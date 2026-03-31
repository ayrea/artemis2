import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { GeoLocation } from '../types/geoLocation'
import { EARTH_RADIUS_KM } from '../sat/astroUtils'
import { latLonToVector3 } from '../utils/3d'

const CITY_RADIUS_FACTOR = 1.001
const CITY_MARKER_RADIUS_KM = 10

type CityPointsProps = {
  locations: GeoLocation[]
}

/**
 * Single draw call for all city markers (vs one mesh per city).
 */
export default function CityPoints({ locations }: CityPointsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const geometry = useMemo(() => new THREE.SphereGeometry(CITY_MARKER_RADIUS_KM, 8, 8), [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 'red',
        emissive: 'red',
        emissiveIntensity: 1,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i]!
      const [x, y, z] = latLonToVector3(
        loc.latitude,
        loc.longitude,
        EARTH_RADIUS_KM * CITY_RADIUS_FACTOR,
      )
      dummy.position.set(x, y, z)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [locations, dummy])

  return <instancedMesh ref={meshRef} args={[geometry, material, locations.length]} />
}
