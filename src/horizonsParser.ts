import rawHorizonsData from '../data/horizons_results.txt?raw'
import { toJulianDate } from './sat/astroUtils'

export type HorizonsEntry = {
  jd: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
}

const JD_LINE_REGEX = /^\s*([0-9]+\.[0-9]+)\s*=/
const XYZ_LINE_REGEX = /^\s*X\s*=\s*([+-]?[0-9.]+E[+-][0-9]+)\s+Y\s*=\s*([+-]?[0-9.]+E[+-][0-9]+)\s+Z\s*=\s*([+-]?[0-9.]+E[+-][0-9]+)\s*$/
const VXYZ_LINE_REGEX = /^\s*VX\s*=\s*([+-]?[0-9.]+E[+-][0-9]+)\s+VY\s*=\s*([+-]?[0-9.]+E[+-][0-9]+)\s+VZ\s*=\s*([+-]?[0-9.]+E[+-][0-9]+)\s*$/

function parseHorizonsEntries(rawData: string): HorizonsEntry[] {
  const lines = rawData.split(/\r?\n/)
  const entries: HorizonsEntry[] = []

  let isInEphemeris = false

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]

    if (!isInEphemeris) {
      if (line.trim() === '$$SOE') {
        isInEphemeris = true
      }
      continue
    }

    if (line.trim() === '$$EOE') {
      break
    }

    const jdMatch = line.match(JD_LINE_REGEX)
    if (jdMatch === null) continue

    const xyzLine = lines[index + 1]
    if (xyzLine === undefined) break
    const vxyzLine = lines[index + 2]
    if (vxyzLine === undefined) break

    const xyzMatch = xyzLine.match(XYZ_LINE_REGEX)
    if (xyzMatch === null) continue
    const vxyzMatch = vxyzLine.match(VXYZ_LINE_REGEX)
    if (vxyzMatch === null) continue

    const jd = Number.parseFloat(jdMatch[1])
    const x = Number.parseFloat(xyzMatch[1])
    const y = Number.parseFloat(xyzMatch[2])
    const z = Number.parseFloat(xyzMatch[3])
    const vx = Number.parseFloat(vxyzMatch[1])
    const vy = Number.parseFloat(vxyzMatch[2])
    const vz = Number.parseFloat(vxyzMatch[3])

    if ([jd, x, y, z, vx, vy, vz].every(Number.isFinite)) {
      entries.push({ jd, x, y, z, vx, vy, vz })
    }
  }

  return entries
}

export const HORIZONS_ENTRIES = parseHorizonsEntries(rawHorizonsData)

const UNIX_EPOCH_JD = 2440587.5
const MS_PER_DAY = 86400000

export function jdToDate(jd: number): Date {
  return new Date((jd - UNIX_EPOCH_JD) * MS_PER_DAY)
}

export const DATA_START = HORIZONS_ENTRIES.length > 0
  ? jdToDate(HORIZONS_ENTRIES[0].jd)
  : null

export const DATA_END = HORIZONS_ENTRIES.length > 0
  ? jdToDate(HORIZONS_ENTRIES[HORIZONS_ENTRIES.length - 1].jd)
  : null

export const MISSION_LAUNCH_UTC = new Date('2026-04-01T22:35:12Z')

export function findClosestEntryIndex(targetJd: number): number {
  if (HORIZONS_ENTRIES.length === 0) return -1

  let left = 0
  let right = HORIZONS_ENTRIES.length - 1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const midJd = HORIZONS_ENTRIES[mid].jd

    if (midJd < targetJd) {
      left = mid + 1
    } else if (midJd > targetJd) {
      right = mid - 1
    } else {
      return mid
    }
  }

  if (left >= HORIZONS_ENTRIES.length) return HORIZONS_ENTRIES.length - 1
  if (right < 0) return 0

  const leftDiff = Math.abs(HORIZONS_ENTRIES[left].jd - targetJd)
  const rightDiff = Math.abs(HORIZONS_ENTRIES[right].jd - targetJd)
  return leftDiff < rightDiff ? left : right
}

export function getEntryAtUtc(date: Date): HorizonsEntry | null {
  if (HORIZONS_ENTRIES.length === 0) return null

  const index = findClosestEntryIndex(toJulianDate(date))
  return index >= 0 ? HORIZONS_ENTRIES[index] : null
}
