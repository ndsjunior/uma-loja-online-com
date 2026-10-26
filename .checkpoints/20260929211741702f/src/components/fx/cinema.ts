// Kit 3D Cinema do Brixly — TUDO num import só (o palco 3D guiado pela rolagem + os layouts
// de rolagem + o kit antigo de movimento). Import: `import { ScrollStage, Chapter, … } from './components/fx/cinema'`.
// O motor 3D (StageScene/Scene3D) NÃO é exportado aqui de propósito: ele entra sob demanda.
export * from './index'
export { ScrollStage, Chapter } from './ScrollStage'
export type { ScrollStageProps, ChapterProps, StageObject, StageSceneName } from './ScrollStage'
export {
  SmoothScroll, PinnedSection, PinStep, StickyScrollytelling, HorizontalScroll, HCard,
  TextMaskReveal, ZoomThrough, ScrubbedCounter, MarqueeParallax,
} from './Scroll'
export type { Step } from './Scroll'
