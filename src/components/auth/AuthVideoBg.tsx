export function AuthVideoBg({ fullScreen = false }: { fullScreen?: boolean }) {
  const pos = fullScreen ? 'fixed' : 'absolute'
  return (
    <>
      <video
        autoPlay
        muted
        loop
        playsInline
        className={`${pos} inset-0 w-full h-full object-cover`}
        aria-hidden="true"
      >
        <source src="/videos/szalon-foglalas-hatter.webm" type="video/webm" />
        <source src="/videos/szalon-foglalas-hatter.mp4" type="video/mp4" />
      </video>
      <div className={`${pos} inset-0 bg-black/60`} aria-hidden="true" />
    </>
  )
}
