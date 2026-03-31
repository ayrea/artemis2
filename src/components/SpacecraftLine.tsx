import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { findClosestEntryIndex, HORIZONS_ENTRIES } from '../horizonsParser'
import {
  eclipticJ2000ToEci,
  toJulianDate,
} from '../sat/astroUtils'
import { eciToScene } from '../utils/3d'
import { EARTH_DISPLAY_TILT_RAD } from './Earth'

type SpacecraftLineProps = {
  currentTime: Date
}

export default function SpacecraftLine({ currentTime }: SpacecraftLineProps) {
  const fullPathPoints = useMemo<[number, number, number][]>(() => {
    const tilt = new THREE.Euler(EARTH_DISPLAY_TILT_RAD, 0, 0, 'XYZ')

    return HORIZONS_ENTRIES.map((entry) => {
      const eci = eclipticJ2000ToEci([entry.x, entry.y, entry.z])
      const [x, y, z] = eciToScene(eci)
      const tilted = new THREE.Vector3(x, y, z).applyEuler(tilt)
      return [tilted.x, tilted.y, tilted.z]
    })
  }, [])

  const points = useMemo<[number, number, number][]>(() => {
    const endIndex = findClosestEntryIndex(toJulianDate(currentTime))
    if (endIndex < 0) return []
    return fullPathPoints.slice(0, endIndex + 1)
  }, [currentTime, fullPathPoints])

  if (points.length < 2) return null

  return (
    <Line
      points={points}
      color="#ff8800"
      lineWidth={1}
    />
  )
}
