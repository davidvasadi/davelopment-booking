'use client'

/**
 * Amikor EZ a kliens saját maga ment (pl. foglalás-szerkesztés), a `save()` már saját maga
 * meghívja a `router.refresh()`-t — nincs szükség arra, hogy az SSE-visszhang (a saját írásunk
 * `afterChange` hookja, ami MINDEN csatlakozott klienshez, a sajátunkhoz is visszaküldi a
 * "refresh" eseményt) EGY MÁSODIK, redundáns refresh-t is indítson. Ha ez a második,
 * SSE-vezérelt refresh valamiért a save() saját refresh-ével egy időben/versenyben fut,
 * a kettő közül az egyik régebbi RSC-választ is felülírhatja a frissen mentett állapotot —
 * ez okozta azt, hogy mentés után egy pillanattal "visszaugrott" a régi érték.
 * Ezért: saját mentés után egy rövid ideig figyelmen kívül hagyjuk a beérkező SSE-echo-t.
 */
let lastLocalMutationAt = 0

export function markLocalMutation() {
  lastLocalMutationAt = Date.now()
}

export function wasRecentLocalMutation(windowMs = 2000): boolean {
  return Date.now() - lastLocalMutationAt < windowMs
}
