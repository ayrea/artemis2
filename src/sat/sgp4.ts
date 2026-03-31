/**
 * SGP4 orbital propagator implementation used to advance TLE states in time.
 *
 * The functions in this module initialize near-Earth propagation constants and
 * then compute Earth-centered inertial (ECI) position vectors at `tsince`
 * minutes from TLE epoch.
 */
import type { TleData } from './tleParser'

const PI = Math.PI
const TWOPI = PI * 2.0
const EARTH_RADIUS_KM = 6378.135
const AE = 1.0
const XJ2 = 1.082616e-3
const CK2 = 0.5 * XJ2 * AE * AE
const XJ4 = -1.65597e-6
const CK4 = -0.375 * XJ4 * AE * AE * AE * AE
const S_CONST = AE * (1.0 + 78.0 / EARTH_RADIUS_KM)
// Full-precision strings avoid eslint no-loss-of-precision on numeric literals.
const QOMS2T = Number('1.880279159015270643865e-9')
const XKE = Number('0.0743669161331734132')
const MINUS_XJ3 = 2.53881e-6
const A3OVK2 = (MINUS_XJ3 / CK2) * AE * AE * AE
const TWO_THIRDS = 2.0 / 3.0
const MINIMAL_E = 1e-4
const ECC_EPS = 1e-6

type DeepArg = {
  aodp: number
  cosio: number
  sinio: number
  omgdot: number
  xmdot: number
  xnodot: number
  xnodp: number
  eosq: number
  betao: number
  cosio2: number
  betao2: number
}

type InitT = {
  coef: number
  coef1: number
  tsi: number
  s4: number
}

/**
 * Precomputes SGP4 coefficients from a parsed TLE.
 *
 * The returned numeric array mirrors legacy SGP4 slot-based implementations
 * to keep propagation fast and allocation-light during animation updates.
 *
 * @param tle Parsed Two-Line Element data.
 * @returns Packed parameter array consumed by `sgp4Propagate`.
 */
export function sgp4Init(tle: TleData): number[] {
  const p = new Array<number>(30).fill(0)
  const common = sxpxCommonInit(tle, p)
  const init = common.init
  const deep = common.deep

  p[10] = deep.aodp
  p[11] = deep.cosio
  p[12] = deep.sinio
  p[13] = deep.omgdot
  p[14] = deep.xmdot
  p[15] = deep.xnodot
  p[16] = deep.xnodp
  p[22] = deep.aodp * tle.eo * init.tsi

  const pEta = p[22]
  const eeta = tle.eo * pEta
  const simple = (deep.aodp * (1 - tle.eo) / AE) < (220.0 / EARTH_RADIUS_KM + AE)

  if (!simple) {
    const c1 = p[2]
    const c1sq = c1 * c1
    let delmo = 1.0 + pEta * Math.cos(tle.xmo)
    delmo *= delmo * delmo
    const d2 = 4 * deep.aodp * init.tsi * c1sq
    const temp = d2 * init.tsi * c1 / 3.0
    p[18] = d2
    p[19] = (17 * deep.aodp + init.s4) * temp
    p[20] = 0.5 * temp * deep.aodp * init.tsi * (221 * deep.aodp + 31 * init.s4) * c1
    p[25] = d2 + 2 * c1sq
    p[26] = 0.25 * (3 * p[19] + c1 * (12 * d2 + 10 * c1sq))
    p[27] = 0.2 * (3 * p[20] + 12 * c1 * p[19] + 6 * d2 * d2 + 15 * c1sq * (2 * d2 + c1sq))
    p[24] = Math.sin(tle.xmo)
    if (tle.eo < MINIMAL_E) {
      p[23] = 0
      p[28] = 0
    } else {
      const c3 = init.coef * init.tsi * A3OVK2 * deep.xnodp * AE * deep.sinio / tle.eo
      p[28] = -TWO_THIRDS * init.coef * tle.bstar * AE / eeta
      p[23] = tle.bstar * c3 * Math.cos(tle.omegao)
    }
    p[21] = delmo
  }

  const etasq = pEta * pEta
  p[17] = 2 * init.coef1 * deep.aodp * deep.betao2 * (1 + 2.75 * (etasq + eeta) + eeta * etasq)
  p[29] = simple ? 1.0 : 0.0

  return p
}

/**
 * Propagates an initialized TLE forward/backward in minutes from epoch.
 *
 * @param tsince Minutes since TLE epoch (can be negative).
 * @param tle Parsed Two-Line Element data.
 * @param p Packed initialization array returned by `sgp4Init`.
 * @returns ECI position vector `[x, y, z]` in kilometers; `[0,0,0]` on failure.
 */
export function sgp4Propagate(tsince: number, tle: TleData, p: number[]): [number, number, number] {
  const simple = p[29] !== 0

  const xmdf = tle.xmo + p[14] * tsince
  const omgadf = tle.omegao + p[13] * tsince
  const xnoddf = tle.xnodeo + p[15] * tsince
  let omega = omgadf
  let xmp = xmdf
  const tsq = tsince * tsince
  const xnode = xnoddf + p[4] * tsq
  let tempa = 1 - p[2] * tsince
  let tempe = tle.bstar * p[3] * tsince
  let templ = p[5] * tsq

  if (!simple) {
    const delomg = p[23] * tsince
    let delm = 1.0 + p[22] * Math.cos(xmdf)
    delm = p[28] * (delm * delm * delm - p[21])
    const temp = delomg + delm
    xmp = xmdf + temp
    omega = omgadf - temp
    const tcube = tsq * tsince
    const tfour = tsince * tcube
    tempa -= p[18] * tsq + p[19] * tcube + p[20] * tfour
    tempe += tle.bstar * p[17] * (Math.sin(xmp) - p[24])
    templ += p[25] * tcube + tfour * (p[26] + tsince * p[27])
  }

  let a = p[10] * tempa * tempa
  let e = tle.eo - tempe
  if (e < ECC_EPS) {
    e = ECC_EPS
  }

  const xl = xmp + omega + xnode + p[16] * templ
  if (tempa < 0) {
    a = -a
  }

  return sxpxPosnVel(xnode, a, e, p[11], p[12], tle.xincl, omega, xl)
}

/**
 * Computes baseline orbital terms shared by SGP4 initialization paths.
 *
 * @param tle Parsed TLE data.
 * @returns Core derived parameters used by later initialization steps.
 */
function sxpallCommonInit(tle: TleData): DeepArg {
  const a1 = Math.pow(XKE / tle.xno, 2.0 / 3.0)
  const cosio = Math.cos(tle.xincl)
  const cosio2 = cosio * cosio
  const eosq = tle.eo * tle.eo
  const betao2 = 1 - eosq
  const betao = Math.sqrt(betao2)
  const tval = 1.5 * CK2 * (3 * cosio2 - 1) / (betao * betao2)
  const del1 = tval / (a1 * a1)
  const ao = a1 * (1 - del1 * (1.0 / 3 + del1 * (1 + 134.0 / 81 * del1)))
  const delo = tval / (ao * ao)
  const xnodp = tle.xno / (1 + delo)
  const aodp = ao / (1 - delo)
  const sinio = Math.sin(tle.xincl)

  return {
    aodp,
    cosio,
    sinio,
    omgdot: 0,
    xmdot: 0,
    xnodot: 0,
    xnodp,
    eosq,
    betao,
    cosio2,
    betao2,
  }
}

/**
 * Computes drag and secular-rate terms and stores them into packed state `p`.
 *
 * @param tle Parsed TLE data.
 * @param p Packed mutable parameter array.
 * @returns Grouped initialization terms and deep-space arguments.
 */
function sxpxCommonInit(tle: TleData, p: number[]): { init: InitT; deep: DeepArg } {
  const deep0 = sxpallCommonInit(tle)
  const x3thm1 = 3 * deep0.cosio2 - 1

  let s4 = S_CONST
  let qoms24 = QOMS2T
  const perige = (deep0.aodp * (1 - tle.eo) - AE) * EARTH_RADIUS_KM
  if (perige < 156) {
    if (perige <= 98) {
      s4 = 20
    } else {
      s4 = perige - 78
    }
    const tempVal = (120 - s4) * AE / EARTH_RADIUS_KM
    const tempValSquared = tempVal * tempVal
    qoms24 = tempValSquared * tempValSquared
    s4 = s4 / EARTH_RADIUS_KM + AE
  }

  const pinv = 1 / (deep0.aodp * deep0.betao2)
  const pinvsq = pinv * pinv
  const tsi = 1 / (deep0.aodp - s4)
  const eta = deep0.aodp * tle.eo * tsi
  const etasq = eta * eta
  const eeta = tle.eo * eta
  const psisq = Math.abs(1 - etasq)
  const tsiSquared = tsi * tsi
  const coef = qoms24 * tsiSquared * tsiSquared
  const coef1 = coef / Math.pow(psisq, 3.5)

  const c2 = coef1 * deep0.xnodp * (deep0.aodp * (1 + 1.5 * etasq + eeta * (4 + etasq))
    + 0.75 * CK2 * tsi / psisq * x3thm1 * (8 + 3 * etasq * (8 + etasq)))
  const c1 = tle.bstar * c2
  const sinio = Math.sin(tle.xincl)
  const c4 = 2 * deep0.xnodp * coef1 * deep0.aodp * deep0.betao2
    * (eta * (2 + 0.5 * etasq) + tle.eo * (0.5 + 2 * etasq) - 2 * CK2 * tsi
      / (deep0.aodp * psisq) * (-3 * x3thm1 * (1 - 2 * eeta + etasq * (1.5 - 0.5 * eeta))
        + 0.75 * (1 - deep0.cosio2) * (2 * etasq - eeta * (1 + etasq)) * Math.cos(2 * tle.omegao)))

  const cosio4 = deep0.cosio2 * deep0.cosio2
  const temp1 = 3 * CK2 * pinvsq * deep0.xnodp
  const temp2 = temp1 * CK2 * pinvsq
  const temp3 = 1.25 * CK4 * pinvsq * pinvsq * deep0.xnodp
  const xmdot = deep0.xnodp + temp1 * deep0.betao * x3thm1 / 2
    + temp2 * deep0.betao * (13 - 78 * deep0.cosio2 + 137 * cosio4) / 16
  const omgdot = -temp1 * (1 - 5 * deep0.cosio2) / 2
    + temp2 * (7 - 114 * deep0.cosio2 + 395 * cosio4) / 16
    + temp3 * (3 - 36 * deep0.cosio2 + 49 * cosio4)
  const xhdot1 = -temp1 * deep0.cosio
  const xnodot = xhdot1 + (temp2 * (4 - 19 * deep0.cosio2) / 2 + 2 * temp3 * (3 - 7 * deep0.cosio2)) * deep0.cosio
  const xnodcf = 3.5 * deep0.betao2 * xhdot1 * c1
  const t2cof = 1.5 * c1

  p[0] = c2
  p[2] = c1
  p[3] = c4
  p[4] = xnodcf
  p[5] = t2cof

  return {
    deep: {
      aodp: deep0.aodp,
      cosio: deep0.cosio,
      sinio,
      omgdot,
      xmdot,
      xnodot,
      xnodp: deep0.xnodp,
      eosq: deep0.eosq,
      betao: deep0.betao,
      cosio2: deep0.cosio2,
      betao2: deep0.betao2,
    },
    init: {
      coef,
      coef1,
      tsi,
      s4,
    },
  }
}

/**
 * Normalizes an angle into the interval `[-π, π]`.
 *
 * @param value Angle in radians.
 * @returns Equivalent wrapped angle in radians.
 */
function centralizeAngle(value: number): number {
  let out = value % TWOPI
  if (out > PI) {
    out -= TWOPI
  } else if (out < -PI) {
    out += TWOPI
  }
  return out
}

/**
 * Solves Kepler terms and transforms orbital elements into ECI position.
 *
 * This function performs iterative anomaly solving and applies short-period
 * perturbation corrections before producing a Cartesian position vector.
 *
 * @returns ECI position vector `[x, y, z]` in kilometers; `[0,0,0]` on failure.
 */
function sxpxPosnVel(
  xnode: number,
  a: number,
  ecc: number,
  cosio: number,
  sinio: number,
  xincl: number,
  omega: number,
  xl: number,
): [number, number, number] {
  const maxKeplerIter = 10
  const chickenFactorOnEccentricity = 1e-6

  const axn = ecc * Math.cos(omega)
  let temp = 1 / (a * (1 - ecc * ecc))
  const xlcof = 0.125 * A3OVK2 * sinio * (3 + 5 * cosio) / (1 + cosio)
  const aycof = 0.25 * A3OVK2 * sinio
  const xll = temp * xlcof * axn
  const aynl = temp * aycof
  const xlt = xl + xll
  const ayn = ecc * Math.sin(omega) + aynl
  const elsq = axn * axn + ayn * ayn
  const capu = centralizeAngle(xlt - xnode)

  const cosioSquared = cosio * cosio
  const x3thm1 = 3.0 * cosioSquared - 1.0
  const sinio2 = 1.0 - cosioSquared
  const x7thm1 = 7.0 * cosioSquared - 1.0

  if (a < 0 || elsq > 1 - chickenFactorOnEccentricity) {
    return [0, 0, 0]
  }

  let epw = capu
  let i = 0
  for (; i < maxKeplerIter; i += 1) {
    const newtonRaphsonEpsilon = 1e-12
    const sinEPW = Math.sin(epw)
    const cosEPW = Math.cos(epw)
    const ecosE = axn * cosEPW + ayn * sinEPW
    const esinE = axn * sinEPW - ayn * cosEPW
    const f = capu - epw + esinE
    if (Math.abs(f) < newtonRaphsonEpsilon) {
      break
    }
    const fdot = 1 - ecosE
    let deltaEpw = f / fdot
    if (i === 0) {
      const maxNr = 1.25 * Math.abs(ecc)
      if (deltaEpw > maxNr) {
        deltaEpw = maxNr
      } else if (deltaEpw < -maxNr) {
        deltaEpw = -maxNr
      } else {
        deltaEpw = f / (fdot + 0.5 * esinE * deltaEpw)
      }
    } else {
      deltaEpw = f / (fdot + 0.5 * esinE * deltaEpw)
    }
    epw += deltaEpw
  }

  if (i === maxKeplerIter) {
    return [0, 0, 0]
  }

  const sinEPW = Math.sin(epw)
  const cosEPW = Math.cos(epw)
  const ecosE = axn * cosEPW + ayn * sinEPW
  const esinE = axn * sinEPW - ayn * cosEPW

  temp = 1 - elsq
  const pl = a * temp
  const r = a * (1 - ecosE)
  const temp2 = a / r
  const betal = Math.sqrt(temp)
  temp = esinE / (1 + betal)
  const cosu = temp2 * (cosEPW - axn + ayn * temp)
  const sinu = temp2 * (sinEPW - ayn - axn * temp)
  const u = Math.atan2(sinu, cosu)
  const sin2u = 2 * sinu * cosu
  const cos2u = 2 * cosu * cosu - 1
  const ck2OverPl = CK2 / pl
  const ck2OverPlSq = ck2OverPl / pl

  const rk = r * (1 - 1.5 * ck2OverPlSq * betal * x3thm1) + 0.5 * ck2OverPl * sinio2 * cos2u
  const uk = u - 0.25 * ck2OverPlSq * x7thm1 * sin2u
  const xnodek = xnode + 1.5 * ck2OverPlSq * cosio * sin2u
  const xinck = xincl + 1.5 * ck2OverPlSq * cosio * sinio * cos2u

  const sinuk = Math.sin(uk)
  const cosuk = Math.cos(uk)
  const sinik = Math.sin(xinck)
  const cosik = Math.cos(xinck)
  const sinnok = Math.sin(xnodek)
  const cosnok = Math.cos(xnodek)
  const xmx = -sinnok * cosik
  const xmy = cosnok * cosik
  const ux = xmx * sinuk + cosnok * cosuk
  const uy = xmy * sinuk + sinnok * cosuk
  const uz = sinik * sinuk

  return [rk * ux * EARTH_RADIUS_KM, rk * uy * EARTH_RADIUS_KM, rk * uz * EARTH_RADIUS_KM]
}
