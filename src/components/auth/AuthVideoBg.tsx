export function AuthVideoBg() {
  return (
    <>
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        aria-hidden="true"
      >
        <source src="/videos/szalon-foglalas-hatter.webm" type="video/webm" />
        <source src="/videos/szalon-foglalas-hatter.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
    </>
  )
}
