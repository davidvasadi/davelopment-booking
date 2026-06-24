/**
 * A footer óriási „Csatlakozz" felirata. SVG-textként a teljes konténer-szélességre
 * skálázódik (a betűk mindig a fekete kártya széléig érnek, minden nézeten), az alját
 * pedig a footer overflow-hidden + negatív margó kissé levágja.
 */
export function JoinWord({ children }: { children: string }) {
  return (
    <svg
      className="block w-full select-none -mb-[3.5%]"
      viewBox="0 0 1000 200"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
    >
      <text
        x="500"
        y="180"
        textAnchor="middle"
        fontSize="230"
        fontWeight="700"
        letterSpacing="-20"
        fill="currentColor"
        fontFamily="var(--font-geist), system-ui, sans-serif"
      >
        {children}
      </text>
    </svg>
  )
}
