import React, { useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, Stars, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Foliage } from './Foliage';
import { Ornaments } from './Ornaments';
import { Polaroids } from './Polaroids';
import { Fillers } from './Fillers';
import { TopStar } from './TopStar';
import { TreeState, GestureData } from '../types';
import { CAMERA_POS } from '../constants';

interface ExperienceProps {
  gestureData: GestureData;
  customPhotos: string[];
}

const Rig: React.FC<{ gestureData: GestureData }> = ({ gestureData }) => {
  const { camera } = useThree();
  
  useFrame(() => {
    // Smooth camera movement based on hand position
    // Map -1..1 to angle offsets
    const targetX = CAMERA_POS.x + (gestureData.handX * 10); // Pan left/right
    const targetY = CAMERA_POS.y + (gestureData.handY * 5);  // Pan up/down
    
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.05);
    camera.lookAt(0, 6, 0); // Look at center of tree height (adjusted for smaller tree)
  });
  return null;
};

export const Experience: React.FC<ExperienceProps> = ({ gestureData, customPhotos }) => {
  // Lerp the state progress for smooth transitions
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // If CHAOS, target is 1. If FORMED, target is 0.
    const target = gestureData.state === TreeState.CHAOS ? 1 : 0;
    
    let frameId: number;
    const animate = () => {
      setProgress(prev => {
        const diff = target - prev;
        if (Math.abs(diff) < 0.001) return target;
        return prev + diff * 0.05;
      });
      frameId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frameId);
  }, [gestureData.state]);

  return (
    <Canvas
      gl={{ antialias: false, toneMapping: THREE.ReinhardToneMapping, toneMappingExposure: 1.5 }}
      dpr={[1, 2]}
    >
      <PerspectiveCamera makeDefault position={CAMERA_POS.toArray()} fov={50} />
      <Rig gestureData={gestureData} />
      
      <color attach="background" args={['#050505']} />
      
      <ambientLight intensity={0.5} color="#ffd700" />
      <spotLight position={[10, 20, 10]} angle={0.3} penumbra={1} intensity={2} color="#fff" castShadow />
      <pointLight position={[-10, 5, -10]} intensity={1} color="#004225" />

      {/* The Christmas Tree Components */}
      <group position={[0, 0, 0]}>
         <Fillers progress={progress} />
         <Foliage progress={progress} />
         <Ornaments progress={progress} />
         <Polaroids progress={progress} photos={customPhotos} />
         <TopStar progress={progress} />
         
         {/* Tree Trunk Base */}
         <mesh position={[0, 1, 0]}>
           <cylinderGeometry args={[1, 1.5, 2, 8]} />
           <meshStandardMaterial color="#3E2723" />
         </mesh>
      </group>

      {/* Environment & FX */}
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <Environment preset="lobby" background={false} />
      
      <EffectComposer disableNormalPass>
        <Bloom 
          luminanceThreshold={0.8} 
          mipmapBlur 
          intensity={1.2} 
          radius={0.4}
        />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>
    </Canvas>
  );
};