'use client';

import { Component, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import type { MotionValue } from 'motion/react';
import * as THREE from 'three';
import { createBrandSculpture } from '@/lib/brand-sculpture';
import { disposeRig } from '@/lib/avatar-rig';

type Props = {
  running: boolean;
  rotation: number;
  pointer: RefObject<{ x: number; y: number }>;
  onReady: () => void;
  progress: MotionValue<number>;
  study: number;
};

function Sculpture({ running, rotation, pointer, onReady, progress, study }: Props) {
  const [sculpture] = useState(createBrandSculpture);
  const [archive] = useState(() =>
    Array.from({ length: 8 }, (_, index) => {
      const object = sculpture.front.clone(true);
      object.name = `Archive study ${index + 1}`;
      object.traverse((child) => {
        if (child.name.startsWith('Finger')) child.rotation.x += (index % 3) * 0.22;
      });
      sculpture.root.add(object);
      return object;
    }),
  );
  const model = useRef(sculpture);
  const time = useRef(0);
  const { size, invalidate, camera } = useThree();
  const compact = size.width < 760;
  useEffect(() => {
    onReady();
    invalidate();
    return () => disposeRig(sculpture.root);
  }, [sculpture, onReady, invalidate]);
  useEffect(() => {
    invalidate();
  }, [running, rotation, compact, study, invalidate]);
  useEffect(() => progress.on('change', () => invalidate()), [progress, invalidate]);
  useFrame((_, delta) => {
    const sculpture = model.current;
    if (running) time.current += Math.min(delta, 0.05);
    const t = time.current;
    const scroll = progress.get();
    const articulation = study === 1 ? 0.32 : 0;
    const connection = study === 2 ? 0.5 : 0;
    sculpture.root.position.set(0, 0.3, 0);
    sculpture.root.scale.setScalar(compact ? 0.67 : 1);
    sculpture.root.rotation.y = scroll * 0.6;
    sculpture.front.scale.setScalar(0.58 + scroll * 0.3);
    sculpture.back.scale.setScalar(0.55 + scroll * 0.2);
    sculpture.front.position.set(2.9 - connection * 0.2, 0.25 + scroll * 0.3, 0.6);
    sculpture.back.position.set(-2.8 + connection * 0.2, -0.1, -0.4);
    archive.forEach((object, index) => {
      const angle = (index / archive.length) * Math.PI * 2 + rotation + scroll * 1.2;
      const radius = 2.65 + Math.sin(scroll * Math.PI) * 0.65;
      object.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * 1.85,
        Math.sin(angle * 2) * 1.3 - 1.2,
      );
      object.rotation.set(Math.sin(angle) * 0.3, -angle + scroll, Math.cos(angle) * 0.3);
      object.scale.setScalar(0.34 + (index % 3) * 0.035);
    });
    sculpture.front.rotation.y =
      -0.38 +
      rotation +
      scroll * 0.65 +
      Math.sin(t * 0.4) * 0.1 +
      (running ? pointer.current.x * 0.12 : 0);
    sculpture.front.rotation.x =
      -0.15 + Math.sin(t * 0.55) * 0.08 + (running ? pointer.current.y * 0.05 : 0);
    sculpture.back.rotation.z = 1.05 - connection + Math.sin(t * 0.45) * 0.08;
    for (const { bone, rest, phase } of sculpture.digits)
      bone.rotation.x = rest + articulation + (Math.sin(t * 0.65 + phase) + 1) * 0.045;
    camera.position.set(
      running ? pointer.current.x * 0.08 : 0,
      0.15 + scroll * 0.35,
      8.8 - scroll * 1.3,
    );
  });
  return <primitive object={sculpture.root} dispose={null} />;
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="hero-scene-fallback" role="status">
          3D artwork unavailable. The studio and phrase library are still accessible.
        </div>
      );
    return this.props.children;
  }
}

export default function HeroScene(props: Props) {
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<{ x: number; rotation: number } | null>(null);
  return (
    <SceneBoundary>
      <div
        style={{ position: 'absolute', inset: 0 }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          dragStart.current = { x: event.clientX, rotation: drag };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragStart.current)
            setDrag(dragStart.current.rotation + (event.clientX - dragStart.current.x) * 0.006);
        }}
        onPointerUp={() => {
          dragStart.current = null;
        }}
        onPointerCancel={() => {
          dragStart.current = null;
        }}
      >
        <Canvas
          aria-label="Original silver and graphite mechanical hand sculpture. Concept artwork, not ISL."
          role="img"
          dpr={[1, 1.5]}
          frameloop={props.running ? 'always' : 'demand'}
          camera={{ position: [0, 0.15, 7.8], fov: 37 }}
          gl={{
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
            powerPreference: 'low-power',
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
          fallback={
            <div className="hero-scene-fallback">
              3D requires WebGL. Explore the accessible studio below.
            </div>
          }
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[0, 4, 5]} intensity={2.5} color="#f5f6ff" />
          <directionalLight position={[5, 0, 2]} intensity={2} color="#ff957e" />
          <directionalLight position={[-4, 1, 0]} intensity={2.5} color="#b5e7ff" />
          <Environment resolution={128} frames={1}>
            <Lightformer
              form="rect"
              intensity={4}
              position={[0, 4, 2]}
              scale={[10, 3, 1]}
              rotation={[Math.PI / 2, 0, 0]}
            />
            <Lightformer
              form="rect"
              intensity={3}
              position={[-4, 0, 3]}
              scale={[2, 8, 1]}
              rotation={[0, Math.PI / 3, 0]}
            />
            <Lightformer
              form="rect"
              intensity={5}
              color="#ffd2c4"
              position={[5, 0, -1]}
              scale={[3, 7, 1]}
              rotation={[0, -Math.PI / 2, 0]}
            />
          </Environment>
          <Sculpture {...props} rotation={props.rotation + drag} />
        </Canvas>
      </div>
    </SceneBoundary>
  );
}
