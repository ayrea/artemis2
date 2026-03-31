import { EARTH_RADIUS_KM } from '../sat/astroUtils'
import type { GeoLocation } from '../types/geoLocation'
import { latLonToVector3 } from '../utils/3d'

export type GeoPointProps = {
  coordinate: GeoLocation
  color?: string
  markerRadius?: number
  earthRadius?: number
}

const DEFAULT_MARKER_COLOR = 'red'
const DEFAULT_MARKER_RADIUS_KM = 10

export default function GeoPoint({
  coordinate,
  color = DEFAULT_MARKER_COLOR,
  markerRadius = DEFAULT_MARKER_RADIUS_KM,
  earthRadius = EARTH_RADIUS_KM,
}: GeoPointProps) {
  return (
    <mesh position={latLonToVector3(coordinate.latitude, coordinate.longitude, earthRadius)}>
      <sphereGeometry args={[markerRadius, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
    </mesh>
  )
}
