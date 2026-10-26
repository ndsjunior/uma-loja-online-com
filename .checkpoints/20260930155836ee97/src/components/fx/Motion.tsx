// Kit 3D Cinema do Brixly — movimento de página (framer-motion). Tudo respeita
// prefers-reduced-motion: com ele ligado, o conteúdo aparece parado, sem animação.
import {
  animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform,
} from 'framer-motion'
import { useEffect, useRef, useState, type ElementType, type PointerEvent as RPointerEvent, type ReactNode } from 'react'

const EASE = [0.22, 1, 0.36, 1] as const

/** Aparece ao entrar na tela (sobe + fade). `delay` em segundos. */
export function Reveal({ children, delay = 0, y = 28, className = '' }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const still = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={still ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/** Grade que revela os filhos em cascata. Use <RevealItem> em cada filho. */
export function RevealGroup({ children, className = '', gap = 0.08 }: { children: ReactNode; className?: string; gap?: number }) {
  const still = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={still ? false : 'hide'}
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      variants={{ hide: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  )
}

export function RevealItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hide: { opacity: 0, y: 32, scale: 0.98 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  )
}

/** Título que entra palavra por palavra (use no h1 do hero). O texto está no HTML desde o início. */
export function SplitWords({ text, as = 'h1', className = '', delay = 0.1 }: { text: string; as?: 'h1' | 'h2' | 'p'; className?: string; delay?: number }) {
  const still = useReducedMotion()
  const Tag = as as ElementType
  const words = text.split(' ')
  return (
    <Tag className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.12em] align-bottom">
          <motion.span
            className="inline-block"
            initial={still ? false : { y: '105%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.9, delay: delay + i * 0.06, ease: EASE }}
          >
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </Tag>
  )
}

/** Botão/link que é "puxado" pelo cursor. Envolva o <a className="btn ...">. Sem efeito no toque. */
export function Magnetic({ children, strength = 0.35, className = '' }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const still = useReducedMotion()
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 16, mass: 0.4 })
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 16, mass: 0.4 })
  const move = (e: RPointerEvent) => {
    if (still || e.pointerType !== 'mouse' || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) * strength)
    y.set((e.clientY - (r.top + r.height / 2)) * strength)
  }
  const leave = () => {
    x.set(0)
    y.set(0)
  }
  return (
    <motion.span ref={ref} className={`inline-flex ${className}`} style={{ x, y }} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </motion.span>
  )
}

/** Card com inclinação 3D + brilho seguindo o cursor. Mesmo visual do .card; parado no toque. */
export function TiltCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const still = useReducedMotion()
  const rx = useSpring(0, { stiffness: 180, damping: 18 })
  const ry = useSpring(0, { stiffness: 180, damping: 18 })
  // brilho escrito direto no estilo (antes: setState a cada movimento do mouse = render do React)
  const glow = useRef<HTMLSpanElement>(null)
  const move = (e: RPointerEvent) => {
    if (still || e.pointerType !== 'mouse' || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    ry.set((px - 0.5) * 10)
    rx.set(-(py - 0.5) * 10)
    const g = glow.current
    if (g) {
      g.style.background = `radial-gradient(420px circle at ${px * 100}% ${py * 100}%, var(--accent-soft), transparent 60%)`
      g.style.opacity = '1'
    }
  }
  const leave = () => {
    rx.set(0)
    ry.set(0)
    if (glow.current) glow.current.style.opacity = '0'
  }
  return (
    <motion.div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={leave}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      className={`card relative overflow-hidden ${className}`}
    >
      <span
        ref={glow}
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{ opacity: 0, background: 'radial-gradient(420px circle at 50% 50%, var(--accent-soft), transparent 60%)' }}
      />
      <div className="relative">{children}</div>
    </motion.div>
  )
}

/** Número que conta até `to` ao aparecer. SÓ com número REAL informado pelo usuário. */
export function Counter({ to, prefix = '', suffix = '', decimals = 0, className = '' }: { to: number; prefix?: string; suffix?: string; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  const still = useReducedMotion()
  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const [val, setVal] = useState(still ? to : 0)
  useEffect(() => {
    if (!inView) return
    if (still) {
      setVal(to)
      return
    }
    const c = animate(0, to, { duration: 1.8, ease: EASE, onUpdate: setVal })
    return () => c.stop()
  }, [inView, still, to])
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {fmt(val)}
      {suffix}
    </span>
  )
}

/** Desloca o conteúdo mais devagar/rápido que a rolagem (profundidade). speed 0.1-0.4. */
export function Parallax({ children, speed = 0.2, className = '' }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const still = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [`${speed * 100}%`, `${-speed * 100}%`])
  return (
    <div ref={ref} className={className}>
      <motion.div style={still ? undefined : { y }}>{children}</motion.div>
    </div>
  )
}

/** Barra fina no topo mostrando o progresso de leitura. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 24 })
  return <motion.div aria-hidden className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-accent" style={{ scaleX }} />
}
