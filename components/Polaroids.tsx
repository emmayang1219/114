import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Image } from '@react-three/drei';
import * as THREE from 'three';
import { POLAROID_COUNT, TREE_HEIGHT, TREE_RADIUS_BASE, CHAOS_RADIUS, COLORS, CAMERA_POS } from '../constants';

interface PolaroidsProps {
    progress: number;
    photos: string[];
}

const PolaroidItem: React.FC<{ url: string; index: number; progress: number; total: number }> = ({ url, index, progress, total }) => {
    const groupRef = useRef<THREE.Group>(null);
    const timeOffset = useRef(Math.random() * 100);
    const { camera } = useThree();
    
    const { targetPos, galleryPos, speed } = useMemo(() => {
        // 1. Tree Position (Randomized Surface Distribution)
        // Previous spiral logic caused clustering. Using pure random spherical coords constrained to cone.
        
        // Random height
        const h = Math.random() * (TREE_HEIGHT - 2) + 1.5; 
        const relativeH = h / TREE_HEIGHT;
        const radiusAtH = TREE_RADIUS_BASE * (1 - relativeH);
        
        // Push slightly outside the leaves
        const r = radiusAtH + 0.6; 
        
        // Fully random angle to avoid stacking
        const theta = Math.random() * Math.PI * 2;
        
        const targetPos = new THREE.Vector3(r * Math.cos(theta), h, r * Math.sin(theta));
        
        // 2. Gallery Position (Grid in front of camera)
        // Camera is at (0, 3, 20). We want the grid at z ~ 14 (closer to camera)
        const cols = 6;
        const rows = Math.ceil(total / cols);
        const col = index % cols;
        const row = Math.floor(index / cols);
        
        const spacingX = 2.5;
        const spacingY = 3.0;
        
        // Center the grid
        const gridWidth = (cols - 1) * spacingX;
        const gridHeight = (rows - 1) * spacingY;
        
        const galleryPos = new THREE.Vector3(
            (col * spacingX) - (gridWidth / 2),
            (row * spacingY) - (gridHeight / 2) + 3, // +3 to lift it up to eye level
            14 // Fixed Z depth in front of chaos
        );

        return { 
            targetPos, 
            galleryPos, 
            speed: 0.03 + Math.random() * 0.02,
        };
    }, [index, total]);

    useFrame((state) => {
        if (!groupRef.current) return;
        
        // When progress > 0.5, we move to galleryPos instead of random chaos
        const dest = progress > 0.5 ? galleryPos : targetPos;
        
        // Smooth position
        groupRef.current.position.lerp(dest, speed);
        
        if (progress > 0.5) {
            // Gallery Mode: Face the camera (Rotation 0,0,0 usually works if camera is at Z+)
            // Smoothly rotate to face forward
            groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, 0.1);
            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, 0.1);
            groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, 0.1);
        } else {
             // Formed mode: Hang and sway
             const angleToCenter = Math.atan2(groupRef.current.position.x, groupRef.current.position.z);
             const targetRotY = angleToCenter;
             const sway = Math.sin(state.clock.elapsedTime * 2 + timeOffset.current) * 0.1;
             
             groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, sway, 0.1); 
             groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, sway * 0.5, 0.1); 
             groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.1);
        }
    });

    return (
        <group ref={groupRef}>
            {/* The Photo Frame Group */}
            <group position={[0, 0, 0]}>
                {/* Square Frame - Christmas Orange */}
                <mesh position={[0, 0, -0.01]}>
                    <boxGeometry args={[1.3, 1.3, 0.05]} />
                    <meshStandardMaterial color="#FF8C00" roughness={0.4} metalness={0.2} />
                </mesh>
                
                {/* Image - Square */}
                <Image 
                    url={url} 
                    scale={[1.1, 1.1]} 
                    position={[0, 0, 0.03]} 
                    transparent
                />
            </group>
        </group>
    );
}

export const Polaroids: React.FC<PolaroidsProps> = ({ progress, photos }) => {
    const images = useMemo(() => {
        if (photos && photos.length > 0) {
            return photos;
        }
        return Array.from({ length: POLAROID_COUNT }).map((_, i) => `https://picsum.photos/300/300?random=${i}`);
    }, [photos]);

    return (
        <group>
            {Array.from({ length: POLAROID_COUNT }).map((_, i) => {
                const imgUrl = images[i % images.length];
                return (
                    <PolaroidItem 
                        key={`${i}-${imgUrl}`} 
                        index={i} 
                        url={imgUrl} 
                        progress={progress} 
                        total={POLAROID_COUNT}
                    />
                );
            })}
        </group>
    );
};