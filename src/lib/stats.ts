/**
 * Module de statistiques porté fidèlement du Rails (app/models/stats.rb).
 * Calcule les scores, moyennes, écarts-types et intervalles de confiance
 * pour les types de questionnaires UX.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type StatsSummary = {
  mean: number
  sd: number
  ci90: [number, number]
  ci95: [number, number]
  ci99: [number, number]
}

export type SusResult = StatsSummary & { n: number; grade: string }

export type DeepResult = {
  n: number
  G1: StatsSummary
  G2: StatsSummary
  G3: StatsSummary
  G4: StatsSummary
  G5: StatsSummary
  G6: StatsSummary
}

export type UmuxResult = StatsSummary & { n: number }

export type UmuxLiteResult = {
  n: number
  global: StatsSummary
  usability: StatsSummary
  usefulness: StatsSummary
}

export type UeqResult = {
  n: number
  ATT: StatsSummary
  PERSP: StatsSummary
  EFF: StatsSummary
  DEP: StatsSummary
  STIM: StatsSummary
  NOV: StatsSummary
  GLOBAL: StatsSummary
}

export type UeqSResult = {
  n: number
  PRAG: StatsSummary
  HED: StatsSummary
  GLOBAL: StatsSummary
}

export type AttrakDiffResult = {
  n: number
  QP: StatsSummary
  QHS: StatsSummary
  QHI: StatsSummary
  ATT: StatsSummary
  QH: StatsSummary
}

export type WordPairAverages = Record<string, number>

export type Answers = Record<string, number>

// ─── Helpers statistiques (port de Stats::Helper + Stats::SRS) ──────────

const ZERO_SUMMARY: StatsSummary = { mean: 0, sd: 0, ci90: [0, 0], ci95: [0, 0], ci99: [0, 0] }

function round(v: number, decimals = 2): number {
  const f = 10 ** decimals
  return Math.round(v * f) / f
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function stdev(arr: number[], m?: number): number {
  if (arr.length <= 1) return 0
  const avg = m ?? mean(arr)
  const variance = arr.reduce((acc, v) => acc + (v - avg) ** 2, 0) / (arr.length - 1)
  return Math.sqrt(variance)
}

/**
 * Approximation de la fonction quantile de la distribution t de Student.
 * Utilise l'approximation d'Abramowitz & Stegun pour la distribution normale,
 * puis la correction de Hill pour la distribution t.
 */
function tQuantile(p: number, df: number): number {
  // Approximation de la fonction quantile normale (Abramowitz & Stegun 26.2.23)
  const a = p < 0.5 ? p : 1 - p
  const sign = p < 0.5 ? -1 : 1

  const t2 = Math.log(1 / (a * a))
  const c0 = 2.515517
  const c1 = 0.802853
  const c2 = 0.010328
  const d1 = 1.432788
  const d2 = 0.189269
  const d3 = 0.001308

  const sqrtT2 = Math.sqrt(t2)
  const zApprox = sign * (sqrtT2 - (c0 + c1 * sqrtT2 + c2 * t2) / (1 + d1 * sqrtT2 + d2 * t2 + d3 * sqrtT2 * t2))

  // Correction pour la distribution t (Hill's approximation)
  if (df >= 1000) return zApprox

  const g1 = (zApprox ** 3 + zApprox) / (4 * df)
  const g2 = (5 * zApprox ** 5 + 16 * zApprox ** 3 + 3 * zApprox) / (96 * df * df)
  const g3 = (3 * zApprox ** 7 + 19 * zApprox ** 5 + 17 * zApprox ** 3 - 15 * zApprox) / (384 * df ** 3)
  const g4 = (79 * zApprox ** 9 + 776 * zApprox ** 7 + 1482 * zApprox ** 5 - 1920 * zApprox ** 3 - 945 * zApprox) / (92160 * df ** 4)

  return zApprox + g1 + g2 + g3 + g4
}

function zQuantile(p: number): number {
  return tQuantile(p, 10000)
}

/**
 * Standard error (estimated variance, without replacement).
 * Cf. Cochran (1972) p.47
 */
function standardErrorWor(s: number, nSample: number, nPop: number): number {
  const qf = 1 - nSample / nPop
  return (s / Math.sqrt(nSample)) * Math.sqrt(qf)
}

function confidenceInterval(
  m: number,
  s: number,
  nSample: number,
  nPop: number,
  x: number,
): [number, number] {
  const se = standardErrorWor(s, nSample, nPop)
  const range = x * se
  return [m - range, m + range]
}

/**
 * Calcule un résumé statistique complet.
 * Port fidèle de Stats::Helper.compute_stats_summary_for_data
 */
export function computeStatsSummary(values: number[], n: number): StatsSummary {
  if (values.length === 0 || n === 0) return { ...ZERO_SUMMARY }

  const m = mean(values)
  if (n <= 1 || values.length <= 1) {
    const roundedMean = round(m)
    return {
      mean: roundedMean,
      sd: 0,
      ci90: [roundedMean, roundedMean],
      ci95: [roundedMean, roundedMean],
      ci99: [roundedMean, roundedMean],
    }
  }

  const s = stdev(values, m)
  const pop = 1e100 // population infinie

  let ci90: [number, number], ci95: [number, number], ci99: [number, number]

  if (n > 60) {
    const z90 = zQuantile(1 - (1 - 0.9) / 2)
    const z95 = zQuantile(1 - (1 - 0.95) / 2)
    const z99 = zQuantile(1 - (1 - 0.99) / 2)
    ci90 = confidenceInterval(m, s, n, pop, z90)
    ci95 = confidenceInterval(m, s, n, pop, z95)
    ci99 = confidenceInterval(m, s, n, pop, z99)
  } else {
    const df = n - 1
    const t90 = tQuantile(1 - (1 - 0.9) / 2, df)
    const t95 = tQuantile(1 - (1 - 0.95) / 2, df)
    const t99 = tQuantile(1 - (1 - 0.99) / 2, df)
    ci90 = confidenceInterval(m, s, n, pop, t90)
    ci95 = confidenceInterval(m, s, n, pop, t95)
    ci99 = confidenceInterval(m, s, n, pop, t99)
  }

  return {
    mean: round(m),
    sd: round(s),
    ci90: [round(ci90[0]), round(ci90[1])],
    ci95: [round(ci95[0]), round(ci95[1])],
    ci99: [round(ci99[0]), round(ci99[1])],
  }
}

// ─── SUS ────────────────────────────────────────────────────────────────────

export function computeSusScore(answers: Answers): number {
  const odd = (answers.Q1 ?? 0) + (answers.Q3 ?? 0) + (answers.Q5 ?? 0) + (answers.Q7 ?? 0) + (answers.Q9 ?? 0)
  const even = (4 - (answers.Q2 ?? 0)) + (4 - (answers.Q4 ?? 0)) + (4 - (answers.Q6 ?? 0)) + (4 - (answers.Q8 ?? 0)) + (4 - (answers.Q10 ?? 0))
  return 2.5 * (odd + even)
}

export function susGrade(score: number): string {
  if (score >= 84.1) return 'A+'
  if (score >= 80.8) return 'A'
  if (score >= 78.9) return 'A-'
  if (score >= 77.2) return 'B+'
  if (score >= 74.1) return 'B'
  if (score >= 72.6) return 'B-'
  if (score >= 71.1) return 'C+'
  if (score >= 65) return 'C'
  if (score >= 62.7) return 'C-'
  if (score >= 51.7) return 'D'
  return 'F'
}

export function computeSusStats(responses: Answers[]): SusResult | null {
  const scores: number[] = []
  for (const a of responses) {
    const keys = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10']
    if (keys.some((k) => typeof a[k] !== 'number' || Number.isNaN(a[k]))) continue
    scores.push(computeSusScore(a))
  }
  if (scores.length === 0) return null
  const summary = computeStatsSummary(scores, scores.length)
  return { ...summary, n: scores.length, grade: susGrade(summary.mean) }
}

// ─── DEEP ───────────────────────────────────────────────────────────────────

type DeepGroup = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6'

const DEEP_GROUPS: Record<DeepGroup, string[]> = {
  G1: ['Q1', 'Q2', 'Q3', 'Q4'],
  G2: ['Q5', 'Q6', 'Q7'],
  G3: ['Q8', 'Q9', 'Q10'],
  G4: ['Q11', 'Q12', 'Q13'],
  G5: ['Q14', 'Q15', 'Q16'],
  G6: ['Q17', 'Q18', 'Q19'],
}

export const DEEP_GROUP_LABELS: Record<DeepGroup, string> = {
  G1: 'Contenu percu',
  G2: 'Structure / AI',
  G3: 'Navigation',
  G4: 'Effort cognitif',
  G5: 'Cohérence mise en page',
  G6: 'Guidage visuel',
}

const DEEP_REVERSED_ITEMS = new Set(['Q12', 'Q15'])

function normalizeDeepValue(raw: unknown, itemId: string): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  if (raw === 0) return null // 0 = Non applicable
  if (raw < 1 || raw > 5) return null
  return DEEP_REVERSED_ITEMS.has(itemId) ? 6 - raw : raw
}

export function computeDeepStats(responses: Answers[]): DeepResult | null {
  if (responses.length === 0) return null

  const values: Record<DeepGroup, number[]> = {
    G1: [],
    G2: [],
    G3: [],
    G4: [],
    G5: [],
    G6: [],
  }

  let n = 0

  for (const a of responses) {
    let hasAtLeastOneValue = false

    for (const [group, questions] of Object.entries(DEEP_GROUPS) as Array<[DeepGroup, string[]]>) {
      const rowValues: number[] = []

      for (const q of questions) {
        const normalized = normalizeDeepValue(a[q], q)
        if (normalized == null) continue
        rowValues.push(normalized)
      }

      if (rowValues.length > 0) {
        values[group].push(mean(rowValues))
        hasAtLeastOneValue = true
      }
    }

    if (hasAtLeastOneValue) n++
  }

  if (n === 0) return null

  return {
    n,
    G1: values.G1.length > 0 ? computeStatsSummary(values.G1, values.G1.length) : { ...ZERO_SUMMARY },
    G2: values.G2.length > 0 ? computeStatsSummary(values.G2, values.G2.length) : { ...ZERO_SUMMARY },
    G3: values.G3.length > 0 ? computeStatsSummary(values.G3, values.G3.length) : { ...ZERO_SUMMARY },
    G4: values.G4.length > 0 ? computeStatsSummary(values.G4, values.G4.length) : { ...ZERO_SUMMARY },
    G5: values.G5.length > 0 ? computeStatsSummary(values.G5, values.G5.length) : { ...ZERO_SUMMARY },
    G6: values.G6.length > 0 ? computeStatsSummary(values.G6, values.G6.length) : { ...ZERO_SUMMARY },
  }
}

// ─── UMUX ───────────────────────────────────────────────────────────────────

export function computeUmuxScore(answers: Answers): number {
  const q1 = answers.Q1
  const q2 = answers.Q2
  const q3 = answers.Q3
  const q4 = answers.Q4
  if ([q1, q2, q3, q4].some((v) => typeof v !== 'number' || Number.isNaN(v) || (v as number) < 0 || (v as number) > 6)) return 0
  // UMUX (échelle 0-6): Q2 et Q4 sont inversés.
  return (100 * (q1 + (6 - q2) + q3 + (6 - q4))) / 24
}

export function computeUmuxStats(responses: Answers[]): UmuxResult | null {
  if (responses.length === 0) return null

  const scores: number[] = []
  for (const a of responses) {
    const keys = ['Q1', 'Q2', 'Q3', 'Q4']
    if (keys.some((k) => typeof a[k] !== 'number' || Number.isNaN(a[k]) || (a[k] as number) < 0 || (a[k] as number) > 6)) {
      continue
    }
    scores.push(computeUmuxScore(a))
  }
  if (scores.length === 0) return null

  const summary = computeStatsSummary(scores, scores.length)
  return { ...summary, n: scores.length }
}

// ─── UMUX-Lite ──────────────────────────────────────────────────────────────

export function computeUmuxLiteScore(answers: Answers): number {
  const q1 = answers.Q1
  const q3 = answers.Q3
  if ([q1, q3].some((v) => typeof v !== 'number' || Number.isNaN(v) || (v as number) < 0 || (v as number) > 6)) return 0
  // UMUX-Lite standard (échelle 0-6) avec les 2 items positifs de cette app (Q1 et Q3).
  return (100 * (q1 + q3)) / 12
}

export function computeUmuxLiteStats(responses: Answers[]): UmuxLiteResult | null {
  if (responses.length === 0) return null

  const globalScores: number[] = []
  const usabilityScores: number[] = []
  const usefulnessScores: number[] = []

  for (const a of responses) {
    const q1 = a.Q1
    const q3 = a.Q3
    if ([q1, q3].some((v) => typeof v !== 'number' || Number.isNaN(v) || (v as number) < 0 || (v as number) > 6)) {
      continue
    }
    globalScores.push(computeUmuxLiteScore(a))
    usabilityScores.push((100 / 6) * q3)
    usefulnessScores.push((100 / 6) * q1)
  }

  if (globalScores.length === 0) return null

  const n = globalScores.length
  return {
    n,
    global: computeStatsSummary(globalScores, n),
    usability: computeStatsSummary(usabilityScores, n),
    usefulness: computeStatsSummary(usefulnessScores, n),
  }
}

// ─── UEQ ────────────────────────────────────────────────────────────────────

const UEQ_DIMENSIONS: Record<'ATT' | 'PERSP' | 'EFF' | 'DEP' | 'STIM' | 'NOV', string[]> = {
  ATT: ['Q1', 'Q12', 'Q14', 'Q16', 'Q24', 'Q25'],
  PERSP: ['Q2', 'Q4', 'Q13', 'Q21'],
  EFF: ['Q9', 'Q20', 'Q22', 'Q23'],
  DEP: ['Q8', 'Q11', 'Q17', 'Q19'],
  STIM: ['Q5', 'Q6', 'Q7', 'Q18'],
  NOV: ['Q3', 'Q10', 'Q15', 'Q26'],
}

const UEQ_POSITIVE_SIDE: Record<string, 'left' | 'right'> = {
  Q1: 'right',
  Q2: 'right',
  Q3: 'left',
  Q4: 'left',
  Q5: 'left',
  Q6: 'right',
  Q7: 'right',
  Q8: 'right',
  Q9: 'left',
  Q10: 'left',
  Q11: 'right',
  Q12: 'left',
  Q13: 'right',
  Q14: 'right',
  Q15: 'right',
  Q16: 'right',
  Q17: 'left',
  Q18: 'left',
  Q19: 'left',
  Q20: 'right',
  Q21: 'left',
  Q22: 'right',
  Q23: 'left',
  Q24: 'left',
  Q25: 'left',
  Q26: 'right',
}

function normalizeUeqValue(raw: number, itemId: string): number | null {
  if (!Number.isFinite(raw) || raw < 1 || raw > 7) return null
  const direction = UEQ_POSITIVE_SIDE[itemId]
  if (!direction) return null
  return direction === 'right' ? raw - 4 : 4 - raw
}

export function computeUeqStats(responses: Answers[]): UeqResult | null {
  if (responses.length === 0) return null

  const dimensionValues: Record<'ATT' | 'PERSP' | 'EFF' | 'DEP' | 'STIM' | 'NOV', number[]> = {
    ATT: [],
    PERSP: [],
    EFF: [],
    DEP: [],
    STIM: [],
    NOV: [],
  }
  const globalValues: number[] = []

  for (const a of responses) {
    const respondentAllItems: number[] = []

    for (const [dimension, keys] of Object.entries(UEQ_DIMENSIONS) as Array<[keyof typeof UEQ_DIMENSIONS, string[]]>) {
      const respondentDimensionItems: number[] = []

      for (const key of keys) {
        const raw = a[key]
        if (typeof raw !== 'number') continue
        const normalized = normalizeUeqValue(raw, key)
        if (normalized == null) continue
        respondentDimensionItems.push(normalized)
        respondentAllItems.push(normalized)
      }

      if (respondentDimensionItems.length > 0) {
        dimensionValues[dimension].push(mean(respondentDimensionItems))
      }
    }

    if (respondentAllItems.length > 0) {
      globalValues.push(mean(respondentAllItems))
    }
  }

  const n = globalValues.length
  return {
    n,
    ATT: dimensionValues.ATT.length > 0 ? computeStatsSummary(dimensionValues.ATT, dimensionValues.ATT.length) : { ...ZERO_SUMMARY },
    PERSP: dimensionValues.PERSP.length > 0 ? computeStatsSummary(dimensionValues.PERSP, dimensionValues.PERSP.length) : { ...ZERO_SUMMARY },
    EFF: dimensionValues.EFF.length > 0 ? computeStatsSummary(dimensionValues.EFF, dimensionValues.EFF.length) : { ...ZERO_SUMMARY },
    DEP: dimensionValues.DEP.length > 0 ? computeStatsSummary(dimensionValues.DEP, dimensionValues.DEP.length) : { ...ZERO_SUMMARY },
    STIM: dimensionValues.STIM.length > 0 ? computeStatsSummary(dimensionValues.STIM, dimensionValues.STIM.length) : { ...ZERO_SUMMARY },
    NOV: dimensionValues.NOV.length > 0 ? computeStatsSummary(dimensionValues.NOV, dimensionValues.NOV.length) : { ...ZERO_SUMMARY },
    GLOBAL: globalValues.length > 0 ? computeStatsSummary(globalValues, globalValues.length) : { ...ZERO_SUMMARY },
  }
}

export const UEQ_DIMENSION_LABELS: Record<keyof typeof UEQ_DIMENSIONS | 'GLOBAL', string> = {
  ATT: 'Attractivité',
  PERSP: 'Clarté',
  EFF: 'Efficacité',
  DEP: 'Contrôlabilité',
  STIM: 'Stimulation',
  NOV: 'Nouveauté',
  GLOBAL: 'Score global',
}

// ─── UEQ-S ──────────────────────────────────────────────────────────────────

const UEQ_S_DIMENSIONS: Record<'PRAG' | 'HED', string[]> = {
  PRAG: ['Q1', 'Q2', 'Q3', 'Q4'],
  HED: ['Q5', 'Q6', 'Q7', 'Q8'],
}

const UEQ_S_POSITIVE_SIDE: Record<string, 'left' | 'right'> = {
  Q1: 'right',
  Q2: 'right',
  Q3: 'right',
  Q4: 'right',
  Q5: 'right',
  Q6: 'right',
  Q7: 'right',
  Q8: 'right',
}

function normalizeUeqSValue(raw: number, itemId: string): number | null {
  if (!Number.isFinite(raw) || raw < 1 || raw > 7) return null
  const direction = UEQ_S_POSITIVE_SIDE[itemId]
  if (!direction) return null
  return direction === 'right' ? raw - 4 : 4 - raw
}

export function computeUeqSStats(responses: Answers[]): UeqSResult | null {
  if (responses.length === 0) return null

  const dimensionValues: Record<'PRAG' | 'HED', number[]> = {
    PRAG: [],
    HED: [],
  }
  const globalValues: number[] = []

  for (const a of responses) {
    const respondentAllItems: number[] = []

    for (const [dimension, keys] of Object.entries(UEQ_S_DIMENSIONS) as Array<[keyof typeof UEQ_S_DIMENSIONS, string[]]>) {
      const respondentDimensionItems: number[] = []

      for (const key of keys) {
        const raw = a[key]
        if (typeof raw !== 'number') continue
        const normalized = normalizeUeqSValue(raw, key)
        if (normalized == null) continue
        respondentDimensionItems.push(normalized)
        respondentAllItems.push(normalized)
      }

      if (respondentDimensionItems.length > 0) {
        dimensionValues[dimension].push(mean(respondentDimensionItems))
      }
    }

    if (respondentAllItems.length > 0) {
      globalValues.push(mean(respondentAllItems))
    }
  }

  const n = globalValues.length
  return {
    n,
    PRAG: dimensionValues.PRAG.length > 0 ? computeStatsSummary(dimensionValues.PRAG, dimensionValues.PRAG.length) : { ...ZERO_SUMMARY },
    HED: dimensionValues.HED.length > 0 ? computeStatsSummary(dimensionValues.HED, dimensionValues.HED.length) : { ...ZERO_SUMMARY },
    GLOBAL: globalValues.length > 0 ? computeStatsSummary(globalValues, globalValues.length) : { ...ZERO_SUMMARY },
  }
}

export const UEQ_S_DIMENSION_LABELS: Record<keyof typeof UEQ_S_DIMENSIONS | 'GLOBAL', string> = {
  PRAG: 'Qualité pragmatique',
  HED: 'Qualité hédonique',
  GLOBAL: 'Score global',
}

// ─── AttrakDiff ─────────────────────────────────────────────────────────────

const ATTRAKDIFF_FULL_KEYS = {
  QP: ['QP1', 'QP2', 'QP3', 'QP4', 'QP5', 'QP6', 'QP7'],
  QHS: ['QHS1', 'QHS2', 'QHS3', 'QHS4', 'QHS5', 'QHS6', 'QHS7'],
  QHI: ['QHI1', 'QHI2', 'QHI3', 'QHI4', 'QHI5', 'QHI6', 'QHI7'],
  ATT: ['ATT1', 'ATT2', 'ATT3', 'ATT4', 'ATT5', 'ATT6', 'ATT7'],
}

const ATTRAKDIFF_ABRIDGED_KEYS = {
  QP: ['QP2', 'QP3', 'QP5', 'QP6'],
  QHS: ['QHS2', 'QHS5'],
  QHI: ['QHI3', 'QHI4'],
  ATT: ['ATT2', 'ATT5'],
}

// Items inversés selon la passation FR (AttrakDiff2 - Lallemand/Gronier).
const ATTRAKDIFF_REVERSED_ITEMS = new Set([
  'QP1',
  'ATT1',
  'QHS1',
  'QP2',
  'QHI2',
  'QP3',
  'ATT3',
  'QHI3',
  'QP5',
  'QHI6',
  'ATT5',
  'QHS3',
  'QHS4',
  'ATT7',
  'QHS7',
])

function normalizeAttrakDiffValue(raw: unknown, itemId: string): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < -3 || raw > 3) return null
  return ATTRAKDIFF_REVERSED_ITEMS.has(itemId) ? -raw : raw
}

export function computeAttrakDiffStats(
  responses: Answers[],
  abridged = false,
): AttrakDiffResult | null {
  if (responses.length === 0) return null

  const keys = abridged ? ATTRAKDIFF_ABRIDGED_KEYS : ATTRAKDIFF_FULL_KEYS
  const values: Record<'QP' | 'QHS' | 'QHI' | 'ATT' | 'QH', number[]> = {
    QP: [],
    QHS: [],
    QHI: [],
    ATT: [],
    QH: [],
  }

  for (const a of responses) {
    const qpRow: number[] = []
    const qhsRow: number[] = []
    const qhiRow: number[] = []
    const attRow: number[] = []

    for (const k of keys.QP) {
      const normalized = normalizeAttrakDiffValue(a[k], k)
      if (normalized != null) qpRow.push(normalized)
    }
    for (const k of keys.QHS) {
      const normalized = normalizeAttrakDiffValue(a[k], k)
      if (normalized != null) qhsRow.push(normalized)
    }
    for (const k of keys.QHI) {
      const normalized = normalizeAttrakDiffValue(a[k], k)
      if (normalized != null) qhiRow.push(normalized)
    }
    for (const k of keys.ATT) {
      const normalized = normalizeAttrakDiffValue(a[k], k)
      if (normalized != null) attRow.push(normalized)
    }

    if (qpRow.length > 0) values.QP.push(mean(qpRow))
    if (qhsRow.length > 0) values.QHS.push(mean(qhsRow))
    if (qhiRow.length > 0) values.QHI.push(mean(qhiRow))
    if (attRow.length > 0) values.ATT.push(mean(attRow))

    const qhRow = [...qhsRow, ...qhiRow]
    if (qhRow.length > 0) values.QH.push(mean(qhRow))
  }

  const n = Math.max(values.QP.length, values.QHS.length, values.QHI.length, values.ATT.length)
  return {
    n,
    QP: values.QP.length > 0 ? computeStatsSummary(values.QP, values.QP.length) : { ...ZERO_SUMMARY },
    QHS: values.QHS.length > 0 ? computeStatsSummary(values.QHS, values.QHS.length) : { ...ZERO_SUMMARY },
    QHI: values.QHI.length > 0 ? computeStatsSummary(values.QHI, values.QHI.length) : { ...ZERO_SUMMARY },
    ATT: values.ATT.length > 0 ? computeStatsSummary(values.ATT, values.ATT.length) : { ...ZERO_SUMMARY },
    QH: values.QH.length > 0 ? computeStatsSummary(values.QH, values.QH.length) : { ...ZERO_SUMMARY },
  }
}

export const ATTRAKDIFF_DIMENSION_LABELS: Record<string, string> = {
  QP: 'Qualité Pragmatique',
  QHS: 'Qualité Hédonique - Stimulation',
  QHI: 'Qualité Hédonique - Identification',
  ATT: 'Attractivité',
  QH: 'Qualité Hédonique',
}

export function computeWordPairAverages(
  responses: Answers[],
  abridged = false,
): WordPairAverages {
  const allKeys = abridged
    ? [...ATTRAKDIFF_ABRIDGED_KEYS.QP, ...ATTRAKDIFF_ABRIDGED_KEYS.QHS, ...ATTRAKDIFF_ABRIDGED_KEYS.QHI, ...ATTRAKDIFF_ABRIDGED_KEYS.ATT]
    : [...ATTRAKDIFF_FULL_KEYS.QP, ...ATTRAKDIFF_FULL_KEYS.QHS, ...ATTRAKDIFF_FULL_KEYS.QHI, ...ATTRAKDIFF_FULL_KEYS.ATT]

  const result: WordPairAverages = {}

  if (responses.length === 0) {
    for (const k of allKeys) result[k] = 0
    return result
  }

  for (const k of allKeys) {
    const sum = responses.reduce((acc, a) => acc + (a[k] ?? 0), 0)
    result[k] = round(sum / responses.length)
  }

  return result
}
