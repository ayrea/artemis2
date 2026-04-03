export function latLonToVector3(
  lat: number,
  lon: number,
  radius: number,
): [number, number, number] {
  const phi = (lon + 180) * (Math.PI / 180);
  const theta = (90 - lat) * (Math.PI / 180);

  return [
    -radius * Math.cos(phi) * Math.sin(theta),
    radius * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

/**
 * Converts ECI (Z-up, right-handed) coordinates into this scene's Y-up axis convention.
 */
export function eciToScene(
  eciKm: [number, number, number],
): [number, number, number] {
  return [eciKm[0], eciKm[2], -eciKm[1]];
}
