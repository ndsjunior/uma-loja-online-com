// Kit 3D Cinema do Brixly — motor das cenas (carregado sob demanda pelo Hero3D.tsx).
// Não importe este arquivo direto em outro lugar: use <Hero3D variant=... />. Nenhuma cena baixa
// textura/HDR: reflexos vêm de Lightformers (estúdio gerado na GPU) e shaders próprios.
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Float, Lightformer, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'
import type { Hero3DShape, Hero3DVariant } from './Hero3D'

export interface Scene3DProps {
  variant: Hero3DVariant
  shape: Hero3DShape
  colors: [string, string]
  align: 'right' | 'center' | 'left'
  intensity: number
  active: boolean
  mobile: boolean
  dark: boolean
  onReady: () => void
}

// ponteiro e rolagem compartilhados (o canvas não recebe eventos: o texto por cima é clicável)
const input = { x: 0, y: 0, scroll: 0 }

function useInput() {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      input.x = (e.clientX / window.innerWidth) * 2 - 1
      input.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    const scroll = () => {
      input.scroll = Math.min(1, window.scrollY / Math.max(1, window.innerHeight))
    }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('scroll', scroll, { passive: true })
    scroll()
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('scroll', scroll)
    }
  }, [])
}

/** Palco: posiciona a cena de acordo com `align`, segue o ponteiro e afunda ao rolar. */
function Stage({ align, mobile, k, children }: { align: Scene3DProps['align']; mobile: boolean; k: number; children: ReactNode }) {
  const g = useRef<THREE.Group>(null)
  const { viewport } = useThree()
  const side = mobile || align === 'center' ? 0 : align === 'right' ? 1 : -1
  const baseX = side * Math.min(viewport.width * 0.24, 3.2)
  // celular: objeto menor e no alto da tela — o texto do hero fica embaixo, sobre fundo limpo
  const baseY = mobile ? viewport.height * 0.26 : 0
  const scale = mobile ? Math.min(0.78, viewport.width / 5.4) : Math.min(1.15, viewport.width / 9)
  useFrame((_, dt) => {
    const o = g.current
    if (!o) return
    const d = Math.min(dt, 0.05) * 3
    o.rotation.y += (input.x * 0.35 * k - o.rotation.y) * d
    o.rotation.x += (-input.y * 0.2 * k - o.rotation.x) * d
    o.position.x += (baseX + input.x * 0.15 - o.position.x) * d
    o.position.y += (baseY - input.scroll * 1.6 - o.position.y) * d
  })
  return (
    <group ref={g} position={[baseX, baseY, 0]} scale={scale}>
      {children}
    </group>
  )
}

/** Estúdio de luz sem download: faixas de softbox viram o mapa de reflexo (renderizado 1 vez). */
function Studio({ a, b, mobile }: { a: string; b: string; mobile: boolean }) {
  // fundo do estúdio = accent bem escuro: o metal reflete cor, não um buraco preto
  const room = useMemo(() => '#' + new THREE.Color(a).lerp(new THREE.Color('#000000'), 0.78).getHexString(), [a])
  return (
    <Environment resolution={mobile ? 128 : 256} frames={1}>
      <color attach="background" args={[room]} />
      {[-2.4, -0.8, 0.8, 2.4].map((y, i) => (
        <Lightformer key={i} intensity={1.6} position={[0, y, -6]} scale={[14, 0.35, 1]} color="#ffffff" />
      ))}
      <Lightformer intensity={5} position={[-6, 0.5, 1]} rotation={[0, Math.PI / 2, 0]} scale={[12, 3, 1]} color={a} />
      <Lightformer intensity={4} position={[6, -0.5, 1]} rotation={[0, -Math.PI / 2, 0]} scale={[12, 3, 1]} color={b} />
      <Lightformer intensity={2.5} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 8, 1]} color="#ffffff" />
      <Lightformer intensity={1.5} position={[0, -6, 2]} rotation={[-Math.PI / 2, 0, 0]} scale={[10, 10, 1]} color={a} />
    </Environment>
  )
}

// ─────────────────────────── cenas ───────────────────────────

function Blob({ a, b, mobile, k }: { a: string; b: string; mobile: boolean; k: number }) {
  const m = useRef<THREE.Mesh>(null)
  // cromo tingido: o accent clareado reflete as faixas de luz em vez de virar uma bola escura
  const tint = useMemo(() => '#' + new THREE.Color(a).lerp(new THREE.Color('#ffffff'), 0.35).getHexString(), [a])
  useFrame((_, dt) => {
    if (m.current) m.current.rotation.z += Math.min(dt, 0.05) * 0.12 * k
  })
  return (
    <>
      <Studio a={a} b={b} mobile={mobile} />
      <Float speed={1.4 * k} rotationIntensity={0.5} floatIntensity={0.9}>
        <mesh ref={m} scale={1.55}>
          <icosahedronGeometry args={[1, mobile ? 24 : 64]} />
          <MeshDistortMaterial color={tint} distort={0.38} speed={1.5 * k} roughness={0.16} metalness={0.95} envMapIntensity={1.35} clearcoat={1} clearcoatRoughness={0.1} />
        </mesh>
      </Float>
      <Float speed={2 * k} floatIntensity={1.6}>
        <mesh position={[1.75, 1.05, -0.6]} scale={0.26}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color={b} roughness={0.12} metalness={1} />
        </mesh>
      </Float>
      <Float speed={1.7 * k} floatIntensity={1.2}>
        <mesh position={[-1.6, -1.15, 0.4]} scale={0.16}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={1} />
        </mesh>
      </Float>
    </>
  )
}

function dotTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  if (x) {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 64, 64)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Particles({ a, b, mobile, k, dark }: { a: string; b: string; mobile: boolean; k: number; dark: boolean }) {
  const pts = useRef<THREE.Points>(null)
  const count = mobile ? 1600 : 5200
  const { geo, map } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const ca = new THREE.Color(a)
    const cb = new THREE.Color(b)
    const white = new THREE.Color('#ffffff')
    const arms = 4
    for (let i = 0; i < count; i++) {
      const r = Math.pow(Math.random(), 0.7) * 4.2
      const arm = ((i % arms) / arms) * Math.PI * 2
      const spin = r * 1.1
      const spread = (1 - r / 5) * 0.55 + 0.08
      const rx = (Math.random() - 0.5) * spread * r * 0.6
      const ry = (Math.random() - 0.5) * spread * 0.9
      const rz = (Math.random() - 0.5) * spread * r * 0.6
      pos[i * 3] = Math.cos(arm + spin) * r + rx
      pos[i * 3 + 1] = ry
      pos[i * 3 + 2] = Math.sin(arm + spin) * r + rz
      const c = ca.clone().lerp(cb, r / 4.2)
      if (Math.random() < 0.12) c.lerp(white, 0.7)
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return { geo: g, map: dotTexture() }
  }, [a, b, count])
  useEffect(() => () => { geo.dispose(); map.dispose() }, [geo, map])
  useFrame((_, dt) => {
    const p = pts.current
    if (p) p.rotation.y += Math.min(dt, 0.05) * 0.07 * k
  })
  return (
    <group rotation={[0.55, 0, 0.18]} scale={1.05}>
      <points ref={pts} geometry={geo}>
        <pointsMaterial
          size={mobile ? 0.09 : 0.075}
          sizeAttenuation
          vertexColors
          map={map}
          transparent
          depthWrite={false}
          blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </points>
      <sprite scale={2.4}>
        <spriteMaterial map={map} color={a} transparent depthWrite={false} blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending} />
      </sprite>
      <sprite scale={0.9}>
        <spriteMaterial map={map} color="#ffffff" transparent depthWrite={false} blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending} />
      </sprite>
    </group>
  )
}

function Shape({ shape, mobile }: { shape: Hero3DShape; mobile: boolean }) {
  const seg = mobile ? 96 : 220
  switch (shape) {
    case 'gem':
      return <icosahedronGeometry args={[1.3, 0]} />
    case 'torus':
      return <torusGeometry args={[1, 0.42, mobile ? 32 : 64, mobile ? 96 : 160]} />
    case 'capsule':
      return <capsuleGeometry args={[0.62, 1.3, 16, mobile ? 32 : 64]} />
    case 'sphere':
      return <sphereGeometry args={[1.15, 64, 64]} />
    default:
      return <torusKnotGeometry args={[0.85, 0.3, seg, mobile ? 24 : 40]} />
  }
}

function Orbit({ a, b, mobile, k, shape }: { a: string; b: string; mobile: boolean; k: number; shape: Hero3DShape }) {
  const core = useRef<THREE.Mesh>(null)
  const tint = useMemo(() => '#' + new THREE.Color(a).lerp(new THREE.Color('#ffffff'), 0.3).getHexString(), [a])
  const rings = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05)
    if (core.current) {
      core.current.rotation.y += d * 0.35 * k
      core.current.rotation.x += d * 0.12 * k
    }
    if (rings.current) rings.current.rotation.z += d * 0.25 * k
  })
  return (
    <>
      <Studio a={a} b={b} mobile={mobile} />
      <Float speed={1.2 * k} rotationIntensity={0.3} floatIntensity={0.7}>
        <mesh ref={core}>
          <Shape shape={shape} mobile={mobile} />
          <meshPhysicalMaterial color={tint} roughness={shape === 'gem' ? 0.05 : 0.14} metalness={0.95} envMapIntensity={1.6} clearcoat={1} clearcoatRoughness={0.08} flatShading={shape === 'gem'} />
        </mesh>
      </Float>
      <group ref={rings} rotation={[1.2, 0.2, 0]}>
        <mesh>
          <torusGeometry args={[2.05, 0.012, 8, 160]} />
          <meshBasicMaterial color={b} />
        </mesh>
        <mesh rotation={[0.5, 0.9, 0]}>
          <torusGeometry args={[2.45, 0.008, 8, 160]} />
          <meshBasicMaterial color={a} transparent opacity={0.7} />
        </mesh>
        <mesh position={[2.05, 0, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
      {!mobile && (
        <ContactShadows position={[0, -1.9, 0]} opacity={0.55} scale={7} blur={2.6} far={3.2} resolution={256} color="#000000" />
      )}
    </>
  )
}

// ruído simplex 3D (Ashima Arts, MIT) — usado pela esfera líquida e pelo terreno
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`

function Liquid({ a, b, mobile, k, dark }: { a: string; b: string; mobile: boolean; k: number; dark: boolean }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uA: { value: new THREE.Color(a) },
          uB: { value: new THREE.Color(b) },
          uDark: { value: dark ? 1 : 0 },
        },
        vertexShader: NOISE + `
          uniform float uTime; varying vec3 vN; varying vec3 vView; varying float vD;
          void main(){
            float d = snoise(normal*0.85 + uTime*0.22) * 0.17 + snoise(normal*1.9 - uTime*0.15) * 0.025;
            vD = d;
            vec3 p = position + normal * d;
            vec4 mv = modelViewMatrix * vec4(p,1.0);
            vN = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 uA; uniform vec3 uB; uniform float uTime; uniform float uDark;
          varying vec3 vN; varying vec3 vView; varying float vD;
          void main(){
            float f = pow(1.0 - max(dot(vN, vView), 0.0), 2.2);
            float t = smoothstep(-0.25, 0.3, vD + vN.y*0.25);
            vec3 base = mix(uA, uB, t);
            vec3 iri = 0.5 + 0.5*cos(6.2831*(vec3(0.0,0.33,0.67) + f*0.9 + uTime*0.04));
            vec3 col = mix(base, base*0.4 + iri*0.6, f*(0.35 + 0.4*uDark));
            col += vec3(1.0) * pow(max(dot(reflect(-vView, vN), normalize(vec3(0.4,0.8,0.6))),0.0), 24.0) * 0.8;
            col = mix(col, col*0.55, (1.0-f)*0.35*uDark);
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [a, b, dark],
  )
  useEffect(() => () => mat.dispose(), [mat])
  const m = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05)
    mat.uniforms.uTime.value += d * k
    if (m.current) m.current.rotation.y += d * 0.1 * k
  })
  return (
    <Float speed={1.1 * k} rotationIntensity={0.2} floatIntensity={0.6}>
      <mesh ref={m} material={mat} scale={1.6}>
        <icosahedronGeometry args={[1, mobile ? 40 : 96]} />
      </mesh>
    </Float>
  )
}

function Waves({ a, b, mobile, k, dark }: { a: string; b: string; mobile: boolean; k: number; dark: boolean }) {
  const cols = mobile ? 70 : 160
  const rows = mobile ? 50 : 90
  const { geo, mat } = useMemo(() => {
    const pos = new Float32Array(cols * rows * 3)
    let i = 0
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        pos[i++] = (c / (cols - 1) - 0.5) * 14
        pos[i++] = 0
        pos[i++] = (r / (rows - 1) - 0.5) * 9
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: dark ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uA: { value: new THREE.Color(a) },
        uB: { value: new THREE.Color(b) },
        uSize: { value: (mobile ? 3.6 : 3.4) * Math.min(window.devicePixelRatio || 1, 1.5) },
        uMouse: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: NOISE + `
        uniform float uTime; uniform float uSize; uniform vec2 uMouse; varying float vH; varying float vFade;
        void main(){
          vec3 p = position;
          float h = snoise(vec3(p.x*0.2, p.z*0.26, uTime*0.18))*1.15 + sin(p.x*0.55 + uTime*0.8)*0.18;
          float md = distance(p.xz, uMouse*vec2(7.0,4.5));
          h += exp(-md*md*0.18)*0.9;
          p.y = h;
          vH = h;
          vFade = smoothstep(4.5, 1.0, abs(p.z)) * smoothstep(7.0, 3.5, abs(p.x));
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          gl_PointSize = uSize * (8.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uA; uniform vec3 uB; varying float vH; varying float vFade;
        void main(){
          vec2 c = gl_PointCoord - 0.5; float d = length(c);
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.05, d) * vFade * (0.55 + 0.45*smoothstep(-0.8, 1.0, vH));
          vec3 col = mix(uB, uA, smoothstep(-0.6, 0.9, vH)) * 1.35;
          col += vec3(1.0) * smoothstep(0.6, 1.5, vH) * 0.6;
          gl_FragColor = vec4(col, alpha);
          #include <colorspace_fragment>
        }`,
    })
    return { geo: g, mat: m }
  }, [a, b, cols, rows, mobile, dark])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += Math.min(dt, 0.05) * k
    const u = mat.uniforms.uMouse.value as THREE.Vector2
    u.x += (input.x - u.x) * 0.05
    u.y += (-input.y - u.y) * 0.05
  })
  return <points geometry={geo} material={mat} position={[0, -1.1, 0]} rotation={[0.28, 0, 0]} />
}

function Ready({ onReady }: { onReady: () => void }) {
  const done = useRef(false)
  useFrame(() => {
    if (!done.current) {
      done.current = true
      requestAnimationFrame(() => onReady())
    }
  })
  return null
}

export default function Scene3D({ variant, shape, colors, align, intensity, active, mobile, dark, onReady }: Scene3DProps) {
  useInput()
  const [a, b] = colors
  const k = Math.max(0.2, Math.min(2, intensity))
  const flat = variant === 'particles' || variant === 'waves' || variant === 'liquid'
  return (
    <Canvas
      dpr={mobile ? [1, 1.25] : [1, 1.5]}
      frameloop={active ? 'always' : 'never'}
      gl={{ antialias: !mobile, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: variant === 'waves' ? [0, 2.2, 6.5] : [0, 0, 6], fov: 40 }}
      onCreated={({ camera }) => {
        if (variant === 'waves') camera.lookAt(0, -0.6, 0)
      }}
      style={{ pointerEvents: 'none' }}
    >
      {!flat && <ambientLight intensity={0.25} />}
      {!flat && <directionalLight position={[3, 4, 5]} intensity={1.2} />}
      {variant === 'waves' ? (
        <Waves a={a} b={b} mobile={mobile} k={k} dark={dark} />
      ) : (
        <Stage align={align} mobile={mobile} k={k}>
          {variant === 'particles' && <Particles a={a} b={b} mobile={mobile} k={k} dark={dark} />}
          {variant === 'orbit' && <Orbit a={a} b={b} mobile={mobile} k={k} shape={shape} />}
          {variant === 'liquid' && <Liquid a={a} b={b} mobile={mobile} k={k} dark={dark} />}
          {variant === 'blob' && <Blob a={a} b={b} mobile={mobile} k={k} />}
        </Stage>
      )}
      <Ready onReady={onReady} />
    </Canvas>
  )
}
