// Kit 3D Cinema do Brixly — o PALCO 3D fixo atrás da página, guiado pela rolagem.
//
// <ScrollStage scene="produto" object="roda" /> uma vez, no topo do App. Depois, cada seção que
// deve mudar o 3D é um <Chapter state="explode">: ao chegar nela, a cena vai para aquele estado
// (o objeto explode em peças, gira, muda de cor; a câmera voa…). O motor (three.js) fica em
// StageScene.tsx, num pedaço separado baixado DEPOIS da página aparecer: o texto pinta na hora.
import { Component, lazy, Suspense, useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import { isMobile, onStageChange, prefersReduced, stage, startStage } from './stage'
import type { StageObject, StageSceneName } from './StageScene'

export type { StageObject, StageSceneName } from './StageScene'

const StageScene = lazy(() => import('./StageScene'))

export interface ScrollStageProps {
  /** produto (objeto que explode em peças) · particulas (milhares de pontos que viram formas e a palavra) ·
   *  tunel (a câmera voa por dentro de anéis) · liquido (esfera líquida que se transforma) · cidade (sobrevoo de grade/cidade) */
  scene?: StageSceneName
  /** objeto da cena `produto`: roda · relogio · joia · frasco · dispositivo */
  object?: StageObject
  /** palavra que as partículas desenham (estado `texto`): nome curto da marca, até ~10 letras */
  word?: string
  /** [principal, secundária]; padrão = token --accent e um tom vizinho */
  colors?: [string, string]
  /** lado padrão do 3D quando o capítulo não diz (`side` no <Chapter>) */
  side?: 'left' | 'right' | 'center'
  /** 0.6 calmo · 1 padrão · 1.4 enérgico */
  intensity?: number
}

function webglOk(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {}
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function ScrollStage({ scene = 'produto', object = 'dispositivo', word = '', colors, side = 'right', intensity = 1 }: ScrollStageProps) {
  const [mount, setMount] = useState(false)
  const [shown, setShown] = useState(false)
  // o brilho de espera (80vmin com blur) sai do DOM depois do fade: camada desfocada fixa, mesmo
  // transparente, continua custando composição em todo quadro
  const [glowGone, setGlowGone] = useState(false)
  useEffect(() => {
    if (!shown) return
    const t = window.setTimeout(() => setGlowGone(true), 1200)
    return () => window.clearTimeout(t)
  }, [shown])
  const [env, setEnv] = useState({ mobile: false, dark: true, reduced: false, accent: '#7C9CFF', bg: '#07080B' })

  useEffect(() => startStage(side === 'left' ? -1 : side === 'center' ? 0 : 1), [side])

  // véu de contraste do lado do TEXTO (desktop): o objeto fica de um lado, e atrás do título do
  // outro lado entra um degradê da cor do fundo — texto legível mesmo se o objeto encostar nele.
  // Troca só quando muda o capítulo (opacidade de duas camadas paradas: custo zero por quadro).
  const scrimL = useRef<HTMLDivElement>(null)
  const scrimR = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const apply = () => {
      const i = Math.max(0, Math.min(stage.sides.length - 1, Math.round(stage.c)))
      const s = stage.sides[i] ?? 1
      if (scrimL.current) scrimL.current.style.opacity = s > 0 ? '1' : '0'
      if (scrimR.current) scrimR.current.style.opacity = s < 0 ? '1' : '0'
    }
    const off = onStageChange(apply)
    const ts = [300, 1600, 4000].map((t) => window.setTimeout(apply, t))
    return () => { off(); ts.forEach((t) => window.clearTimeout(t)) }
  }, [])

  useEffect(() => {
    if (!webglOk()) return // fica o brilho estático
    const bg = token('--bg', '#07080B')
    setEnv({ mobile: isMobile(), dark: luminance(bg) < 0.45, reduced: prefersReduced(), accent: token('--accent', '#7C9CFF'), bg })
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    let t = 0
    if (w.requestIdleCallback) w.requestIdleCallback(() => setMount(true), { timeout: 900 })
    else t = window.setTimeout(() => setMount(true), 200)
    return () => window.clearTimeout(t)
  }, [])

  const a = colors?.[0] ?? env.accent
  const b = colors?.[1] ?? lighten(shiftHue(env.accent, -0.06), 0.35)
  return (
    <div aria-hidden className="stage-3d pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {!glowGone && <div className={`absolute left-1/2 top-1/3 size-[80vmin] -translate-x-1/2 rounded-full bg-accent blur-3xl transition-opacity duration-1000 ${shown ? 'opacity-0' : 'opacity-20'}`} />}
      {mount && (
        <Guard>
          <Suspense fallback={null}>
            <div className={`absolute inset-0 transition-opacity duration-[1400ms] ease-out ${shown ? 'opacity-100' : 'opacity-0'}`}>
              <StageScene
                scene={scene}
                object={object}
                word={word}
                colors={[a, b]}
                bg={env.bg}
                intensity={intensity}
                mobile={env.mobile}
                dark={env.dark}
                reduced={env.reduced}
                onReady={() => setShown(true)}
              />
            </div>
          </Suspense>
        </Guard>
      )}
      {/* véu: contraste do texto por cima do 3D (mais forte no celular, onde o texto cobre o objeto) */}
      <div className={`stage-veil absolute inset-0 ${scene === 'tunel' || scene === 'cidade' ? 'stage-veil-env' : ''}`} />
      <div ref={scrimL} className="absolute inset-y-0 left-0 hidden w-[64%] transition-opacity duration-700 md:block"
        style={{ opacity: 1, background: 'linear-gradient(90deg, color-mix(in srgb, var(--bg) 80%, transparent) 0%, color-mix(in srgb, var(--bg) 45%, transparent) 55%, transparent 100%)' }} />
      <div ref={scrimR} className="absolute inset-y-0 right-0 hidden w-[64%] transition-opacity duration-700 md:block"
        style={{ opacity: 0, background: 'linear-gradient(270deg, color-mix(in srgb, var(--bg) 80%, transparent) 0%, color-mix(in srgb, var(--bg) 45%, transparent) 55%, transparent 100%)' }} />
    </div>
  )
}

export interface ChapterProps {
  /** estado do 3D enquanto esta seção está na tela (ex.: hero, explode, detalhe, orbita, cor, fundo, final) */
  state: string
  /** onde fica o 3D neste capítulo — ponha o TEXTO do outro lado */
  side?: 'left' | 'right' | 'center'
  id?: string
  className?: string
  as?: 'section' | 'div' | 'header' | 'footer'
  children?: ReactNode
}

/** Seção-capítulo: ao chegar nela, o palco 3D vai para `state`. Fundo transparente (o 3D aparece). */
export function Chapter({ state, side, id, className = '', as = 'section', children }: ChapterProps) {
  const Tag = as as ElementType
  return (
    <Tag id={id} data-chapter={state} data-side={side} className={`chapter ${className}`}>
      {children}
    </Tag>
  )
}

// ── cor (sem three aqui) ──
function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((x) => x + x).join('')
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [124, 156, 255]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}
function lighten(hex: string, t: number): string {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v + (255 - v) * t))
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}
function shiftHue(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  h = (h + amount + 1) % 1
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1))
  const m = l - c / 2
  const [rr, gg, bb] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h * 6) % 6]
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${to(rr)}${to(gg)}${to(bb)}`
}
