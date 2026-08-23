export function AuthVideoBg({ fullScreen = false }: { fullScreen?: boolean }) {
  const pos = fullScreen ? 'fixed' : 'absolute'
  return (
    <>
      {/* NINCS translateZ(0)/willChange — a szülő rounded-[30px] + overflow-hidden kombóval a
          videó GPU-rétegre emelése Chrome-ban időnként "elvágja" a lekerekítést, amint egy
          MÁSIK elem (pl. a jobb oldali gomb hoverre) is animál a lapon (a kompozitor-réteg
          maszkja nem frissül helyesen). Réteg-promóció nélkül a böngésző a sima (nem
          kompozitált) útvonalon vágja a videót, ez a bug nem jelentkezik. */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
        className={`${pos} inset-0 w-full h-full object-cover`}
        aria-hidden="true"
      >
        <source src="/videos/szalon-foglalas-hatter.mp4" type="video/mp4" />
        <source src="/videos/szalon-foglalas-hatter.mp4" type="video/mp4" />
      </video>
      <div className={`${pos} inset-0 bg-black/60`} aria-hidden="true" />
    </>
  )
}
