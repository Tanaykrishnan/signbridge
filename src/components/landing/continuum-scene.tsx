'use client';

import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import type { MotionValue } from 'motion/react';
import * as THREE from 'three';

type Props = {
  progress: MotionValue<number>;
  paused: boolean;
  active: boolean;
  rotation: number;
  onReady: () => void;
};

// Shared topology lets the GPU morph one sculpture continuously between its five forms.
class SignalCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private form: number,
    private strand: number,
  ) {
    super();
  }
  getPoint(value: number, target = new THREE.Vector3()) {
    const t = value * Math.PI * 2;
    const phase = this.strand * 0.17;
    const radius = 1.18 + 0.43 * Math.cos(3 * t + phase);
    switch (this.form) {
      case 1:
        return target.set(
          2.05 * Math.cos(t),
          0.5 * Math.sin(t * 3 + phase),
          0.52 * Math.sin(t) + this.strand * 0.16,
        );
      case 2:
        return target.set(
          (0.8 + this.strand * 0.17) * Math.cos(t * 2),
          1.8 * Math.sin(t),
          0.7 * Math.sin(t * 2 + phase),
        );
      case 3:
        return target.set(
          1.8 * Math.cos(t),
          1.25 * Math.sin(t) + 0.25 * Math.cos(2 * t),
          0.5 * Math.sin(t * 2 + phase),
        );
      case 4:
        return target.set(
          (1.8 * Math.cos(t)) / (1 + Math.sin(t) ** 2),
          (1.55 * Math.cos(t) * Math.sin(t)) / (1 + Math.sin(t) ** 2),
          0.55 * Math.sin(t + phase),
        );
      default:
        return target.set(
          radius * Math.cos(2 * t),
          radius * Math.sin(2 * t),
          0.65 * Math.sin(3 * t + phase),
        );
    }
  }
}

function ribbonGeometry(strand: number, edge: boolean) {
  const forms = Array.from({ length: 5 }, (_, form) => {
    const curve = new SignalCurve(form, strand);
    const geometry = new THREE.TubeGeometry(curve, 240, 1, 12, true);
    const positions = geometry.getAttribute('position');
    const frames = curve.computeFrenetFrames(240, true);
    const point = new THREE.Vector3();
    for (let i = 0; i <= 240; i++) {
      curve.getPointAt(i / 240, point);
      for (let j = 0; j <= 12; j++) {
        const theta = (j / 12) * Math.PI * 2;
        const u = Math.cos(theta) * (edge ? 0.035 : 0.22) + strand * 0.24 + (edge ? 0.225 : 0);
        const v = Math.sin(theta) * (edge ? 0.035 : 0.078);
        const normal = frames.normals[i];
        const binormal = frames.binormals[i];
        positions.setXYZ(
          i * 13 + j,
          point.x + normal.x * u + binormal.x * v,
          point.y + normal.y * u + binormal.y * v,
          point.z + normal.z * u + binormal.z * v,
        );
      }
    }
    geometry.computeVertexNormals();
    return geometry;
  });
  const base = forms[0];
  base.morphAttributes.position = forms
    .slice(1)
    .map((geometry) => geometry.getAttribute('position').clone());
  base.morphAttributes.normal = forms
    .slice(1)
    .map((geometry) => geometry.getAttribute('normal').clone());
  forms.slice(1).forEach((geometry) => geometry.dispose());
  base.computeBoundingSphere();
  return base;
}

function Sculpture({ progress, paused, active, rotation, onReady }: Props) {
  const group = useRef<THREE.Group>(null);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const geometries = useMemo(
    () => [ribbonGeometry(0, false), ribbonGeometry(1, false), ribbonGeometry(0, true)],
    [],
  );
  const time = useRef(0);
  const smooth = useRef(progress.get());
  const { invalidate, viewport, size } = useThree();
  useEffect(() => {
    onReady();
    invalidate();
    return () => geometries.forEach((geometry) => geometry.dispose());
  }, [geometries, invalidate, onReady]);
  useEffect(() => progress.on('change', invalidate), [progress, invalidate]);
  useEffect(() => {
    invalidate();
  }, [paused, active, rotation, invalidate]);
  useFrame(({ gl }, delta) => {
    if (!group.current) return;
    const step = Math.min(delta, 0.05);
    if (!paused && active) time.current += step;
    smooth.current = paused
      ? progress.get()
      : THREE.MathUtils.damp(smooth.current, progress.get(), 7, Math.min(delta, 0.5));
    const p = smooth.current;
    const form = p * 4;
    const from = Math.min(3, Math.floor(form));
    const blend = THREE.MathUtils.smoothstep(form - from, 0, 1);
    meshes.current.forEach((mesh) => {
      if (!mesh?.morphTargetInfluences) return;
      mesh.morphTargetInfluences.fill(0);
      if (from > 0) mesh.morphTargetInfluences[from - 1] = 1 - blend;
      mesh.morphTargetInfluences[from] = blend;
    });
    const stops = [0.235, -0.23, 0.23, -0.24, 0.2];
    const x = THREE.MathUtils.lerp(stops[from], stops[from + 1], blend);
    const compact = size.width <= 900;
    group.current.position.set(compact ? 0 : viewport.width * x, compact ? 1.4 : 0, 0);
    group.current.scale.setScalar(compact ? 0.43 : Math.min(1.2, viewport.height / 5.7));
    group.current.rotation.set(
      0.16 + Math.sin(time.current * 0.23) * 0.08,
      rotation + p * Math.PI * 1.7 + Math.sin(time.current * 0.19) * 0.15,
      -0.24 + Math.sin(p * Math.PI * 2) * 0.25,
    );
    gl.domElement.setAttribute('data-progress', p.toFixed(3));
    gl.domElement.setAttribute('data-form', String(from));
  });
  return (
    <group ref={group}>
      {geometries.map((geometry, index) => (
        <mesh
          key={index}
          args={[geometry]}
          geometry={geometry}
          ref={(mesh) => {
            meshes.current[index] = mesh;
          }}
          frustumCulled={false}
        >
          <meshPhysicalMaterial
            color={index === 2 ? '#dfff00' : index === 1 ? '#a7b5a9' : '#e1e5dd'}
            metalness={index === 2 ? 0.35 : 0.96}
            roughness={index === 2 ? 0.23 : 0.2}
            clearcoat={1}
            clearcoatRoughness={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="status">3D preview unavailable. All studio links remain available.</div>
    ) : (
      this.props.children
    );
  }
}

export default function ContinuumScene(props: Props) {
  return (
    <SceneBoundary>
      <Canvas
        style={{ position: 'absolute', inset: 0 }}
        aria-label="Continuous sculptural ribbon that transforms from a knot into a wave, a helix, a bridge and an infinity loop as you scroll. Concept artwork."
        role="img"
        dpr={[1, 1.5]}
        frameloop={!props.paused && props.active ? 'always' : 'demand'}
        camera={{ position: [0, 0, 9], fov: 36 }}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
        }}
        fallback={<p>3D requires WebGL. The studio remains available.</p>}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 6, 5]} intensity={3.5} color="#fffef6" />
        <directionalLight position={[-5, -2, 2]} intensity={2} color="#d5e2ff" />
        <Environment resolution={128} frames={1}>
          <Lightformer
            form="rect"
            position={[0, 5, 3]}
            scale={[10, 3, 1]}
            intensity={4}
            rotation={[Math.PI / 4, 0, 0]}
          />
          <Lightformer
            form="rect"
            position={[-4, 0, 3]}
            scale={[2, 8, 1]}
            intensity={3}
            rotation={[0, Math.PI / 3, 0]}
          />
          <Lightformer
            form="rect"
            position={[5, 1, -2]}
            scale={[3, 7, 1]}
            intensity={5}
            rotation={[0, -Math.PI / 2, 0]}
          />
        </Environment>
        <Sculpture {...props} />
      </Canvas>
    </SceneBoundary>
  );
}
