import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import Earth, { EARTH_DISPLAY_TILT_RAD } from './Earth';
import Moon from './Moon';
import Spacecraft from './Spacecraft';
import SpacecraftLine from './SpacecraftLine';
import TimeControls from './TimeControls';
import FocusControls, { type FocusTarget } from './FocusControls';
import Invalidator from './Invalidator';
import SatelliteTracker from './SatelliteTracker';
import CameraPositionReporter, {
  CAMERA_POSITION_EPSILON_KM,
  type CameraPosition,
} from './CameraPositionReporter';
import {
  eclipticJ2000ToEci,
  EARTH_RADIUS_KM,
  moonEciKm,
  MOON_RADIUS_KM,
  toJulianDate,
} from '../sat/astroUtils';
import { useVirtualClock } from '../hooks/useVirtualClock';
import {
  HORIZONS_ENTRIES,
  interpolateEntry,
  MISSION_LAUNCH_UTC,
} from '../horizonsParser';
import { eciToScene } from '../utils/3d';

const INITIAL_CAMERA_POSITION: [number, number, number] = [
  -110275, -207586, 366634,
];
const INITIAL_CAMERA_UP: [number, number, number] = [0, 0, 1];
const INITIAL_ORBIT_TARGET: [number, number, number] = [
  -104162, -209887, 65473,
];
const MIN_ZOOM_DISTANCE_KM = 7000;
const MAX_ZOOM_DISTANCE_KM = 500000;
const PAN_SPEED_KM = 1.2;
const ROTATE_SPEED = 0.55;
const ZOOM_SPEED = 0.85;
const KEYBOARD_PAN_STEP_KM = 500;
const DAMPING_FACTOR = 0.08;
const CAMERA_NEAR_KM = 10;
// Must exceed worst-case camera-to-moon distance when the moon is on the far side of Earth.
const CAMERA_FAR_KM = 1200000;

const SHOW_CAMERA_POSITION = false;

type TelemetryDisplay = {
  timeSinceLaunch: string;
  earthDistanceText: string;
  moonDistanceText: string;
};

function magnitude3(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const totalDays = Math.floor(totalSeconds / 86400);
  const hours = String(Math.floor((totalSeconds % 3600) / 24)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
    2,
    '0',
  );
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `T+${totalDays}:${hours}:${minutes}:${seconds}`;
}

export default function ThreeView() {
  const directionalLightRef = useRef<THREE.DirectionalLight>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const interactionStartTargetRef = useRef(new THREE.Vector3());
  const focusTiltEuler = useMemo(
    () => new THREE.Euler(EARTH_DISPLAY_TILT_RAD, 0, 0, 'XYZ'),
    [],
  );
  const [cameraPosition, setCameraPosition] = useState<CameraPosition>({
    x: INITIAL_CAMERA_POSITION[0],
    y: INITIAL_CAMERA_POSITION[1],
    z: INITIAL_CAMERA_POSITION[2],
  });
  const [orbitTarget, setOrbitTarget] = useState<CameraPosition>({
    x: INITIAL_ORBIT_TARGET[0],
    y: INITIAL_ORBIT_TARGET[1],
    z: INITIAL_ORBIT_TARGET[2],
  });
  const {
    currentTime,
    minTime,
    maxTime,
    isPlaying,
    speed,
    speedPresets,
    isRealTime,
    isRealtimeAvailable,
    play,
    pause,
    setSpeed,
    seek,
    jumpToStart,
    jumpToEnd,
    rewindStep,
    fastForwardStep,
    toggleRealTime,
  } = useVirtualClock();

  const handleStop = useCallback(() => {
    pause();
    jumpToStart();
  }, [pause, jumpToStart]);

  const handleCameraPositionChange = useCallback(
    (nextPosition: CameraPosition) => {
      setCameraPosition((previousPosition) => {
        const dx = nextPosition.x - previousPosition.x;
        const dy = nextPosition.y - previousPosition.y;
        const dz = nextPosition.z - previousPosition.z;
        if (
          dx * dx + dy * dy + dz * dz <=
          CAMERA_POSITION_EPSILON_KM * CAMERA_POSITION_EPSILON_KM
        ) {
          return previousPosition;
        }

        return nextPosition;
      });
    },
    [],
  );

  const handleControlsStart = () => {
    const controls = controlsRef.current;
    if (controls === null) return;
    interactionStartTargetRef.current.copy(controls.target);
  };

  const handleControlsEnd = () => {
    const controls = controlsRef.current;
    if (controls === null) return;

    // If pan moved the target, persist it as the new baseline center.
    if (
      controls.target.distanceToSquared(interactionStartTargetRef.current) >
      1e-6
    ) {
      controls.saveState();
      setOrbitTarget({
        x: controls.target.x,
        y: controls.target.y,
        z: controls.target.z,
      });
    }
  };

  const handleFocus = useCallback(
    (target: FocusTarget) => {
      const controls = controlsRef.current;
      if (controls === null) return;

      const julianDate = toJulianDate(currentTime);
      let targetPosition = new THREE.Vector3(0, 0, 0);

      if (target === 'moon') {
        const [x, y, z] = eciToScene(moonEciKm(julianDate));
        targetPosition = new THREE.Vector3(x, y, z).applyEuler(focusTiltEuler);
      } else if (target === 'spacecraft') {
        const entry = interpolateEntry(julianDate);
        if (entry === null || HORIZONS_ENTRIES.length === 0) return;
        const spacecraftEci = eclipticJ2000ToEci([entry.x, entry.y, entry.z]);
        const [x, y, z] = eciToScene(spacecraftEci);
        targetPosition = new THREE.Vector3(x, y, z).applyEuler(focusTiltEuler);
      }

      controls.target.copy(targetPosition);
      controls.update();
      setOrbitTarget({
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z,
      });
    },
    [currentTime, focusTiltEuler],
  );

  const telemetry = useMemo<TelemetryDisplay>(() => {
    const timeSinceLaunch = formatElapsedTime(
      currentTime.getTime() - MISSION_LAUNCH_UTC.getTime(),
    );
    const entry = interpolateEntry(toJulianDate(currentTime));
    if (entry === null || HORIZONS_ENTRIES.length === 0) {
      return {
        timeSinceLaunch,
        earthDistanceText: 'Earth: -- km | -- km/s',
        moonDistanceText: 'Moon: -- km | -- km/s',
      };
    }
    const earthSurfaceDistanceKm =
      magnitude3(entry.x, entry.y, entry.z) - EARTH_RADIUS_KM;
    const earthRelativeSpeedKmS = magnitude3(entry.vx, entry.vy, entry.vz);

    const jd = toJulianDate(currentTime);
    const spacecraftEci = eclipticJ2000ToEci([entry.x, entry.y, entry.z]);
    const spacecraftVelocityEci = eclipticJ2000ToEci([
      entry.vx,
      entry.vy,
      entry.vz,
    ]);
    const moonEciNow = moonEciKm(jd);
    const moonEciNext = moonEciKm(jd + 1 / 86400);
    const moonVelocityEci: [number, number, number] = [
      moonEciNext[0] - moonEciNow[0],
      moonEciNext[1] - moonEciNow[1],
      moonEciNext[2] - moonEciNow[2],
    ];
    const moonRelativePosition: [number, number, number] = [
      spacecraftEci[0] - moonEciNow[0],
      spacecraftEci[1] - moonEciNow[1],
      spacecraftEci[2] - moonEciNow[2],
    ];
    const moonRelativeVelocity: [number, number, number] = [
      spacecraftVelocityEci[0] - moonVelocityEci[0],
      spacecraftVelocityEci[1] - moonVelocityEci[1],
      spacecraftVelocityEci[2] - moonVelocityEci[2],
    ];
    const moonSurfaceDistanceKm =
      magnitude3(
        moonRelativePosition[0],
        moonRelativePosition[1],
        moonRelativePosition[2],
      ) - MOON_RADIUS_KM;
    const moonRelativeSpeedKmS = magnitude3(
      moonRelativeVelocity[0],
      moonRelativeVelocity[1],
      moonRelativeVelocity[2],
    );

    return {
      timeSinceLaunch,
      earthDistanceText: `Earth: ${earthSurfaceDistanceKm.toFixed(0)} km | ${earthRelativeSpeedKmS.toFixed(2)} km/s`,
      moonDistanceText: `Moon: ${moonSurfaceDistanceKm.toFixed(0)} km | ${moonRelativeSpeedKmS.toFixed(2)} km/s`,
    };
  }, [currentTime]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        frameloop="demand"
        style={{ width: '100%', height: '100%' }}
        camera={{
          position: INITIAL_CAMERA_POSITION,
          up: INITIAL_CAMERA_UP,
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
        <ambientLight intensity={0.2} />
        <directionalLight
          ref={directionalLightRef}
          intensity={10.0}
          position={[1, 0, 0]}
        />
        <Invalidator currentTime={currentTime} />
        <SatelliteTracker
          lightRef={directionalLightRef}
          currentTime={currentTime}
        />
        <Suspense fallback={null}>
          <Earth currentTime={currentTime} />
          <Moon currentTime={currentTime} />
        </Suspense>
        <Spacecraft currentTime={currentTime} />
        <SpacecraftLine currentTime={currentTime} />
        <CameraPositionReporter onPositionChange={handleCameraPositionChange} />
        <OrbitControls
          ref={controlsRef}
          target={INITIAL_ORBIT_TARGET}
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
          zoomToCursor
          mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }}
          onStart={handleControlsStart}
          onEnd={handleControlsEnd}
        />
      </Canvas>
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 2,
          padding: '6px 8px',
          borderRadius: 6,
          background: 'rgba(0, 0, 0, 0.6)',
          color: '#e8edf2',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: 12,
          lineHeight: 1.4,
          pointerEvents: 'none',
          whiteSpace: 'pre',
        }}
      >
        {`Artemis II : ${telemetry.timeSinceLaunch}\nDistance | Velocity\n${telemetry.earthDistanceText}\n${telemetry.moonDistanceText}`}
      </div>
      {SHOW_CAMERA_POSITION && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 2,
            padding: '6px 8px',
            borderRadius: 6,
            background: 'rgba(0, 0, 0, 0.6)',
            color: '#e8edf2',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: 12,
            lineHeight: 1.4,
            pointerEvents: 'none',
            whiteSpace: 'pre',
          }}
        >
          {`Camera (km)\nX: ${cameraPosition.x.toFixed(0)}\nY: ${cameraPosition.y.toFixed(0)}\nZ: ${cameraPosition.z.toFixed(0)}\n\nTarget (km)\nX: ${orbitTarget.x.toFixed(0)}\nY: ${orbitTarget.y.toFixed(0)}\nZ: ${orbitTarget.z.toFixed(0)}`}
        </div>
      )}
      <FocusControls onFocus={handleFocus} />
      <TimeControls
        currentTime={currentTime}
        minTime={minTime}
        maxTime={maxTime}
        isPlaying={isPlaying}
        speed={speed}
        speedPresets={speedPresets}
        isRealTime={isRealTime}
        isRealtimeAvailable={isRealtimeAvailable}
        onPlay={play}
        onPause={pause}
        onStop={handleStop}
        onSetSpeed={setSpeed}
        onSeek={seek}
        onJumpToStart={jumpToStart}
        onJumpToEnd={jumpToEnd}
        onRewindStep={rewindStep}
        onFastForwardStep={fastForwardStep}
        onToggleRealTime={toggleRealTime}
      />
    </div>
  );
}
