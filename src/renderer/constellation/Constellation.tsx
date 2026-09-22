import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Library, Settings } from '../../shared/types';
import { duration } from '../utils/format';
interface Props {
  library: Library;
  visible: Set<number>;
  selected: number;
  neighbours: number[];
  settings: Settings;
  focus: number;
  reset: number;
  flat: boolean;
  onSelect: (index: number, focus?: boolean) => void;
}
interface Engine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  stars: THREE.Points;
  lines: THREE.LineSegments;
  ring: THREE.Mesh;
  target: THREE.Vector3 | null;
  destination: THREE.Vector3 | null;
}
export default function Constellation(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);
  const [failure, setFailure] = useState('');
  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setFailure(
        'WebGL is unavailable. Update your graphics driver. Search and the sound list remain available.',
      );
      return;
    }
    element.appendChild(renderer.domElement);
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1500);
    camera.position.set(12, 18, 165);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5;
    controls.maxDistance = 500;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { pointSize: { value: 1 }, glow: { value: 0.7 } },
      vertexShader: `attribute float magnitude; attribute vec3 tint; varying vec3 vColor; uniform float pointSize; void main(){ vColor=tint; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=clamp(magnitude*pointSize*200./max(5.,-mv.z),2.,36.); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vColor; uniform float glow; void main(){ float r=length(gl_PointCoord-.5)*2.; if(r>1.) discard; float core=exp(-r*r*24.); float halo=exp(-r*r*4.)*glow*.48; gl_FragColor=vec4(vColor,core+halo); }`,
    });
    const stars = new THREE.Points(new THREE.BufferGeometry(), material);
    scene.add(stars);
    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: '#79b9bc',
        transparent: true,
        opacity: 0.27,
        depthWrite: false,
      }),
    );
    scene.add(lines);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.38, 64),
      new THREE.MeshBasicMaterial({
        color: '#9adbcf',
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthTest: false,
      }),
    );
    ring.visible = false;
    scene.add(ring);
    const e: Engine = {
      scene,
      camera,
      renderer,
      controls,
      stars,
      lines,
      ring,
      target: null,
      destination: null,
    };
    engine.current = e;
    const observer = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    });
    observer.observe(element);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    let lastMove = 0;
    const pick = (event: PointerEvent | MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.params.Points!.threshold = controls.getDistance() * 0.008;
      raycaster.setFromCamera(pointer, camera);
      return raycaster
        .intersectObject(stars)
        .find((hit) => hit.index !== undefined && latest.current.visible.has(hit.index))?.index;
    };
    const move = (event: PointerEvent) => {
      if (event.buttons || performance.now() - lastMove < 35) return;
      lastMove = performance.now();
      const index = pick(event);
      const rect = element.getBoundingClientRect();
      setHover(
        index === undefined
          ? null
          : {
              index,
              x: Math.min(event.clientX - rect.left + 16, rect.width - 260),
              y: Math.max(10, event.clientY - rect.top - 70),
            },
      );
      element.style.cursor = index === undefined ? 'grab' : 'pointer';
    };
    const pointerDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY };
      e.target = null;
      e.destination = null;
      setHover(null);
    };
    const up = (event: PointerEvent) => {
      if (event.button || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
      const index = pick(event);
      if (index !== undefined) latest.current.onSelect(index);
    };
    const double = (event: MouseEvent) => {
      const index = pick(event);
      if (index !== undefined) latest.current.onSelect(index, true);
    };
    const leave = () => setHover(null);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('dblclick', double);
    renderer.domElement.addEventListener('pointerleave', leave);
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (e.target && e.destination) {
        controls.target.lerp(e.target, 0.08);
        camera.position.lerp(e.destination, 0.08);
        if (camera.position.distanceTo(e.destination) < 0.01) {
          e.target = null;
          e.destination = null;
        }
      }
      ring.quaternion.copy(camera.quaternion);
      ring.scale.setScalar(1 + Math.sin(performance.now() * 0.003) * 0.09);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      stars.geometry.dispose();
      material.dispose();
      lines.geometry.dispose();
      (lines.material as THREE.Material).dispose();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      renderer.dispose();
      element.removeChild(renderer.domElement);
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const positions: number[] = [];
    const magnitudes: number[] = [];
    const tints: number[] = [];
    props.library.files.forEach((file, i) => {
      const p = props.library.points[i];
      positions.push(p.x, p.y, props.flat ? 0 : p.z);
      const visible = props.visible.has(i);
      magnitudes.push(visible ? 4 + Math.min(5, Math.log1p(file.duration) * 1.7) : 0.8);
      const hue = Math.min(1, file.features.centroid / 6500);
      const color = new THREE.Color('#7cc5bc').lerp(new THREE.Color('#c4b8df'), hue);
      color.multiplyScalar(visible ? 0.65 + Math.min(0.45, file.features.rms * 2) : 0.08);
      tints.push(color.r, color.g, color.b);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('magnitude', new THREE.Float32BufferAttribute(magnitudes, 1));
    geometry.setAttribute('tint', new THREE.Float32BufferAttribute(tints, 3));
    geometry.computeBoundingSphere();
    e.stars.geometry.dispose();
    e.stars.geometry = geometry;
  }, [props.library, props.visible, props.flat]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const material = e.stars.material as THREE.ShaderMaterial;
    material.uniforms.pointSize.value = props.settings.pointSize;
    material.uniforms.glow.value = props.settings.glow;
    e.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        props.settings.quality === 'low' ? 1 : props.settings.quality === 'high' ? 2 : 1.5,
      ),
    );
    e.controls.enableRotate = !props.flat;
    e.controls.mouseButtons.LEFT = props.flat ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    const p = props.library.points[props.selected];
    e.ring.visible = Boolean(p && props.visible.has(props.selected));
    const lines: number[] = [];
    if (p) {
      e.ring.position.set(p.x, p.y, props.flat ? 0 : p.z);
      if (props.settings.lines)
        props.neighbours.forEach((i) => {
          const n = props.library.points[i];
          if (n && props.visible.has(i))
            lines.push(p.x, p.y, props.flat ? 0 : p.z, n.x, n.y, props.flat ? 0 : n.z);
        });
    }
    e.lines.geometry.dispose();
    e.lines.geometry = new THREE.BufferGeometry();
    e.lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  }, [props.selected, props.neighbours, props.library, props.settings, props.visible, props.flat]);
  useEffect(() => {
    const e = engine.current;
    const p = props.library.points[props.selected];
    if (!e || !p || !props.focus) return;
    e.target = new THREE.Vector3(p.x, p.y, props.flat ? 0 : p.z);
    e.destination = e.target
      .clone()
      .add(
        props.flat
          ? new THREE.Vector3(0, 0, 40)
          : e.camera.position.clone().sub(e.controls.target).normalize().multiplyScalar(40),
      );
  }, [props.focus]);
  useEffect(() => {
    const e = engine.current;
    if (e) {
      e.target = new THREE.Vector3();
      e.destination = props.flat ? new THREE.Vector3(0, 0, 165) : new THREE.Vector3(12, 18, 165);
    }
  }, [props.reset, props.flat, props.library]);
  const file = hover ? props.library.files[hover.index] : undefined;
  return (
    <div
      className="universe"
      ref={host}
      aria-label="Interactive sound constellation. Use the sound list for keyboard selection."
    >
      {failure && (
        <div className="canvas-error" role="alert">
          {failure}
        </div>
      )}
      {file && hover && (
        <div className="star-tooltip" style={{ left: hover.x, top: hover.y }}>
          <strong>{file.name}</strong>
          <span>
            {duration(file.duration)} · {file.extension.toUpperCase()}
            {file.sampleRate ? ` · ${(file.sampleRate / 1000).toFixed(1)} kHz` : ''}
          </span>
        </div>
      )}
    </div>
  );
}
