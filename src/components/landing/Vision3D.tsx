'use client'

import { useRef } from 'react'
import { Canvas, useFrame, type ThreeElements } from '@react-three/fiber'
import { Float, Environment } from '@react-three/drei'
import type { Mesh } from 'three'

/**
 * A Vision-szekció 3D-jelenete (R3F). EGYELŐRE PLACEHOLDER geometria — amikor kész a Blender
 * glTF export (public/3d/), a `PlaceholderObject` lecserélhető `useGLTF`-fel, a többi marad.
 *
 * A `progressRef`-et a Vision GSAP-timeline-ja állítja (0→1): ezzel forgatjuk/közelítjük az
 * objektumot a scroll-scrubhoz kötve. Mobil/reduced-motion esetén a szülő statikus posztert mutat
 * helyette — ez a komponens csak akkor mountol, ha tényleg kell (dynamic ssr:false).
 *
 * Megjegyzés a típusokról: NEM használjuk az R3F globális JSX-augmentációját (az React 19 alatt
 * `never`-be omlasztja a sima <div>/<svg> intrinsic-eket projekt-szerte). Helyette a Three-elemeket
 * itt, lokálisan, az `R3F` névtérrel típusozzuk a `ThreeElements`-ből — a globális JSX tiszta marad.
 */

const R3F = {
  mesh: 'mesh' as unknown as React.FC<ThreeElements['mesh']>,
  torusKnotGeometry: 'torusKnotGeometry' as unknown as React.FC<ThreeElements['torusKnotGeometry']>,
  meshStandardMaterial:
    'meshStandardMaterial' as unknown as React.FC<ThreeElements['meshStandardMaterial']>,
  ambientLight: 'ambientLight' as unknown as React.FC<ThreeElements['ambientLight']>,
  directionalLight: 'directionalLight' as unknown as React.FC<ThreeElements['directionalLight']>,
}

function PlaceholderObject({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const mesh = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (!mesh.current) return
    // Lassú alap-forgás + a scroll-progresszióhoz kötött extra elfordulás/zoom.
    mesh.current.rotation.y += delta * 0.15
    mesh.current.rotation.x = progressRef.current * Math.PI * 0.5
    const s = 1 + progressRef.current * 0.4
    mesh.current.scale.set(s, s, s)
  })

  return (
    <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.6}>
      <R3F.mesh ref={mesh}>
        {/* Placeholder: lekerekített torus-knot — becserélhető a valódi glTF-re. */}
        <R3F.torusKnotGeometry args={[1, 0.32, 160, 32]} />
        <R3F.meshStandardMaterial color="#ecf95a" roughness={0.25} metalness={0.6} />
      </R3F.mesh>
    </Float>
  )
}

export default function Vision3D({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 5], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      className="!absolute inset-0"
    >
      <R3F.ambientLight intensity={0.6} />
      <R3F.directionalLight position={[5, 5, 5]} intensity={1.2} />
      <PlaceholderObject progressRef={progressRef} />
      <Environment preset="city" />
    </Canvas>
  )
}
