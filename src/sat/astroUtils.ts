/**
 * Orbital/astronomy utility helpers used by the satellite visualization flow.
 *
 * This module converts JavaScript `Date` values to Julian dates, computes
 * Greenwich sidereal time, and transforms Earth-centered inertial (ECI)
 * coordinates into approximate geodetic latitude/longitude/altitude values.
 */
const PI = Math.PI
const TWO_PI = PI * 2.0
const DEG2RAD = PI / 180.0
export const EARTH_RADIUS_KM = 6378.135

/**
 * Converts a UTC timestamp into a Julian Date number.
 *
 * @param date UTC date/time value.
 * @returns Julian Date representation of `date`.
 */
export function toJulianDate(date: Date): number {
  const utcYear = date.getUTCFullYear()
  const utcMonth = date.getUTCMonth() + 1
  const utcDay = date.getUTCDate()
  const utcHour = date.getUTCHours()
  const utcMinute = date.getUTCMinutes()
  const utcSecond = date.getUTCSeconds()
  const utcMs = date.getUTCMilliseconds()

  let y = utcYear
  let m = utcMonth
  if (m <= 2) {
    y -= 1
    m += 12
  }

  const day = utcDay + (utcHour + (utcMinute + (utcSecond + utcMs / 1000.0) / 60.0) / 60.0) / 24.0
  const a = Math.floor(y / 100)
  const b = 2 - a + Math.floor(a / 4)

  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5
}

/**
 * Computes Greenwich Mean Sidereal Time (GMST) in radians.
 *
 * @param jd Julian Date timestamp.
 * @returns Sidereal rotation angle in range `[0, 2π)`.
 */
export function greenwichSiderealTime(jd: number): number {
  const omegaE = 1.00273790934
  const secondsPerDay = 86400.0
  const jd2000 = 2451545.0

  let ut = (jd + 0.5) % 1.0
  if (ut < 0) {
    ut += 1.0
  }

  const tCent = (jd - ut - jd2000) / 36525.0
  let gmst = 24110.54841 + tCent * (8640184.812866 + tCent * (0.093104 - tCent * 6.2e-6))
  gmst = (gmst + secondsPerDay * omegaE * ut) % secondsPerDay
  if (gmst < 0) {
    gmst += secondsPerDay
  }

  return TWO_PI * gmst / secondsPerDay
}

/**
 * Converts an ECI position vector to a geodetic-like latitude/longitude/altitude.
 *
 * This uses a spherical Earth approximation, which is sufficient for the
 * current visualization and avoids heavier ellipsoid conversions.
 *
 * @param eciKm ECI position vector `[x, y, z]` in kilometers.
 * @param jd Julian Date of the position epoch.
 * @returns Latitude/longitude in degrees and altitude in kilometers.
 */
export function eciToGeodetic(
  eciKm: [number, number, number],
  jd: number,
): { latitude: number; longitude: number; altitudeKm: number } {
  const theta = greenwichSiderealTime(jd)
  const cosTheta = Math.cos(theta)
  const sinTheta = Math.sin(theta)

  const ecefX = cosTheta * eciKm[0] + sinTheta * eciKm[1]
  const ecefY = -sinTheta * eciKm[0] + cosTheta * eciKm[1]
  const ecefZ = eciKm[2]

  const longitude = Math.atan2(ecefY, ecefX) * 180 / PI
  const rxy = Math.sqrt(ecefX * ecefX + ecefY * ecefY)
  const latitude = Math.atan2(ecefZ, rxy) * 180 / PI
  const r = Math.sqrt(ecefX * ecefX + ecefY * ecefY + ecefZ * ecefZ)
  const altitudeKm = r - EARTH_RADIUS_KM

  return { latitude, longitude, altitudeKm }
}

/**
 * Approximates geocentric Sun position in ECI coordinates.
 *
 * This low-precision Meeus-style model is sufficient for visualization and
 * subsolar-point lighting direction.
 *
 * @param jd Julian Date timestamp.
 * @returns Sun ECI vector `[x, y, z]` in kilometers.
 */
export function sunEciKm(jd: number): [number, number, number] {
  const AU_KM = 149597870.7
  const n = jd - 2451545.0

  let l = (280.460 + 0.9856474 * n) % 360.0
  if (l < 0) {
    l += 360.0
  }
  let g = (357.528 + 0.9856003 * n) % 360.0
  if (g < 0) {
    g += 360.0
  }

  const lr = l * DEG2RAD
  const gr = g * DEG2RAD
  const lambda = lr + (1.915 * Math.sin(gr) + 0.020 * Math.sin(2 * gr)) * DEG2RAD
  const epsilon = (23.439 - 0.0000004 * n) * DEG2RAD

  const ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda))
  const dec = Math.asin(Math.sin(epsilon) * Math.sin(lambda))

  const rAu = 1.00014 - 0.01671 * Math.cos(gr) - 0.00014 * Math.cos(2 * gr)
  const rKm = rAu * AU_KM
  const cd = Math.cos(dec)

  return [rKm * cd * Math.cos(ra), rKm * cd * Math.sin(ra), rKm * Math.sin(dec)]
}
