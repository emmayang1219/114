import React, { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ORNAMENT_COUNT, TREE_HEIGHT, TREE_RADIUS_BASE, CHAOS_RADIUS, COLORS } from '../constants';

interface OrnamentsProps {
  progress: number;
}

export const Ornaments: React.FC<OrnamentsProps> = ({ progress }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = new THREE.Object3D();
  const tempColor = new THREE.Color();
  
  // Data for each instance
  const data = useMemo(() => {
    return Array.from({ length: ORNAMENT_COUNT }).map((_, i) => {
      // Target Tree Position
      const h = Math.random() * (TREE_HEIGHT - 1) + 1; // Avoid very bottom
      const relativeH = h / TREE_HEIGHT;
      const radiusAtH = TREE_RADIUS_BASE * (1 - relativeH);
      // Place on surface mostly
      const r = radiusAtH * (0.8 + Math.random() * 0.4); 
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
        r2 * Math.sin(phi) * Math.sin(theta2) + 10,
        r2 * Math.cos(phi)
      );

      // Properties
      const scale = Math.random() * 0.4 + 0.2;
      const type = Math.random() > 0.7 ? 'GIFT' : 'BALL';
      const color = type === 'GIFT' 
        ? (Math.random() > 0.5 ? COLORS.RIBBON_RED : COLORS.GOLD)
        : (Math.random() > 0.5 ? COLORS.GOLD : COLORS.SILVER);

      // Physics weight (light things move fast, heavy things move slow)
      const speed = Math.random() * 0.05 + 0.02;

      return { targetPos, chaosPos, scale, color, type, speed, currentPos: chaosPos.clone() };
    });
  }, []);

  useLayoutEffect(() => {
    if (meshRef.current) {
        data.forEach((d, i) => {
            tempObject.position.copy(d.targetPos);
            tempObject.scale.setScalar(d.scale);
            tempObject.updateMatrix();
            meshRef.current!.setMatrixAt(i, tempObject.matrix);
            meshRef.current!.setColorAt(i, d.color);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [data]);

  useFrame(() => {
    if (!meshRef.current) return;

    data.forEach((d, i) => {
      // Determine destination based on global progress
      // But we add individual lag based on 'speed'
      const dest = progress > 0.5 ? d.chaosPos : d.targetPos;
      
      // Lerp current position
      d.currentPos.lerp(dest, d.speed);
      
      // Floating effect when in chaos
      if (progress > 0.5) {
         d.currentPos.y += Math.sin(Date.now() * 0.001 + i) * 0.02;
      }

      tempObject.position.copy(d.currentPos);
      
      // Rotate objects
      tempObject.rotation.x += 0.01;
      tempObject.rotation.y += 0.01;
      
      tempObject.scale.setScalar(d.scale);
      tempObject.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObject.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, ORNAMENT_COUNT]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial 
        roughness={0.1} 
        metalness={0.9} 
        emissive={COLORS.GOLD}
        emissiveIntensity={0.2}
      />
    </instancedMesh>
  );
};
