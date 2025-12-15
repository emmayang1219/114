import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { IGeminiService, GestureData, TreeState } from '../types';

// Helper to encode image data
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      // Remove data url prefix
      resolve(base64data.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export class GeminiLiveService implements IGeminiService {
  private session: any = null;
  private intervalId: number | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private ai: GoogleGenAI | null = null;
  private isFallbackActive = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  async connect(videoElement: HTMLVideoElement, onData: (data: GestureData) => void): Promise<void> {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("No API Key found. Gesture control disabled.");
      return;
    }

    this.ai = new GoogleGenAI({ apiKey });
    this.isFallbackActive = false;

    // System instruction to force JSON output describing the hand state
    const systemInstruction = `
    You are a visual control system for an interactive art installation.
    Analyze the video stream (or image) of the user.
    
    1. Detect if the user's hand is OPEN (fingers spread) or CLOSED (fist).
    2. OPEN hand means "UNLEASH" (Chaos). CLOSED hand means "FORM" (Tree).
    3. Calculate the approximate centroid of the hand in the frame.
       Map X from -1 (left) to 1 (right).
       Map Y from -1 (bottom) to 1 (top).
    
    Output ONLY valid JSON.
    Format:
    { "state": "CHAOS" | "FORMED", "x": number, "y": number }
    
    If no hand is detected, default to { "state": "FORMED", "x": 0, "y": 0 }.
    `;

    try {
      // 1. Try connecting to the Live API (Low Latency WebSocket)
      this.session = await this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.TEXT], // We want text (JSON) back
          systemInstruction: systemInstruction,
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected (WebSocket)");
            this.startStreamingLive(videoElement, onData);
          },
          onmessage: (msg: LiveServerMessage) => {
            if (msg.serverContent?.modelTurn?.parts) {
              for (const part of msg.serverContent.modelTurn.parts) {
                if (part.text) {
                  try {
                    const match = part.text.match(/\{.*\}/);
                    if (match) {
                      const json = JSON.parse(match[0]);
                      onData({
                        state: json.state === 'CHAOS' ? TreeState.CHAOS : TreeState.FORMED,
                        handX: typeof json.x === 'number' ? json.x : 0,
                        handY: typeof json.y === 'number' ? json.y : 0,
                      });
                    }
                  } catch (e) {
                    // Ignore parsing errors from partial chunks
                  }
                }
              }
            }
          },
          onclose: () => console.log("Gemini Live Closed"),
          onerror: (e) => {
            console.warn("Gemini Live Error (likely Region Not Supported), switching to fallback...", e);
            this.switchToFallback(videoElement, onData, systemInstruction);
          },
        },
      });
    } catch (error) {
      console.warn("Gemini Live API failed to connect. Falling back to Standard Polling.", error);
      this.switchToFallback(videoElement, onData, systemInstruction);
    }
  }

  private switchToFallback(videoElement: HTMLVideoElement, onData: (data: GestureData) => void, instruction: string) {
    if (this.isFallbackActive) return;
    this.isFallbackActive = true;

    // Cleanup Live Session if it exists partially
    if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
    }
    if (this.session) {
        // Try close, but ignore errors if already closed
        try { if(typeof this.session.close === 'function') this.session.close(); } catch(e) {}
        this.session = null;
    }

    this.startPollingFallback(videoElement, onData, instruction);
  }

  // Live API Streaming Strategy
  private startStreamingLive(videoEl: HTMLVideoElement, onData: any) {
    this.intervalId = window.setInterval(async () => {
      // If we switched to fallback, stop this loop
      if (this.isFallbackActive || !this.session || !this.ctx || !videoEl.videoWidth) return;

      this.canvas.width = videoEl.videoWidth / 4; 
      this.canvas.height = videoEl.videoHeight / 4;
      this.ctx.drawImage(videoEl, 0, 0, this.canvas.width, this.canvas.height);

      this.canvas.toBlob(async (blob) => {
        if (blob && this.session && !this.isFallbackActive) {
          const base64 = await blobToBase64(blob);
          try {
              this.session.sendRealtimeInput({
                media: {
                  mimeType: 'image/jpeg',
                  data: base64
                }
              });
          } catch(e) {
              // If send fails, it might be closed. Let onError handle it or ignore.
          }
        }
      }, 'image/jpeg', 0.5);

    }, 800); 
  }

  // Fallback Polling Strategy
  private startPollingFallback(videoEl: HTMLVideoElement, onData: (data: GestureData) => void, systemInstruction: string) {
    // Slower interval for HTTP requests (1.5s) to avoid rate limits
    this.intervalId = window.setInterval(async () => {
      if (!this.ai || !this.ctx || !videoEl.videoWidth) return;

      this.canvas.width = videoEl.videoWidth / 4;
      this.canvas.height = videoEl.videoHeight / 4;
      this.ctx.drawImage(videoEl, 0, 0, this.canvas.width, this.canvas.height);

      const base64Data = this.canvas.toDataURL('image/jpeg', 0.6).split(',')[1];

      try {
        const response = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash', // Standard multimodal model
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
                { text: "Analyze hand state. Return JSON only." }
              ]
            }
          ],
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: 'application/json' 
          }
        });

        if (response.text) {
          const json = JSON.parse(response.text);
          onData({
            state: json.state === 'CHAOS' ? TreeState.CHAOS : TreeState.FORMED,
            handX: typeof json.x === 'number' ? json.x : 0,
            handY: typeof json.y === 'number' ? json.y : 0,
          });
        }
      } catch (e) {
        console.error("Fallback inference error", e);
      }
    }, 1500);
  }

  disconnect() {
    this.isFallbackActive = false;
    if (this.intervalId) clearInterval(this.intervalId);
    if(this.session && typeof this.session.close === 'function') {
        try { this.session.close(); } catch(e) {}
    }
    this.session = null;
    this.ai = null;
  }
}

export const geminiService = new GeminiLiveService();