// Kit 3D Cinema do Brixly — LAYOUTS DE ROLAGEM (GSAP ScrollTrigger + Lenis).
// Seções prontas estilo página de produto da Apple: seção presa enquanto a história anda,
// galeria que corre de lado com a rolagem, texto gigante que acende, zoom que atravessa a
// palavra, número que sobe com a rolagem, letreiro que acelera. Todas:
// - usam `position: sticky` (nada de pin com spacer: o layout não pula);
// - animam só transform/opacity, escrevendo direto no estilo (sem re-render do React);
// - com prefers-reduced-motion viram seções normais e paradas.
// FLUIDEZ (medido, set/2026): NENHUMA leitura de layout (getBoundingClientRect, scrollWidth,
// offsetWidth) dentro do quadro — medida fica em cache e só é refeita no refresh do ScrollTrigger
// ou no resize; estilo só é escrito quando o valor muda; o que é grande e escala (zoom da palavra)
// é desenhado num <canvas> em vez de reescalar uma camada (que re-rasterizava a cada quadro).
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

const useIso = typeof window !== 'undefined' ? useLayoutEffect : useEffect
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

// escreve no estilo só quando muda (cada escrita invalida estilo; a mesma string repetida a cada
// quadro, em dezenas de elementos, é trabalho à toa no celular)
const last = new WeakMap<HTMLElement, Record<string, string>>()
function put(el: HTMLElement, prop: 'opacity' | 'transform' | 'visibility', v: string): void {
  let m = last.get(el)
  if (!m) last.set(el, (m = {}))
  if (m[prop] === v) return
  m[prop] = v
  el.style[prop] = v
}
const r3 = (x: number) => Math.round(x * 1000) / 1000

function useReduced(): boolean {
  const [r, setR] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    const f = () => setR(m.matches)
    m.addEventListener?.('change', f)
    return () => m.removeEventListener?.('change', f)
  }, [])
  return r
}

/** progresso 0…1 de um elemento entre `start` e `end` (sintaxe do ScrollTrigger), direto num callback */
function useProgress<T extends HTMLElement>(fn: (p: number, self: ScrollTrigger) => void, opts: { start?: string; end?: string; off?: boolean; onRefresh?: () => void } = {}) {
  const ref = useRef<T>(null)
  const cb = useRef(fn)
  cb.current = fn
  const rf = useRef(opts.onRefresh)
  rf.current = opts.onRefresh
  useIso(() => {
    const el = ref.current
    if (!el || opts.off) return
    const st = ScrollTrigger.create({
      trigger: el,
      start: opts.start ?? 'top top',
      end: opts.end ?? 'bottom bottom',
      invalidateOnRefresh: true,
      onUpdate: (self) => cb.current(self.progress, self),
      onRefresh: (self) => { rf.current?.(); cb.current(self.progress, self) },
    })
    return () => st.kill()
  }, [opts.start, opts.end, opts.off])
  return ref
}

// ───────────────────────── rolagem suave ─────────────────────────

/** Envolve o App: rolagem suave (Lenis) sincronizada com o ScrollTrigger. Sem efeito com movimento reduzido. */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = useReduced()
  useEffect(() => {
    if (reduced) return
    const lenis = new Lenis({ lerp: 0.1, anchors: { offset: -72 }, wheelMultiplier: 1 })
    lenis.on('scroll', ScrollTrigger.update)
    const raf = (t: number) => lenis.raf(t * 1000)
    // UM relógio só: o Lenis anda no ticker do GSAP e na FRENTE da fila (prioritize) — a rolagem
    // do quadro acontece antes de qualquer outro callback escrever estilo (sem layout forçado no scrollTo)
    gsap.ticker.add(raf, false, true)
    gsap.ticker.lagSmoothing(0)
    // fontes/imagens mudam a altura da página: remede tudo depois de carregar
    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)
    document.fonts?.ready.then(refresh).catch(() => {})
    return () => {
      gsap.ticker.remove(raf)
      window.removeEventListener('load', refresh)
      lenis.destroy()
    }
  }, [reduced])
  return <>{children}</>
}

// ───────────────────────── seção presa + passos ─────────────────────────

const PinCtx = createContext<{ add: (fn: (p: number) => void) => () => void } | null>(null)

/** Seção que fica PRESA na tela por `length` alturas de tela enquanto os <PinStep> aparecem/somem. */
export function PinnedSection({ length = 3, state, side, id, className = '', children }: { length?: number; state?: string; side?: 'left' | 'right' | 'center'; id?: string; className?: string; children: ReactNode }) {
  const reduced = useReduced()
  const subs = useRef(new Set<(p: number) => void>())
  const ref = useProgress<HTMLElement>((p) => subs.current.forEach((f) => f(p)), { off: reduced })
  const ctx = useRef({ add: (fn: (p: number) => void) => { subs.current.add(fn); fn(0); return () => { subs.current.delete(fn) } } })
  if (reduced) {
    return (
      <section id={id} data-chapter={state} data-side={side} className={`relative py-24 ${className}`}>
        <PinCtx.Provider value={null}><div className="wrap flex flex-col gap-16">{children}</div></PinCtx.Provider>
      </section>
    )
  }
  return (
    <section ref={ref} id={id} data-chapter={state} data-side={side} className="relative" style={{ height: `${Math.max(1.5, length) * 100}vh` }}>
      <div className={`sticky top-0 flex h-[100svh] items-center overflow-hidden ${className}`}>
        <PinCtx.Provider value={ctx.current}>{children}</PinCtx.Provider>
      </div>
    </section>
  )
}

/** Um passo dentro do <PinnedSection>: visível entre `from` e `to` (0…1 do tempo preso). */
export function PinStep({ from, to, effect = 'up', className = '', children }: { from: number; to: number; effect?: 'up' | 'fade' | 'scale' | 'left' | 'right'; className?: string; children: ReactNode }) {
  const ctx = useContext(PinCtx)
  const el = useRef<HTMLDivElement>(null)
  useIso(() => {
    if (!ctx) return
    return ctx.add((p) => {
      const e = el.current
      if (!e) return
      const span = Math.max(0.05, to - from)
      const fade = Math.min(0.12, span / 3)
      const vin = clamp01((p - from) / fade)
      const vout = to >= 1 ? 1 : clamp01((to - p) / fade)
      const v = Math.min(vin, vout)
      const d = p < from + fade ? 1 - vin : -(1 - vout) // entrando (+) ou saindo (-)
      const k = r3(d)
      const tr = effect === 'fade' ? '' : effect === 'scale' ? `scale(${r3(0.9 + v * 0.1)})` : effect === 'left' ? `translate3d(${k * -60}px,0,0)` : effect === 'right' ? `translate3d(${k * 60}px,0,0)` : `translate3d(0,${k * 60}px,0)`
      put(e, 'opacity', String(r3(v)))
      put(e, 'transform', tr)
      put(e, 'visibility', v < 0.01 ? 'hidden' : 'visible')
    })
  }, [ctx, from, to, effect])
  if (!ctx) return <div className={className}>{children}</div>
  return <div ref={el} className={`absolute inset-0 flex items-center will-change-transform ${className}`}>{children}</div>
}

// ───────────────────────── história com passos (scrollytelling) ─────────────────────────

export interface Step {
  /** estado do 3D neste passo (ex.: explode, detalhe, cor) */
  state?: string
  eyebrow?: string
  title: string
  text?: string
}

/** Texto em passos de um lado, o 3D do outro: cada passo = um capítulo do palco 3D. */
export function StickyScrollytelling({ steps, side = 'left', id, className = '' }: { steps: Step[]; side?: 'left' | 'right'; id?: string; className?: string }) {
  const reduced = useReduced()
  const items = useRef<(HTMLDivElement | null)[]>([])
  const bar = useRef<HTMLDivElement>(null)
  const n = steps.length
  const ref = useProgress<HTMLElement>((p) => {
    const pos = p * Math.max(1, n - 1)
    items.current.forEach((e, i) => {
      if (!e) return
      const d = pos - i
      // segura o passo inteiro perto da âncora e troca sem os dois textos se sobreporem
      const v = clamp01(1 - Math.max(0, Math.abs(d) - 0.15) * 3.2)
      put(e, 'opacity', String(r3(v)))
      // passo invisível não anda (nada a pintar); o visível anda com a rolagem
      if (v > 0) put(e, 'transform', `translate3d(0,${r3(-d * 70)}px,0)`)
      put(e, 'visibility', v < 0.01 ? 'hidden' : 'visible')
    })
    if (bar.current) put(bar.current, 'transform', `scaleY(${r3(Math.max(0.02, p))})`)
  }, { off: reduced })
  const the3d = side === 'left' ? 'right' : 'left'
  if (reduced) {
    return (
      <section id={id} className={`relative py-24 ${className}`}>
        <div className="wrap flex flex-col gap-24">
          {steps.map((s, i) => (
            <div key={i} data-chapter={s.state ?? 'hero'} data-side={the3d} className={`max-w-xl ${side === 'right' ? 'ml-auto' : ''}`}>
              {s.eyebrow && <p className="eyebrow">{s.eyebrow}</p>}
              <h3 className="mt-3 font-display text-h2">{s.title}</h3>
              {s.text && <p className="mt-4 text-lead text-muted">{s.text}</p>}
            </div>
          ))}
        </div>
      </section>
    )
  }
  return (
    <section ref={ref} id={id} className={`relative ${className}`} style={{ height: `${n * 100}vh` }}>
      {/* marcadores: um capítulo do 3D por passo */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        {steps.map((s, i) => <div key={i} data-chapter={s.state ?? 'hero'} data-side={the3d} className="h-[100vh] shrink-0" />)}
      </div>
      <div className="sticky top-0 flex h-[100svh] items-end pb-16 md:items-center md:pb-0">
        <div className="wrap grid grid-cols-12">
          <div className={`relative col-span-12 md:col-span-6 lg:col-span-5 ${side === 'right' ? 'md:col-start-7 lg:col-start-8' : ''}`}>
            <div className="absolute -left-6 top-0 hidden h-full w-px bg-line md:block">
              <div ref={bar} className="h-full w-px origin-top bg-accent will-change-transform" />
            </div>
            <div className="grid">
              {steps.map((s, i) => (
                <div key={i} ref={(el) => { items.current[i] = el }} className="step-card text-halo [grid-area:1/1] will-change-transform" style={{ opacity: i ? 0 : 1 }}>
                  {s.eyebrow && <p className="eyebrow">{s.eyebrow}</p>}
                  <h3 className="mt-3 font-display text-h1">{s.title}</h3>
                  {s.text && <p className="mt-4 max-w-md text-[#F4F5F8]">{s.text}</p>}
                  <p className="mt-6 font-mono text-xs tracking-[0.3em] text-muted">{String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ───────────────────────── galeria horizontal ─────────────────────────

/** Rolagem vertical vira horizontal: os filhos (use <HCard>) correm de lado com inclinação 3D. */
export function HorizontalScroll({ eyebrow, title, state = 'fundo', side = 'center', id, className = '', children }: { eyebrow?: string; title?: string; state?: string; side?: 'left' | 'right' | 'center'; id?: string; className?: string; children: ReactNode }) {
  const reduced = useReduced()
  const track = useRef<HTMLDivElement>(null)
  const [h, setH] = useState(300)
  // medidas em cache (refeitas no refresh/resize): o quadro só faz conta, nunca lê layout
  const geo = useRef({ dist: 0, mid: 720, cards: [] as { el: HTMLElement; c: number }[] })
  const remeasure = () => {
    const t = track.current
    if (!t) return
    geo.current.dist = Math.max(0, t.scrollWidth - window.innerWidth)
    geo.current.mid = window.innerWidth / 2
    // offsetLeft ignora o transform: é a posição do card com a galeria parada no início
    geo.current.cards = Array.from(t.querySelectorAll<HTMLElement>('[data-hcard]'))
      .map((el) => ({ el, c: (el.offsetParent === t ? t.offsetLeft : 0) + el.offsetLeft + el.offsetWidth / 2 }))
  }
  const ref = useProgress<HTMLElement>((p) => {
    const t = track.current
    if (!t) return
    if (!geo.current.cards.length) remeasure()
    const { dist, mid, cards } = geo.current
    const x = -p * dist
    put(t, 'transform', `translate3d(${r3(x)}px,0,0)`)
    for (const { el, c } of cards) {
      const d = r3(Math.max(-1, Math.min(1, (c + x - mid) / mid)))
      put(el, 'transform', `perspective(1100px) rotateY(${r3(d * -24)}deg) scale(${r3(1 - Math.abs(d) * 0.1)}) translateZ(${r3(-Math.abs(d) * 60)}px)`)
      put(el, 'opacity', String(r3(1 - Math.abs(d) * 0.35)))
    }
  }, { off: reduced, onRefresh: () => remeasure() })
  useIso(() => {
    if (reduced) return
    const measure = () => {
      const t = track.current
      if (!t) return
      remeasure()
      setH(Math.round(((geo.current.dist + window.innerHeight) / window.innerHeight) * 100))
    }
    measure()
    const ro = new ResizeObserver(() => { measure(); ScrollTrigger.refresh() })
    if (track.current) ro.observe(track.current)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [reduced])
  const head = (title || eyebrow) && (
    <div className="wrap mb-8 md:mb-12">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      {title && <h2 className="mt-3 max-w-3xl font-display text-h1">{title}</h2>}
    </div>
  )
  if (reduced) {
    return (
      <section id={id} data-chapter={state} data-side={side} className={`relative py-24 ${className}`}>
        {head}
        <div className="flex snap-x gap-6 overflow-x-auto px-4 pb-6 md:px-8">{children}</div>
      </section>
    )
  }
  return (
    <section ref={ref} id={id} data-chapter={state} data-side={side} className={`relative ${className}`} style={{ height: `${h}vh` }}>
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        {head}
        <div ref={track} className="flex w-max gap-5 px-[6vw] will-change-transform md:gap-8 md:px-[8vw]">{children}</div>
      </div>
    </section>
  )
}

/** Card da galeria horizontal. Com `image` (URL da lista de fotos) vira pôster; sem, cartão tipográfico. */
export function HCard({ image, alt = '', eyebrow, title, text, index, children, className = '' }: { image?: string; alt?: string; eyebrow?: string; title?: string; text?: string; index?: number; children?: ReactNode; className?: string }) {
  return (
    // sem `glass` (backdrop-filter): card que gira em 3D a cada quadro refazia o desfoque do fundo por
    // trás dele quadro a quadro. O mesmo véu translúcido do .glass, sem o desfoque.
    <article data-hcard className={`hcard relative flex h-[62svh] w-[78vw] shrink-0 snap-center flex-col justify-end overflow-hidden rounded-ui-lg border border-line p-6 will-change-transform sm:w-[52vw] md:h-[64vh] md:w-[34vw] md:p-8 ${className}`}
      style={image ? undefined : { background: 'var(--glass, rgb(255 255 255 / 0.04))' }}>
      {image && (
        <>
          <img src={image} alt={alt} loading="lazy" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent opacity-90" />
        </>
      )}
      {!image && typeof index === 'number' && (
        <span className="absolute right-6 top-4 font-display text-[7rem] leading-none text-accent opacity-25 md:text-[9rem]">{String(index).padStart(2, '0')}</span>
      )}
      <div className="relative">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {title && <h3 className="mt-2 font-display text-h2">{title}</h3>}
        {text && <p className="mt-3 text-muted">{text}</p>}
        {children}
      </div>
    </article>
  )
}

// ───────────────────────── texto que acende ─────────────────────────

/** Frase GRANDE que acende palavra por palavra com a rolagem. `highlight` = palavras em accent. */
export function TextMaskReveal({ text, as = 'h2', highlight = [], className = '' }: { text: string; as?: 'h2' | 'p' | 'h3'; highlight?: string[]; className?: string }) {
  const reduced = useReduced()
  const words = text.split(' ')
  const spans = useRef<(HTMLSpanElement | null)[]>([])
  const hl = new Set(highlight.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')))
  const ref = useProgress<HTMLElement>((p) => {
    const n = words.length
    spans.current.forEach((s, i) => {
      if (!s) return
      const v = r3(clamp01(p * (n + 4) - i)) // 4 palavras de "rastro"
      // só as ~4 palavras do rastro mudam por quadro; as outras já estão em 0 ou 1 e nem são tocadas
      put(s, 'opacity', String(r3(0.14 + v * 0.86)))
      put(s, 'transform', `translate3d(0,${r3((1 - v) * 0.18)}em,0)`)
    })
  }, { start: 'top 85%', end: 'bottom 45%', off: reduced })
  const Tag = as
  return (
    <Tag ref={ref as never} aria-label={text} className={`text-halo font-display ${className}`}>
      {words.map((w, i) => (
        <span key={i} aria-hidden ref={(el) => { spans.current[i] = el }}
          className={`inline-block ${reduced ? '' : 'will-change-transform'} ${hl.has(w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')) ? 'text-accent' : ''}`}
          style={reduced ? undefined : { opacity: 0.14 }}>
          {w}{i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  )
}

// ───────────────────────── zoom que atravessa a palavra ─────────────────────────

/** Painel sólido com a PALAVRA vazada (o 3D aparece pelas letras); rolando, a câmera "entra" numa
 *  letra até a tela inteira virar o 3D e revelar os filhos. Palavra curta (1 palavra, até ~9 letras).
 *  Desenhado num <canvas> do tamanho da tela, redesenhado só quando a rolagem muda: escalar uma
 *  camada DOM/SVG até 60× obrigava o navegador a re-rasterizar a camada gigante a cada quadro
 *  (medido: quadros de 40–95 ms no fim da página); no canvas o custo é o de pintar UMA tela. */
export function ZoomThrough({ word, state = 'final', side = 'center', id, className = '', children }: { word: string; state?: string; side?: 'left' | 'right' | 'center'; id?: string; className?: string; children?: ReactNode }) {
  const reduced = useReduced()
  const box = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const after = useRef<HTMLDivElement>(null)
  // tudo que o desenho usa fica em cache (refeito no resize e quando a fonte carrega)
  const g = useRef({ w: 0, h: 0, dpr: 1, size: 0, ox: 0, oy: 0, fam: 'sans-serif', bg: '#07080B', accent: '#7C9CFF', ok: false, p: 0, drawn: -1 })
  const draw = () => {
    const G = g.current
    const c = cv.current
    if (!c || !G.ok) return
    const p = G.p
    if (p > 0.76 && G.drawn > 0.76) return // painel já sumiu
    const q = Math.round(p * 4000) / 4000
    if (q === G.drawn) return
    G.drawn = q
    const x = c.getContext('2d')
    if (!x) return
    const s = 1 + Math.pow(Math.min(1, p / 0.7), 3.2) * 60
    x.setTransform(G.dpr, 0, 0, G.dpr, 0, 0)
    x.globalCompositeOperation = 'source-over'
    x.globalAlpha = 1
    x.clearRect(0, 0, G.w, G.h)
    x.fillStyle = G.bg
    x.fillRect(0, 0, G.w, G.h)
    x.translate(G.ox, G.oy)
    x.scale(s, s)
    x.translate(-G.ox, -G.oy)
    x.font = `800 ${G.size}px ${G.fam}`
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.globalCompositeOperation = 'destination-out'
    x.fillText(word, G.w / 2, G.h / 2)
    // contorno da palavra em accent: legível mesmo com o 3D escuro atrás; some quando o zoom começa
    const o = 1 - clamp01(p / 0.22)
    if (o > 0.002) {
      x.globalCompositeOperation = 'source-over'
      x.globalAlpha = 0.9 * o
      x.strokeStyle = G.accent
      x.lineWidth = 1.5
      x.strokeText(word, G.w / 2, G.h / 2)
    }
  }
  const ref = useProgress<HTMLElement>((p) => {
    g.current.p = p
    const c = cv.current
    const af = after.current
    if (c) {
      put(c, 'opacity', String(r3(1 - clamp01((p - 0.6) / 0.14))))
      put(c, 'visibility', p > 0.76 ? 'hidden' : 'visible')
    }
    draw()
    if (af) {
      const v = r3(clamp01((p - 0.66) / 0.2))
      put(af, 'opacity', String(v))
      put(af, 'transform', `scale(${r3(0.92 + v * 0.08)})`)
    }
  }, { off: reduced })
  // mede a tela, o tamanho da palavra e a origem do zoom = um ponto DENTRO do traço de uma letra,
  // perto do centro: a câmera atravessa a letra (vira 3D puro) em vez de bater na parede entre letras
  useIso(() => {
    if (reduced) return
    let off = false
    const run = () => {
      const c = cv.current
      const bx = box.current
      if (off || !c || !bx) return
      const G = g.current
      const w = bx.clientWidth || window.innerWidth
      const h = bx.clientHeight || window.innerHeight
      const cs = getComputedStyle(document.documentElement)
      G.fam = cs.getPropertyValue('--font-display').trim() || 'sans-serif'
      G.bg = cs.getPropertyValue('--bg').trim() || '#07080B'
      G.accent = cs.getPropertyValue('--accent').trim() || '#7C9CFF'
      G.w = w
      G.h = h
      G.dpr = Math.min(window.devicePixelRatio || 1, 2)
      c.width = Math.round(w * G.dpr)
      c.height = Math.round(h * G.dpr)
      c.style.width = `${w}px`
      c.style.height = `${h}px`
      const m = document.createElement('canvas')
      m.width = w
      m.height = h
      const x = m.getContext('2d', { willReadFrequently: true })
      if (!x) return
      // tamanho medido de verdade (fontes largas como Syne estouravam a tela)
      x.font = `800 100px ${G.fam}`
      const size = Math.min(h * 0.42, (w * 0.84 * 100) / Math.max(1, x.measureText(word).width))
      G.size = size
      x.font = `800 ${size}px ${G.fam}`
      x.textAlign = 'center'
      x.textBaseline = 'middle'
      x.fillText(word, w / 2, h / 2)
      const d = x.getImageData(0, 0, w, h).data
      const on = (px: number, py: number) => px >= 0 && py >= 0 && px < w && py < h && d[(Math.round(py) * w + Math.round(px)) * 4 + 3] > 200
      const r = Math.max(3, size * 0.05)
      let best: [number, number] | null = null
      let bestD = Infinity
      for (let py = h / 2 - size * 0.4; py < h / 2 + size * 0.4; py += 3)
        for (let px = 0; px < w; px += 3) {
          if (!on(px, py) || !on(px + r, py) || !on(px - r, py) || !on(px, py + r) || !on(px, py - r)) continue
          const dist = Math.abs(px - w / 2) + Math.abs(py - h / 2) * 0.5
          if (dist < bestD) { bestD = dist; best = [px, py] }
        }
      G.ox = best ? best[0] : w / 2
      G.oy = best ? best[1] : h / 2
      G.ok = true
      G.drawn = -1
      draw()
    }
    run()
    if (document.fonts?.ready) document.fonts.ready.then(run).catch(() => {})
    let t = 0
    const onResize = () => { window.clearTimeout(t); t = window.setTimeout(run, 120) }
    window.addEventListener('resize', onResize)
    return () => { off = true; window.clearTimeout(t); window.removeEventListener('resize', onResize) }
  }, [reduced, word])
  if (reduced) {
    return (
      <section id={id} data-chapter={state} data-side={side} className={`relative py-24 ${className}`}>
        <p className="wrap font-display text-display text-accent">{word}</p>
        {children && <div className="mt-12">{children}</div>}
      </section>
    )
  }
  return (
    <section ref={ref} id={id} data-chapter={state} data-side={side} className={`relative ${className}`} style={{ height: '280vh' }}>
      <div ref={box} className="sticky top-0 h-[100svh] overflow-hidden">
        <div ref={after} className="zoom-after text-halo absolute inset-0 flex items-center will-change-transform" style={{ opacity: 0 }}>{children}</div>
        <canvas ref={cv} aria-hidden className="absolute left-0 top-0 block" style={{ width: '100%', height: '100%' }} />
        <h2 className="sr-only">{word}</h2>
      </div>
    </section>
  )
}

// ───────────────────────── número guiado pela rolagem ─────────────────────────

/** Número que sobe conforme a pessoa rola (não com o tempo). SÓ com número informado pelo usuário. */
export function ScrubbedCounter({ to, from = 0, prefix = '', suffix = '', decimals = 0, className = '' }: { to: number; from?: number; prefix?: string; suffix?: string; decimals?: number; className?: string }) {
  const reduced = useReduced()
  const fmt = (v: number) => prefix + v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix
  const out = useRef<HTMLSpanElement>(null)
  const ref = useProgress<HTMLSpanElement>((p) => {
    const e = out.current
    if (!e) return
    const t = fmt(from + (to - from) * (1 - Math.pow(1 - p, 3)))
    if (e.textContent !== t) e.textContent = t
  }, { start: 'top 92%', end: 'top 40%', off: reduced })
  return (
    <span ref={ref} className={className} aria-label={fmt(to)}>
      <span ref={out} aria-hidden>{fmt(reduced ? to : from)}</span>
    </span>
  )
}

// ───────────────────────── letreiro com paralaxe ─────────────────────────

/** Faixas de palavras gigantes que correm em sentidos opostos e aceleram com a rolagem. */
export function MarqueeParallax({ items, rows = 2, className = '' }: { items: string[]; rows?: number; className?: string }) {
  const reduced = useReduced()
  const lines = useRef<(HTMLDivElement | null)[]>([])
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (reduced) return
    let vel = 0
    const x = lines.current.map(() => 0)
    // largura em cache: ler scrollWidth logo depois de escrever o transform forçava layout a cada quadro
    const widths = () => lines.current.map((el) => (el ? el.scrollWidth / 2 : 0))
    let halves = widths()
    const ro = new ResizeObserver(() => { halves = widths() })
    lines.current.forEach((el) => el && ro.observe(el))
    const st = ScrollTrigger.create({ trigger: document.body, start: 0, end: 'max', onUpdate: (s) => { vel = s.getVelocity() } })
    const tick = (_t: number, dt: number) => {
      vel *= 0.92
      lines.current.forEach((el, i) => {
        const half = halves[i]
        if (!el || !half) return
        const dir = i % 2 ? 1 : -1
        x[i] += dir * (0.04 * dt + Math.abs(vel) * 0.0009 * dt) * (vel < 0 ? -1 : 1)
        if (x[i] <= -half) x[i] += half
        if (x[i] > 0) x[i] -= half
        el.style.transform = `translate3d(${x[i].toFixed(1)}px,0,0)`
      })
    }
    // fora da tela o letreiro fica parado (não gasta o quadro de ninguém)
    let on = false
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting === on) return
      on = e.isIntersecting
      if (on) gsap.ticker.add(tick)
      else gsap.ticker.remove(tick)
    }, { rootMargin: '120px 0px' })
    if (wrap.current) io.observe(wrap.current)
    return () => { io.disconnect(); ro.disconnect(); gsap.ticker.remove(tick); st.kill() }
  }, [reduced])
  const text = items.join('  ·  ') + '  ·  '
  return (
    <div ref={wrap} className={`relative overflow-hidden py-10 ${className}`} aria-label={items.join(', ')}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} ref={(el) => { lines.current[r] = el }} aria-hidden
          className={`flex w-max whitespace-nowrap font-display text-[clamp(3rem,9vw,8.5rem)] leading-[1.05] will-change-transform ${r % 2 ? 'text-accent' : 'text-ink'}`}
          style={r % 2 ? { WebkitTextStroke: '1px var(--accent)', color: 'transparent' } : undefined}>
          <span className="pr-8">{text}</span>
          <span className="pr-8">{text}</span>
        </div>
      ))}
    </div>
  )
}
