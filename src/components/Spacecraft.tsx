import { useMemo } from 'react';
import * as THREE from 'three';
import { interpolateEntry } from '../horizonsParser';
import { eclipticJ2000ToEci, sunEciKm, toJulianDate } from '../sat/astroUtils';
import { eciToScene } from '../utils/3d';
import { EARTH_DISPLAY_TILT_RAD } from './Earth';

const SPACECRAFT_MARKER_RADIUS_KM = 200;
const CYLINDER_REAL_RADIUS_M = 2.4;
const CYLINDER_REAL_LENGTH_M = 4.0;
const CONE_REAL_HEIGHT_M = 3.35;
const SPACECRAFT_SCALE_KM_PER_M =
  SPACECRAFT_MARKER_RADIUS_KM / CYLINDER_REAL_RADIUS_M;
const SPACECRAFT_CYLINDER_RADIUS_KM = SPACECRAFT_MARKER_RADIUS_KM;
const SPACECRAFT_CYLINDER_HEIGHT_KM =
  CYLINDER_REAL_LENGTH_M * SPACECRAFT_SCALE_KM_PER_M;
const SPACECRAFT_CONE_RADIUS_KM = SPACECRAFT_MARKER_RADIUS_KM;
const SPACECRAFT_CONE_HEIGHT_KM =
  CONE_REAL_HEIGHT_M * SPACECRAFT_SCALE_KM_PER_M;

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const displayTiltEuler = new THREE.Euler(EARTH_DISPLAY_TILT_RAD, 0, 0, 'XYZ');

type SpacecraftProps = {
  currentTime: Date;
};

type SpacecraftPose = {
  position: [number, number, number];
  quaternion: THREE.Quaternion;
};

export default function Spacecraft({ currentTime }: SpacecraftProps) {
  const pose = useMemo<SpacecraftPose | null>(() => {
    const jd = toJulianDate(currentTime);
    const entry = interpolateEntry(jd);
    if (entry === null) return null;

    const spacecraftEci = eclipticJ2000ToEci([entry.x, entry.y, entry.z]);
    const [sx, sy, sz] = eciToScene(spacecraftEci);
    const spacecraftScene = new THREE.Vector3(sx, sy, sz).applyEuler(
      displayTiltEuler,
    );

    const sunEci = sunEciKm(jd);
    const [ux, uy, uz] = eciToScene(sunEci);
    const sunScene = new THREE.Vector3(ux, uy, uz).applyEuler(displayTiltEuler);

    const dirToSun = new THREE.Vector3().subVectors(sunScene, spacecraftScene);
    const len = dirToSun.length();
    const quaternion = new THREE.Quaternion();
    if (len < 1e-9) {
      quaternion.identity();
    } else {
      dirToSun.multiplyScalar(1 / len);
      const awayFromSun = dirToSun.clone().negate();
      quaternion.setFromUnitVectors(Y_AXIS, awayFromSun);
    }

    return {
      position: [spacecraftScene.x, spacecraftScene.y, spacecraftScene.z],
      quaternion,
    };
  }, [currentTime]);

  if (pose === null) return null;

  const { position, quaternion } = pose;

  return (
    <group position={position} quaternion={quaternion}>
      <mesh>
        <cylinderGeometry
          args={[
            SPACECRAFT_CYLINDER_RADIUS_KM,
            SPACECRAFT_CYLINDER_RADIUS_KM,
            SPACECRAFT_CYLINDER_HEIGHT_KM,
            24,
          ]}
        />
        <meshStandardMaterial
          color="#b0c8d8"
          emissive="#1a3a4a"
          emissiveIntensity={0.6}
        />
      </mesh>
      <mesh
        position={[
          0,
          SPACECRAFT_CYLINDER_HEIGHT_KM / 2 + SPACECRAFT_CONE_HEIGHT_KM / 2,
          0,
        ]}
      >
        <coneGeometry
          args={[SPACECRAFT_CONE_RADIUS_KM, SPACECRAFT_CONE_HEIGHT_KM, 24]}
        />
        <meshStandardMaterial
          color="#6090b0"
          emissive="#0a2030"
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
  );
}
