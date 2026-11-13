/**
 * A tipp / cikk kártyák képe (lista, kapcsolódó tippek lapozó). Két fajta kép van:
 *  - kész borító (`/landing/tips/borito/…`, 1220×994: a telefon már középen, fehér kerettel) → kitölti a képmezőt;
 *  - nyers, álló telefonos képernyőkép (900×1840, pl. a kézikönyv-útmutatóknál) → középre, a borítók telefonjával azonos
 *    méretben — különben a kártya szélességére nagyítva csak az elmosódott teteje látszana.
 */
export function TipCardImage({ src, alt }: { src: string; alt: string }) {
  const cover = src.includes('/landing/tips/borito/')
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" decoding="async"
      className={cover
        ? 'absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:-translate-y-1'
        : 'absolute left-1/2 top-5 w-[46%] max-w-[170px] -translate-x-1/2 transition-transform duration-500 group-hover:-translate-y-1'} />
  )
}
