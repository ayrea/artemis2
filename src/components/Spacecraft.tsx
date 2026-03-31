import { useMemo } from 'react'
import * as THREE from 'three'
import { findClosestEntryIndex, HORIZONS_ENTRIES } from '../horizonsParser'
import {
  eclipticJ2000ToEci,
  toJulianDate,
} from '../sat/astroUtils'
import { eciToScene } from '../utils/3d'
import { EARTH_DISPLAY_TILT_RAD } from './Earth'

const SPACECRAFT_MARKER_RADIUS_KM = 200
const CYLINDER_REAL_RADIUS_M = 2.4
const CYLINDER_REAL_LENGTH_M = 7.9
const CONE_REAL_HEIGHT_M = 3.35
const SPACECRAFT_SCALE_KM_PER_M = SPACECRAFT_MARKER_RADIUS_KM / CYLINDER_REAL_RADIUS_M
const SPACECRAFT_CYLINDER_RADIUS_KM = SPACECRAFT_MARKER_RADIUS_KM
const SPACECRAFT_CYLINDER_HEIGHT_KM = CYLINDER_REAL_LENGTH_M * SPACECRAFT_SCALE_KM_PER_M
const SPACECRAFT_CONE_RADIUS_KM = SPACECRAFT_MARKER_RADIUS_KM
const SPACECRAFT_CONE_HEIGHT_KM = CONE_REAL_HEIGHT_M * SPACECRAFT_SCALE_KM_PER_M

type SpacecraftProps = {
  currentTime: Date
}

export default function Spacecraft({ currentTime }: SpacecraftProps) {
  const position = useMemo<[number, number, number] | null>(() => {
    const entryIndex = findClosestEntryIndex(toJulianDate(currentTime))
    if (entryIndex < 0) return null
    const entry = HORIZONS_ENTRIES[entryIndex]

    const eci = eclipticJ2000ToEci([entry.x, entry.y, entry.z])
    const [x, y, z] = eciToScene(eci)

    const tilted = new THREE.Vector3(x, y, z).applyEuler(
      new THREE.Euler(EARTH_DISPLAY_TILT_RAD, 0, 0, 'XYZ'),
    )

    return [tilted.x, tilted.y, tilted.z]
  }, [currentTime])

  if (position === null) return null

  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry
          args={[
            SPACECRAFT_CYLINDER_RADIUS_KM,
            SPACECRAFT_CYLINDER_RADIUS_KM,
            SPACECRAFT_CYLINDER_HEIGHT_KM,
            24,
          ]}
        />
        <meshStandardMaterial color="#b0c8d8" emissive="#1a3a4a" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, SPACECRAFT_CYLINDER_HEIGHT_KM / 2 + SPACECRAFT_CONE_HEIGHT_KM / 2, 0]}>
        <coneGeometry args={[SPACECRAFT_CONE_RADIUS_KM, SPACECRAFT_CONE_HEIGHT_KM, 24]} />
        <meshStandardMaterial color="#6090b0" emissive="#0a2030" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}
