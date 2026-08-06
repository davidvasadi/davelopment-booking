// Statikus feTurbulence data URI — egyszer rendereli a böngésző, soha nem számolja újra.
// Az animáció csak translate: compositor-layer, GPU csinálja ingyen.
const GRAIN_SVG = `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`

export function Grain({ opacity = 0.22 }: { opacity?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden z-0">
      <div
        className="absolute inset-[-50%] w-[200%] h-[200%] animate-grain"
        style={{
          backgroundImage: GRAIN_SVG,
          backgroundSize: '180px 180px',
          opacity,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  )
}
