// Kit 3D Cinema do Brixly — o PALCO 3D guiado pela rolagem (carregado sob demanda pelo ScrollStage).
// Não importe direto: use <ScrollStage scene=... />. Um canvas só, fixo atrás da página; cada
// capítulo (`data-chapter`) diz em que ESTADO a cena fica, e a rolagem interpola entre eles.
// Nada é baixado: objetos feitos de primitivas, reflexo de estúdio gerado na GPU, shaders próprios.
//
// FLUIDEZ (regras que este arquivo segue — medido em set/2026, não afrouxe):
// - zero estado do React durante a rolagem: a cena lê `stage` (objeto mutável) dentro do useFrame;
// - nada de `transmission` (vidro/gema "de verdade"): cada material com transmission faz o three
//   renderizar a cena INTEIRA de novo num alvo à parte, todo quadro. Vidro = transparente + reflexo;
// - clearcoat só no desktop; nada de sombra; Environment gerado UMA vez (frames={1});
// - malha pesada só onde aparece (esfera líquida 64 subdivisões, não 110) e pontos sem duplicata;
//   o que está invisível (opacidade ~0) não é desenhado;
// - DPR ≤1.5 desktop / ≤1.25 celular, e o PerformanceMonitor ainda baixa se o aparelho não aguentar;
//   antialias (MSAA) só em tela 1× — em tela densa o próprio DPR já alisa, e MSAA em 1.5× custa caro.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { onStageChange, stage } from './stage'

export type StageSceneName = 'produto' | 'particulas' | 'tunel' | 'liquido' | 'cidade'
export type StageObject = 'roda' | 'relogio' | 'joia' | 'frasco' | 'dispositivo'

export interface StageSceneProps {
  scene: StageSceneName
  object: StageObject
  word: string
  colors: [string, string]
  bg: string
  intensity: number
  mobile: boolean
  dark: boolean
  reduced: boolean
  onReady: () => void
}

// ───────────────────────── história (capítulos → parâmetros) ─────────────────────────

type P = Record<string, number>
interface Story {
  states: Record<string, P>
  order: string[]
  alias: Record<string, string>
}

const ALIAS: Record<string, string> = {
  inicio: 'hero', topo: 'hero', abertura: 'hero', capa: 'hero',
  fim: 'final', cta: 'final', contato: 'final', encerramento: 'final', fechamento: 'final',
  explodir: 'explode', explosao: 'explode', vista: 'explode', pecas: 'explode',
  detalhes: 'detalhe', zoom: 'detalhe', close: 'detalhe',
  cores: 'cor', acabamento: 'cor', giro: 'orbita', volta: 'orbita',
  apagado: 'fundo', conteudo: 'fundo', lista: 'fundo',
}

function story(base: P, states: Record<string, Partial<P>>, order: string[], alias: Record<string, string> = {}): Story {
  const full: Record<string, P> = {}
  for (const [k, v] of Object.entries(states)) {
    const s: P = { ...base }
    for (const [kk, vv] of Object.entries(v)) if (typeof vv === 'number') s[kk] = vv
    full[k] = s
  }
  return { states: full, order, alias: { ...ALIAS, ...alias } }
}

function stateName(s: Story, i: number): string {
  const n = stage.names.length
  if (!n) return s.order[0]
  const nm = stage.names[Math.max(0, Math.min(n - 1, i))]
  if (s.states[nm]) return nm
  const al = s.alias[nm]
  if (al && s.states[al]) return al
  return s.order[Math.max(0, i) % s.order.length] // estado desconhecido: roteiro padrão
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
// quanto o objeto anda pro lado no desktop: longe o bastante pra não ficar ATRÁS do título (com 0.2
// a roda de uma oficina caía embaixo do h1 em tela 1440) — o texto fica na outra metade
const SIDE_K = 0.27
const SIDE_MAX = 3.3
// "pausa" em cada capítulo: o estado segura perto da âncora e anda no meio do caminho
const ease = (f: number) => {
  const t = clamp01((f - 0.1) / 0.8)
  return t * t * (3 - 2 * t)
}

interface Sampled { a: string; b: string; t: number; side: number }

function sample(s: Story, cs: number, out: P): Sampled {
  const n = Math.max(1, stage.names.length)
  const c = Math.min(n - 1, Math.max(0, cs))
  const i0 = Math.floor(c)
  const i1 = Math.min(n - 1, i0 + 1)
  const t = ease(c - i0)
  const a = stateName(s, i0)
  const b = stateName(s, i1)
  const A = s.states[a]
  const B = s.states[b]
  for (const k in A) out[k] = A[k] + (B[k] - A[k]) * t
  const sa = stage.sides[i0] ?? 1
  const sb = stage.sides[i1] ?? sa
  return { a, b, t, side: sa + (sb - sa) * t }
}

// posição suavizada na história (uma vez por quadro, compartilhada por tudo)
const live = { cs: 0, last: -1, time: 0, vel: 0, lastP: 0 }
function tick(clock: number, dt: number, reduced: boolean): void {
  if (clock === live.last) return
  live.last = clock
  const d = Math.min(dt, 0.1)
  if (reduced) {
    live.cs = Math.round(stage.c)
    live.vel = 0
    return
  }
  live.cs = THREE.MathUtils.damp(live.cs, stage.c, 3.2, d)
  live.time += d
  const dp = (stage.p - live.lastP) / Math.max(d, 1e-3)
  live.lastP = stage.p
  live.vel = THREE.MathUtils.damp(live.vel, dp, 4, d)
}

// ───────────────────────── utilidades ─────────────────────────

function hex(c: THREE.Color): string {
  return '#' + c.getHexString()
}
function mixHex(a: string, b: string, t: number): string {
  return hex(new THREE.Color(a).lerp(new THREE.Color(b), t))
}

function dotTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')
  if (x) {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 128, 128)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** enquadra no celular: câmera mais longe quanto mais estreita a tela */
function useFit(): number {
  const { size } = useThree()
  const aspect = size.width / Math.max(1, size.height)
  return Math.max(1, 0.82 / aspect)
}

/** Estúdio de luz sem download (o mesmo truque do Hero3D): softboxes viram o reflexo. */
function Studio({ a, b, mobile }: { a: string; b: string; mobile: boolean }) {
  const room = useMemo(() => mixHex(a, '#000000', 0.9), [a])
  return (
    <Environment resolution={mobile ? 128 : 256} frames={1}>
      <color attach="background" args={[room]} />
      {[-2.4, -0.8, 0.8, 2.4].map((y, i) => (
        <Lightformer key={i} intensity={1.8} position={[0, y, -6]} scale={[14, 0.35, 1]} color="#ffffff" />
      ))}
      <Lightformer intensity={5} position={[-6, 0.5, 1]} rotation={[0, Math.PI / 2, 0]} scale={[12, 3, 1]} color={a} />
      <Lightformer intensity={4} position={[6, -0.5, 1]} rotation={[0, -Math.PI / 2, 0]} scale={[12, 3, 1]} color={b} />
      <Lightformer intensity={3} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 8, 1]} color="#ffffff" />
      <Lightformer intensity={1.5} position={[0, -6, 2]} rotation={[-Math.PI / 2, 0, 0]} scale={[10, 10, 1]} color={a} />
    </Environment>
  )
}

/** Poeira de luz em volta (profundidade), reage à velocidade da rolagem. */
function Dust({ color, mobile, dark, spread = 9 }: { color: string; mobile: boolean; dark: boolean; spread?: number }) {
  const n = mobile ? 160 : 420
  const ref = useRef<THREE.Points>(null)
  const { geo, map } = useMemo(() => {
    const p = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      p[i * 3] = (Math.random() - 0.5) * spread * 1.6
      p[i * 3 + 1] = (Math.random() - 0.5) * spread
      p[i * 3 + 2] = (Math.random() - 0.5) * spread - 2
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return { geo: g, map: dotTexture() }
  }, [n, spread])
  useEffect(() => () => { geo.dispose(); map.dispose() }, [geo, map])
  useFrame((_, dt) => {
    const o = ref.current
    if (!o) return
    o.rotation.y += Math.min(dt, 0.05) * 0.02
    o.position.y = -stage.p * 3 // a poeira "sobe" enquanto a pessoa desce: sensação de movimento
  })
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={mobile ? 0.05 : 0.04} map={map} color={color} transparent opacity={0.7} depthWrite={false}
        blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending} sizeAttenuation />
    </points>
  )
}

function Halo({ color, dark, scale = 7, opacity = 0.35 }: { color: string; dark: boolean; scale?: number; opacity?: number }) {
  const map = useMemo(() => dotTexture(), [])
  const mat = useRef<THREE.SpriteMaterial>(null)
  useEffect(() => () => map.dispose(), [map])
  return (
    <sprite scale={scale} position={[0, 0, -2.5]}>
      <spriteMaterial ref={mat} map={map} color={color} transparent opacity={opacity} depthWrite={false}
        blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending} />
    </sprite>
  )
}

// ───────────────────────── PRODUTO (vista explodida) ─────────────────────────

type MatKind = 'metal' | 'chrome' | 'steel' | 'rubber' | 'dark' | 'paint' | 'glass' | 'gem' | 'glow' | 'liquid'

interface Part {
  mat: MatKind
  geo: ReactNode
  pos: [number, number, number]
  rot?: [number, number, number]
  scale?: [number, number, number]
  /** deslocamento na vista explodida */
  ex: [number, number, number]
  /** giro extra na vista explodida */
  er?: [number, number, number]
  /** ponteiro de relógio: gira com o tempo */
  hand?: number
}

type V3 = [number, number, number]
interface Item { g: THREE.BufferGeometry; p: V3; r?: V3 }
/** muitas peças iguais numa malha só (banda do pneu, dentes de engrenagem): 1 draw call */
function merged(items: Item[]): THREE.BufferGeometry {
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const one = new THREE.Vector3(1, 1, 1)
  const list = items.map(({ g, p, r }) => {
    e.set(r?.[0] ?? 0, r?.[1] ?? 0, r?.[2] ?? 0)
    q.setFromEuler(e)
    m.compose(new THREE.Vector3(p[0], p[1], p[2]), q, one)
    return g.clone().applyMatrix4(m)
  })
  const out = mergeGeometries(list) ?? new THREE.BufferGeometry()
  list.forEach((g) => g.dispose())
  return out
}

function ring<T>(n: number, fn: (i: number, a: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => fn(i, (i / n) * Math.PI * 2))
}

function partsFor(obj: StageObject, mobile: boolean): Part[] {
  const seg = mobile ? 48 : 96
  switch (obj) {
    case 'roda': {
      // pneu = perfil de seção girado (lathe), banda de rodagem numa malha só (1 draw call)
      const prof = [[1.0, -0.28], [1.1, -0.36], [1.42, -0.38], [1.57, -0.34], [1.63, -0.22], [1.645, 0], [1.63, 0.22], [1.57, 0.34], [1.42, 0.38], [1.1, 0.36], [1.0, 0.28]]
        .map(([x, y]) => new THREE.Vector2(x, y))
      const nT = mobile ? 40 : 64
      const block = new THREE.BoxGeometry(0.1, 0.05, 0.25)
      const tread = merged([
        ...ring(nT, (_, a): Item => ({ g: block, p: [Math.sin(a) * 1.645, Math.cos(a) * 1.645, 0.15], r: [0, 0.25, -a] })),
        ...ring(nT, (_, a): Item => ({ g: block, p: [Math.sin(a + Math.PI / nT) * 1.645, Math.cos(a + Math.PI / nT) * 1.645, -0.15], r: [0, -0.25, -a - Math.PI / nT] })),
      ])
      const spokes = ring(10, (i): Part => {
        const a = Math.floor(i / 2) * ((Math.PI * 2) / 5) + (i % 2 ? 0.15 : -0.15) // 5 raios duplos
        return {
          mat: 'chrome', geo: <boxGeometry args={[0.085, 0.72, 0.07]} />,
          pos: [Math.sin(a) * 0.56, Math.cos(a) * 0.56, 0.17], rot: [0.12, 0, -a],
          ex: [Math.sin(a) * 0.6, Math.cos(a) * 0.6, 1.15], er: [0, 0, 0.5],
        }
      })
      const nuts = ring(5, (_, a): Part => ({
        mat: 'chrome', geo: <cylinderGeometry args={[0.045, 0.045, 0.1, 6]} />,
        pos: [Math.sin(a + 0.63) * 0.15, Math.cos(a + 0.63) * 0.15, 0.25], rot: [Math.PI / 2, 0, 0],
        ex: [Math.sin(a) * 0.55, Math.cos(a) * 0.55, 2.0],
      }))
      return [
        { mat: 'rubber', geo: <latheGeometry args={[prof, seg]} />, pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0], ex: [0, 0, -1.8] },
        { mat: 'rubber', geo: <primitive object={tread} attach="geometry" />, pos: [0, 0, 0], ex: [0, 0, -1.8] },
        { mat: 'dark', geo: <cylinderGeometry args={[0.99, 0.99, 0.52, seg, 1, true]} />, pos: [0, 0, -0.02], rot: [Math.PI / 2, 0, 0], ex: [0, 0, -0.75] },
        { mat: 'chrome', geo: <torusGeometry args={[0.99, 0.045, 12, seg]} />, pos: [0, 0, 0.24], ex: [0, 0, 0.5] },
        ...spokes,
        { mat: 'steel', geo: <cylinderGeometry args={[0.2, 0.25, 0.18, 32]} />, pos: [0, 0, 0.15], rot: [Math.PI / 2, 0, 0], ex: [0, 0, 1.55] },
        { mat: 'paint', geo: <cylinderGeometry args={[0.1, 0.1, 0.05, 32]} />, pos: [0, 0, 0.26], rot: [Math.PI / 2, 0, 0], ex: [0, 0, 2.5] },
        ...nuts,
        { mat: 'steel', geo: <cylinderGeometry args={[0.8, 0.8, 0.06, seg]} />, pos: [0, 0, -0.26], rot: [Math.PI / 2, 0, 0], ex: [0, 0, -1.05], er: [0, 1.2, 0] },
        { mat: 'steel', geo: <cylinderGeometry args={[0.34, 0.34, 0.14, 40]} />, pos: [0, 0, -0.2], rot: [Math.PI / 2, 0, 0], ex: [0, 0, -0.9] },
        { mat: 'paint', geo: <torusGeometry args={[0.72, 0.13, 14, 28, 1.15]} />, pos: [0, 0, -0.16], rot: [0, 0, 0.85], scale: [1, 1, 1.5], ex: [0.45, 0.65, -0.6] },
      ]
    }
    case 'relogio': {
      const marks = ring(12, (i, a): Part => ({
        mat: 'chrome', geo: <boxGeometry args={[i % 3 ? 0.035 : 0.06, i % 3 ? 0.12 : 0.2, 0.03]} />,
        pos: [Math.sin(a) * 0.74, Math.cos(a) * 0.74, 0.19], rot: [0, 0, -a],
        ex: [Math.sin(a) * 0.35, Math.cos(a) * 0.35, 1.05],
      }))
      const teeth = (r: number, x: number, y: number, z: number, exz: number): Part[] =>
        ring(mobile ? 14 : 22, (_, a): Part => ({
          mat: 'metal', geo: <boxGeometry args={[0.05, 0.08, 0.05]} />,
          pos: [x + Math.sin(a) * r, y + Math.cos(a) * r, z], rot: [0, 0, -a], ex: [0, 0, exz],
        }))
      return [
        { mat: 'metal', geo: <cylinderGeometry args={[1.02, 1.02, 0.34, seg]} />, pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0], ex: [0, 0, 0] },
        { mat: 'chrome', geo: <torusGeometry args={[1.02, 0.1, 16, seg]} />, pos: [0, 0, 0.16], ex: [0, 0, 0.45] },
        { mat: 'dark', geo: <cylinderGeometry args={[0.9, 0.9, 0.02, seg]} />, pos: [0, 0, 0.17], rot: [Math.PI / 2, 0, 0], ex: [0, 0, 0.75] },
        ...marks,
        { mat: 'chrome', geo: <boxGeometry args={[0.07, 0.46, 0.02]} />, pos: [0, 0, 0.21], ex: [0, 0, 1.35], hand: 1 / 43200 },
        { mat: 'chrome', geo: <boxGeometry args={[0.045, 0.7, 0.02]} />, pos: [0, 0, 0.225], ex: [0, 0, 1.55], hand: 1 / 3600 },
        { mat: 'paint', geo: <boxGeometry args={[0.02, 0.82, 0.015]} />, pos: [0, 0, 0.24], ex: [0, 0, 1.75], hand: 1 / 60 },
        { mat: 'paint', geo: <cylinderGeometry args={[0.05, 0.05, 0.06, 24]} />, pos: [0, 0, 0.24], rot: [Math.PI / 2, 0, 0], ex: [0, 0, 1.75] },
        { mat: 'glass', geo: <cylinderGeometry args={[0.93, 0.93, 0.04, seg]} />, pos: [0, 0, 0.27], rot: [Math.PI / 2, 0, 0], ex: [0, 0, 2.2] },
        { mat: 'metal', geo: <cylinderGeometry args={[0.09, 0.09, 0.22, 20]} />, pos: [1.1, 0, 0], rot: [0, 0, Math.PI / 2], ex: [0.9, 0, 0] },
        // movimento (engrenagens atrás do mostrador)
        { mat: 'metal', geo: <torusGeometry args={[0.42, 0.05, 10, 48]} />, pos: [-0.28, 0.18, -0.2], ex: [0, 0, -0.9], er: [0, 0, 2] },
        ...teeth(0.46, -0.28, 0.18, -0.2, -0.9),
        { mat: 'paint', geo: <torusGeometry args={[0.28, 0.04, 10, 40]} />, pos: [0.36, -0.26, -0.24], ex: [0, 0, -1.3], er: [0, 0, -2.5] },
        ...teeth(0.31, 0.36, -0.26, -0.24, -1.3),
        { mat: 'chrome', geo: <cylinderGeometry args={[0.7, 0.7, 0.03, seg]} />, pos: [0, 0, -0.3], rot: [Math.PI / 2, 0, 0], ex: [0, 0, -1.8] },
        // pulseira
        { mat: 'rubber', geo: <boxGeometry args={[0.86, 0.95, 0.14]} />, pos: [0, 1.5, -0.08], rot: [0.22, 0, 0], ex: [0, 0.7, -0.5] },
        { mat: 'rubber', geo: <boxGeometry args={[0.86, 0.95, 0.14]} />, pos: [0, -1.5, -0.08], rot: [-0.22, 0, 0], ex: [0, -0.7, -0.5] },
        { mat: 'metal', geo: <boxGeometry args={[1.05, 0.14, 0.26]} />, pos: [0, 1.0, 0], ex: [0, 0.45, -0.2] },
        { mat: 'metal', geo: <boxGeometry args={[1.05, 0.14, 0.26]} />, pos: [0, -1.0, 0], ex: [0, -0.45, -0.2] },
      ]
    }
    case 'joia': {
      const pave = ring(mobile ? 14 : 22, (_, a): Part => ({
        mat: 'gem', geo: <octahedronGeometry args={[0.07, 0]} />,
        pos: [Math.sin(a) * 1.08, Math.cos(a) * 1.08, 0.02], ex: [Math.sin(a) * 0.9, Math.cos(a) * 0.9, 0.8], er: [2, 2, 0],
      })).filter((_, i, arr) => {
        const a = (i / arr.length) * Math.PI * 2
        return Math.cos(a) > -0.2 && Math.abs(Math.sin(a)) > 0.2 // só na metade de cima, fora da cabeça
      })
      const prongs = ring(6, (_, a): Part => ({
        mat: 'metal', geo: <cylinderGeometry args={[0.03, 0.045, 0.55, 10]} />,
        pos: [Math.sin(a) * 0.36, 1.3, Math.cos(a) * 0.36], rot: [Math.cos(a) * -0.35, 0, Math.sin(a) * 0.35],
        ex: [Math.sin(a) * 0.8, 0.35, Math.cos(a) * 0.8],
      }))
      return [
        { mat: 'metal', geo: <torusGeometry args={[1.08, 0.13, 32, seg * 2]} />, pos: [0, 0, 0], scale: [1, 1, 1.6], ex: [0, -0.6, 0] },
        ...pave,
        { mat: 'metal', geo: <cylinderGeometry args={[0.32, 0.18, 0.28, 24]} />, pos: [0, 1.12, 0], ex: [0, 0.35, 0] },
        ...prongs,
        // brilhante: coroa + pavilhão (facetado)
        { mat: 'gem', geo: <cylinderGeometry args={[0.28, 0.52, 0.2, 16]} />, pos: [0, 1.72, 0], ex: [0, 1.25, 0], er: [0, 1.6, 0] },
        { mat: 'gem', geo: <cylinderGeometry args={[0.52, 0.02, 0.5, 16]} />, pos: [0, 1.37, 0], ex: [0, 0.9, 0], er: [0, -1.2, 0] },
      ]
    }
    case 'frasco': {
      const prof = [[0.001, 0], [0.62, 0], [0.72, 0.08], [0.76, 0.5], [0.74, 1.5], [0.6, 1.78], [0.24, 1.9], [0.2, 2.02], [0.001, 2.02]]
        .map(([x, y]) => new THREE.Vector2(x, y))
      const inner = prof.map((v) => new THREE.Vector2(v.x * 0.86, v.y * 0.72 + 0.08)).slice(0, 5)
      inner.push(new THREE.Vector2(0.001, inner[inner.length - 1].y))
      return [
        { mat: 'glass', geo: <latheGeometry args={[prof, seg]} />, pos: [0, -1.1, 0], ex: [0, 0.2, 0] },
        { mat: 'liquid', geo: <latheGeometry args={[inner, seg]} />, pos: [0, -1.1, 0], ex: [0, -0.55, 0], er: [0, 1.2, 0] },
        { mat: 'metal', geo: <cylinderGeometry args={[0.3, 0.3, 0.18, 40]} />, pos: [0, 1.0, 0], ex: [0, 0.8, 0] },
        { mat: 'chrome', geo: <cylinderGeometry args={[0.06, 0.06, 0.2, 16]} />, pos: [0, 1.18, 0], ex: [0, 1.25, 0] },
        { mat: 'metal', geo: <cylinderGeometry args={[0.42, 0.46, 0.8, 8]} />, pos: [0, 1.5, 0], ex: [0, 2.0, 0], er: [0, 0.8, 0.25] },
        { mat: 'paint', geo: <torusGeometry args={[0.46, 0.035, 10, 60]} />, pos: [0, 1.1, 0], rot: [Math.PI / 2, 0, 0], ex: [0, 1.5, 0] },
      ]
    }
    default: {
      // dispositivo: camadas de um aparelho (vidro, tela, placa, bateria, tampa)
      const chips = [[-0.3, 0.7, 0.3], [0.25, 0.5, 0.2], [-0.2, -0.2, 0.45], [0.3, -0.6, 0.25], [0.0, 1.05, 0.15]].map(([x, y, s], i): Part => ({
        mat: i % 2 ? 'chrome' : 'paint', geo: <boxGeometry args={[s, s * 0.8, 0.06]} />,
        pos: [x, y, 0.02], ex: [0, 0, -0.35 + i * 0.05],
      }))
      return [
        { mat: 'glass', geo: <boxGeometry args={[1.62, 3.12, 0.04]} />, pos: [0, 0, 0.14], ex: [0, 0, 1.9] },
        { mat: 'glow', geo: <planeGeometry args={[1.5, 3.0]} />, pos: [0, 0, 0.11], ex: [0, 0, 1.25] },
        { mat: 'metal', geo: <boxGeometry args={[1.7, 3.2, 0.2]} />, pos: [0, 0, 0], ex: [0, 0, 0.45] },
        { mat: 'dark', geo: <boxGeometry args={[1.4, 2.8, 0.04]} />, pos: [0, 0, -0.02], ex: [0, 0, -0.4] },
        ...chips,
        { mat: 'rubber', geo: <boxGeometry args={[1.2, 1.5, 0.1]} />, pos: [0, -0.55, -0.08], ex: [0, 0, -1.2] },
        { mat: 'chrome', geo: <cylinderGeometry args={[0.17, 0.17, 0.08, 32]} />, pos: [-0.42, 1.12, -0.13], rot: [Math.PI / 2, 0, 0], ex: [0, 0, -2.2] },
        { mat: 'chrome', geo: <cylinderGeometry args={[0.13, 0.13, 0.08, 32]} />, pos: [-0.42, 0.78, -0.13], rot: [Math.PI / 2, 0, 0], ex: [0, 0, -2.2] },
        { mat: 'paint', geo: <boxGeometry args={[1.7, 3.2, 0.03]} />, pos: [0, 0, -0.12], ex: [0, 0, -1.8] },
      ]
    }
  }
}

/** tela do `dispositivo`: gradiente vivo + grade de ícones (nada de imagem) */
function screenMaterial(a: string, b: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform vec3 uA; uniform vec3 uB; uniform float uTime; varying vec2 vUv;
      float box(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        vec3 col = vec3(0.015, 0.02, 0.035);
        col += uA * 0.75 * smoothstep(0.75, 0.0, length((uv - vec2(0.3 + 0.15 * sin(uTime * 0.4), 0.78)) * vec2(1.0, 2.0)));
        col += uB * 0.45 * smoothstep(0.7, 0.0, length((uv - vec2(0.75, 0.3 + 0.08 * cos(uTime * 0.5))) * vec2(1.0, 2.0)));
        vec2 g = uv * vec2(4.0, 8.0); vec2 id = floor(g); vec2 f = fract(g) - 0.5;
        if (uv.y > 0.25 && uv.y < 0.62) {
          float d = box(f, vec2(0.33), 0.12);
          vec3 tc = mix(uA, uB, hash(id)) * (0.7 + 0.3 * hash(id + 3.0)) + 0.08;
          col = mix(col, tc, 1.0 - smoothstep(0.0, 0.03, d));
        }
        float w = box((uv - vec2(0.5, 0.76)) * vec2(1.0, 2.0), vec2(0.4, 0.17), 0.08);
        col = mix(col, col * 0.5 + vec3(0.9) * 0.18, (1.0 - smoothstep(0.0, 0.01, w)) * 0.6);
        float dock = box((uv - vec2(0.5, 0.08)) * vec2(1.0, 2.0), vec2(0.42, 0.07), 0.06);
        col = mix(col, vec3(1.0) * 0.14 + col * 0.6, 1.0 - smoothstep(0.0, 0.01, dock));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

// cada objeto tem um tamanho natural diferente: normaliza pra caber igual no quadro
const OBJ_SCALE: Record<StageObject, number> = { roda: 1, relogio: 0.86, joia: 0.92, frasco: 0.8, dispositivo: 0.82 }
const OBJ_Y: Record<StageObject, number> = { roda: 0, relogio: 0, joia: -0.35, frasco: 0, dispositivo: 0 }

function useMaterials(a: string, b: string, mobile: boolean, obj: StageObject) {
  return useMemo(() => {
    const gold = mixHex(a, '#ffffff', 0.3)
    // clearcoat = segundo reflexo por pixel: no celular sai (a diferença não aparece na tela pequena)
    const cc = mobile ? 0 : 1
    const m: Record<MatKind, THREE.Material> = {
      metal: new THREE.MeshPhysicalMaterial({ color: gold, metalness: 1, roughness: 0.16, clearcoat: cc, clearcoatRoughness: 0.08, envMapIntensity: 1.4 }),
      chrome: new THREE.MeshPhysicalMaterial({ color: '#e9ebf0', metalness: 1, roughness: 0.06, envMapIntensity: 1.6 }),
      steel: new THREE.MeshPhysicalMaterial({ color: '#8d939e', metalness: 1, roughness: 0.32, envMapIntensity: 1.2 }),
      rubber: new THREE.MeshPhysicalMaterial({ color: obj === 'relogio' ? mixHex(a, '#101114', 0.82) : '#17181b', metalness: 0, roughness: 0.62, clearcoat: 0.25 * cc, clearcoatRoughness: 0.6, side: THREE.DoubleSide }),
      dark: new THREE.MeshPhysicalMaterial({ color: '#0b0c10', metalness: 0.4, roughness: 0.35, clearcoat: cc, envMapIntensity: 1 }),
      paint: new THREE.MeshPhysicalMaterial({ color: a, metalness: 0.35, roughness: 0.25, clearcoat: cc, clearcoatRoughness: 0.05, envMapIntensity: 1.2 }),
      // vidro SEM transmission (ela re-renderiza a cena inteira a cada quadro): fino, transparente e
      // espelhado pelo estúdio — lido como vidro, custo de um material comum
      glass: new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.02, transparent: true, opacity: mobile ? 0.14 : 0.17, clearcoat: cc, envMapIntensity: mobile ? 2.5 : 2.8, depthWrite: false, side: THREE.DoubleSide }),
      // gema: brilho vem do reflexo facetado + iridescência (sem transmission, pelo mesmo motivo)
      gem: new THREE.MeshPhysicalMaterial({ color: mixHex(b, '#ffffff', 0.7), metalness: 0.2, roughness: 0, flatShading: true, clearcoat: cc, iridescence: mobile ? 0 : 1, iridescenceIOR: 1.6, envMapIntensity: 3.4 }),
      glow: screenMaterial(a, b),
      liquid: new THREE.MeshPhysicalMaterial({ color: a, metalness: 0.1, roughness: 0.08, clearcoat: cc, envMapIntensity: 1.6, emissive: a, emissiveIntensity: 0.12 }),
    }
    return m
  }, [a, b, mobile, obj])
}

const PRODUTO = story(
  { ry: -0.55, rx: 0.12, rz: 0, ex: 0, cz: 7.2, cy: 0, ty: 0, s: 1, fx: 1, mix: 0, dim: 0, spin: 0.12, glow: 0.35 },
  {
    hero: {},
    explode: { ry: -1.05, rx: 0.3, ex: 1, cz: 8.8, fx: 0.85, spin: 0.04, glow: 0.5 },
    detalhe: { ry: -0.15, rx: 0.05, ex: 0.18, cz: 4.9, ty: -0.3, fx: 1, spin: 0.02 },
    orbita: { ry: 2.6, rx: -0.2, ex: 0.35, cz: 7.4, spin: 0.2 },
    cor: { ry: 0.5, rx: 0.2, mix: 1, cz: 6.6, glow: 0.6 },
    montagem: { ry: 4.2, ex: 0, cz: 7 },
    fundo: { dim: 1, s: 0.8, cz: 10, fx: 0.4, spin: 0.25, glow: 0.15 },
    final: { ry: 6.0, rx: 0.1, ex: 0, cz: 8.4, fx: 0, s: 0.9, glow: 0.7 },
  },
  ['hero', 'explode', 'detalhe', 'orbita', 'cor', 'final'],
  { produto: 'hero', silhueta: 'hero' },
)

function Produto({ object, a, b, mobile, dark, reduced, k }: { object: StageObject; a: string; b: string; mobile: boolean; dark: boolean; reduced: boolean; k: number }) {
  const parts = useMemo(() => partsFor(object, mobile), [object, mobile])
  const mats = useMaterials(a, b, mobile, object)
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  const root = useRef<THREE.Group>(null)
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const cur = useRef<P>({})
  const fit = useFit()
  const { viewport, camera } = useThree()
  const colA = useMemo(() => new THREE.Color(mixHex(a, '#ffffff', 0.3)), [a])
  const colB = useMemo(() => new THREE.Color('#e4e7ee'), [])
  const paintA = useMemo(() => new THREE.Color(a), [a])
  const paintB = useMemo(() => new THREE.Color(b), [b])
  const spinAcc = useRef(0)
  const halo = useRef<THREE.Group>(null)
  useFrame((state, dt) => {
    tick(state.clock.elapsedTime, dt, reduced)
    const p = cur.current
    const sm = sample(PRODUTO, live.cs, p)
    const g = root.current
    if (!g) return
    spinAcc.current += Math.min(dt, 0.05) * p.spin * k * (reduced ? 0 : 1)
    const px = mobile ? 0 : sm.side * p.fx * Math.min(viewport.width * SIDE_K, SIDE_MAX) * (camera.position.z / 7.2)
    const py = (mobile ? 1.7 : 0) + p.ty + OBJ_Y[object] // celular: objeto no terço de cima, texto embaixo
    g.position.set(px, py, 0)
    g.rotation.set(p.rx + stage.y * 0.12 + live.vel * 0.15, p.ry + spinAcc.current + stage.x * 0.25 + live.cs * 0.3, p.rz)
    g.scale.setScalar(p.s * OBJ_SCALE[object] * (mobile ? 0.78 : 1))
    const scr = mats.glow as THREE.ShaderMaterial
    if (scr.uniforms) scr.uniforms.uTime.value = live.time
    const ex = p.ex
    parts.forEach((pt, i) => {
      const m = refs.current[i]
      if (!m) return
      m.position.set(pt.pos[0] + pt.ex[0] * ex, pt.pos[1] + pt.ex[1] * ex, pt.pos[2] + pt.ex[2] * ex)
      const r = pt.rot ?? [0, 0, 0]
      const er = pt.er ?? [0, 0, 0]
      let rz = r[2] + er[2] * ex
      if (pt.hand) rz = -((Date.now() / 1000) * pt.hand * Math.PI * 2) % (Math.PI * 2)
      m.rotation.set(r[0] + er[0] * ex, r[1] + er[1] * ex, rz)
    })
    ;(mats.metal as THREE.MeshPhysicalMaterial).color.lerpColors(colA, colB, p.mix)
    ;(mats.paint as THREE.MeshPhysicalMaterial).color.lerpColors(paintA, paintB, p.mix)
    const cz = p.cz * fit
    camera.position.set(0, p.cy, cz)
    camera.lookAt(0, 0, 0)
    const vis = 1 - p.dim * 0.75
    g.visible = vis > 0.02
    if (halo.current) {
      halo.current.position.set(px * 0.9, py, -2)
      halo.current.scale.setScalar(0.6 + p.glow)
    }
    state.gl.toneMappingExposure = 0.35 + vis * 0.75
  })
  return (
    <>
      <Studio a={a} b={b} mobile={mobile} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} />
      <directionalLight position={[-4, -2, 3]} intensity={0.5} color={b} />
      <group ref={halo}>
        <Halo color={a} dark={dark} scale={9} opacity={dark ? 0.32 : 0.18} />
      </group>
      <group ref={root}>
        {parts.map((pt, i) => (
          <mesh key={i} ref={(el) => { refs.current[i] = el }} material={mats[pt.mat]} scale={pt.scale ?? [1, 1, 1]}>
            {pt.geo}
          </mesh>
        ))}
      </group>
      <Dust color={b} mobile={mobile} dark={dark} />
    </>
  )
}

// ───────────────────────── PARTÍCULAS (morfose de formas) ─────────────────────────

const SHAPES = ['esfera', 'anel', 'texto', 'onda', 'galaxia', 'nuvem', 'helice'] as const

const PARTICULAS = story(
  { shape: 0, ry: 0, rx: 0.15, rz: 0, cz: 7.5, s: 1, fx: 1, dim: 0, spin: 0.08, size: 1 },
  {
    hero: { shape: 0 },
    esfera: { shape: 0 },
    anel: { shape: 1, rx: 1.0, ry: 0.4, fx: 0.8 },
    texto: { shape: 2, rx: 0, ry: 0, fx: 0, spin: 0, cz: 6.8 },
    onda: { shape: 3, rx: 0.55, cz: 6.5, fx: 0, spin: 0.02 },
    galaxia: { shape: 4, rx: 0.9, cz: 8, spin: 0.14, fx: 0.6 },
    nuvem: { shape: 5, cz: 7, fx: 0, spin: 0.04, size: 0.8 },
    helice: { shape: 6, rx: 0.1, rz: 0.4, cz: 7.8, spin: 0.25 },
    fundo: { shape: 5, dim: 1, fx: 0, size: 0.7 },
    final: { shape: 2, fx: 0, rx: 0, ry: 0, spin: 0, cz: 7.2 },
  },
  ['esfera', 'anel', 'galaxia', 'helice', 'onda', 'texto'],
  { explode: 'nuvem', explosao: 'nuvem', particulas: 'nuvem', logo: 'texto', marca: 'texto', nome: 'texto', dna: 'helice', orbita: 'galaxia', cor: 'anel', detalhe: 'helice' },
)

function fillShape(kind: number, n: number, out: Float32Array, mobile: boolean): void {
  const rnd = Math.random
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0, z = 0
    const u = rnd(), v = rnd()
    switch (kind) {
      case 0: { // pata de cachorro: almofada principal + 4 dedos
        const pads: [number, number, number, number, number][] = [
          [0, -0.55, 1.05, 0.85, 0.44], [-1.25, 0.45, 0.38, 0.5, 0.14], [-0.45, 1.15, 0.4, 0.52, 0.14],
          [0.45, 1.15, 0.4, 0.52, 0.14], [1.25, 0.45, 0.38, 0.5, 0.14],
        ]
        let acc = 0; const pick = rnd()
        let pd = pads[0]
        for (const q of pads) { acc += q[4]; if (pick <= acc) { pd = q; break } }
        const ang = rnd() * Math.PI * 2, rr = Math.sqrt(rnd())
        const edge = rnd() < 0.35 ? 1 : rr
        x = pd[0] + Math.cos(ang) * pd[2] * edge; y = pd[1] + Math.sin(ang) * pd[3] * edge
        z = (rnd() - 0.5) * 0.5 * Math.sqrt(Math.max(0, 1 - edge * edge)) + (rnd() - 0.5) * 0.04
        break
      }
      case 1: { // anel (toro)
        const a = u * Math.PI * 2, b = v * Math.PI * 2, R = 1.9, r = 0.32 * Math.sqrt(rnd())
        x = (R + r * Math.cos(b)) * Math.cos(a); y = (R + r * Math.cos(b)) * Math.sin(a); z = r * Math.sin(b)
        break
      }
      case 3: { // onda (plano; o shader anima a altura)
        const side = Math.ceil(Math.sqrt(n))
        x = ((i % side) / side - 0.5) * (mobile ? 6 : 10); z = (Math.floor(i / side) / side - 0.5) * 6; y = 0
        break
      }
      case 4: { // galáxia espiral
        const r = Math.pow(u, 0.6) * 3.4, arm = (i % 4) / 4 * Math.PI * 2, sp = r * 1.25
        x = Math.cos(arm + sp) * r + (rnd() - 0.5) * 0.35; z = Math.sin(arm + sp) * r + (rnd() - 0.5) * 0.35; y = (rnd() - 0.5) * 0.25 * (3.4 - r) * 0.5
        break
      }
      case 5: { // nuvem (explosão)
        const r = 2.5 + Math.pow(rnd(), 0.5) * 4.5, t = Math.acos(2 * u - 1), ph = v * Math.PI * 2
        x = Math.sin(t) * Math.cos(ph) * r * 1.4; y = Math.sin(t) * Math.sin(ph) * r; z = Math.cos(t) * r - 1
        break
      }
      case 6: { // hélice dupla
        const t = (i / n) * Math.PI * 8, strand = i % 3
        const h = (i / n - 0.5) * 5
        if (strand === 2) { // degraus
          const k = rnd() * 2 - 1
          x = Math.cos(t) * 0.9 * k; z = Math.sin(t) * 0.9 * k
        } else {
          const o = strand ? Math.PI : 0
          x = Math.cos(t + o) * 0.9 + (rnd() - 0.5) * 0.08; z = Math.sin(t + o) * 0.9 + (rnd() - 0.5) * 0.08
        }
        y = h
        break
      }
      default: { // texto sem palavra: esfera
        const t = Math.acos(2 * u - 1), ph = v * Math.PI * 2
        x = Math.sin(t) * Math.cos(ph) * 1.7; y = Math.sin(t) * Math.sin(ph) * 1.7; z = Math.cos(t) * 1.7
      }
    }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z
  }
}

function textShape(word: string, n: number, out: Float32Array, width: number): boolean {
  const W = 1400, H = 360
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const x = c.getContext('2d', { willReadFrequently: true })
  if (!x || !word.trim()) return false
  const fam = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'system-ui, sans-serif'
  let size = 260
  x.font = `800 ${size}px ${fam}`
  const w = x.measureText(word).width
  if (w > W * 0.94) {
    size = Math.floor(size * (W * 0.94) / w)
    x.font = `800 ${size}px ${fam}`
  }
  x.fillStyle = '#fff'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText(word, W / 2, H / 2)
  const d = x.getImageData(0, 0, W, H).data
  const pts: number[] = []
  for (let y = 0; y < H; y += 2) for (let xx = 0; xx < W; xx += 2) if (d[(y * W + xx) * 4 + 3] > 128) pts.push(xx, y)
  if (pts.length < 40) return false
  const tw = x.measureText(word).width
  const sc = width / Math.max(tw, 1)
  const m = pts.length / 2
  for (let i = 0; i < n; i++) {
    const k = Math.floor(Math.random() * m) * 2
    out[i * 3] = (pts[k] - W / 2) * sc + (Math.random() - 0.5) * 0.02
    out[i * 3 + 1] = -(pts[k + 1] - H / 2) * sc + (Math.random() - 0.5) * 0.02
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.3
  }
  return true
}

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

function Particulas({ word, a, b, mobile, dark, reduced, k }: { word: string; a: string; b: string; mobile: boolean; dark: boolean; reduced: boolean; k: number }) {
  const n = mobile ? 6000 : 16000
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    for (let s = 0; s < SHAPES.length; s++) {
      const arr = new Float32Array(n * 3)
      fillShape(s, n, arr, mobile)
      g.setAttribute(s === 0 ? 'position' : `aP${s}`, new THREE.BufferAttribute(arr, 3))
    }
    const r = new Float32Array(n)
    for (let i = 0; i < n; i++) r[i] = Math.random()
    g.setAttribute('aR', new THREE.BufferAttribute(r, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20)
    const sel = SHAPES.map((_, i) => `if(i==${i}) return ${i === 0 ? 'position' : `aP${i}`};`).join(' else ')
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: dark ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uFrom: { value: 0 }, uTo: { value: 0 }, uT: { value: 0 }, uTime: { value: 0 },
        uSize: { value: (mobile ? 3.6 : 3.4) * Math.min(window.devicePixelRatio || 1, 1.5) },
        uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uDim: { value: 0 }, uDark: { value: dark ? 1 : 0 },
      },
      vertexShader: NOISE + `
        ${SHAPES.slice(1).map((_, i) => `attribute vec3 aP${i + 1};`).join('\n')}
        attribute float aR;
        uniform int uFrom; uniform int uTo; uniform float uT; uniform float uTime; uniform float uSize;
        varying float vR; varying float vMix;
        vec3 shapeAt(int i){ ${sel} return position; }
        vec3 animate(int i, vec3 p){
          if(i==3){ p.y = sin(p.x*1.1 + uTime*1.2)*0.35 + cos(p.z*1.4 + uTime*0.9)*0.25; }
          if(i==5){ p += 0.25*vec3(snoise(p*0.3+uTime*0.1), snoise(p*0.3+7.0+uTime*0.1), 0.0); }
          return p;
        }
        void main(){
          float t = smoothstep(aR*0.35, aR*0.35+0.65, uT);
          vec3 a = animate(uFrom, shapeAt(uFrom));
          vec3 b = animate(uTo, shapeAt(uTo));
          vec3 p = mix(a, b, t);
          // no meio da troca as partículas se espalham (a forma "explode" e se recompõe)
          float mid = sin(t*3.14159);
          p += mid * 0.9 * vec3(snoise(p*0.6+aR*9.0), snoise(p*0.6+3.0), snoise(p*0.6+5.0));
          p += 0.03*vec3(snoise(p*1.5+uTime*0.3));
          vR = aR; vMix = clamp(0.5 + p.y*0.18 + (aR-0.5)*0.6, 0.0, 1.0);
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          gl_PointSize = uSize * (0.55 + aR*0.9) * (7.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uA; uniform vec3 uB; uniform float uDim; uniform float uDark;
        varying float vR; varying float vMix;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          if(d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, d) * (1.0 - uDim*0.8);
          vec3 col = mix(uA, uB, vMix);
          if(vR > 0.94) col = mix(col, vec3(1.0), 0.75);
          col *= mix(1.0, 1.6, uDark);
          gl_FragColor = vec4(col, alpha);
          #include <colorspace_fragment>
        }`,
    })
    return { geo: g, mat: m }
  }, [n, a, b, dark, mobile])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  // a palavra precisa da fonte carregada
  useEffect(() => {
    let off = false
    const run = () => {
      if (off) return
      const attr = geo.getAttribute('aP2') as THREE.BufferAttribute
      if (textShape(word, n, attr.array as Float32Array, mobile ? 3.4 : 6.4)) attr.needsUpdate = true
    }
    if (document.fonts?.ready) document.fonts.ready.then(run).catch(run)
    else run()
    return () => { off = true }
  }, [geo, word, n, mobile])
  const g = useRef<THREE.Group>(null)
  const cur = useRef<P>({})
  const fit = useFit()
  const { viewport, camera } = useThree()
  const spin = useRef(0)
  useFrame((state, dt) => {
    tick(state.clock.elapsedTime, dt, reduced)
    const p = cur.current
    const sm = sample(PARTICULAS, live.cs, p)
    const from = PARTICULAS.states[sm.a].shape
    const to = PARTICULAS.states[sm.b].shape
    mat.uniforms.uFrom.value = from
    mat.uniforms.uTo.value = to
    mat.uniforms.uT.value = from === to ? 0 : sm.t
    mat.uniforms.uTime.value = live.time * k
    mat.uniforms.uDim.value = p.dim
    const o = g.current
    if (!o) return
    spin.current += reduced ? 0 : Math.min(dt, 0.05) * p.spin * k
    // o texto fica de frente: o giro automático some quando a forma é a palavra
    const textW = (from === 2 ? 1 - sm.t : 0) + (to === 2 ? sm.t : 0)
    o.rotation.set(p.rx + stage.y * 0.1, (p.ry + spin.current) * (1 - textW) + stage.x * 0.2, p.rz * (1 - textW))
    const px = mobile ? 0 : sm.side * p.fx * Math.min(viewport.width * SIDE_K, SIDE_MAX) * (camera.position.z / 7.5)
    o.position.set(px, mobile ? 1.3 * (1 - textW) : 0, 0)
    o.scale.setScalar(p.s)
    camera.position.set(0, 0, p.cz * (textW > 0.5 ? Math.min(fit, 1.4) : fit))
    camera.lookAt(0, 0, 0)
  })
  return (
    <group ref={g}>
      <points geometry={geo} material={mat} />
    </group>
  )
}

// ───────────────────────── TÚNEL (voo da câmera) ─────────────────────────

const TUNEL = story(
  { cx: 3.2, cy: 1.2, off: 9, twist: 0.02, roll: 0, rad: 1, glow: 0.8, mix: 0, dim: 0, sides: 6 },
  {
    hero: {},
    entrada: {},
    voo: { cx: 0, cy: 0, off: 0, twist: 0.05, glow: 1 },
    espiral: { cx: 0.4, cy: -0.3, off: 0, twist: 0.35, roll: 1.2, glow: 1.1, mix: 0.5 },
    luz: { cx: 0, cy: 0, off: 0, twist: 0.08, rad: 1.6, glow: 1.6, mix: 1 },
    curva: { cx: -0.8, cy: 0.5, off: 0, twist: 0.15, roll: -0.6, glow: 1 },
    fundo: { cx: 0, cy: 0, off: 0, dim: 1, glow: 0.5 },
    final: { cx: 0, cy: 0, off: 0, twist: 0, rad: 2.4, glow: 1.8, mix: 0.3 },
    saida: { cx: 0, cy: 0, off: 0, twist: 0, rad: 2.4, glow: 1.8, mix: 0.3 },
  },
  ['entrada', 'voo', 'espiral', 'luz', 'curva', 'final'],
  { explode: 'espiral', detalhe: 'voo', orbita: 'espiral', cor: 'luz' },
)

function Tunel({ a, b, bg, mobile, dark, reduced, k }: { a: string; b: string; bg: string; mobile: boolean; dark: boolean; reduced: boolean; k: number }) {
  const count = mobile ? 70 : 120
  const gap = 1.4
  const rings = useRef<THREE.InstancedMesh>(null)
  const streak = useRef<THREE.Points>(null)
  const cur = useRef<P>({})
  const { camera, scene } = useThree()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const cols = useMemo(() => {
    const A = new THREE.Color(a), B = new THREE.Color(b), W = new THREE.Color('#ffffff')
    return Array.from({ length: count }, (_, i) => (i % 7 === 0 ? W : i % 2 ? A : B).clone())
  }, [a, b, count])
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.95, blending: dark ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false }), [dark])
  const ringGeo = useMemo(() => new THREE.TorusGeometry(2.3, 0.022, 4, 6), [])
  const sn = mobile ? 900 : 2400
  const { sGeo, sMap } = useMemo(() => {
    const p = new Float32Array(sn * 3)
    for (let i = 0; i < sn; i++) {
      const ang = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 1.5
      p[i * 3] = Math.cos(ang) * r
      p[i * 3 + 1] = Math.sin(ang) * r
      p[i * 3 + 2] = -Math.random() * count * gap
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return { sGeo: g, sMap: dotTexture() }
  }, [sn, count])
  useEffect(() => () => { ringGeo.dispose(); ringMat.dispose(); sGeo.dispose(); sMap.dispose() }, [ringGeo, ringMat, sGeo, sMap])
  useEffect(() => {
    const fog = new THREE.Fog(bg, 2, 26)
    scene.fog = fog
    scene.background = new THREE.Color(bg)
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = 62
    cam.updateProjectionMatrix()
    return () => { scene.fog = null; scene.background = null }
  }, [bg, scene, camera])
  const travel = useRef(0)
  const tmp = useMemo(() => new THREE.Color(), [])
  useFrame((state, dt) => {
    tick(state.clock.elapsedTime, dt, reduced)
    const p = cur.current
    sample(TUNEL, live.cs, p)
    const n = Math.max(1, stage.names.length)
    const span = (count * gap - 18) / Math.max(1, n - 1)
    travel.current = live.cs * span + (reduced ? 0 : live.time * 0.25 * k)
    const z = -travel.current
    camera.position.set(p.cx + stage.x * 0.3, p.cy + stage.y * 0.2, z + p.off)
    camera.lookAt(0, 0, z - 8)
    camera.rotation.z += p.roll + live.vel * 0.3
    const m = rings.current
    if (m) {
      for (let i = 0; i < count; i++) {
        const rz = -i * gap
        dummy.position.set(Math.sin(i * 0.35 + live.time * 0.4) * 0.25 * p.twist * 3, Math.cos(i * 0.3) * 0.2 * p.twist * 3, rz)
        dummy.rotation.set(0, 0, i * p.twist + live.time * 0.1 * k)
        const s = p.rad * (1 + 0.08 * Math.sin(i * 0.5 + live.time))
        dummy.scale.set(s, s, 1)
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
        tmp.copy(cols[i]).multiplyScalar(p.glow * (1 - p.dim * 0.7))
        m.setColorAt(i, tmp)
      }
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
    const st = streak.current
    if (st) st.rotation.z += Math.min(dt, 0.05) * (0.1 + p.twist) * k
  })
  return (
    <>
      <instancedMesh ref={rings} args={[ringGeo, ringMat, count]} frustumCulled={false} />
      <points ref={streak} geometry={sGeo} frustumCulled={false}>
        <pointsMaterial size={mobile ? 0.07 : 0.05} map={sMap} color={b} transparent depthWrite={false}
          blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending} sizeAttenuation />
      </points>
      <sprite position={[0, 0, -count * gap - 4]} scale={30}>
        <spriteMaterial map={sMap} color={a} transparent depthWrite={false} fog={false} blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending} />
      </sprite>
    </>
  )
}

// ───────────────────────── LÍQUIDO (esfera que se transforma) ─────────────────────────

const LIQUIDO = story(
  { amp: 0.16, freq: 0.85, spd: 0.22, mix: 0, fres: 0.4, s: 1.3, fx: 1, dim: 0, pts: 0, solid: 1, cz: 7, ry: 0 },
  {
    hero: {},
    calmo: { amp: 0.1, freq: 0.7 },
    onda: { amp: 0.32, freq: 1.25, spd: 0.35, mix: 0.4, ry: 1.2 },
    pico: { amp: 0.5, freq: 2.3, spd: 0.5, mix: 0.8, fres: 0.8, s: 1.15, ry: 2.2 },
    pontos: { amp: 0.3, freq: 1.4, pts: 1, solid: 0, s: 1.55, ry: 3 },
    espelho: { amp: 0.08, freq: 0.6, fres: 1.4, mix: 1, s: 1.45, fx: 0.5 },
    fundo: { dim: 1, s: 1.2, fx: 0.3, amp: 0.1 },
    final: { amp: 0.2, freq: 1, fx: 0, s: 1.3, mix: 0.5, fres: 0.9 },
  },
  ['calmo', 'onda', 'pico', 'pontos', 'espelho', 'final'],
  { explode: 'pontos', detalhe: 'pico', orbita: 'onda', cor: 'espelho', particulas: 'pontos' },
)

function Liquido({ a, b, mobile, dark, reduced, k }: { a: string; b: string; mobile: boolean; dark: boolean; reduced: boolean; k: number }) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uAmp: { value: 0.16 }, uFreq: { value: 0.85 }, uMix: { value: 0 }, uFres: { value: 0.4 },
    uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uDark: { value: dark ? 1 : 0 }, uAlpha: { value: 1 }, uPts: { value: 0 },
    uSize: { value: (mobile ? 2.4 : 2.0) * Math.min(window.devicePixelRatio || 1, 1.5) },
  }), [a, b, dark, mobile])
  const vert = NOISE + `
    uniform float uTime; uniform float uAmp; uniform float uFreq; uniform float uSize;
    varying vec3 vN; varying vec3 vView; varying float vD;
    void main(){
      float d = snoise(normal*uFreq + uTime) * uAmp + snoise(normal*uFreq*2.3 - uTime*0.7) * uAmp*0.18;
      vD = d;
      vec3 p = position + normal * d;
      vec4 mv = modelViewMatrix * vec4(p,1.0);
      vN = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      gl_PointSize = uSize * (7.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`
  const { mesh, pts } = useMemo(() => {
    const mesh = new THREE.ShaderMaterial({
      uniforms, transparent: true, vertexShader: vert,
      fragmentShader: `
        uniform vec3 uA; uniform vec3 uB; uniform float uTime; uniform float uDark; uniform float uMix; uniform float uFres; uniform float uAlpha;
        varying vec3 vN; varying vec3 vView; varying float vD;
        void main(){
          float f = pow(1.0 - max(dot(vN, vView), 0.0), 2.0);
          float t = smoothstep(-0.3, 0.35, vD + vN.y*0.25);
          vec3 base = mix(uA, uB, clamp(t*0.6 + uMix*0.6, 0.0, 1.0));
          vec3 iri = 0.5 + 0.5*cos(6.2831*(vec3(0.0,0.33,0.67) + f*0.9 + uTime*0.2));
          vec3 col = mix(base, base*0.35 + iri*0.65, clamp(f*uFres, 0.0, 1.0));
          col += vec3(1.0) * pow(max(dot(reflect(-vView, vN), normalize(vec3(0.4,0.8,0.6))),0.0), 28.0) * 0.9;
          col = mix(col, col*0.5, (1.0-f)*0.3*uDark);
          gl_FragColor = vec4(col, uAlpha);
          #include <colorspace_fragment>
        }`,
    })
    const pts = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, blending: dark ? THREE.AdditiveBlending : THREE.NormalBlending, vertexShader: vert,
      fragmentShader: `
        uniform vec3 uA; uniform vec3 uB; uniform float uPts; uniform float uDark; varying float vD;
        void main(){
          float d = length(gl_PointCoord - 0.5); if(d > 0.5) discard;
          vec3 col = mix(uB, uA, smoothstep(-0.3, 0.4, vD)) * mix(1.3, 2.8, uDark);
          // cada ponto antes era desenhado ~6× no mesmo lugar (vértices repetidos da malha): a
          // cobertura de 6 camadas vem da conta, não de 6× mais pontos
          float a = smoothstep(0.5, 0.0, d) * uPts;
          gl_FragColor = vec4(col, 1.0 - pow(1.0 - a, 6.0));
          #include <colorspace_fragment>
        }`,
    })
    return { mesh, pts }
  }, [uniforms, vert, dark])
  useEffect(() => () => { mesh.dispose(); pts.dispose() }, [mesh, pts])
  // pontos: um por vértice DE VERDADE (a icosfera não indexada repete cada vértice ~6×)
  const ptsGeo = useMemo(() => {
    const ico = new THREE.IcosahedronGeometry(1.02, mobile ? 28 : 56)
    ico.deleteAttribute('uv')
    const idx = mergeVertices(ico, 1e-4)
    const out = new THREE.BufferGeometry()
    out.setAttribute('position', idx.getAttribute('position'))
    out.setAttribute('normal', idx.getAttribute('normal'))
    ico.dispose()
    idx.dispose()
    return out
  }, [mobile])
  const meshGeo = useMemo(() => new THREE.IcosahedronGeometry(1, mobile ? 40 : 64), [mobile])
  useEffect(() => () => { ptsGeo.dispose(); meshGeo.dispose() }, [ptsGeo, meshGeo])
  const meshRef = useRef<THREE.Mesh>(null)
  const warmup = useRef(0)
  const ptsRef = useRef<THREE.Points>(null)
  const g = useRef<THREE.Group>(null)
  const cur = useRef<P>({})
  const fit = useFit()
  const { viewport, camera } = useThree()
  const sats = useRef<THREE.Group>(null)
  useFrame((state, dt) => {
    tick(state.clock.elapsedTime, dt, reduced)
    const p = cur.current
    const sm = sample(LIQUIDO, live.cs, p)
    const d = Math.min(dt, 0.05)
    uniforms.uTime.value += reduced ? 0 : d * p.spd * k * (1 + Math.abs(live.vel) * 8)
    uniforms.uAmp.value = p.amp * (1 + Math.min(0.6, Math.abs(live.vel) * 3))
    uniforms.uFreq.value = p.freq
    uniforms.uMix.value = p.mix
    uniforms.uFres.value = p.fres
    uniforms.uAlpha.value = p.solid * (1 - p.dim * 0.6)
    uniforms.uPts.value = p.pts * (1 - p.dim * 0.5)
    // invisível = não desenhado (os pontos só aparecem no estado `pontos`). Os 3 primeiros quadros
    // desenham tudo: o shader compila na entrada, não no meio da rolagem (era um engasgo de ~100 ms)
    const warm = warmup.current++ < 3
    if (meshRef.current) meshRef.current.visible = warm || uniforms.uAlpha.value > 0.004
    if (ptsRef.current) ptsRef.current.visible = warm || uniforms.uPts.value > 0.004
    const o = g.current
    if (!o) return
    const px = mobile ? 0 : sm.side * p.fx * Math.min(viewport.width * SIDE_K, SIDE_MAX) * (camera.position.z / 7)
    o.position.set(px, mobile ? 1.7 : 0, 0)
    o.rotation.set(stage.y * 0.15, p.ry + stage.x * 0.25 + live.time * 0.05, 0)
    o.scale.setScalar(p.s * (mobile ? 0.75 : 1))
    if (sats.current) {
      sats.current.position.copy(o.position)
      sats.current.rotation.set(1.1, live.time * 0.3 * k + live.cs * 0.8, 0.3)
      sats.current.scale.setScalar(p.s * 1.1)
    }
    camera.position.set(0, 0, p.cz * fit)
    camera.lookAt(0, 0, 0)
  })
  return (
    <>
      <group ref={g}>
        <mesh ref={meshRef} material={mesh} geometry={meshGeo} />
        <points ref={ptsRef} material={pts} geometry={ptsGeo} />
      </group>
      <group ref={sats}>
        {[0, 1].map((i) => (
          <mesh key={i} position={[Math.cos(i * 2.6) * 1.55, Math.sin(i * 2.6) * 1.55, 0]} scale={0.022 + i * 0.01}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial color={b} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <Halo color={a} dark={dark} scale={10} opacity={dark ? 0.25 : 0.14} />
      <Dust color={b} mobile={mobile} dark={dark} />
    </>
  )
}

// ───────────────────────── CIDADE (sobrevoo de grade) ─────────────────────────

const CIDADE = story(
  { cy: 7, pitch: -0.55, roll: 0, spd: 0.6, glow: 1, mix: 0, dim: 0, cx: 0 },
  {
    hero: {},
    alto: {},
    rasante: { cy: 0.9, pitch: -0.06, spd: 1.4, roll: 0.05 },
    cidade: { cy: 2.4, pitch: -0.12, spd: 0.9, cx: 0, glow: 1.2 },
    curva: { cy: 3.2, pitch: -0.2, roll: -0.35, cx: -2, spd: 1 },
    noite: { cy: 4, pitch: -0.3, glow: 1.7, mix: 1, spd: 0.5 },
    horizonte: { cy: 1.5, pitch: 0.12, glow: 1.4, spd: 0.4 },
    fundo: { dim: 1, cy: 9, pitch: -0.7 },
    final: { cy: 14, pitch: -0.9, glow: 1.5, mix: 0.4, spd: 0.3 },
  },
  ['alto', 'rasante', 'cidade', 'curva', 'noite', 'final'],
  { explode: 'cidade', detalhe: 'rasante', orbita: 'curva', cor: 'noite', voo: 'rasante' },
)

function Cidade({ a, b, bg, mobile, dark, reduced, k }: { a: string; b: string; bg: string; mobile: boolean; dark: boolean; reduced: boolean; k: number }) {
  const { camera, scene } = useThree()
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uBg: { value: new THREE.Color(bg) },
    uGlow: { value: 1 }, uMix: { value: 0 }, uCam: { value: new THREE.Vector3() }, uDark: { value: dark ? 1 : 0 },
  }), [a, b, bg, dark])
  const L = 240
  const ground = useMemo(() => new THREE.ShaderMaterial({
    uniforms, transparent: false,
    vertexShader: NOISE + `
      varying vec3 vW; varying float vH;
      void main(){
        vec3 p = position;
        float road = smoothstep(2.5, 9.0, abs(p.x));
        float h = (snoise(vec3(p.x*0.06, p.y*0.06, 0.0))*0.5+0.5) * 5.0 * road * road;
        p.z = h; vH = h;
        vec4 w = modelMatrix * vec4(p,1.0); vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform vec3 uA; uniform vec3 uB; uniform vec3 uBg; uniform float uGlow; uniform float uMix; uniform vec3 uCam; uniform float uDark;
      varying vec3 vW; varying float vH;
      void main(){
        vec2 g = abs(fract(vW.xz/2.0 - 0.5) - 0.5) / fwidth(vW.xz/2.0);
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        float dist = length(vW - uCam);
        float fog = smoothstep(70.0, 12.0, dist);
        vec3 lc = mix(uA, uB, clamp(vH/5.0 + uMix*0.7, 0.0, 1.0));
        float lane = smoothstep(0.12, 0.0, abs(abs(vW.x) - 2.2)) * 0.8;
        vec3 col = uBg + lc * (line*0.9 + lane) * uGlow;
        gl_FragColor = vec4(mix(uBg, col, fog), 1.0);
        #include <colorspace_fragment>
      }`,
  }), [uniforms])
  const bn = mobile ? 160 : 420
  const blocks = useRef<THREE.InstancedMesh>(null)
  const bMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vW; varying vec3 vL; varying float vSeed; varying float vRoof;
      void main(){
        vec4 w = modelMatrix * instanceMatrix * vec4(position,1.0);
        vW = w.xyz; vL = position; vRoof = step(0.5, normal.y); vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898,78.233)))*43758.5453);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform vec3 uA; uniform vec3 uB; uniform vec3 uBg; uniform float uGlow; uniform float uMix; uniform vec3 uCam; uniform float uTime;
      varying vec3 vW; varying vec3 vL; varying float vSeed; varying float vRoof;
      void main(){
        vec2 win = fract(vec2(vW.x + vW.z, vW.y) * vec2(3.2, 2.4));
        float isWin = step(0.45, win.x) * step(0.4, win.y) * step(0.55, fract(sin(floor(vW.y*2.4)*7.1 + floor((vW.x+vW.z)*3.2)*3.3 + vSeed*10.0)*437.5));
        vec3 wc = mix(mix(uA, vec3(1.0), 0.35), uB, uMix*vSeed);
        vec3 col = uBg*1.4 + wc * isWin * uGlow * 0.55 * (1.0 - vRoof);
        col += uA * vRoof * smoothstep(0.38, 0.5, max(abs(vL.x), abs(vL.z))) * 0.6 * uGlow; // contorno do telhado
        float fog = smoothstep(70.0, 10.0, length(vW - uCam));
        gl_FragColor = vec4(mix(uBg, col, fog), 1.0);
        #include <colorspace_fragment>
      }`,
  }), [uniforms])
  const bGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  useEffect(() => {
    const m = blocks.current
    if (!m) return
    const d = new THREE.Object3D()
    for (let i = 0; i < bn; i++) {
      const side = i % 2 ? 1 : -1
      const x = side * (3.4 + Math.pow(Math.random(), 1.6) * 16)
      const z = -Math.random() * L + 20
      const h = 0.6 + Math.pow(Math.random(), 2.2) * 9 * (1 - Math.abs(x) / 24)
      const w = 0.8 + Math.random() * 1.4
      d.position.set(x, h / 2, z)
      d.scale.set(w, h, 0.8 + Math.random() * 1.6)
      d.updateMatrix()
      m.setMatrixAt(i, d.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [bn])
  useEffect(() => {
    scene.fog = null
    scene.background = new THREE.Color(bg)
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = mobile ? 70 : 55
    cam.far = 200
    cam.updateProjectionMatrix()
    return () => { scene.background = null }
  }, [bg, scene, camera, mobile])
  useEffect(() => () => { ground.dispose(); bMat.dispose(); bGeo.dispose() }, [ground, bMat, bGeo])
  const cur = useRef<P>({})
  const sun = useRef<THREE.Sprite>(null)
  useFrame((state, dt) => {
    tick(state.clock.elapsedTime, dt, reduced)
    const p = cur.current
    sample(CIDADE, live.cs, p)
    const n = Math.max(1, stage.names.length)
    const z = 10 - live.cs * ((L - 70) / Math.max(1, n - 1)) - (reduced ? 0 : live.time * p.spd * 0.6 * k)
    camera.position.set(p.cx + stage.x * 0.6, p.cy + stage.y * 0.3, z)
    camera.rotation.set(p.pitch, stage.x * -0.05, p.roll + live.vel * 0.25, 'YXZ')
    uniforms.uCam.value.copy(camera.position)
    uniforms.uGlow.value = p.glow * (1 - p.dim * 0.65)
    uniforms.uMix.value = p.mix
    uniforms.uTime.value = live.time
    if (sun.current) sun.current.position.set(0, 6 + p.cy * 0.3, z - 90)
  })
  const map = useMemo(() => dotTexture(), [])
  useEffect(() => () => map.dispose(), [map])
  return (
    <>
      <mesh material={ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -L / 2 + 20]}>
        <planeGeometry args={[60, L, mobile ? 40 : 80, mobile ? 120 : 240]} />
      </mesh>
      <instancedMesh ref={blocks} args={[bGeo, bMat, bn]} frustumCulled={false} />
      <sprite ref={sun} scale={60}>
        <spriteMaterial map={map} color={a} transparent opacity={0.55} depthWrite={false} blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending} />
      </sprite>
    </>
  )
}

// ───────────────────────── montagem ─────────────────────────

function Ready({ onReady }: { onReady: () => void }) {
  const n = useRef(0)
  useFrame(() => {
    n.current++
    if (n.current === 2) requestAnimationFrame(() => onReady())
  })
  return null
}

/** movimento reduzido: sem laço de animação; redesenha só quando o capítulo muda (quadro parado) */
function Invalidator() {
  const { invalidate } = useThree()
  useEffect(() => onStageChange(() => { invalidate(); requestAnimationFrame(() => invalidate()) }), [invalidate])
  return null
}

export default function StageScene({ scene, object, word, colors, bg, intensity, mobile, dark, reduced, onReady }: StageSceneProps) {
  const [a, b] = colors
  const k = Math.max(0.2, Math.min(2, intensity))
  const [dpr, setDpr] = useState<[number, number]>(mobile ? [1, 1.25] : [1, 1.5])
  // MSAA só em tela 1× (lá o serrilhado aparece); em tela densa o DPR 1.25–1.5 já alisa
  const [aa] = useState(() => !mobile && (window.devicePixelRatio || 1) < 1.5)
  const opaque = scene === 'tunel' || scene === 'cidade'
  // aparelho que não segura o quadro: baixa a resolução do 3D um degrau por vez (nunca sobe de
  // novo — cada troca redimensiona o canvas, e ficar oscilando é pior que ficar um pouco mais macio)
  const decline = () => setDpr(([lo, hi]) => {
    const n = Math.max(mobile ? 0.75 : 1, Math.round((hi - 0.25) * 100) / 100)
    return [Math.min(lo, n), n]
  })
  return (
    <Canvas
      dpr={dpr}
      frameloop={reduced ? 'demand' : 'always'}
      gl={{ antialias: aa, alpha: !opaque, powerPreference: 'high-performance', stencil: false }}
      camera={{ position: [0, 0, 7], fov: 35, near: 0.1, far: 220 }}
      style={{ pointerEvents: 'none' }}
    >
      {!reduced && <PerformanceMonitor flipflops={3} onDecline={decline} />}
      {scene === 'produto' && <Produto object={object} a={a} b={b} mobile={mobile} dark={dark} reduced={reduced} k={k} />}
      {scene === 'particulas' && <Particulas word={word} a={a} b={b} mobile={mobile} dark={dark} reduced={reduced} k={k} />}
      {scene === 'tunel' && <Tunel a={a} b={b} bg={bg} mobile={mobile} dark={dark} reduced={reduced} k={k} />}
      {scene === 'liquido' && <Liquido a={a} b={b} mobile={mobile} dark={dark} reduced={reduced} k={k} />}
      {scene === 'cidade' && <Cidade a={a} b={b} bg={bg} mobile={mobile} dark={dark} reduced={reduced} k={k} />}
      {reduced && <Invalidator />}
      <Ready onReady={onReady} />
    </Canvas>
  )
}
