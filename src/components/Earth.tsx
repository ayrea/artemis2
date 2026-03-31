import { useTexture } from '@react-three/drei'
import type { ReactNode } from 'react'
import { EARTH_RADIUS_KM } from '../sat/astroUtils'

const POLAR_TO_EQUATOR_RATIO = 12714 / 12756

/*
 * Visual tilt applied to the globe mesh so the north pole points "up and back"
 * in the default camera view. This is not astronomically accurate — it is a
 * presentation adjustment. Earth's true axial tilt is ~23.4° (0.408 rad).
 */
const EARTH_DISPLAY_TILT_RAD = 0.35

type EarthProps = {
  children?: ReactNode
}

export default function Earth({ children }: EarthProps) {
  const earthTexture = useTexture('/earth-8k.jpg')

  return (
    <mesh rotation={[EARTH_DISPLAY_TILT_RAD, 0, 0]} scale={[1, POLAR_TO_EQUATOR_RATIO, 1]}>
      <sphereGeometry args={[EARTH_RADIUS_KM, 48, 48]} />
      <meshStandardMaterial map={earthTexture} color="#ffffff" emissive="#1a1a1a" emissiveIntensity={0.45} />
      {children}
    </mesh>
  )
}
