import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import type { Mesh, Points, BufferGeometry, NormalBufferAttributes } from 'three';
import * as THREE from 'three';

function TorusKnotWire() {
    const meshRef = useRef<Mesh>(null);

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        meshRef.current.rotation.x = clock.getElapsedTime() * 0.04;
        meshRef.current.rotation.y = clock.getElapsedTime() * 0.06;
    });

    return (
        <Float speed={0.8} rotationIntensity={0.15} floatIntensity={0.3}>
            <mesh ref={meshRef} scale={2.2}>
                <torusKnotGeometry args={[1, 0.35, 200, 24, 2, 3]} />
                <meshBasicMaterial
                    wireframe
                    color="#6366F1"
                    transparent
                    opacity={0.07}
                />
            </mesh>
        </Float>
    );
}

function ParticleField() {
    const pointsRef = useRef<Points<BufferGeometry<NormalBufferAttributes>>>(null);
    const count = 600;

    const [positions, sizes] = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const sz = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 14;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
            sz[i] = Math.random() * 2 + 0.5;
        }
        return [pos, sz];
    }, []);

    useFrame(({ clock }) => {
        if (!pointsRef.current) return;
        pointsRef.current.rotation.y = clock.getElapsedTime() * 0.015;
        pointsRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.01) * 0.05;
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                />
                <bufferAttribute
                    attach="attributes-size"
                    args={[sizes, 1]}
                />
            </bufferGeometry>
            <pointsMaterial
                color="#818CF8"
                size={0.025}
                transparent
                opacity={0.35}
                sizeAttenuation
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
}

function InnerRing() {
    const ref = useRef<Mesh>(null);
    useFrame(({ clock }) => {
        if (!ref.current) return;
        ref.current.rotation.z = -clock.getElapsedTime() * 0.03;
        ref.current.rotation.x = Math.PI / 2 + Math.sin(clock.getElapsedTime() * 0.02) * 0.1;
    });
    return (
        <mesh ref={ref} scale={3.5}>
            <torusGeometry args={[1, 0.005, 16, 120]} />
            <meshBasicMaterial color="#6366F1" transparent opacity={0.12} />
        </mesh>
    );
}

export default function MathWireframe() {
    return (
        <div className="absolute inset-0 z-0" aria-hidden="true">
            <Canvas
                camera={{ position: [0, 0, 6], fov: 50 }}
                dpr={[1, 1.5]}
                gl={{
                    antialias: false,
                    alpha: true,
                    powerPreference: 'low-power',
                }}
                style={{ background: 'transparent' }}
            >
                <TorusKnotWire />
                <ParticleField />
                <InnerRing />
            </Canvas>
        </div>
    );
}
