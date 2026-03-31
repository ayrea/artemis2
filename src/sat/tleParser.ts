/**
 * Two-Line Element (TLE) text parsing helpers.
 *
 * This module extracts satellite TLE entries from raw file text and converts
 * fixed-width fields into numeric values expected by the SGP4 propagator.
 */
const PI = Math.PI
const TWO_PI = 2 * PI
const MINUTES_PER_DAY = 1440
const MINUTES_PER_DAY_SQUARED = MINUTES_PER_DAY * MINUTES_PER_DAY
const MINUTES_PER_DAY_CUBED = MINUTES_PER_DAY * MINUTES_PER_DAY * MINUTES_PER_DAY
const J2000 = 2451545.5
const J1900 = J2000 - 36525.0 - 1.0

export type TleData = {
  epoch: number
  xndt2o: number
  xndd6o: number
  bstar: number
  xincl: number
  xnodeo: number
  eo: number
  omegao: number
  xmo: number
  xno: number
}

export type TleEntry = {
  name: string
  line1: string
  line2: string
}

function normalizeTleLines(tleText: string): string[] {
  return tleText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
}

/**
 * Reads every three-line satellite block (name, TLE line 1, TLE line 2) from a raw TLE file.
 *
 * @param tleText Raw contents of a `.tle` file.
 * @returns One {@link TleEntry} per satellite, in file order.
 * @throws If the line count is not a multiple of three or any group fails TLE line validation.
 */
export function readAllTles(tleText: string): TleEntry[] {
  const lines = normalizeTleLines(tleText)

  if (lines.length % 3 !== 0) {
    throw new Error(
      `TLE file must contain complete three-line groups (name, line 1, line 2); got ${lines.length} non-empty lines`,
    )
  }

  const entries: TleEntry[] = []
  for (let i = 0; i < lines.length; i += 3) {
    const name = lines[i]
    const line1 = lines[i + 1]
    const line2 = lines[i + 2]
    const t1 = line1.trimStart()
    const t2 = line2.trimStart()
    if (!t1.startsWith('1 ') || !t2.startsWith('2 ')) {
      throw new Error(
        `Invalid TLE triple at group starting at line index ${i}: expected line 1 to start with "1 " and line 2 with "2 "`,
      )
    }
    entries.push({ name, line1, line2 })
  }

  return entries
}

/**
 * Parses standard TLE line strings into SGP4-ready orbital parameters.
 *
 * @param line1 TLE line 1.
 * @param line2 TLE line 2.
 * @returns Normalized numeric TLE representation.
 * @throws If either line is shorter than the minimum expected width.
 */
export function parseTle(line1: string, line2: string): TleData {
  if (line1.length < 69 || line2.length < 69) {
    throw new Error('TLE lines must each be at least 69 characters')
  }

  let year = Number.parseInt(line1.slice(18, 20), 10)
  if (year < 57) {
    year += 100
  }

  const epoch = getEightPlaces(line1.slice(20)) + J1900 + (year * 365 + Math.floor((year - 1) / 4))
  const xmo = getAngle(line2.slice(43)) * (PI / 180e4)
  const xnodeo = getAngle(line2.slice(17)) * (PI / 180e4)
  const omegao = getAngle(line2.slice(34)) * (PI / 180e4)
  const xincl = getAngle(line2.slice(8)) * (PI / 180e4)
  const eo = Number.parseInt(line2.slice(26, 33), 10) * 1e-7
  const xno = getEightPlaces(line2.slice(51, 63)) * TWO_PI / MINUTES_PER_DAY

  const xndt = Number.parseInt(line1.slice(35, 45).trim(), 10)
  let xndt2o = xndt * 1e-8 * TWO_PI / MINUTES_PER_DAY_SQUARED
  if (line1[33] === '-') {
    xndt2o *= -1
  }

  const xndd6o = sci(line1.slice(44, 52)) * TWO_PI / MINUTES_PER_DAY_CUBED
  const bstar = sci(line1.slice(53, 61))

  return {
    epoch,
    xndt2o,
    xndd6o,
    bstar,
    xincl,
    xnodeo,
    eo,
    omegao,
    xmo,
    xno,
  }
}

/**
 * Parses an angle-like fixed-width TLE token into an integer-style value.
 *
 * The parser strips decimal points and returns the raw digit value, matching
 * the legacy scaling approach used in this project.
 */
function getAngle(raw: string): number {
  const token = raw.trim().split(/\s+/)[0] ?? ''
  if (!token) {
    return 0
  }

  let value = 0
  for (const char of token) {
    if (char !== '.') {
      value = value * 10 + (char.charCodeAt(0) - 48)
    }
  }

  return value
}

/**
 * Parses TLE compact scientific notation fields (e.g. " 12345-5").
 *
 * @param s Fixed-width scientific notation token.
 * @returns Floating-point value represented by the token.
 */
function sci(s: string): number {
  if (s.length < 8 || s[1] === ' ') {
    return 0
  }

  const intVal = atoiFrom(s, 0)
  if (intVal === 0) {
    return 0
  }

  let value = intVal * 1e-5
  const exponent = s.charCodeAt(7) - 48
  if (exponent !== 0) {
    if (s[6] === '-') {
      for (let i = 0; i < exponent; i += 1) {
        value *= 0.1
      }
    } else {
      for (let i = 0; i < exponent; i += 1) {
        value *= 10.0
      }
    }
  }

  return value
}

/**
 * Parses a fixed-width numeric token with eight implied decimal places.
 *
 * @param raw Raw fixed-width token.
 * @returns Parsed floating-point value.
 */
function getEightPlaces(raw: string): number {
  const whole = atoiFrom(raw, 0)
  if (raw.length <= 4) {
    return whole
  }
  const frac = atoiFrom(raw, 4)
  return whole + frac * 1e-8
}

/**
 * Parses a signed integer from `raw` starting at `start`.
 *
 * Parsing stops at the first non-digit character after optional whitespace/sign.
 *
 * @param raw Source text.
 * @param start Start index to begin parsing from.
 * @returns Parsed integer value.
 */
function atoiFrom(raw: string, start: number): number {
  let index = start
  while (index < raw.length && raw[index] === ' ') {
    index += 1
  }

  let negative = false
  if (raw[index] === '-') {
    negative = true
    index += 1
  } else if (raw[index] === '+') {
    index += 1
  }

  let value = 0
  while (index < raw.length) {
    const code = raw.charCodeAt(index)
    if (code < 48 || code > 57) {
      break
    }
    value = value * 10 + (code - 48)
    index += 1
  }

  return negative ? -value : value
}
