'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Lightformer } from '@react-three/drei';
import {
  Component,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type ComponentRef,
} from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createDemoRig, disposeRig, remapClip } from '@/lib/avatar-rig';
import { PlaybackEngine } from '@/lib/playback';
import type { Manifest, Sign } from '@/lib/schemas';
import type { IslMotion } from '@/lib/isl-motion-schema';
import { createGeneratedIslClips } from '@/lib/isl-motion-clips';
type Props = {
  engine: PlaybackEngine;
  sequence: Sign[];
  manifest: Manifest;
  cameraCommand: { type: 'reset' | 'in' | 'out' | 'quarter' | 'detail'; id: number };
  presentation?: 'studio';
  fingerspelling?: boolean;
  islPreview?: boolean;
  generatedMotion?: IslMotion;
  onStatus: (status: string, missing: string[]) => void;
};
class CanvasBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="canvas-fallback" role="alert">
        <strong>3D is unavailable in this browser.</strong>
        <p>
          Enable hardware acceleration or try another browser. The phrase sequence remains available
          below.
        </p>
        <button className="button secondary" onClick={() => this.setState({ error: false })}>
          Retry viewer
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Actor({
  engine,
  sequence,
  manifest,
  onStatus,
  fingerspelling,
  generatedMotion,
  presentation,
}: Omit<Props, 'cameraCommand'>) {
  const [asset, setAsset] = useState<ReturnType<typeof createDemoRig> | null>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const actions = useRef<Map<string, THREE.AnimationAction>>(new Map());
  const { invalidate } = useThree();
  const wasPlaying = useRef(false);
  useEffect(() => engine.subscribe(() => invalidate()), [engine, invalidate]);
  useEffect(() => {
    let cancelled = false;
    let owned: THREE.Object3D | null = null;
    async function load() {
      onStatus('Loading avatar...', []);
      let resolved: ReturnType<typeof createDemoRig>;
      try {
        if (manifest.avatar.url) {
          if (!manifest.avatar.url.startsWith('/assets/'))
            throw new Error('Avatar must be a same-origin /assets/ path.');
          const loader = new GLTFLoader();
          const gltf = await loader.loadAsync(manifest.avatar.url);
          owned = gltf.scene;
          const clips = [...gltf.animations];
          for (const url of new Set(
            manifest.signs.map((s) => s.asset).filter((v): v is string => Boolean(v)),
          )) {
            const motion = await loader.loadAsync(url);
            clips.push(...motion.animations);
            disposeRig(motion.scene);
          }
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = box.getSize(new THREE.Vector3());
          if (!Number.isFinite(size.y) || size.y <= 0) throw new Error('Empty avatar scene');
          const scale = 1.8 / size.y;
          gltf.scene.scale.multiplyScalar(scale);
          box.setFromObject(gltf.scene);
          const center = box.getCenter(new THREE.Vector3());
          gltf.scene.position.add(new THREE.Vector3(-center.x, -box.min.y, -center.z));
          gltf.scene.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          resolved = {
            root: gltf.scene,
            clips: clips.map((c) => remapClip(c, manifest.avatar.boneMap)),
          };
        } else resolved = createDemoRig(presentation);
        if (generatedMotion) {
          if (generatedMotion.model.id === 'local-sign-vqvae' && !manifest.avatar.url) {
            // Mirror this rig's legacy left finger bases only for the anatomical research mapper.
            // Existing ASL and reference clips keep their original rest configuration.
            for (let digit = 0; digit < 4; digit++) {
              const bone = resolved.root.getObjectByName(`LeftFinger${digit}`);
              if (bone) bone.position.x *= -1;
            }
          }
          resolved.clips.push(...createGeneratedIslClips(generatedMotion));
        }
        if (fingerspelling) {
          const hand = resolved.root.getObjectByName('RightHand');
          resolved.root.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            let parent: THREE.Object3D | null = object;
            while (parent && parent !== hand) parent = parent.parent;
            object.visible = parent === hand;
          });
        }
        if (cancelled) {
          disposeRig(resolved.root);
          return;
        }
        owned = resolved.root;
        setAsset(resolved);
        onStatus(
          manifest.avatar.url ? 'Asset loaded' : 'Procedural demonstration rig',
          manifest.signs
            .filter((s) => s.available && !resolved.clips.some((c) => c.name === s.clip))
            .map((s) => s.id),
        );
      } catch (error) {
        if (owned) disposeRig(owned);
        if (cancelled) return;
        resolved = createDemoRig(presentation);
        owned = resolved.root;
        setAsset(resolved);
        onStatus(
          'Model loading failed. Using procedural demo rig: ' +
            (error instanceof Error ? error.message : 'Unknown error'),
          manifest.signs
            .filter((s) => !resolved.clips.some((c) => c.name === s.clip))
            .map((s) => s.id),
        );
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (owned) disposeRig(owned);
    };
  }, [manifest, onStatus, fingerspelling, generatedMotion, presentation]);
  useEffect(() => {
    if (!asset) return;
    const m = new THREE.AnimationMixer(asset.root);
    mixer.current = m;
    const map = new Map<string, THREE.AnimationAction>();
    asset.clips.forEach((c) => {
      const a = m.clipAction(c);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.play();
      a.paused = true;
      map.set(c.name, a);
    });
    actions.current = map;
    return () => {
      m.stopAllAction();
      m.uncacheRoot(asset.root);
      mixer.current = null;
      actions.current.clear();
    };
  }, [asset]);
  useFrame((_, delta) => {
    const playing = engine.getSnapshot().phase === 'playing';
    // Demand rendering can leave a long idle delta. The first playback frame starts at zero.
    engine.tick(playing && !wasPlaying.current ? 0 : delta);
    wasPlaying.current = playing;
    const state = engine.getSnapshot();
    const current = sequence[state.index];
    const previous = state.transitionFrom === null ? undefined : sequence[state.transitionFrom];
    actions.current.forEach((a) => {
      a.enabled = false;
      a.weight = 0;
    });
    const a = current?.available
      ? actions.current.get(current.clip)
      : fingerspelling && !current
        ? actions.current.get('asl-pause')
        : undefined;
    if (a) {
      a.enabled = true;
      a.time = Math.min(
        a.getClip().duration,
        current ? (state.localTime / current.duration) * a.getClip().duration : 0,
      );
      a.weight = 1;
      const transition = current?.transition ?? 0;
      if (previous && transition > 0 && state.localTime < transition) {
        const b = actions.current.get(previous.clip);
        if (b && b !== a) {
          const blend = state.localTime / transition;
          a.weight = blend;
          b.enabled = true;
          b.weight = 1 - blend;
          b.time = b.getClip().duration;
        }
      }
    }
    mixer.current?.update(0);
  });
  return asset ? <primitive object={asset.root} dispose={null} /> : null;
}
function CameraControls({
  command,
  fingerspelling,
  islPreview,
}: {
  command: Props['cameraCommand'];
  fingerspelling?: boolean;
  islPreview?: boolean;
}) {
  const ref = useRef<ComponentRef<typeof OrbitControls>>(null);
  const previousMode = useRef('');
  const { camera, invalidate } = useThree();
  useEffect(() => {
    const mode = fingerspelling ? 'asl' : islPreview ? 'isl' : 'model';
    const type = previousMode.current === mode ? command.type : 'reset';
    previousMode.current = mode;
    if (type === 'reset') {
      camera.position.set(
        ...((fingerspelling
          ? [0.29, 1.36, 0.98]
          : islPreview
            ? [0, 1.46, 2.55]
            : [0, 1.2, 3.65]) as [number, number, number]),
      );
      ref.current?.target.set(
        ...((fingerspelling ? [0.29, 1.35, 0.25] : islPreview ? [0, 1.28, 0.12] : [0, 1.03, 0]) as [
          number,
          number,
          number,
        ]),
      );
    } else if (type === 'quarter') {
      camera.position.set(
        ...((fingerspelling ? [0.85, 1.4, 1] : [2.1, 1.3, 3]) as [number, number, number]),
      );
      ref.current?.target.set(
        ...((fingerspelling ? [0.29, 1.35, 0.25] : [0, 1.03, 0]) as [number, number, number]),
      );
    } else if (type === 'detail') {
      camera.position.set(
        ...((fingerspelling ? [0.29, 1.36, 0.94] : [0, 1.5, 2.1]) as [number, number, number]),
      );
      ref.current?.target.set(
        ...((fingerspelling ? [0.29, 1.35, 0.25] : [0, 1.35, 0]) as [number, number, number]),
      );
    } else {
      const target = ref.current?.target ?? new THREE.Vector3(0, 1, 0);
      camera.position
        .sub(target)
        .multiplyScalar(type === 'in' ? 0.82 : 1.22)
        .add(target);
    }
    ref.current?.update();
    invalidate();
  }, [command, camera, fingerspelling, islPreview, invalidate]);
  return (
    <OrbitControls
      ref={ref}
      target={fingerspelling ? [0.29, 1.35, 0.25] : islPreview ? [0, 1.28, 0.12] : [0, 1.03, 0]}
      enablePan={false}
      minDistance={fingerspelling ? 0.4 : 1.6}
      maxDistance={5.5}
      minPolarAngle={0.5}
      maxPolarAngle={Math.PI / 2}
      minAzimuthAngle={-0.9}
      maxAzimuthAngle={0.9}
    />
  );
}
export default function AvatarScene(props: Props) {
  const playing = useSyncExternalStore(
    props.engine.subscribe,
    () => props.engine.getSnapshot().phase === 'playing',
    () => false,
  );
  const studio = props.presentation === 'studio';
  const background = studio ? '#171a17' : '#171a22';
  return (
    <CanvasBoundary>
      <Canvas
        style={{ position: 'absolute', inset: 0 }}
        frameloop={playing ? 'always' : 'demand'}
        shadows
        camera={{ position: [0, 1.2, 3.65], fov: 36 }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        role="img"
        aria-label="3D avatar; use the labeled playback and camera controls to interact"
        onCreated={({ gl }) => {
          gl.setClearColor(background);
        }}
      >
        <fog attach="fog" args={[background, 6, 13]} />
        {studio && (
          <Environment resolution={128} frames={1}>
            <Lightformer
              form="rect"
              intensity={2}
              position={[-3, 2, 3]}
              rotation={[0, Math.PI / 4, 0]}
              scale={[2, 5, 1]}
            />
            <Lightformer
              form="rect"
              intensity={2}
              color="#e8efcc"
              position={[3, 1, 0]}
              rotation={[0, -Math.PI / 2, 0]}
              scale={[2, 4, 1]}
            />
          </Environment>
        )}
        <ambientLight intensity={1.25} />
        <hemisphereLight
          args={[studio ? '#f1f2eb' : '#cbe9ff', studio ? '#282b23' : '#223645', 1.6]}
        />
        <directionalLight
          position={[3, 5, 4]}
          intensity={3}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <spotLight
          position={[-3, 3, -2]}
          intensity={studio ? 12 : 20}
          color={studio ? '#dfff88' : '#ff9c88'}
        />
        <pointLight position={[-2, 2, 3]} intensity={9} color={studio ? '#ebeee3' : '#b3e6ff'} />
        <Actor {...props} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color={studio ? '#20231e' : '#20232e'} roughness={0.94} />
        </mesh>
        <Grid
          position={[0, -0.018, 0]}
          args={[20, 20]}
          cellSize={0.4}
          cellThickness={0.45}
          cellColor={studio ? '#35392f' : '#393f50'}
          sectionSize={2}
          sectionThickness={0.6}
          sectionColor={studio ? '#525748' : '#4b5266'}
          fadeDistance={7}
          infiniteGrid
        />
        <CameraControls
          command={props.cameraCommand}
          fingerspelling={props.fingerspelling}
          islPreview={props.islPreview}
        />
      </Canvas>
    </CanvasBoundary>
  );
}
