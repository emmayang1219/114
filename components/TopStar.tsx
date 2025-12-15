import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TREE_HEIGHT, CHAOS_RADIUS, COLORS } from '../constants';

interface TopStarProps {
  progress: number;
}

export const TopStar: React.FC<TopStarProps> = ({ progress }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Generate Star Shape
  const starShape = useMemo(() => {
    const shape = new THREE.Shape();
    const points = 5;
    const outerRadius = 1.2;
    const innerRadius = 0.5;
    
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const a = (i / (points * 2)) * Math.PI * 2;
      const x = Math.cos(a + Math.PI / 2) * r; // Rotate to point up
      const y = Math.sin(a + Math.PI / 2) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }, []);

  const extrudeSettings = {
    depth: 0.4,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 2,
  };

  const targetPos = new THREE.Vector3(0, TREE_HEIGHT + 0.5, 0);
  const chaosPos = new THREE.Vector3(0, CHAOS_RADIUS * 0.8, 0); // Floats high up in chaos

  useFrame((state) => {
    if (!meshRef.current) return;
    
    const dest = progress > 0.5 ? chaosPos : targetPos;
    
    // Smooth movement
    meshRef.current.position.lerp(dest, 0.05);

    // Rotation logic
    if (progress > 0.5) {
       // Spin wildly in chaos
       meshRef.current.rotation.y += 0.05;
       meshRef.current.rotation.z += 0.02;
    } else {
       // Slow majestic spin in tree form
       meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
       meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, 0, 0.1);
       meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, 0, 0.1);
    }
  });

  return (
    <mesh ref={meshRef} position={[0, TREE_HEIGHT, 0]}>
      <extrudeGeometry args={[starShape, extrudeSettings]} />
      <meshStandardMaterial 
        color={COLORS.GOLD} 
        emissive={COLORS.GOLD}
        emissiveIntensity={0.5}
        metalness={1}
        roughness={0.1}
      />
    </mesh>
  );
};