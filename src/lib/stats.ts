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

const DEEP_GROUPS: Record<string, string[]> = {
  G1: ['Q1', 'Q2', 'Q3', 'Q4'],
  G2: ['Q5', 'Q6', 'Q7'],
  G3: ['Q8', 'Q9', 'Q10'],
  G4: ['Q11', 'Q12', 'Q13'],
  G5: ['Q14', 'Q15', 'Q16'],
  G6: ['Q17', 'Q18', 'Q19'],
}

export const DEEP_GROUP_LABELS: Record<string, string> = {
  G1: 'Contenu percu',
  G2: 'Structure / AI',
  G3: 'Navigation',
  G4: 'Effort cognitif',
  G5: 'Cohérence mise en page',
  G6: 'Guidage visuel',
}

export function computeDeepStats(responses: Answers[]): DeepResult | null {
  if (responses.length === 0) return null

  const values: Record<string, number[]> = { G1: [], G2: [], G3: [], G4: [], G5: [], G6: [] }

  for (const a of responses) {
    for (const [group, questions] of Object.entries(DEEP_GROUPS)) {
      for (const q of questions) {
        const v = a[q]
        if (typeof v === 'number' && v > 0) {
          values[group].push(v)
        }
      }
    }
  }

  const n = responses.length
  return {
    n,
    G1: values.G1.length > 0 ? computeStatsSummary(values.G1, n) : { ...ZERO_SUMMARY },
    G2: values.G2.length > 0 ? computeStatsSummary(values.G2, n) : { ...ZERO_SUMMARY },
    G3: values.G3.length > 0 ? computeStatsSummary(values.G3, n) : { ...ZERO_SUMMARY },
    G4: values.G4.length > 0 ? computeStatsSummary(values.G4, n) : { ...ZERO_SUMMARY },
    G5: values.G5.length > 0 ? computeStatsSummary(values.G5, n) : { ...ZERO_SUMMARY },
    G6: values.G6.length > 0 ? computeStatsSummary(values.G6, n) : { ...ZERO_SUMMARY },
  }
}

// ─── UMUX ───────────────────────────────────────────────────────────────────

export function computeUmuxScore(answers: Answers): number {
  return (100 * ((answers.Q1 ?? 0) + (answers.Q2 ?? 0) + (answers.Q3 ?? 0) + (answers.Q4 ?? 0))) / 24
}

export function computeUmuxStats(responses: Answers[]): UmuxResult | null {
  if (responses.length === 0) return null
  const scores = responses.map(computeUmuxScore)
  const summary = computeStatsSummary(scores, scores.length)
  return { ...summary, n: scores.length }
}

// ─── UMUX-Lite ──────────────────────────────────────────────────────────────

export function computeUmuxLiteScore(answers: Answers): number {
  return (100 * ((answers.Q1 ?? 0) + (answers.Q3 ?? 0))) / 12
}

export function computeUmuxLiteStats(responses: Answers[]): UmuxLiteResult | null {
  if (responses.length === 0) return null

  const globalScores = responses.map(computeUmuxLiteScore)
  const usabilityScores = responses.map((a) => (100 / 6) * (a.Q3 ?? 0))
  const usefulnessScores = responses.map((a) => (100 / 6) * (a.Q1 ?? 0))

  const n = responses.length
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

  const values: Record<'ATT' | 'PERSP' | 'EFF' | 'DEP' | 'STIM' | 'NOV' | 'GLOBAL', number[]> = {
    ATT: [],
    PERSP: [],
    EFF: [],
    DEP: [],
    STIM: [],
    NOV: [],
    GLOBAL: [],
  }

  for (const a of responses) {
    for (const [dimension, keys] of Object.entries(UEQ_DIMENSIONS) as Array<[keyof typeof UEQ_DIMENSIONS, string[]]>) {
      for (const key of keys) {
        const raw = a[key]
        if (typeof raw !== 'number') continue
        const normalized = normalizeUeqValue(raw, key)
        if (normalized == null) continue
        values[dimension].push(normalized)
        values.GLOBAL.push(normalized)
      }
    }
  }

  const n = responses.length
  return {
    n,
    ATT: values.ATT.length > 0 ? computeStatsSummary(values.ATT, n) : { ...ZERO_SUMMARY },
    PERSP: values.PERSP.length > 0 ? computeStatsSummary(values.PERSP, n) : { ...ZERO_SUMMARY },
    EFF: values.EFF.length > 0 ? computeStatsSummary(values.EFF, n) : { ...ZERO_SUMMARY },
    DEP: values.DEP.length > 0 ? computeStatsSummary(values.DEP, n) : { ...ZERO_SUMMARY },
    STIM: values.STIM.length > 0 ? computeStatsSummary(values.STIM, n) : { ...ZERO_SUMMARY },
    NOV: values.NOV.length > 0 ? computeStatsSummary(values.NOV, n) : { ...ZERO_SUMMARY },
    GLOBAL: values.GLOBAL.length > 0 ? computeStatsSummary(values.GLOBAL, n) : { ...ZERO_SUMMARY },
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

function normalizeUeqSValue(raw: number): number | null {
  if (!Number.isFinite(raw) || raw < 1 || raw > 7) return null
  // Toutes les paires UEQ-S sont orientées négatif à gauche / positif à droite.
  return raw - 4
}

export function computeUeqSStats(responses: Answers[]): UeqSResult | null {
  if (responses.length === 0) return null

  const values: Record<'PRAG' | 'HED' | 'GLOBAL', number[]> = {
    PRAG: [],
    HED: [],
    GLOBAL: [],
  }

  for (const a of responses) {
    for (const [dimension, keys] of Object.entries(UEQ_S_DIMENSIONS) as Array<[keyof typeof UEQ_S_DIMENSIONS, string[]]>) {
      for (const key of keys) {
        const raw = a[key]
        if (typeof raw !== 'number') continue
        const normalized = normalizeUeqSValue(raw)
        if (normalized == null) continue
        values[dimension].push(normalized)
        values.GLOBAL.push(normalized)
      }
    }
  }

  const n = responses.length
  return {
    n,
    PRAG: values.PRAG.length > 0 ? computeStatsSummary(values.PRAG, n) : { ...ZERO_SUMMARY },
    HED: values.HED.length > 0 ? computeStatsSummary(values.HED, n) : { ...ZERO_SUMMARY },
    GLOBAL: values.GLOBAL.length > 0 ? computeStatsSummary(values.GLOBAL, n) : { ...ZERO_SUMMARY },
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

export function computeAttrakDiffStats(
  responses: Answers[],
  abridged = false,
): AttrakDiffResult | null {
  if (responses.length === 0) return null

  const keys = abridged ? ATTRAKDIFF_ABRIDGED_KEYS : ATTRAKDIFF_FULL_KEYS
  const values: Record<string, number[]> = { QP: [], QHS: [], QHI: [], ATT: [], QH: [] }

  for (const a of responses) {
    for (const k of keys.QP) values.QP.push(a[k] ?? 0)
    for (const k of keys.QHS) values.QHS.push(a[k] ?? 0)
    for (const k of keys.QHI) values.QHI.push(a[k] ?? 0)
    for (const k of keys.ATT) values.ATT.push(a[k] ?? 0)
    for (const k of keys.QHS) values.QH.push(a[k] ?? 0)
    for (const k of keys.QHI) values.QH.push(a[k] ?? 0)
  }

  const n = responses.length
  return {
    n,
    QP: computeStatsSummary(values.QP, n),
    QHS: computeStatsSummary(values.QHS, n),
    QHI: computeStatsSummary(values.QHI, n),
    ATT: computeStatsSummary(values.ATT, n),
    QH: computeStatsSummary(values.QH, n),
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
