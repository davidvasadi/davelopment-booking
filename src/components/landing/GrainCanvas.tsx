'use client';

import { useEffect, useRef, useState } from 'react';

// ============================================================
// GRAIN CANVAS — animált, optimalizált (átvéve a davelopment.hu árazási blokkjából, hogy a két
// oldal sötét felületein ugyanaz a textúra legyen)
//
// Hogyan működik:
// 1. Offscreen canvas-on generál egy 256x256 noise tile-t (egyszer)
// 2. toDataURL()-lel CSS background-image-be tölti
// 3. A div CSS background-repeat: repeat + animation: translate
//    → GPU-n fut, nulla JS overhead animáció közben
//    → nem látszik a téglalaphatár mert a tile ismétlődik
// ============================================================

type GrainStrength = 'light' | 'medium' | 'heavy';

const STRENGTH: Record<GrainStrength, { base: number; range: number; alpha: number }> = {
  light:  { base: 20, range: 30, alpha: 180 },
  medium: { base: 8,  range: 55, alpha: 255 },
  heavy:  { base: 0,  range: 80, alpha: 255 },
};

type GrainCanvasProps = {
  opacity?: number;
  strength?: GrainStrength;
  className?: string;
  zIndex?: number;
};

// A zajtextúra tiszta véletlen pixeladat, amit a PNG (veszteségmentes) nagyon
// rosszul tömörít (~80-90 KB/csempe) — JPEG-gel sokkal kisebb, mert a szem
// nem veszi észre a veszteséget egy finom grain-effektnél. Az alpha-csatornát
// (ami a JPEG-ben nincs) a hívó oldali CSS opacity-be sűrítjük bele.
// Egy adott erősséghez (light/medium/heavy) egyszer generáljuk le a csempét,
// és minden <GrainCanvas> instance (akár 4-5 is egy oldalon) ugyanazt a
// data URL-t használja — nincs ok rá, hogy mindegyik saját, külön zajt
// generáljon és saját base64 payloadot hordozzon.
const tileCache = new Map<GrainStrength, string>();

function generateTile(strength: GrainStrength): string {
  const cached = tileCache.get(strength);
  if (cached) return cached;

  const { base, range } = STRENGTH[strength];
  const SIZE = 256;

  const canvas = document.createElement('canvas');
  canvas.width  = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  const img = ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = base + Math.random() * range;
    img.data[i]     = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
  tileCache.set(strength, dataUrl);
  return dataUrl;
}

export function GrainCanvas({
  opacity = 1,
  strength = 'medium',
  className,
  zIndex = 0,
}: GrainCanvasProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const { alpha } = STRENGTH[strength];
  // a korábbi, pixelenkénti alpha-csatornát itt, a CSS opacity-ben pótoljuk
  const effectiveOpacity = opacity * (alpha / 255);

  useEffect(() => {
    setDataUrl(generateTile(strength));
  }, [strength]);

  // csak akkor animál, ha a felület látszik (képernyőn kívül nem terheli a GPU-t)
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '100px' });
    io.observe(el);
    return () => io.disconnect();
  }, [dataUrl]);

  if (!dataUrl) return null;

  return (
    <>
      <style>{`
        @keyframes grain-move {
          0%   { transform: translate3d(0, 0, 0); }
          10%  { transform: translate3d(-48px, -72px, 0); }
          20%  { transform: translate3d(-96px, 48px, 0); }
          30%  { transform: translate3d(48px, -96px, 0); }
          40%  { transform: translate3d(-48px, 96px, 0); }
          50%  { transform: translate3d(-96px, 72px, 0); }
          60%  { transform: translate3d(96px, 0, 0); }
          70%  { transform: translate3d(0, 96px, 0); }
          80%  { transform: translate3d(24px, 72px, 0); }
          90%  { transform: translate3d(-72px, 72px, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) { .grain-layer { animation: none !important; } }
      `}</style>
      <div
        ref={ref}
        aria-hidden
        className={className ?? 'absolute inset-0 pointer-events-none overflow-hidden'}
        style={{ zIndex, opacity: effectiveOpacity, contain: 'strict' }}
      >
        <div
          className="grain-layer"
          style={{
            position: 'absolute',
            // Teljesítmény: a csempe 256 px-enként ismétlődik, ezért elég egy csempényi ráhagyás
            // (nem kell a doboz 4×-es területe — az nagy hero-n hatalmas GPU-textúra volt), és a
            // mozgás px-ben, a csempén belül marad. Képernyőn kívül az animáció szünetel.
            inset: '-128px',
            backgroundImage: `url(${dataUrl})`,
            backgroundRepeat: 'repeat',
            backgroundSize: '256px 256px',
            animation: 'grain-move 0.8s steps(1) infinite',
            animationPlayState: visible ? 'running' : 'paused',
          }}
        />
      </div>
    </>
  );
}

/** A davelopment.hu árazási blokkjának sötét háttere CSS-ben (közel fekete, jobb felső és bal
 *  alsó sarokból derengő grafit fény) — ezen jól látszik a grain. A landing nagy sötét felületei
 *  (hero-k, kalkulátor, „Eddig” kártya) ezt használják a GrainCanvas-szal együtt. */
export const DARK_SURFACE_BG =
  'radial-gradient(85% 75% at 100% 0%, #3a3a3a 0%, #1c1c1c 38%, transparent 72%), radial-gradient(75% 70% at 0% 100%, #2e2e2e 0%, #161616 36%, transparent 70%), #060606'
