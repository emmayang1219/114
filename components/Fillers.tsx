import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FILLER_COUNT, TREE_HEIGHT, TREE_RADIUS_BASE, CHAOS_RADIUS, COLORS } from '../constants';

interface FillersProps {
  progress: number;
}

export const Fillers: React.FC<FillersProps> = ({ progress }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = new THREE.Object3D();
  
  // Data for each instance
  const data = useMemo(() => {
    return Array.from({ length: FILLER_COUNT }).map((_, i) => {
      // Target Tree Position - DISTRIBUTED INSIDE THE VOLUME
      const h = Math.random() * (TREE_HEIGHT - 1.5) + 1; 
      const relativeH = h / TREE_HEIGHT;
      const radiusAtH = TREE_RADIUS_BASE * (1 - relativeH);
      
      // Fill the volume: Random radius from center up to 85% of surface
      const r = Math.random() * radiusAtH * 0.85; 
      const theta = Math.random() * Math.PI * 2;
      
      const targetPos = new THREE.Vector3(
        r * Math.cos(theta),
        h,
        r * Math.sin(theta)
      );

      // Chaos Position
      const u = Math.random();
      const v = Math.random();
      const theta2 = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r2 = Math.cbrt(Math.random()) * CHAOS_RADIUS;
      const chaosPos = new THREE.Vector3(
        r2 * Math.sin(phi) * Math.cos(theta2),
        r2 * Math.sin(phi) * Math.sin(theta2) + 5,
        r2 * Math.cos(phi)
      );

      // Random Colors between Red and Yellow/Gold
      const mixRatio = Math.random(); // 0 is Red, 1 is Gold
      const color = new THREE.Color().lerpColors(COLORS.RIBBON_RED, COLORS.GOLD, mixRatio);

      // Sizes
      const scale = Math.random() * 0.4 + 0.2; // Box scale
      const speed = Math.random() * 0.05 + 0.01;
      
      // Store initial rotation to avoid accumulating error
      const initialRotation = new THREE.Euler(
        Math.random() * Math.PI, 
        Math.random() * Math.PI, 
        Math.random() * Math.PI
      );

      return { targetPos, chaosPos, scale, color, speed, currentPos: chaosPos.clone(), initialRotation };
    });
  }, []);

  useLayoutEffect(() => {
    if (meshRef.current) {
        data.forEach((d, i) => {
            tempObject.position.copy(d.targetPos);
            tempObject.scale.setScalar(d.scale);
            tempObject.rotation.copy(d.initialRotation);
            tempObject.updateMatrix();
            meshRef.current!.setMatrixAt(i, tempObject.matrix);
            meshRef.current!.setColorAt(i, d.color);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [data]);

  useFrame((state) => {
    if (!meshRef.current) return;

    const time = state.clock.elapsedTime;

    data.forEach((d, i) => {
      const dest = progress > 0.5 ? d.chaosPos : d.targetPos;
      
      // Lerp current position
      d.currentPos.lerp(dest, d.speed);
      
      tempObject.position.copy(d.currentPos);
      
      // Continuous rotation based on TIME, not accumulation
      // This fixes the flickering/seizure effect
      tempObject.rotation.set(
        d.initialRotation.x + time * 0.5,
        d.initialRotation.y + time * 0.5,
        d.initialRotation.z
      );
      
      tempObject.scale.setScalar(d.scale);
      
      tempObject.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObject.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, FILLER_COUNT]}>
      <boxGeometry args={[1, 1, 1]} /> 
      <meshStandardMaterial 
        roughness={0.3} 
        metalness={0.8}
      />
    </instancedMesh>
  );
};