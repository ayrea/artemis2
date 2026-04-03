import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { findLastEntryIndexLeq, HORIZONS_ENTRIES, interpolateEntry } from '../horizonsParser'
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
    if (HORIZONS_ENTRIES.length === 0) return []

    const jd = toJulianDate(currentTime)
    const lastIdx = findLastEntryIndexLeq(jd)
    if (lastIdx < 0) return []

    const tilt = new THREE.Euler(EARTH_DISPLAY_TILT_RAD, 0, 0, 'XYZ')
    const base = fullPathPoints.slice(0, lastIdx + 1)
    const lastSampleJd = HORIZONS_ENTRIES[lastIdx].jd
    const atExactSample = Math.abs(jd - lastSampleJd) < 1e-6
    const atEndOfEphemeris = lastIdx >= HORIZONS_ENTRIES.length - 1

    if (atExactSample || atEndOfEphemeris) {
      return base
    }

    const entry = interpolateEntry(jd)
    if (entry === null) return base

    const eci = eclipticJ2000ToEci([entry.x, entry.y, entry.z])
    const [x, y, z] = eciToScene(eci)
    const tip = new THREE.Vector3(x, y, z).applyEuler(tilt)
    return [...base, [tip.x, tip.y, tip.z]]
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
