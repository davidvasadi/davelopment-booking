// Import-párosítás: a fájlban szereplő nevek (munkatárs, szolgáltatás, kategória, asztal, terem)
// összevetése a vállalkozás meglévő elemeivel, hogy az import ne hozzon létre duplikátumot.
// Tiszta függvények — a szerver (/api/import-csv, mode: 'match' és az import maga) és a felület
// ugyanezt használja.
//
// Három szint:
//   exact    — normalizálva (kisbetű, ékezet nélkül, zárójeles rész nélkül) ugyanazok a szavak,
//              sorrendtől függetlenül ("Bence Csonka" = "Csonka Bence") → automatikus párosítás
//   probable — elírás, egyik név tartalmazza a másikat, vagy csak a keresztnév egyezik egyértelműen
//              → csak javaslat, a felhasználó dönt
//   none     — nincs megfelelő → a felhasználó dönt (új / meglévőhöz párosít / kihagy)

export type EntityKind = 'staff' | 'services' | 'categories' | 'tables' | 'rooms'
export type MatchStatus = 'exact' | 'probable' | 'none'

export type Candidate = { id: number; name: string; is_active?: boolean | null }

export type MatchResult = {
  status: MatchStatus
  match?: Candidate
  score: number
  // további lehetséges egyezések (pl. kétértelmű keresztnév), legjobb elöl
  alternatives: (Candidate & { score: number })[]
}

// A felhasználó döntése egy fájlbeli értékre
export type MatchDecision =
  | { action: 'match'; id: number }
  | { action: 'new' }
  | { action: 'skip' }

// kind → fájlbeli (eredeti) érték → döntés
export type EntityMap = Partial<Record<EntityKind, Record<string, MatchDecision>>>

export function normalizeName(value: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // "Csonka Bence(alapító)" → "csonka bence"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

// Kötőszavak nem részei a névnek: „Haj és szakáll” = „Haj & szakáll”
const STOPWORDS = new Set(['es', 'and', 'meg'])
const tokens = (value: string) => normalizeName(value).split(' ').filter((t) => t && !STOPWORDS.has(t))
const sortedKey = (value: string) => tokens(value).sort().join(' ')

// Egy cellában több munkatárs is lehet ("Oravecz András, Csonka Bence") — szétbontjuk.
export function splitPeople(value: string): string[] {
  return (value ?? '')
    // (\b nem működik ékezetes betűvel, ezért az „és” szóközökkel határolva)
    .split(/\s*[,;/&+]\s*|\s+(?:és|es|and)\s+/i)
    .map((s) => s.replace(/\([^)]*\)/g, '').trim())
    .filter(Boolean)
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

function similarity(value: string, candidate: string, kind: EntityKind): number {
  const a = sortedKey(value)
  const b = sortedKey(candidate)
  if (!a || !b) return 0
  if (a === b) return 1

  const ta = new Set(a.split(' '))
  const tb = new Set(b.split(' '))
  let score = 1 - levenshtein(a, b) / Math.max(a.length, b.length)

  // Az egyik név az összes szavával benne van a másikban ("Kombinált Terápia" ⊂ "Személyre
  // Szabott Kombinált Terápia"). Minél kisebb a különbség, annál erősebb.
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta]
  if ([...small].every((t) => big.has(t))) {
    score = Math.max(score, 0.8 + 0.15 * (small.size / big.size))
  }

  // Személynél: csak keresztnév / csak vezetéknév ("Bence" ↔ "Csonka Bence")
  if (kind === 'staff' && small.size === 1 && big.has([...small][0])) {
    score = Math.max(score, 0.8)
  }
  return score
}

const PROBABLE_MIN = 0.8
const ALTERNATIVE_MIN = 0.6

export function matchName(value: string, candidates: Candidate[], kind: EntityKind): MatchResult {
  const key = sortedKey(value)
  if (!key) return { status: 'none', score: 0, alternatives: [] }

  const exact = candidates.filter((c) => sortedKey(c.name) === key)
  if (exact.length === 1) return { status: 'exact', match: exact[0], score: 1, alternatives: [] }
  if (exact.length > 1) {
    // Két azonos nevű meglévő elem — nem döntünk helyette
    return {
      status: 'probable',
      match: exact[0],
      score: 0.99,
      alternatives: exact.map((c) => ({ ...c, score: 0.99 })),
    }
  }

  const scored = candidates
    .map((c) => ({ ...c, score: similarity(value, c.name, kind) }))
    .filter((c) => c.score >= ALTERNATIVE_MIN)
    .sort((x, y) => y.score - x.score)

  const best = scored[0]
  if (best && best.score >= PROBABLE_MIN) {
    return { status: 'probable', match: best, score: best.score, alternatives: scored.slice(0, 4) }
  }
  return { status: 'none', score: best?.score ?? 0, alternatives: scored.slice(0, 4) }
}

// Alapértelmezett döntés, ha a felhasználó nem párosított (pl. több munkalapos import):
// csak a biztos egyezés párosul automatikusan, minden más újként (inaktívan) jön létre.
export function defaultDecision(result: MatchResult): MatchDecision {
  return result.status === 'exact' && result.match ? { action: 'match', id: result.match.id } : { action: 'new' }
}
