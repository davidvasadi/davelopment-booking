/** A foglalás színe az idővonalakon — mobilon (kártya) és asztalon (blokk) ugyanaz a szabály (Dave, 2026-11-03):
 *  megerősített / bent sötét, függő (jóváhagyásra vár) sárga, befejezett fehér; a pötty mutatja az állapotot (megerősített
 *  sárga, függő sötét, befejezett szürke, bent zöld). A szünet fehér, piros pöttyel. A lemondott csak az asztali idővonalon látszik, pirosan. */
export function statusCard(status: string): { tone: 'dark' | 'light' | 'yellow'; dot: string } {
  const tone = status === 'pending' ? 'yellow' : status === 'completed' ? 'light' : 'dark'
  const dot = status === 'completed' ? 'bg-ui-grey' : status === 'seated' ? 'bg-ui-ok-dot' : status === 'pending' ? 'bg-ui-dark' : 'bg-ui-yellow'
  return { tone, dot }
}

/** Az asztali idővonal blokkjának színe ugyanebből (a lemondott / nem jött piros). */
export const statusBlockClass = (status: string) =>
  status === 'cancelled' || status === 'no_show' ? 'bg-ui-bad-bg text-ui-bad' : CARD_CLASS[statusCard(status).tone]

/** A kártya / blokk háttere a tónusból. */
export const CARD_CLASS = { dark: 'bg-ui-dark text-white', yellow: 'bg-ui-yellow text-ui-dark', light: 'bg-white text-ui-text' } as const

/** Jelmagyarázat (BlockLegend `items`): [minta, felirat, pötty]. */
export const STATUS_LEGEND: string[][] = [
  ['bg-ui-dark', 'Megerősített', 'bg-ui-yellow'],
  ['bg-ui-yellow', 'Függő', 'bg-ui-dark'],
  ['bg-white', 'Befejezett', 'bg-ui-grey'],
  ['bg-ui-bad-bg', 'Lemondva'],
  ['bg-white', 'Szünet', 'bg-ui-bad-dot'],
  ['ui-hatch', 'Szabad'],
]
