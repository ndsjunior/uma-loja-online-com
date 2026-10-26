// Kit 3D Cinema do Brixly — o "roteiro" da rolagem, lido pela cena 3D a cada quadro.
//
// Cada elemento com `data-chapter="estado"` (o <Chapter>, os passos do <StickyScrollytelling>…)
// vira um CAPÍTULO. `stage.c` é a posição contínua na história: 2.4 = 40% do caminho entre o
// capítulo 2 e o 3. A cena 3D interpola o estado dela entre os dois — é isso que faz o objeto
// explodir, girar, mudar de cor e a câmera voar enquanto a pessoa desce a página.
// Este arquivo NÃO importa three: fica no pedaço principal, leve.

export interface StageState {
  /** posição contínua nos capítulos (0 … n-1) */
  c: number
  /** progresso da página inteira 0…1 */
  p: number
  /** velocidade da rolagem (px/quadro, suavizada; + = descendo) */
  v: number
  /** estado de cada capítulo, na ordem do documento */
  names: string[]
  /** lado do 3D em cada capítulo: -1 esquerda · 0 centro · 1 direita */
  sides: number[]
  /** ponteiro -1…1 */
  x: number
  y: number
  /** muda quando os capítulos são remedidos (a cena refaz o que depende da contagem) */
  ver: number
}

export const stage: StageState = { c: 0, p: 0, v: 0, names: [], sides: [], x: 0, y: 0, ver: 0 }

const SIDE: Record<string, number> = { left: -1, esquerda: -1, center: 0, centro: 0, right: 1, direita: 1 }
let anchors: number[] = []
// altura rolável em cache (medida no measure): o ouvinte de scroll NUNCA lê layout
let maxY = 1
let lastY = 0
let defaultSide = 1
let users = 0
let raf = 0
let stop = () => {}
const listeners = new Set<() => void>()

/** a cena em modo "movimento reduzido" só redesenha quando o capítulo muda */
export function onStageChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function measure(): void {
  if (typeof window === 'undefined') return
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-chapter]'))
  const vh = window.innerHeight
  const max = Math.max(1, document.documentElement.scrollHeight - vh)
  maxY = max
  let prev = -Infinity
  anchors = els.map((el) => {
    const r = el.getBoundingClientRect()
    const top = r.top + window.scrollY
    // âncora = rolagem em que o capítulo está centrado na tela
    let a = Math.min(max, Math.max(0, top + r.height / 2 - vh / 2))
    if (a <= prev) a = prev + 1 // capítulo aninhado / fora de ordem: nunca volta
    prev = a
    return a
  })
  const names = els.map((el) => (el.dataset.chapter || '').trim().toLowerCase())
  const sides = els.map((el) => SIDE[(el.dataset.side || '').trim().toLowerCase()] ?? defaultSide)
  // o 1º capítulo é o hero: o objeto NUNCA fica no centro, atrás do h1 (título ilegível em cima
  // do 3D). No celular o lado não conta — o objeto sobe pro terço de cima e o texto fica embaixo.
  if (sides.length && sides[0] === 0) sides[0] = defaultSide || 1
  if (names.join('|') !== stage.names.join('|') || sides.join('|') !== stage.sides.join('|')) {
    stage.names = names
    stage.sides = sides
    stage.ver++
  }
  update()
}

function update(): void {
  const y = window.scrollY
  stage.p = Math.min(1, Math.max(0, y / maxY))
  stage.v += (y - lastY - stage.v) * 0.2
  lastY = y
  const n = anchors.length
  let c = 0
  if (n > 1) {
    if (y <= anchors[0]) c = 0
    else if (y >= anchors[n - 1]) c = n - 1
    else {
      let i = 0
      while (i < n - 2 && y >= anchors[i + 1]) i++
      c = i + (y - anchors[i]) / Math.max(1, anchors[i + 1] - anchors[i])
    }
  }
  const changed = Math.round(c) !== Math.round(stage.c)
  stage.c = c
  if (changed) listeners.forEach((f) => f())
}

/** Liga os ouvintes (contagem de referência: vários ScrollStage/StickyScrollytelling podem pedir). */
export function startStage(side: number = 1): () => void {
  defaultSide = side
  users++
  if (users === 1) {
    const onScroll = () => update()
    const onMove = (e: PointerEvent) => {
      stage.x = (e.clientX / window.innerWidth) * 2 - 1
      stage.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('load', schedule)
    const ro = 'ResizeObserver' in window ? new ResizeObserver(schedule) : null
    ro?.observe(document.body)
    const timers = [0, 400, 1500, 3500].map((t) => window.setTimeout(schedule, t))
    document.fonts?.ready.then(schedule).catch(() => {})
    stop = () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('load', schedule)
      ro?.disconnect()
      timers.forEach((t) => window.clearTimeout(t))
      cancelAnimationFrame(raf)
    }
  } else {
    requestAnimationFrame(measure)
  }
  return () => {
    users--
    if (users === 0) stop()
  }
}
export function prefersReduced(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isMobile(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px), (pointer: coarse)').matches
}
