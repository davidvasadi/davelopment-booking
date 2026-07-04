/** Asztal-piktogram (davelopment): sötét lap + világos székpöttyök, PONTOSAN a kapacitás szerint.
 *  KÖZÖS: az Asztalok menü (`TablesManager`) ÉS az élő terem-nézet (`DailyView`) is ezt használja,
 *  hogy az asztalok mindenhol egyformán nézzenek ki.
 *
 *  A székek száma = a férőhelyek száma: felül ⌈n/2⌉, alul ⌊n/2⌋ (tehát 3 fő = 2 fönt + 1 lent).
 *  A lap szélessége és a székméret a nagyobbik sorhoz igazodik, hogy 1–20 főig kiférjen. */
export function TableGlyph({ capacity, size = 32 }: { capacity: number; size?: number }) {
  const cap = Math.max(1, Math.min(20, Math.round(capacity)))
  const top = Math.ceil(cap / 2)
  const bottom = cap - top
  const maxSide = Math.max(top, bottom, 1)

  const span = Math.min(28, 7 + maxSide * 2.4)
  const x = (30 - span) / 2
  const rectY = 9.5
  const rectH = 11
  const seatR = maxSide >= 7 ? 1.1 : maxSide >= 5 ? 1.4 : 2

  const row = (count: number) =>
    count <= 0
      ? []
      : count === 1
        ? [15]
        : Array.from({ length: count }, (_, i) => x + (span / (count + 1)) * (i + 1))

  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <rect x={x} y={rectY} width={span} height={rectH} rx="3" fill="#1D1C19" />
      {row(top).map((cx, i) => (
        <circle key={`t${i}`} cx={cx} cy={rectY - 3.4} r={seatR} fill="#D9D3C2" />
      ))}
      {row(bottom).map((cx, i) => (
        <circle key={`b${i}`} cx={cx} cy={rectY + rectH + 3.4} r={seatR} fill="#D9D3C2" />
      ))}
    </svg>
  )
}
