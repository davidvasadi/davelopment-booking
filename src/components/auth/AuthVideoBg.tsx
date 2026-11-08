export function AuthVideoBg({ fullScreen = false }: { fullScreen?: boolean }) {
  // mobilon a teljes képernyő, a Safari felső / alsó sávja mögé is (100lvh: a legnagyobb nézet-magasság) — iOS 26-on a
  // sávok áttetszők, alattuk a videó látszik (elmosva); enélkül a sávok mögött szürke üres hely volt
  const pos = fullScreen ? 'fixed' : 'absolute'
  const size = fullScreen ? 'left-0 top-0 h-[100lvh] w-full' : 'inset-0 h-full w-full'
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
        className={`${pos} ${size} object-cover`}
        aria-hidden="true"
      >
        <source src="/videos/szalon-foglalas-hatter.mp4" type="video/mp4" />
        <source src="/videos/szalon-foglalas-hatter.mp4" type="video/mp4" />
      </video>
      <div className={`${pos} ${size} bg-black/60`} aria-hidden="true" />
    </>
  )
}
