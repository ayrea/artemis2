import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { EARTH_DISPLAY_TILT_RAD } from './Earth';
import { sunEciKm, toJulianDate } from '../sat/astroUtils';
import { eciToScene } from '../utils/3d';

export type SatelliteTrackerProps = {
  lightRef: RefObject<THREE.DirectionalLight | null>;
  currentTime: Date;
};

/** Positions sunlight using the virtual mission timestamp. */
export default function SatelliteTracker({
  lightRef,
  currentTime,
}: SatelliteTrackerProps) {
  const tiltedVector = useRef(new THREE.Vector3());
  const tiltEuler = useRef(
    new THREE.Euler(EARTH_DISPLAY_TILT_RAD, 0, 0, 'XYZ'),
  );
  const timeRef = useRef(currentTime);

  useEffect(() => {
    timeRef.current = currentTime;
  }, [currentTime]);

  useFrame(() => {
    const julianDate = toJulianDate(timeRef.current);
    const applyDisplayTilt = (x: number, y: number, z: number) => {
      tiltedVector.current.set(x, y, z).applyEuler(tiltEuler.current);
      return tiltedVector.current;
    };

    if (lightRef.current !== null) {
      const sunEciPosition = sunEciKm(julianDate);
      const [lx, ly, lz] = eciToScene(sunEciPosition);
      const tiltedLightPosition = applyDisplayTilt(lx, ly, lz);
      lightRef.current.position.copy(tiltedLightPosition);
    }
  });

  return null;
}
