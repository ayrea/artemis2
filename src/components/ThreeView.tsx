import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import cities from '../../data/cities.json'
import CityPoints from './CityPoints'
import Earth from './Earth'
import Satellite from './Satellite'
import type { GeoLocation } from '../types/geoLocation'
import { eciToGeodetic, sunEciKm, toJulianDate } from '../sat/astroUtils'
import { initSatellites } from '../sat/satellite'
import { latLonToVector3 } from '../utils/3d'

const CAMERA_DISTANCE_KM = 20000
const LIGHT_POSITION_KM: [number, number, number] = [16000, 24000, 24000]
const LIGHT_DISTANCE_KM = Math.sqrt(
  LIGHT_POSITION_KM[0] * LIGHT_POSITION_KM[0]
  + LIGHT_POSITION_KM[1] * LIGHT_POSITION_KM[1]
  + LIGHT_POSITION_KM[2] * LIGHT_POSITION_KM[2],
)
const MIN_ZOOM_DISTANCE_KM = 7000
const MAX_ZOOM_DISTANCE_KM = 120000
const PAN_SPEED_KM = 1.2
const ROTATE_SPEED = 0.55
const ZOOM_SPEED = 0.85
const KEYBOARD_PAN_STEP_KM = 500
const DAMPING_FACTOR = 0.08
const CAMERA_NEAR_KM = 10
const CAMERA_FAR_KM = 500000

/** Throttle satellite scene invalidation / subsolar light updates (~4 Hz). Start “full” so the first frame runs immediately (matches prior sync `update()` before `setInterval`). */
const SATELLITE_UPDATE_INTERVAL_SECONDS = 0.25

/**
 * Validates at compile time that every entry in cities.json satisfies GeoLocation,
 * so any future schema change surfaces as a type error here.
 */
const geoLocations = cities satisfies GeoLocation[]

type SatelliteTrackerProps = {
  lightRef: RefObject<THREE.DirectionalLight | null>
}

/**
 * Invalidates the canvas on a timer (so each Satellite useFrame runs) and moves
 * the directional light to the subsolar point inside the R3F render loop.
 */
function SatelliteTracker({ lightRef }: SatelliteTrackerProps) {
  const { invalidate } = useThree()
  const secondsSinceLastUpdate = useRef(SATELLITE_UPDATE_INTERVAL_SECONDS)

  useEffect(() => {
    const id = setInterval(() => {
      invalidate()
    }, SATELLITE_UPDATE_INTERVAL_SECONDS * 1000)
    return () => clearInterval(id)
  }, [invalidate])

  useFrame((_, deltaSeconds) => {
    secondsSinceLastUpdate.current += deltaSeconds

    if (secondsSinceLastUpdate.current < SATELLITE_UPDATE_INTERVAL_SECONDS) return
    secondsSinceLastUpdate.current = 0

    const now = new Date()

    if (lightRef.current !== null) {
      const julianDate = toJulianDate(now)
      const sunEciPosition = sunEciKm(julianDate)
      const sunGeodetic = eciToGeodetic(sunEciPosition, julianDate)
      const [lx, ly, lz] = latLonToVector3(
        sunGeodetic.latitude,
        sunGeodetic.longitude,
        LIGHT_DISTANCE_KM,
      )
      lightRef.current.position.set(lx, ly, lz)
    }
  })

  return null
}

export default function ThreeView() {
  const [satellites] = useState(() => initSatellites())

  const directionalLightRef = useRef<THREE.DirectionalLight>(null)

  return (
    <Canvas
      frameloop="demand"
      style={{ width: '100%', height: '100%' }}
      camera={{
        position: [CAMERA_DISTANCE_KM, CAMERA_DISTANCE_KM, CAMERA_DISTANCE_KM],
        fov: 50,
        near: CAMERA_NEAR_KM,
        far: CAMERA_FAR_KM,
      }}
    >
      {/*
        R3F's "attach" prop sets a property directly on the parent Three.js object.
        Here it assigns a Color to scene.background without an imperative callback.
      */}
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.85} />
      <directionalLight
        ref={directionalLightRef}
        intensity={10.0}
        position={LIGHT_POSITION_KM}
      />
      <SatelliteTracker lightRef={directionalLightRef} />
      <Suspense fallback={null}>
        <Earth>
          <CityPoints locations={geoLocations} />
          {satellites.map((s) => (
            <Satellite key={s.id} name={s.name} tle={s.tle} p={s.p} isNameVisible={true} />
          ))}
        </Earth>
      </Suspense>
      <OrbitControls
        enablePan
        enableRotate
        enableZoom
        enableDamping
        dampingFactor={DAMPING_FACTOR}
        minDistance={MIN_ZOOM_DISTANCE_KM}
        maxDistance={MAX_ZOOM_DISTANCE_KM}
        panSpeed={PAN_SPEED_KM}
        keyPanSpeed={KEYBOARD_PAN_STEP_KM}
        rotateSpeed={ROTATE_SPEED}
        zoomSpeed={ZOOM_SPEED}
      />
    </Canvas>
  )
}
