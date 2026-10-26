// Kit 3D Cinema do Brixly. Import: `import { Hero3D, Reveal, Magnetic } from './components/fx'`
// (o caminho relativo muda conforme o arquivo). O motor 3D (Scene3D) NÃO é exportado aqui de
// propósito: ele entra só pelo Hero3D, num pedaço separado que carrega depois da página.
export { default as Hero3D } from './Hero3D'
export type { Hero3DProps, Hero3DVariant, Hero3DShape } from './Hero3D'
export { Reveal, RevealGroup, RevealItem, SplitWords, Magnetic, TiltCard, Counter, Parallax, ScrollProgress } from './Motion'
