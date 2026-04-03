import { useMemo } from 'react';
import * as THREE from 'three';
import { moonEciKm, MOON_RADIUS_KM, toJulianDate } from '../sat/astroUtils';
import { eciToScene } from '../utils/3d';
import { EARTH_DISPLAY_TILT_RAD } from './Earth';

type MoonProps = {
  currentTime: Date;
};

export default function Moon({ currentTime }: MoonProps) {
  const position = useMemo<[number, number, number]>(() => {
    const jd = toJulianDate(currentTime);
    const moonEciPosition = moonEciKm(jd);
    const [x, y, z] = eciToScene(moonEciPosition);
    const tilted = new THREE.Vector3(x, y, z).applyEuler(
      new THREE.Euler(EARTH_DISPLAY_TILT_RAD, 0, 0, 'XYZ'),
    );
    return [tilted.x, tilted.y, tilted.z];
  }, [currentTime]);

  return (
    <mesh position={position}>
      <sphereGeometry args={[MOON_RADIUS_KM, 32, 32]} />
      <meshStandardMaterial color="#aaaaaa" roughness={0.95} metalness={0.0} />
    </mesh>
  );
}
