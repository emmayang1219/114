import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FOLIAGE_COUNT, TREE_HEIGHT, TREE_RADIUS_BASE, CHAOS_RADIUS, COLORS } from '../constants';

const FoliageShaderMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uProgress: { value: 0 }, // 0 = Formed, 1 = Chaos
    uColorBase: { value: COLORS.EMERALD },
    uColorTip: { value: new THREE.Color('#2E8B57') },
    uGold: { value: COLORS.GOLD },
  },
  vertexShader: `
    uniform float uTime;
    uniform float uProgress;
    attribute vec3 aTargetPos;
    attribute vec3 aChaosPos;
    attribute float aRandom;
    
    varying vec2 vUv;
    varying float vRandom;

    void main() {
      vUv = uv;
      vRandom = aRandom;
      
      // Interpolate between Tree (Target) and Chaos
      vec3 pos = mix(aTargetPos, aChaosPos, uProgress);
      
      // Add some wind/breathing movement
      float wind = sin(uTime * 2.0 + aRandom * 10.0) * 0.1;
      pos.x += wind;
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      
      // Size attenuation
      gl_PointSize = (4.0 * (1.0 + uProgress * 2.0)) * (20.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 uColorBase;
    uniform vec3 uColorTip;
    uniform vec3 uGold;
    uniform float uProgress;
    varying float vRandom;

    void main() {
      // Circular particle
      vec2 xy = gl_PointCoord.xy - vec2(0.5);
      float ll = length(xy);
      if(ll > 0.5) discard;

      // Color mixing: mostly green, some gold sparkles
      vec3 color = mix(uColorBase, uColorTip, vRandom);
      
      // Add gold sparkle occasionally based on random ID
      if (vRandom > 0.9) {
        color = mix(color, uGold, 0.8);
      }
      
      // When in chaos mode (uProgress > 0.5), glitter more
      float sparkle = sin(vRandom * 100.0) > 0.95 ? 1.0 : 0.0;
      color += sparkle * uProgress * uGold;

      gl_FragColor = vec4(color, 1.0);
    }
  `
};

interface FoliageProps {
  progress: number; // 0 to 1
}

export const Foliage: React.FC<FoliageProps> = ({ progress }) => {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  
  const { positions, chaosPositions, randoms } = useMemo(() => {
    const pos = new Float32Array(FOLIAGE_COUNT * 3);
    const chaos = new Float32Array(FOLIAGE_COUNT * 3);
    const rands = new Float32Array(FOLIAGE_COUNT);

    for (let i = 0; i < FOLIAGE_COUNT; i++) {
      // 1. Target (Tree) Position
      // Spiral distribution for cone
      const h = Math.random() * TREE_HEIGHT; // Height from 0 to TREE_HEIGHT
      const relativeH = h / TREE_HEIGHT;
      const radiusAtH = TREE_RADIUS_BASE * (1 - relativeH);
      const theta = Math.random() * Math.PI * 2 * 10; // Wraps around
      const r = Math.sqrt(Math.random()) * radiusAtH; // Uniform disk at height
      
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const y = h; // Shift up

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      // 2. Chaos Position (Random Sphere)
      const u = Math.random();
      const v = Math.random();
      const theta2 = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r2 = Math.cbrt(Math.random()) * CHAOS_RADIUS; // Uniform sphere
      
      chaos[i * 3] = r2 * Math.sin(phi) * Math.cos(theta2);
      chaos[i * 3 + 1] = r2 * Math.sin(phi) * Math.sin(theta2) + 10; // Center chaos higher
      chaos[i * 3 + 2] = r2 * Math.cos(phi);

      rands[i] = Math.random();
    }
    return { positions: pos, chaosPositions: chaos, randoms: rands };
  }, []);

  useFrame((state) => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      // Smooth lerp for the shader uniform
      shaderRef.current.uniforms.uProgress.value = THREE.MathUtils.lerp(
        shaderRef.current.uniforms.uProgress.value,
        progress,
        0.1
      );
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position" // This is actually 'aTargetPos' logic in shader, but Three needs 'position' for bounding box usually
          count={FOLIAGE_COUNT}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aTargetPos"
          count={FOLIAGE_COUNT}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aChaosPos"
          count={FOLIAGE_COUNT}
          array={chaosPositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={FOLIAGE_COUNT}
          array={randoms}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={shaderRef}
        args={[FoliageShaderMaterial]}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
