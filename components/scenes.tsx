"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const BRAND = new THREE.Color("#0087fb");
const GLOW = new THREE.Color("#b9e1ff");

type SceneProps = { running: boolean };

/** Shared pointer in normalised device space; decorative scenes only read it. */
function usePointer() {
  const pointer = useRef(new THREE.Vector2());
  useEffect(() => {
    const move = (event: PointerEvent) => pointer.current.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return pointer;
}

const waveVertex = /* glsl */ `
  uniform float uTime; uniform vec2 uPointer; uniform float uPixelRatio;
  varying float vHeight; varying float vFade;
  void main() {
    vec3 p = position;
    float w = sin(p.x * .34 + uTime * .55) * .42 + sin(p.z * .52 + uTime * .42) * .32 + sin((p.x + p.z) * .21 - uTime * .28) * .5;
    float d = distance(p.xz, vec2(uPointer.x * 13., -6. - uPointer.y * 4.));
    w += exp(-d * d * .06) * 1.1;
    p.y += w;
    vHeight = w;
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.7 + max(w, 0.) * 1.3) * uPixelRatio * (13. / -mv.z);
    vFade = smoothstep(38., 9., -mv.z) * smoothstep(1., 4., -mv.z);
  }
`;

const waveFragment = /* glsl */ `
  uniform vec3 uColorA; uniform vec3 uColorB;
  varying float vHeight; varying float vFade;
  void main() {
    float r = length(gl_PointCoord - .5);
    float disc = smoothstep(.5, .12, r);
    vec3 color = mix(uColorA, uColorB, smoothstep(-.3, 1.4, vHeight));
    gl_FragColor = vec4(color, disc * vFade * (.5 + smoothstep(-.8, 1.2, vHeight) * .5));
  }
`;

function WaveField() {
  const pointer = usePointer();
  const smoothed = useRef(new THREE.Vector2());
  const group = useRef<THREE.Group>(null);
  const points = useRef<THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  const { geometry, material } = useMemo(() => {
    const cols = 180, rows = 84, spacing = .19;
    const positions = new Float32Array(cols * rows * 3);
    for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
      const index = (row * cols + col) * 3;
      positions[index] = (col - cols / 2) * spacing;
      positions[index + 2] = -row * spacing * 1.25 + 4;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPointer: { value: new THREE.Vector2() }, uPixelRatio: { value: 1 }, uColorA: { value: BRAND }, uColorB: { value: GLOW } },
      vertexShader: waveVertex, fragmentShader: waveFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    return { geometry, material };
  }, []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame((state, delta) => {
    smoothed.current.lerp(pointer.current, Math.min(1, delta * 2.4));
    const uniforms = points.current?.material.uniforms;
    if (uniforms) {
      uniforms.uTime.value += Math.min(delta, .05);
      uniforms.uPointer.value.copy(smoothed.current);
      uniforms.uPixelRatio.value = state.viewport.dpr;
    }
    if (group.current) { group.current.rotation.y = smoothed.current.x * .06; group.current.rotation.x = smoothed.current.y * .025; }
  });
  return <group ref={group}><points ref={points} geometry={geometry} material={material} /></group>;
}

export function WaveScene({ running }: SceneProps) {
  return (
    <Canvas className="scene-canvas" dpr={[1, 1.5]} frameloop={running ? "always" : "demand"} gl={{ antialias: false, alpha: true, powerPreference: "low-power" }} camera={{ position: [0, 5.6, 7.5], fov: 55, near: .1, far: 60 }} onCreated={({ camera }) => camera.lookAt(0, -1.2, -7)}>
      <WaveField />
    </Canvas>
  );
}

/* Stylised outline of Canada (longitude, latitude); coarse enough to read as a
   silhouette on a dotted globe, not a cartographic boundary. */
const CANADA_MAINLAND: Array<[number, number]> = [
  [-141, 69.6], [-141, 60.3], [-130, 54.7], [-123.2, 49], [-95, 49], [-89, 48], [-83, 46], [-82.5, 42], [-79, 43.3], [-76, 44], [-71, 45], [-67.8, 45.2], [-67, 47],
  [-64, 45.5], [-61, 45.3], [-59.8, 46.5], [-64.5, 48.9], [-66, 50.2], [-57, 51.5], [-55.7, 52.4], [-60, 55.5], [-64.5, 60.3], [-70, 58.8], [-77.5, 62.5], [-78, 58.5],
  [-76.5, 56], [-79.5, 51.5], [-82.5, 52.9], [-87.5, 55.8], [-92.5, 57], [-94.8, 59.2], [-94, 61], [-90, 64], [-81, 67], [-95, 68.5], [-110, 68], [-117, 69], [-128, 70], [-135, 69.2],
];
const CANADA_ARCTIC: Array<[number, number]> = [[-125, 72], [-118, 76.5], [-100, 79], [-90, 81.5], [-70, 82.8], [-62, 82], [-72, 78], [-80, 73.5], [-68, 70], [-62, 66.5], [-75, 65], [-90, 69.5], [-105, 70.5], [-118, 71]];
const NEWFOUNDLAND: Array<[number, number]> = [[-59.3, 47.6], [-56, 51.6], [-53, 49.5], [-52.6, 47.5], [-55.5, 46.8]];

const HUBS: Record<string, [number, number]> = {
  BC: [49.28, -123.12], AB: [51.05, -114.07], SK: [50.45, -104.6], MB: [49.9, -97.14], ON: [43.65, -79.38], QC: [45.5, -73.57],
  NB: [46.09, -64.77], NS: [44.65, -63.57], PE: [46.24, -63.13], NL: [47.56, -52.71],
};

function inside(polygon: Array<[number, number]>, lon: number, lat: number) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i]; const [xj, yj] = polygon[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function toVector(lat: number, lon: number, radius: number) {
  const phi = THREE.MathUtils.degToRad(lat); const lambda = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(radius * Math.cos(phi) * Math.sin(lambda), radius * Math.sin(phi), radius * Math.cos(phi) * Math.cos(lambda));
}

const dotVertex = /* glsl */ `
  attribute float aLand; uniform float uPixelRatio; uniform float uTime;
  varying float vLand; varying float vFacing;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.);
    vFacing = dot(normalize(normalMatrix * normalize(position)), vec3(0., 0., 1.));
    vLand = aLand;
    float twinkle = aLand > .5 ? .85 + .15 * sin(uTime * 2. + position.x * 9. + position.y * 7.) : 1.;
    gl_PointSize = (aLand > .5 ? 4.4 : 2.2) * twinkle * uPixelRatio * (6. / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const dotFragment = /* glsl */ `
  uniform vec3 uLand; uniform vec3 uSea;
  varying float vLand; varying float vFacing;
  void main() {
    float disc = smoothstep(.5, .2, length(gl_PointCoord - .5));
    float face = smoothstep(-.15, .55, vFacing);
    vec3 color = mix(uSea, uLand, vLand);
    gl_FragColor = vec4(color, disc * face * mix(.28, 1., vLand));
  }
`;

const arcVertex = /* glsl */ `
  attribute float aProgress; varying float vProgress;
  void main() { vProgress = aProgress; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`;

const arcFragment = /* glsl */ `
  uniform float uTime; uniform float uOffset; uniform vec3 uColor; varying float vProgress;
  void main() {
    float head = fract(uTime * .22 + uOffset);
    float trail = smoothstep(.26, 0., head - vProgress) * step(vProgress, head);
    gl_FragColor = vec4(uColor, .3 + trail * .7);
  }
`;

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`;

const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor; varying vec3 vNormal;
  void main() { float rim = pow(.72 - dot(vNormal, vec3(0., 0., 1.)), 3.); gl_FragColor = vec4(uColor, clamp(rim, 0., 1.) * .9); }
`;

function Globe({ provinces }: { provinces: Array<{ code: string; share: number }> }) {
  const spin = useRef<THREE.Group>(null);
  const pointer = usePointer();
  const dots = useRef<THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  const arcGroup = useRef<THREE.Group>(null);
  const radius = 2;
  const built = useMemo(() => {
    const count = 5200;
    const positions = new Float32Array(count * 3); const land = new Float32Array(count);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i += 1) {
      const y = 1 - (i / (count - 1)) * 2; const r = Math.sqrt(1 - y * y); const theta = golden * i;
      const x = Math.cos(theta) * r; const z = Math.sin(theta) * r;
      positions.set([x * radius, y * radius, z * radius], i * 3);
      const lat = THREE.MathUtils.radToDeg(Math.asin(y)); const lon = THREE.MathUtils.radToDeg(Math.atan2(x, z));
      land[i] = inside(CANADA_MAINLAND, lon, lat) || inside(CANADA_ARCTIC, lon, lat) || inside(NEWFOUNDLAND, lon, lat) ? 1 : 0;
    }
    const dots = new THREE.BufferGeometry();
    dots.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    dots.setAttribute("aLand", new THREE.BufferAttribute(land, 1));
    const dotMaterial = new THREE.ShaderMaterial({ uniforms: { uPixelRatio: { value: 1 }, uTime: { value: 0 }, uLand: { value: GLOW }, uSea: { value: new THREE.Color("#3f7fc4") } }, vertexShader: dotVertex, fragmentShader: dotFragment, transparent: true, depthWrite: false });

    const known = provinces.filter((province) => HUBS[province.code]);
    const hub = known.reduce((best, province) => (province.share > best.share ? province : best), known[0]);
    const arcs = known.filter((province) => province.code !== hub?.code).map((province, index) => {
      const start = toVector(...HUBS[hub.code], radius); const end = toVector(...HUBS[province.code], radius);
      const mid = start.clone().add(end).multiplyScalar(.5); mid.setLength(radius + .18 + start.distanceTo(end) * .32);
      const points = new THREE.QuadraticBezierCurve3(start, mid, end).getPoints(64);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      geometry.setAttribute("aProgress", new THREE.BufferAttribute(new Float32Array(points.map((_, i) => i / (points.length - 1))), 1));
      const material = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uOffset: { value: index * .37 }, uColor: { value: BRAND.clone().lerp(GLOW, .35) } }, vertexShader: arcVertex, fragmentShader: arcFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      return { line: new THREE.Line(geometry, material), material, geometry };
    });
    const markers = known.map((province) => ({ code: province.code, position: toVector(...HUBS[province.code], radius * 1.004), size: .016 + Math.sqrt(province.share) * .045 }));
    const atmosphere = new THREE.ShaderMaterial({ uniforms: { uColor: { value: BRAND } }, vertexShader: atmosphereVertex, fragmentShader: atmosphereFragment, transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false });
    return { dots, dotMaterial, arcs, markers, atmosphere };
  }, [provinces]);
  useEffect(() => () => { built.dots.dispose(); built.dotMaterial.dispose(); built.atmosphere.dispose(); built.arcs.forEach(({ geometry, material }) => { geometry.dispose(); material.dispose(); }); }, [built]);
  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    const dotUniforms = dots.current?.material.uniforms;
    if (dotUniforms) { dotUniforms.uTime.value = time; dotUniforms.uPixelRatio.value = state.viewport.dpr; }
    arcGroup.current?.children.forEach((child) => { ((child as THREE.Line).material as THREE.ShaderMaterial).uniforms.uTime.value = time; });
    if (spin.current) {
      spin.current.rotation.y = THREE.MathUtils.degToRad(96) + Math.sin(time * .18) * .32 + pointer.current.x * .12;
      spin.current.rotation.x = THREE.MathUtils.lerp(spin.current.rotation.x, pointer.current.y * -.06, Math.min(1, delta * 2));
    }
  });
  return (
    <group rotation={[THREE.MathUtils.degToRad(42), 0, 0]} position={[0, -.2, 0]}>
      <mesh scale={1.16}><sphereGeometry args={[radius, 48, 48]} /><primitive object={built.atmosphere} attach="material" /></mesh>
      <group ref={spin}>
        <mesh renderOrder={-1}><sphereGeometry args={[radius * .985, 48, 48]} /><meshBasicMaterial color="#04142b" /></mesh>
        <points ref={dots} geometry={built.dots} material={built.dotMaterial} />
        <group ref={arcGroup}>{built.arcs.map(({ line }, index) => <primitive key={index} object={line} />)}</group>
        {built.markers.map((marker) => <mesh key={marker.code} position={marker.position}><sphereGeometry args={[marker.size, 16, 16]} /><meshBasicMaterial color="#e6f4ff" /></mesh>)}
      </group>
    </group>
  );
}

export function GlobeScene({ running, provinces }: SceneProps & { provinces: Array<{ code: string; share: number }> }) {
  return (
    <Canvas className="scene-canvas" dpr={[1, 1.5]} frameloop={running ? "always" : "demand"} gl={{ antialias: true, alpha: true, powerPreference: "low-power" }} camera={{ position: [0, 0, 6.2], fov: 42 }}>
      <Globe provinces={provinces} />
    </Canvas>
  );
}
