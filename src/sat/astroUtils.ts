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
const OBLIQUITY_J2000_RAD = 23.439291 * DEG2RAD
export const EARTH_RADIUS_KM = 6378.135
export const MOON_RADIUS_KM = 1737.4

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
 * Rotates Ecliptic J2000 coordinates into Equatorial ECI coordinates.
 *
 * Horizons state vectors in this project are exported in Ecliptic J2000.
 * The scene math expects equatorial ECI, so this fixed X-axis rotation is
 * applied before geodetic conversion.
 */
export function eclipticJ2000ToEci(
  eclipticKm: [number, number, number],
): [number, number, number] {
  const [x, y, z] = eclipticKm

  return [
    x,
    y * Math.cos(OBLIQUITY_J2000_RAD) - z * Math.sin(OBLIQUITY_J2000_RAD),
    y * Math.sin(OBLIQUITY_J2000_RAD) + z * Math.cos(OBLIQUITY_J2000_RAD),
  ]
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

/**
 * Approximates geocentric Moon position in ECI coordinates.
 *
 * Uses a compact Meeus-style model with dominant periodic terms for
 * ecliptic longitude, latitude, and distance. Accuracy is sufficient for
 * real-time visualization at Earth/Moon scale.
 *
 * @param jd Julian Date timestamp.
 * @returns Moon ECI vector `[x, y, z]` in kilometers.
 */
export function moonEciKm(jd: number): [number, number, number] {
  const d = jd - 2451545.0
  const t = d / 36525.0

  const normalizeDeg = (value: number): number => {
    let normalized = value % 360.0
    if (normalized < 0) {
      normalized += 360.0
    }
    return normalized
  }

  const meanLongitudeDeg = normalizeDeg(218.3164477 + 481267.88123421 * t)
  const meanAnomalyDeg = normalizeDeg(134.9633964 + 477198.8675055 * t)
  const argumentOfLatitudeDeg = normalizeDeg(93.2720950 + 483202.0175233 * t)
  const meanElongationDeg = normalizeDeg(297.8501921 + 445267.1114034 * t)

  const lPrime = meanLongitudeDeg * DEG2RAD
  const mPrime = meanAnomalyDeg * DEG2RAD
  const f = argumentOfLatitudeDeg * DEG2RAD
  const dArg = meanElongationDeg * DEG2RAD

  const lambda = lPrime
    + 6.289 * DEG2RAD * Math.sin(mPrime)
    + 1.274 * DEG2RAD * Math.sin(2 * dArg - mPrime)
    + 0.658 * DEG2RAD * Math.sin(2 * dArg)
    + 0.214 * DEG2RAD * Math.sin(2 * mPrime)
    + 0.110 * DEG2RAD * Math.sin(dArg)
  const beta = 5.128 * DEG2RAD * Math.sin(f)
  const distanceKm = 385000.56 - 20905.0 * Math.cos(mPrime)
  const epsilon = (23.439291 - 0.0130042 * t) * DEG2RAD

  const cosBeta = Math.cos(beta)
  const eclipticX = distanceKm * cosBeta * Math.cos(lambda)
  const eclipticY = distanceKm * cosBeta * Math.sin(lambda)
  const eclipticZ = distanceKm * Math.sin(beta)

  return [
    eclipticX,
    eclipticY * Math.cos(epsilon) - eclipticZ * Math.sin(epsilon),
    eclipticY * Math.sin(epsilon) + eclipticZ * Math.cos(epsilon),
  ]
}
