// Kit 3D Cinema do Brixly — fundo 3D do hero. Troque só as PROPS; o motor fica em Scene3D.tsx.
//
// Por que o motor fica num arquivo à parte: three.js é pesado (~200 KB gzip). O import
// preguiçoso abaixo põe tudo num pedaço (chunk) próprio que só é baixado DEPOIS de a página
// aparecer — o título do hero pinta na hora, o 3D entra por trás com fade.
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'

export type Hero3DVariant = 'blob' | 'particles' | 'orbit' | 'liquid' | 'waves'
export type Hero3DShape = 'knot' | 'gem' | 'torus' | 'capsule' | 'sphere'

export interface Hero3DProps {
  /** cena: blob (gota metálica), particles (galáxia), orbit (objeto + anéis), liquid (esfera líquida), waves (terreno de pontos) */
  variant?: Hero3DVariant
  /** forma do objeto central da cena `orbit` */
  shape?: Hero3DShape
  /** [principal, secundária]; padrão = token --accent e um tom vizinho dele */
  colors?: [string, string]
  /** lado do objeto no desktop (no celular ele fica centralizado atrás do texto) */
  align?: 'right' | 'center' | 'left'
  /** 0.3 = calmo · 1 = padrão · 1.6 = enérgico */
  intensity?: number
  /** véu que garante contraste do texto sobre o 3D */
  veil?: 'left' | 'bottom' | 'full' | 'none'
  className?: string
}

const Scene3D = lazy(() => import('./Scene3D'))

function webglOk(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

function readToken(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/** Se o WebGL cair (driver, memória), fica o fundo estático — o site nunca quebra por causa do 3D. */
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

const VEILS: Record<NonNullable<Hero3DProps['veil']>, string> = {
  left: 'bg-gradient-to-r from-bg from-5% via-transparent via-60% to-transparent',
  bottom: 'bg-gradient-to-t from-bg via-transparent via-45% to-transparent',
  full: 'bg-bg opacity-50',
  none: '',
}

export default function Hero3D({
  variant = 'blob',
  shape = 'knot',
  colors,
  align = 'right',
  intensity = 1,
  veil = 'bottom',
  className = '',
}: Hero3DProps) {
  const box = useRef<HTMLDivElement>(null)
  const [mount, setMount] = useState(false) // só depois da 1ª pintura (não atrasa o LCP)
  const [visible, setVisible] = useState(true) // fora da tela = cena pausada
  const [shown, setShown] = useState(false) // 1º quadro pronto → fade-in
  const [env, setEnv] = useState({ mobile: false, dark: true, accent: '#7C5CFF', bg: '#07080B' })

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !webglOk()) return // fica o fundo estático
    const bg = readToken('--bg', '#07080B')
    setEnv({
      mobile: window.matchMedia('(max-width: 767px), (pointer: coarse)').matches,
      dark: luminance(bg) < 0.45,
      accent: readToken('--accent', '#7C5CFF'),
      bg,
    })
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    let t = 0
    if (w.requestIdleCallback) w.requestIdleCallback(() => setMount(true), { timeout: 900 })
    else t = window.setTimeout(() => setMount(true), 200)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    const el = box.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={box} aria-hidden className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}>
      {/* fundo estático: aparece já, e é o que fica sem WebGL / com movimento reduzido */}
      <div
        className={`absolute size-[70vmin] rounded-full bg-accent blur-3xl transition-opacity duration-1000 ${
          align === 'left' ? 'left-[-10%] top-[10%]' : align === 'center' ? 'left-1/2 top-1/4 -translate-x-1/2' : 'right-[-10%] top-[10%]'
        } ${shown ? 'opacity-10' : 'opacity-30'}`}
      />
      {mount && (
        <Guard>
          <Suspense fallback={null}>
            <div className={`absolute inset-0 transition-opacity duration-[1400ms] ease-out ${shown ? 'opacity-100' : 'opacity-0'}`}>
              <Scene3D
                variant={variant}
                shape={shape}
                colors={colors ?? [env.accent, lighten(shiftHue(env.accent, -0.03), 0.4)]}
                align={align}
                intensity={intensity}
                active={visible}
                mobile={env.mobile}
                dark={env.dark}
                onReady={() => setShown(true)}
              />
            </div>
          </Suspense>
        </Guard>
      )}
      {veil !== 'none' && <div className={`absolute inset-0 ${VEILS[veil]}`} />}
      {/* celular: o texto fica na metade de baixo — véu sólido ali garante contraste */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg from-35% via-transparent via-70% to-transparent md:hidden" />
    </div>
  )
}

// ── cor (sem three aqui: este arquivo fica no pedaço principal, leve) ──
function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((x) => x + x).join('')
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [124, 92, 255]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

// tom vizinho CLARO do accent: girar muito o matiz fazia ouro virar verde-limão
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
  const seg = Math.floor(h * 6)
  const [rr, gg, bb] = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ][seg % 6]
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${to(rr)}${to(gg)}${to(bb)}`
}
