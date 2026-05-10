'use client';

import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import type { Table } from '@/data/sharedData';

const FLOOR_SOURCE_WIDTH = 1000;
const FLOOR_SOURCE_HEIGHT = 600;
const FLOOR_WORLD_WIDTH = 14;
const FLOOR_WORLD_DEPTH = 8.4;

function floorToWorld(x: number, y: number) {
    const nx = Math.max(0, Math.min(FLOOR_SOURCE_WIDTH, x)) / FLOOR_SOURCE_WIDTH;
    const ny = Math.max(0, Math.min(FLOOR_SOURCE_HEIGHT, y)) / FLOOR_SOURCE_HEIGHT;
    return {
        x: (nx - 0.5) * FLOOR_WORLD_WIDTH,
        z: (ny - 0.5) * FLOOR_WORLD_DEPTH,
    };
}

function seatOffsets(seats: number) {
    const count = Math.max(2, Math.min(12, seats));
    const radius = 0.78;
    return Array.from({ length: count }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / count;
        return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number];
    });
}

function occupiedSeatIndexes(seatCount: number, occupantCount: number) {
    if (seatCount <= 0 || occupantCount <= 0) return new Set<number>();
    const safeCount = Math.min(seatCount, occupantCount);
    const picks = Array.from({ length: safeCount }).map((_, idx) => Math.floor((idx * seatCount) / safeCount));
    return new Set(picks);
}

function tableStatusMaterial(status: Table['status']) {
    if (status === 'busy') return { top: '#fecdd3', edge: '#e11d48', glow: '#fb7185' };
    if (status === 'reserved') return { top: '#fde68a', edge: '#d97706', glow: '#f59e0b' };
    return { top: '#bbf7d0', edge: '#16a34a', glow: '#4ade80' };
}

export default function LiveOrdersFloor3D({
    tables,
    selectedTableId,
    onSelectTable,
}: {
    tables: Table[];
    selectedTableId: string | null;
    onSelectTable: (id: string | null) => void;
}) {
    return (
        <Canvas
            shadows
            camera={{ position: [7.6, 7.2, 8.2], fov: 44 }}
            className="h-full w-full"
            onPointerMissed={() => onSelectTable(null)}
        >
            <color attach="background" args={['#f1f5f9']} />
            <ambientLight intensity={0.62} />
            <directionalLight
                position={[6, 10, 5]}
                intensity={1}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-near={1}
                shadow-camera-far={35}
                shadow-camera-left={-12}
                shadow-camera-right={12}
                shadow-camera-top={12}
                shadow-camera-bottom={-12}
            />

            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[FLOOR_WORLD_WIDTH, FLOOR_WORLD_DEPTH]} />
                <meshStandardMaterial color="#cbd5e1" roughness={0.9} metalness={0.05} />
            </mesh>

            <gridHelper args={[FLOOR_WORLD_WIDTH, 28, '#64748b', '#94a3b8']} position={[0, 0.01, 0]} />

            <ContactShadows
                opacity={0.34}
                scale={Math.max(FLOOR_WORLD_WIDTH, FLOOR_WORLD_DEPTH) * 1.08}
                blur={2.3}
                far={9}
                resolution={1024}
                color="#0f172a"
                position={[0, 0.02, 0]}
            />

            {tables.map((table) => {
                const pos = floorToWorld(table.x, table.y);
                const selected = selectedTableId === table.id;
                const material = tableStatusMaterial(table.status);
                const chairs = seatOffsets(table.seats);
                const busyOccupantCount = table.status === 'busy' ? Math.max(1, Math.min(4, Math.ceil(table.seats / 3))) : 0;
                const occupiedIndexes = occupiedSeatIndexes(chairs.length, busyOccupantCount);

                return (
                    <group
                        key={`live-floor-${table.id}`}
                        position={[pos.x, 0, pos.z]}
                        onPointerDown={(e) => {
                            e.stopPropagation();
                            onSelectTable(selected ? null : table.id);
                        }}
                    >
                        <mesh castShadow receiveShadow position={[0, 0.34, 0]}>
                            <cylinderGeometry args={[0.72, 0.72, 0.14, 44]} />
                            <meshStandardMaterial color={material.edge} roughness={0.42} metalness={0.08} />
                        </mesh>
                        <mesh castShadow receiveShadow position={[0, 0.4, 0]}>
                            <cylinderGeometry args={[0.62, 0.62, 0.05, 36]} />
                            <meshStandardMaterial color={material.top} roughness={0.52} metalness={0.05} />
                        </mesh>
                        <mesh castShadow receiveShadow position={[0, 0.18, 0]}>
                            <cylinderGeometry args={[0.17, 0.2, 0.34, 20]} />
                            <meshStandardMaterial color="#7c3f1d" roughness={0.56} metalness={0.1} />
                        </mesh>

                        {chairs.map((offset, idx) => {
                            const lookAtCenter = Math.atan2(-offset[0], -offset[2]);
                            return (
                                <group key={`${table.id}-seat-${idx}`} position={offset} rotation={[0, lookAtCenter, 0]}>
                                    <mesh castShadow receiveShadow position={[0, 0.2, 0]}>
                                        <boxGeometry args={[0.26, 0.05, 0.24]} />
                                        <meshStandardMaterial color="#7f4a2b" roughness={0.5} metalness={0.08} />
                                    </mesh>
                                    <mesh castShadow receiveShadow position={[0, 0.42, -0.1]}>
                                        <boxGeometry args={[0.26, 0.34, 0.05]} />
                                        <meshStandardMaterial color="#5b2d15" roughness={0.48} metalness={0.08} />
                                    </mesh>
                                    {[
                                        [0.1, 0.08],
                                        [-0.1, 0.08],
                                        [0.1, -0.08],
                                        [-0.1, -0.08],
                                    ].map((leg, legIdx) => (
                                        <mesh key={`leg-${legIdx}`} castShadow receiveShadow position={[leg[0], 0.08, leg[1]]}>
                                            <boxGeometry args={[0.03, 0.16, 0.03]} />
                                            <meshStandardMaterial color="#3b1d0f" roughness={0.58} metalness={0.1} />
                                        </mesh>
                                    ))}

                                    {occupiedIndexes.has(idx) && (
                                        <group position={[0, 0.26, -0.01]}>
                                            <mesh castShadow receiveShadow position={[0, 0.09, 0]}>
                                                <boxGeometry args={[0.11, 0.16, 0.08]} />
                                                <meshStandardMaterial color="#1e293b" roughness={0.52} metalness={0.18} />
                                            </mesh>
                                            <mesh castShadow receiveShadow position={[0, 0.22, 0.015]}>
                                                <sphereGeometry args={[0.055, 18, 18]} />
                                                <meshStandardMaterial color="#cbd5e1" roughness={0.4} metalness={0.08} />
                                            </mesh>
                                            <mesh castShadow receiveShadow position={[0.022, 0.23, 0.064]}>
                                                <sphereGeometry args={[0.007, 10, 10]} />
                                                <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.6} />
                                            </mesh>
                                            <mesh castShadow receiveShadow position={[-0.022, 0.23, 0.064]}>
                                                <sphereGeometry args={[0.007, 10, 10]} />
                                                <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.6} />
                                            </mesh>
                                            <mesh castShadow receiveShadow position={[0.04, 0.14, 0]} rotation={[0, 0, -0.25]}>
                                                <cylinderGeometry args={[0.012, 0.012, 0.1, 10]} />
                                                <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.2} />
                                            </mesh>
                                            <mesh castShadow receiveShadow position={[-0.04, 0.14, 0]} rotation={[0, 0, 0.25]}>
                                                <cylinderGeometry args={[0.012, 0.012, 0.1, 10]} />
                                                <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.2} />
                                            </mesh>
                                        </group>
                                    )}
                                </group>
                            );
                        })}

                        {table.status === 'reserved' && (
                            <group>
                                <mesh position={[0, 0.5, 0]}>
                                    <cylinderGeometry args={[0.02, 0.02, 0.22, 10]} />
                                    <meshStandardMaterial color="#f59e0b" roughness={0.4} metalness={0.25} />
                                </mesh>
                                <mesh position={[0, 0.67, 0]} rotation={[0, Math.PI / 4, 0]}>
                                    <boxGeometry args={[0.1, 0.1, 0.1]} />
                                    <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.42} />
                                </mesh>
                                <mesh position={[0, 0.52, 0]} rotation={[Math.PI / 2, 0, 0]}>
                                    <torusGeometry args={[0.92, 0.018, 10, 56]} />
                                    <meshBasicMaterial color="#f59e0b" />
                                </mesh>
                            </group>
                        )}

                        {selected && (
                            <mesh position={[0, 0.47, 0]}>
                                <torusGeometry args={[0.88, 0.02, 12, 64]} />
                                <meshBasicMaterial color={material.glow} />
                            </mesh>
                        )}
                    </group>
                );
            })}

            <OrbitControls
                enablePan
                enableZoom
                enableRotate
                enableDamping
                dampingFactor={0.08}
                rotateSpeed={0.75}
                panSpeed={0.7}
                zoomSpeed={0.85}
                target={[0, 0.35, 0]}
                minDistance={5.2}
                maxDistance={22}
                minPolarAngle={Math.PI / 6}
                maxPolarAngle={Math.PI / 2.05}
            />
        </Canvas>
    );
}
