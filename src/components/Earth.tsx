import { useTexture } from '@react-three/drei'
import { useMemo, type ReactNode } from 'react'
import { EARTH_RADIUS_KM, greenwichSiderealTime, toJulianDate } from '../sat/astroUtils'

const POLAR_TO_EQUATOR_RATIO = 12714 / 12756

/*
 * Visual tilt applied to the globe mesh so the north pole points "up and back"
 * in the default camera view. This is not astronomically accurate — it is a
 * presentation adjustment. Earth's true axial tilt is ~23.4° (0.408 rad).
 */
export const EARTH_DISPLAY_TILT_RAD = 0.35

type EarthProps = {
  currentTime: Date
  children?: ReactNode
}

export default function Earth({ currentTime, children }: EarthProps) {
  const earthTexture = useTexture('earth-8k.jpg')
  const gmstAngle = useMemo(() => {
    return greenwichSiderealTime(toJulianDate(currentTime))
  }, [currentTime])

  return (
    <group rotation={[EARTH_DISPLAY_TILT_RAD, 0, 0]}>
      <mesh rotation={[0, -gmstAngle, 0]} scale={[1, POLAR_TO_EQUATOR_RATIO, 1]}>
        <sphereGeometry args={[EARTH_RADIUS_KM, 48, 48]} />
        <meshStandardMaterial map={earthTexture} color="#ffffff" emissive="#1a1a1a" emissiveIntensity={0.45} />
        {children}
      </mesh>
    </group>
  )
}
