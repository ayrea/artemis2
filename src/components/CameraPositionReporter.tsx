import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

export const CAMERA_POSITION_EPSILON_KM = 0.1;

export type CameraPosition = {
  x: number;
  y: number;
  z: number;
};

type CameraPositionReporterProps = {
  onPositionChange: (position: CameraPosition) => void;
};

export default function CameraPositionReporter({
  onPositionChange,
}: CameraPositionReporterProps) {
  const { camera } = useThree();
  const lastReportedPositionRef = useRef(
    new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN),
  );

  useFrame(() => {
    const currentPosition = camera.position;
    if (
      currentPosition.distanceToSquared(lastReportedPositionRef.current) <=
      CAMERA_POSITION_EPSILON_KM * CAMERA_POSITION_EPSILON_KM
    ) {
      return;
    }

    lastReportedPositionRef.current.copy(currentPosition);
    onPositionChange({
      x: currentPosition.x,
      y: currentPosition.y,
      z: currentPosition.z,
    });
  });

  return null;
}
