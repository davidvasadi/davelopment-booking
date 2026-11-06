#!/usr/bin/env node
/**
 * Az ajándékutalvány selyem-hátterének állóképe — a landing SilkGradient shaderének (src/components/landing/
 * SilkGradient.tsx) pixel-pontos CPU-s átirata. Bankkártya-arányú (ISO 85,6 × 54 mm) képet ment, ami a kártyán,
 * a PDF-ben és az e-mailben is ugyanaz.
 *
 * Futtatás: node scripts/render-voucher-silk.mjs  →  public/voucher/silk.webp (+ silk.jpg az e-mailhez)
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const W = 1712, H = 1080, SEED = 3.7

const fract = (x) => x - Math.floor(x)
function hash(x, y) {
  let px = fract(x * 123.34), py = fract(y * 456.21)
  const d = px * (px + 45.32) + py * (py + 45.32)
  px += d; py += d
  return fract(px * py)
}
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1)
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy
}
function fbm(x, y) {
  let v = 0, a = 0.5
  for (let i = 0; i < 5; i++) { v += a * noise(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; a *= 0.5 }
  return v
}
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

const cream = [0.995, 0.972, 0.935], peach = [0.98, 0.84, 0.68], amber = [0.965, 0.705, 0.37]
const orange = [0.945, 0.6, 0.27], yellow = [0.992, 0.88, 0.52], blush = [0.975, 0.86, 0.835]
const dl = Math.hypot(0.66, 1), dx = 0.66 / dl, dy = 1 / dl, pnx = -dy, pny = dx

const buf = Buffer.alloc(W * H * 3)
for (let row = 0; row < H; row++) {
  const fy = H - row - 0.5 // gl_FragCoord.y felfelé nő
  for (let col = 0; col < W; col++) {
    const fxp = col + 0.5
    const nx = fxp / W, ny = fy / H
    const ux = fxp / H, uy = fy / H
    const along = ux * dx + uy * dy, across = ux * pnx + uy * pny
    const bend = (fbm(across * 1.2 + SEED, along * 0.4 + SEED) - 0.5) * 0.12
    const c = across + bend
    const k = fbm(c * 5.5 + SEED, along * 0.28 + SEED) * 0.7 + fbm(c * 16 + SEED * 1.9, along * 0.45 + SEED * 1.9) * 0.3
    // kártya-változat: a meleg tónus az egész felületen (a landingen alul krémbe fut a szöveg miatt)
    let heat = 0.42 + 0.58 * smooth(-0.1, 0.95, ny)
    heat += 0.35 * Math.exp(-Math.pow((nx - 0.62) * 2.2, 2)) * smooth(0.2, 1, ny)
    heat = Math.min(1, Math.max(0, heat))
    let o = mix(cream, peach, smooth(0, 0.55, heat))
    o = mix(o, amber, smooth(0.3, 0.9, heat) * smooth(0.3, 0.7, k))
    o = mix(o, orange, smooth(0.55, 1, heat) * smooth(0.45, 0.8, k))
    o = mix(o, cream, smooth(0.58, 0.82, k) * (0.35 + 0.3 * (1 - heat)))
    o = mix(o, yellow, smooth(0.45, 1, nx) * smooth(0, 0.55, ny) * 0.35)
    o = mix(o, blush, (1 - smooth(0, 0.42, ny)) * 0.18)
    o = mix(o, cream, (1 - smooth(0, 0.32, nx)) * 0.28)
    const dither = ((hash(fxp, fy) - 0.5) / 255) * 2
    const i = (row * W + col) * 3
    for (let ch = 0; ch < 3; ch++) buf[i + ch] = Math.round(Math.min(1, Math.max(0, o[ch] + dither)) * 255)
  }
}

mkdirSync('public/voucher', { recursive: true })
const img = sharp(buf, { raw: { width: W, height: H, channels: 3 } })
await img.clone().webp({ quality: 88 }).toFile('public/voucher/silk.webp')
await img.clone().resize(856, 540).jpeg({ quality: 86, mozjpeg: true }).toFile('public/voucher/silk.jpg')
console.log('public/voucher/silk.webp + silk.jpg kész')
