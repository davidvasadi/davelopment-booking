/** Az ajánló kód megjelenítése (böngészőben is használható — a lib/referrals szerveroldali, abból nem importálhat
 *  kliens-komponens). Az új formátumú kód kötőjellel: ANNA7K2 → ANNA-7K2; a régiek (ANNA, ANNA2) változatlanul. */
export const displayCode = (code: string) => code.replace(/^([A-Z]+)([2-9][A-HJ-NP-Z][2-9])$/, '$1-$2')
