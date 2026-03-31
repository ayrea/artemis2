import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { EARTH_RADIUS_KM } from '../sat/astroUtils'
import { calculatePosition } from '../sat/satellite'
import type { TleData } from '../sat/tleParser'
import { latLonToVector3 } from '../utils/3d'

const ISS_MARKER_RADIUS_KM = 10

/** Throttle position updates (~4 Hz). Start “full” so the first frame runs immediately. */
const SATELLITE_UPDATE_INTERVAL_SECONDS = 0.25

type SatelliteProps = {
  name: string
  tle: TleData
  p: number[]
  isNameVisible?: boolean
}

export default function Satellite({ name, tle, p, isNameVisible }: SatelliteProps) {
  const [nameVisible, setNameVisible] = useState(isNameVisible)
  useEffect(() => {
    if (isNameVisible) {
      setNameVisible(true)
    }
  }, [nameVisible])
  const meshRef = useRef<THREE.Mesh>(null)
  const positionsArray = useRef(new Float32Array(6))
  const nadirLine = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positionsArray.current, 3),
    )
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 'pink' }))
    line.frustumCulled = false
    line.visible = false
    return line
  }, [])
  const secondsSinceLastUpdate = useRef(SATELLITE_UPDATE_INTERVAL_SECONDS)

  useFrame((_, deltaSeconds) => {
    secondsSinceLastUpdate.current += deltaSeconds

    if (secondsSinceLastUpdate.current < SATELLITE_UPDATE_INTERVAL_SECONDS) return
    secondsSinceLastUpdate.current = 0

    const mesh = meshRef.current
    if (mesh === null) return

    const now = new Date()
    const satellitePosition = calculatePosition(tle, p, now)
    if (satellitePosition !== null) {
      const [x, y, z] = latLonToVector3(
        satellitePosition.latitude,
        satellitePosition.longitude,
        EARTH_RADIUS_KM + satellitePosition.altitudeKm,
      )
      const [gx, gy, gz] = latLonToVector3(
        satellitePosition.latitude,
        satellitePosition.longitude,
        EARTH_RADIUS_KM,
      )

      mesh.position.set(x, y, z)
      mesh.visible = true

      const arr = positionsArray.current
      arr[0] = x
      arr[1] = y
      arr[2] = z
      arr[3] = gx
      arr[4] = gy
      arr[5] = gz
      const posAttr = nadirLine.geometry.getAttribute('position') as THREE.BufferAttribute
      posAttr.needsUpdate = true
      // eslint-disable-next-line react-hooks/immutability -- THREE.Object3D.visible updated imperatively in useFrame
      nadirLine.visible = true
    }
    else {
      mesh.visible = false
      nadirLine.visible = false
    }
  })

  return (
    <>
      <mesh
        ref={meshRef}
        visible={false}
      >
        <sphereGeometry args={[ISS_MARKER_RADIUS_KM, 16, 16]} />
        <meshStandardMaterial color="pink" emissive="pink" emissiveIntensity={1} />
        {nameVisible && (
          <Html position={[0, ISS_MARKER_RADIUS_KM * 1.5, 0]} center occlude>
            <div
              style={{
                pointerEvents: 'none',
                padding: '4px 8px',
                background: 'rgba(0,0,0,0.8)',
                color: '#fff',
                borderRadius: 4,
                fontSize: 12,
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </div>
          </Html>
        )}
      </mesh>
      <primitive object={nadirLine} />
    </>
  )
}
