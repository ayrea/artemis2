import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import { EARTH_RADIUS_KM } from '../sat/astroUtils'
import type { GeoLocation } from '../types/geoLocation'
import { latLonToVector3 } from '../utils/3d'

type GeoLineProps = {
  startCoordinate: GeoLocation
  endCoordinate: GeoLocation
  color?: string
  /** Geocentric radius of the reference sphere in km (defaults to WGS84-like value from astroUtils). */
  earthRadius?: number
  lineWidth?: number
}

const DEFAULT_LINE_COLOR = 'red'
const DEFAULT_LINE_WIDTH = 1

export default function GeoLine({
  startCoordinate,
  endCoordinate,
  color = DEFAULT_LINE_COLOR,
  earthRadius = EARTH_RADIUS_KM,
  lineWidth = DEFAULT_LINE_WIDTH,
}: GeoLineProps) {
  const points = useMemo(() => {
    const startAltitudeKm = startCoordinate.altitude ?? 0
    const endAltitudeKm = endCoordinate.altitude ?? 0

    const start = latLonToVector3(
      startCoordinate.latitude,
      startCoordinate.longitude,
      earthRadius + startAltitudeKm,
    )
    const end = latLonToVector3(
      endCoordinate.latitude,
      endCoordinate.longitude,
      earthRadius + endAltitudeKm,
    )

    return [start, end] as [[number, number, number], [number, number, number]]
  }, [
    earthRadius,
    endCoordinate.altitude,
    endCoordinate.latitude,
    endCoordinate.longitude,
    startCoordinate.altitude,
    startCoordinate.latitude,
    startCoordinate.longitude,
  ])

  return (
    <Line
      points={points}
      color={color}
      lineWidth={lineWidth}
    />
  )
}
