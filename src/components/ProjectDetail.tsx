import { useState, useMemo, useRef } from 'react'
import type { Row as ExcelRow, Border as ExcelBorder } from 'exceljs'
import type { Project, ProjectResponse } from '../api'
import { deleteProject, updateProject } from '../api'
import { ProjectForm } from './ProjectForm'
import { ResponsesTable } from './ResponsesTable'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { computeQuestionnaireId } from './Sidebar'
import { getQuestionnaireById } from '../questionnaires'
import { copyToClipboard } from '../lib/clipboard'

import { SusStats } from './stats/SusStats'
import { DeepStats } from './stats/DeepStats'
import { UmuxStats } from './stats/UmuxStats'
import { UmuxLiteStats } from './stats/UmuxLiteStats'
import { UeqStats } from './stats/UeqStats'
import { UeqSStats } from './stats/UeqSStats'
import { AttrakDiffStats } from './stats/AttrakDiffStats'

import {
  ATTRAKDIFF_DIMENSION_LABELS,
  DEEP_GROUP_LABELS,
  computeSusStats,
  computeDeepStats,
  computeUmuxStats,
  computeUmuxLiteStats,
  computeUeqStats,
  computeUeqSStats,
  computeAttrakDiffStats,
  computeWordPairAverages,
  UEQ_DIMENSION_LABELS,
  UEQ_S_DIMENSION_LABELS,
  type Answers,
  type StatsSummary,
} from '../lib/stats'

type ProjectTab = 'stats' | 'responses' | 'form'

type Props = {
  project: Project
  responses: ProjectResponse[]
  responsesLoading: boolean
  onProjectUpdated: (project: Project) => void
  onProjectDeleted: () => void
  onResponsesChanged: () => void
  existingFolders?: string[]
  activeTab?: ProjectTab
  onTabChange?: (tab: ProjectTab) => void
}

type ComputedStats =
  | { type: 'sus'; data: ReturnType<typeof computeSusStats> }
  | { type: 'deep'; data: ReturnType<typeof computeDeepStats> }
  | { type: 'umux'; data: ReturnType<typeof computeUmuxStats> }
  | { type: 'umux_lite'; data: ReturnType<typeof computeUmuxLiteStats> }
  | { type: 'ueq'; data: ReturnType<typeof computeUeqStats> }
  | { type: 'ueq_s'; data: ReturnType<typeof computeUeqSStats> }
  | { type: 'attrakdiff'; data: ReturnType<typeof computeAttrakDiffStats>; wordPairs: Record<string, number> }
  | { type: 'attrakdiff_abridged'; data: ReturnType<typeof computeAttrakDiffStats>; wordPairs: Record<string, number> }

function parsePayload(r: ProjectResponse): { questionnaireId?: string; answers?: Answers } | null {
  const anyProps = r.properties as Record<string, unknown>
  const payloadProp = anyProps?.Payload as { rich_text?: Array<{ plain_text?: string }> } | undefined
  if (!payloadProp?.rich_text) return null
  const text = payloadProp.rich_text.map((t) => t.plain_text || '').join('')
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

type ExportCell = string | number | boolean | null

type ResponseMetricValue = number | string | null

type ResponseMetricColumn = {
  key: string
  label: string
  decimals?: number
  kind?: 'grade' | 'integer'
}

function sanitizeFileName(value: string): string {
  const trimmed = value.trim()
  const safe = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return safe || 'export'
}

function normalizeSheetName(value: string, used: Set<string>): string {
  const cleaned = value.replace(/[\[\]:*?/\\]+/g, ' ').trim()
  const base = (cleaned || 'Feuille').slice(0, 31)
  if (!used.has(base)) {
    used.add(base)
    return base
  }

  let index = 2
  while (index < 1000) {
    const suffix = `_${index}`
    const candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`
    if (!used.has(candidate)) {
      used.add(candidate)
      return candidate
    }
    index += 1
  }

  const fallback = `Feuille_${Date.now()}`
  used.add(fallback)
  return fallback
}

function toTimestamp(value: string): number {
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? 0 : ts
}

function sortByCreatedTimeDesc(a: ProjectResponse, b: ProjectResponse): number {
  const delta = toTimestamp(b.createdTime) - toTimestamp(a.createdTime)
  if (delta !== 0) return delta
  return a.id.localeCompare(b.id)
}

function readAnswer(answers: Answers, key: string): number | null {
  const value = answers[key]
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) return null
  return value
}

function getResponseMetricColumns(qid: ReturnType<typeof computeQuestionnaireId>): ResponseMetricColumn[] {
  switch (qid) {
    case 'sus':
      return [
        { key: 'score', label: 'Score SUS', decimals: 1 },
        { key: 'grade', label: 'Note', kind: 'grade' },
        ...Array.from({ length: 10 }, (_, i) => ({ key: `Q${i + 1}`, label: `Q${i + 1}`, kind: 'integer' as const })),
      ]
    case 'deep':
      return [
        { key: 'naCount', label: 'N/A', kind: 'integer' },
        { key: 'G1', label: 'G1', decimals: 2 },
        { key: 'G2', label: 'G2', decimals: 2 },
        { key: 'G3', label: 'G3', decimals: 2 },
        { key: 'G4', label: 'G4', decimals: 2 },
        { key: 'G5', label: 'G5', decimals: 2 },
        { key: 'G6', label: 'G6', decimals: 2 },
      ]
    case 'umux':
      return [
        { key: 'score', label: 'Score UMUX', decimals: 1 },
        { key: 'Q1', label: 'Q1', kind: 'integer' },
        { key: 'Q2', label: 'Q2', kind: 'integer' },
        { key: 'Q3', label: 'Q3', kind: 'integer' },
        { key: 'Q4', label: 'Q4', kind: 'integer' },
      ]
    case 'umux_lite':
      return [
        { key: 'global', label: 'Global', decimals: 1 },
        { key: 'usefulness', label: 'Utilité', decimals: 1 },
        { key: 'usability', label: 'Utilisabilité', decimals: 1 },
        { key: 'Q1', label: 'Q1', kind: 'integer' },
        { key: 'Q3', label: 'Q3', kind: 'integer' },
      ]
    case 'ueq':
      return [
        { key: 'GLOBAL', label: 'Global', decimals: 2 },
        { key: 'ATT', label: 'ATT', decimals: 2 },
        { key: 'PERSP', label: 'PERSP', decimals: 2 },
        { key: 'EFF', label: 'EFF', decimals: 2 },
        { key: 'DEP', label: 'DEP', decimals: 2 },
        { key: 'STIM', label: 'STIM', decimals: 2 },
        { key: 'NOV', label: 'NOV', decimals: 2 },
      ]
    case 'ueq_s':
      return [
        { key: 'GLOBAL', label: 'Global', decimals: 2 },
        { key: 'PRAG', label: 'PRAG', decimals: 2 },
        { key: 'HED', label: 'HED', decimals: 2 },
      ]
    case 'attrakdiff':
    case 'attrakdiff_abridged':
      return [
        { key: 'QP', label: 'QP', decimals: 2 },
        { key: 'QHS', label: 'QHS', decimals: 2 },
        { key: 'QHI', label: 'QHI', decimals: 2 },
        { key: 'ATT', label: 'ATT', decimals: 2 },
        { key: 'QH', label: 'QH', decimals: 2 },
      ]
    default:
      return [{ key: 'answered', label: 'Réponses', kind: 'integer' }]
  }
}

function buildResponseMetrics(
  qid: ReturnType<typeof computeQuestionnaireId>,
  answers: Answers | null,
): Record<string, ResponseMetricValue> {
  if (!answers) return {}

  switch (qid) {
    case 'sus': {
      const stats = computeSusStats([answers])
      const metrics: Record<string, ResponseMetricValue> = {}
      for (let i = 1; i <= 10; i += 1) {
        metrics[`Q${i}`] = readAnswer(answers, `Q${i}`)
      }
      if (stats) {
        metrics.score = stats.mean
        metrics.grade = stats.grade
      }
      return metrics
    }
    case 'deep': {
      const stats = computeDeepStats([answers])
      const naCount = Array.from({ length: 19 }, (_, i) => readAnswer(answers, `Q${i + 1}`)).filter((v) => v === 0).length
      const metrics: Record<string, ResponseMetricValue> = { naCount }
      if (stats) {
        metrics.G1 = stats.G1.mean
        metrics.G2 = stats.G2.mean
        metrics.G3 = stats.G3.mean
        metrics.G4 = stats.G4.mean
        metrics.G5 = stats.G5.mean
        metrics.G6 = stats.G6.mean
      }
      return metrics
    }
    case 'umux': {
      const stats = computeUmuxStats([answers])
      return {
        score: stats?.mean ?? null,
        Q1: readAnswer(answers, 'Q1'),
        Q2: readAnswer(answers, 'Q2'),
        Q3: readAnswer(answers, 'Q3'),
        Q4: readAnswer(answers, 'Q4'),
      }
    }
    case 'umux_lite': {
      const stats = computeUmuxLiteStats([answers])
      return {
        global: stats?.global.mean ?? null,
        usefulness: stats?.usefulness.mean ?? null,
        usability: stats?.usability.mean ?? null,
        Q1: readAnswer(answers, 'Q1'),
        Q3: readAnswer(answers, 'Q3'),
      }
    }
    case 'ueq': {
      const stats = computeUeqStats([answers])
      if (!stats) return {}
      return {
        GLOBAL: stats.GLOBAL.mean,
        ATT: stats.ATT.mean,
        PERSP: stats.PERSP.mean,
        EFF: stats.EFF.mean,
        DEP: stats.DEP.mean,
        STIM: stats.STIM.mean,
        NOV: stats.NOV.mean,
      }
    }
    case 'ueq_s': {
      const stats = computeUeqSStats([answers])
      if (!stats) return {}
      return {
        GLOBAL: stats.GLOBAL.mean,
        PRAG: stats.PRAG.mean,
        HED: stats.HED.mean,
      }
    }
    case 'attrakdiff': {
      const stats = computeAttrakDiffStats([answers], false)
      if (!stats) return {}
      return {
        QP: stats.QP.mean,
        QHS: stats.QHS.mean,
        QHI: stats.QHI.mean,
        ATT: stats.ATT.mean,
        QH: stats.QH.mean,
      }
    }
    case 'attrakdiff_abridged': {
      const stats = computeAttrakDiffStats([answers], true)
      if (!stats) return {}
      return {
        QP: stats.QP.mean,
        QHS: stats.QHS.mean,
        QHI: stats.QHI.mean,
        ATT: stats.ATT.mean,
        QH: stats.QH.mean,
      }
    }
    default:
      return { answered: Object.keys(answers).length }
  }
}

function formatMetricValue(value: ResponseMetricValue, column: ResponseMetricColumn): ExportCell {
  if (value == null) return null
  if (typeof value === 'number') {
    if (column.kind === 'integer') return Math.round(value)
    if (typeof column.decimals === 'number') return Number(value.toFixed(column.decimals))
    return Number(value.toFixed(2))
  }
  return value
}

function statsRow(label: string, summary: StatsSummary): ExportCell[] {
  return [
    label,
    summary.mean,
    summary.sd,
    summary.ci90[0],
    summary.ci90[1],
    summary.ci95[0],
    summary.ci95[1],
    summary.ci99[0],
    summary.ci99[1],
  ]
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

async function exportWorkbook(
  project: Project,
  responses: ProjectResponse[],
  qid: ReturnType<typeof computeQuestionnaireId>,
  questionnaire: ReturnType<typeof getQuestionnaireById>,
  stats: ComputedStats | null,
) {
  if (!qid) return

  const sortedResponses = [...responses].sort(sortByCreatedTimeDesc)
  const activeResponses = sortedResponses.filter((r) => !r.archived)
  const archivedResponses = sortedResponses.filter((r) => r.archived)
  if (activeResponses.length === 0) return

  const sheetResults: ExportCell[][] = [
    ['Projet', project.name || '(Sans titre)'],
    ['Questionnaire', project.questionnaireType || ''],
    ['Réponses actives', activeResponses.length],
    ['Réponses archivées', archivedResponses.length],
    [],
  ]

  const summaryHeader: ExportCell[] = ['Dimension', 'Moyenne', 'Écart-type', 'IC90 min', 'IC90 max', 'IC95 min', 'IC95 max', 'IC99 min', 'IC99 max']

  if (stats?.data) {
    sheetResults.push(summaryHeader)
    switch (stats.type) {
      case 'sus': {
        const sus = stats.data as ReturnType<typeof computeSusStats>
        if (sus) {
          sheetResults.push(statsRow('Score SUS', sus))
          sheetResults.push(['Note', sus.grade])
        }
        break
      }
      case 'deep': {
        const deep = stats.data as ReturnType<typeof computeDeepStats>
        if (deep) {
          ;(['G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const).forEach((key) => {
            sheetResults.push(statsRow(DEEP_GROUP_LABELS[key], deep[key]))
          })
        }
        break
      }
      case 'umux': {
        const umux = stats.data as ReturnType<typeof computeUmuxStats>
        if (umux) sheetResults.push(statsRow('Score UMUX', umux))
        break
      }
      case 'umux_lite': {
        const lite = stats.data as ReturnType<typeof computeUmuxLiteStats>
        if (lite) {
          sheetResults.push(statsRow('Score global', lite.global))
          sheetResults.push(statsRow('Utilité (Q1)', lite.usefulness))
          sheetResults.push(statsRow('Utilisabilité (Q3)', lite.usability))
        }
        break
      }
      case 'ueq': {
        const ueq = stats.data as ReturnType<typeof computeUeqStats>
        if (ueq) {
          sheetResults.push(statsRow(UEQ_DIMENSION_LABELS.GLOBAL, ueq.GLOBAL))
          ;(['ATT', 'PERSP', 'EFF', 'DEP', 'STIM', 'NOV'] as const).forEach((key) => {
            sheetResults.push(statsRow(UEQ_DIMENSION_LABELS[key], ueq[key]))
          })
        }
        break
      }
      case 'ueq_s': {
        const ueqs = stats.data as ReturnType<typeof computeUeqSStats>
        if (ueqs) {
          sheetResults.push(statsRow(UEQ_S_DIMENSION_LABELS.GLOBAL, ueqs.GLOBAL))
          ;(['PRAG', 'HED'] as const).forEach((key) => {
            sheetResults.push(statsRow(UEQ_S_DIMENSION_LABELS[key], ueqs[key]))
          })
        }
        break
      }
      case 'attrakdiff':
      case 'attrakdiff_abridged': {
        const attrak = stats.data as ReturnType<typeof computeAttrakDiffStats>
        if (attrak) {
          ;(['QP', 'QHS', 'QHI', 'ATT', 'QH'] as const).forEach((key) => {
            sheetResults.push(statsRow(ATTRAKDIFF_DIMENSION_LABELS[key], attrak[key]))
          })
        }
        if (stats.wordPairs && questionnaire) {
          sheetResults.push([])
          sheetResults.push(['Paire de mots', 'Moyenne'])
          for (const question of questionnaire.questions) {
            if (question.type !== 'bipolar') continue
            const score = stats.wordPairs[question.id]
            if (typeof score !== 'number') continue
            sheetResults.push([`${question.leftFr} ↔ ${question.rightFr}`, Number(score.toFixed(2))])
          }
        }
        break
      }
      default:
        break
    }
  } else {
    sheetResults.push(['Aucune statistique disponible.'])
  }

  const metricColumns = getResponseMetricColumns(qid)
  const sheetResponses: ExportCell[][] = [
    ['#', ...metricColumns.map((c) => c.label), 'Date', 'ID réponse', 'Statut'],
  ]

  activeResponses.forEach((response, index) => {
    const payload = parsePayload(response)
    const metrics = buildResponseMetrics(qid, payload?.answers ?? null)
    sheetResponses.push([
      index + 1,
      ...metricColumns.map((column) => formatMetricValue(metrics[column.key] ?? null, column)),
      new Date(response.createdTime).toLocaleString('fr-FR'),
      response.id,
      'Active',
    ])
  })

  archivedResponses.forEach((response, index) => {
    sheetResponses.push([
      activeResponses.length + index + 1,
      ...metricColumns.map(() => null),
      new Date(response.createdTime).toLocaleString('fr-FR'),
      response.id,
      'Archivée',
    ])
  })

  const rawQuestionKeys = questionnaire?.questions.map((q) => q.id) ?? []
  const fallbackKeys = new Set<string>()
  activeResponses.forEach((response) => {
    const payload = parsePayload(response)
    if (!payload?.answers) return
    Object.keys(payload.answers).forEach((key) => fallbackKeys.add(key))
  })
  const questionKeys = rawQuestionKeys.length > 0 ? rawQuestionKeys : Array.from(fallbackKeys).sort((a, b) => a.localeCompare(b, 'fr'))

  const sheetRaw: ExportCell[][] = [
    ['Date', 'ID réponse', ...questionKeys],
  ]

  activeResponses.forEach((response) => {
    const payload = parsePayload(response)
    const answers = payload?.answers ?? {}
    sheetRaw.push([
      new Date(response.createdTime).toLocaleString('fr-FR'),
      response.id,
      ...questionKeys.map((key) => {
        const value = answers[key]
        return typeof value === 'number' && Number.isFinite(value) ? value : null
      }),
    ])
  })

  // --- Build workbook with ExcelJS + brand styling ---
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Team We Love Users'
  workbook.created = new Date()

  const BRAND = {
    flame: 'FFE0553D',
    ink: 'FF1A1A1A',
    cream: 'FFFAF9F7',
    stone: 'FFE2E0DC',
    white: 'FFFFFFFF',
    sage: 'FF4A7C59',
    taupe: 'FFA8A29E',
  }

  const thinBorder: ExcelBorder = { style: 'thin', color: { argb: BRAND.stone } }
  const borderAll = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }

  function applyHeaderStyle(row: ExcelRow, colCount: number) {
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c)
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.flame } }
      cell.border = borderAll
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    }
  }

  function applyDataRowStyle(row: ExcelRow, colCount: number, index: number) {
    const bg = index % 2 === 0 ? BRAND.white : BRAND.cream
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c)
      cell.font = { color: { argb: BRAND.ink }, size: 10 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.border = borderAll
      cell.alignment = { vertical: 'middle' }
    }
  }

  // ---- Sheet 1: Résultats ----
  const usedNames = new Set<string>()
  const wsResults = workbook.addWorksheet(normalizeSheetName('Résultats', usedNames))

  // Title
  wsResults.mergeCells('A1:I1')
  const titleCell = wsResults.getCell('A1')
  titleCell.value = project.name || '(Sans titre)'
  titleCell.font = { size: 16, bold: true, color: { argb: BRAND.ink } }
  titleCell.alignment = { vertical: 'middle' }
  wsResults.getRow(1).height = 30

  // Subtitle
  wsResults.mergeCells('A2:I2')
  const subtitleCell = wsResults.getCell('A2')
  subtitleCell.value = `${project.questionnaireType || 'N/A'}  |  n = ${activeResponses.length}  |  Archivées : ${archivedResponses.length}`
  subtitleCell.font = { size: 11, color: { argb: BRAND.taupe } }

  // Stats data starts at row 4
  let currentRow = 4
  if (stats?.data) {
    const headerRow = wsResults.getRow(currentRow)
    summaryHeader.forEach((h, i) => { headerRow.getCell(i + 1).value = h as string })
    applyHeaderStyle(headerRow, summaryHeader.length)
    currentRow++

    const statsDataRows = sheetResults.slice(sheetResults.indexOf(summaryHeader) + 1)
    statsDataRows.forEach((rowData, idx) => {
      if (rowData.length === 0) { currentRow++; return }
      const row = wsResults.getRow(currentRow)
      // Check if this is a sub-header (e.g. "Paire de mots")
      const isSubHeader = rowData.length === 2 && typeof rowData[0] === 'string' && typeof rowData[1] === 'string' && rowData[1] === 'Moyenne'
      rowData.forEach((val, i) => {
        const cell = row.getCell(i + 1)
        cell.value = val as string | number
        if (typeof val === 'number') cell.numFmt = '0.00'
      })
      if (isSubHeader) {
        applyHeaderStyle(row, rowData.length)
      } else {
        applyDataRowStyle(row, rowData.length, idx)
        row.getCell(1).font = { bold: true, color: { argb: BRAND.ink }, size: 10 }
      }
      currentRow++
    })
  }

  wsResults.columns = [
    { width: 28 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 12 }, { width: 12 },
  ]

  // ---- Sheet 2: Réponses ----
  const wsResp = workbook.addWorksheet(normalizeSheetName('Réponses', usedNames))
  const respColCount = sheetResponses[0]?.length ?? 0

  sheetResponses.forEach((rowData, idx) => {
    const row = wsResp.addRow(rowData)
    if (idx === 0) {
      applyHeaderStyle(row, respColCount)
    } else {
      applyDataRowStyle(row, respColCount, idx - 1)
      // Colour "Active" / "Archivée" status cell
      const statusCell = row.getCell(respColCount)
      if (statusCell.value === 'Active') {
        statusCell.font = { bold: true, color: { argb: BRAND.sage }, size: 10 }
      } else if (statusCell.value === 'Archivée') {
        statusCell.font = { italic: true, color: { argb: BRAND.taupe }, size: 10 }
      }
      // Bold the # column
      row.getCell(1).font = { bold: true, color: { argb: BRAND.ink }, size: 10 }
    }
  })

  // Auto column widths for responses
  const respHeaders = sheetResponses[0] ?? []
  wsResp.columns = respHeaders.map((h) => {
    const label = String(h ?? '')
    const norm = label.toLowerCase()
    if (norm === '#') return { width: 6 }
    if (norm.includes('date')) return { width: 20 }
    if (norm.includes('id')) return { width: 38 }
    if (norm.includes('statut')) return { width: 12 }
    if (/^q\d+$/i.test(label)) return { width: 8 }
    return { width: Math.min(18, Math.max(10, label.length + 4)) }
  })

  // ---- Sheet 3: Données brutes ----
  const wsRaw = workbook.addWorksheet(normalizeSheetName('Données brutes', usedNames))
  const rawColCount = sheetRaw[0]?.length ?? 0

  sheetRaw.forEach((rowData, idx) => {
    const row = wsRaw.addRow(rowData)
    if (idx === 0) {
      // Stone header for raw data
      for (let c = 1; c <= rawColCount; c++) {
        const cell = row.getCell(c)
        cell.font = { bold: true, color: { argb: BRAND.ink }, size: 10 }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.stone } }
        cell.border = borderAll
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      }
    } else {
      for (let c = 1; c <= rawColCount; c++) {
        const cell = row.getCell(c)
        cell.font = { color: { argb: BRAND.ink }, size: 10 }
        cell.border = borderAll
      }
    }
  })

  const rawHeaders = sheetRaw[0] ?? []
  wsRaw.columns = rawHeaders.map((h) => {
    const label = String(h ?? '')
    if (label.toLowerCase().includes('date')) return { width: 20 }
    if (label.toLowerCase().includes('id')) return { width: 38 }
    return { width: 10 }
  })

  // ---- Export ----
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(blob, `${sanitizeFileName(project.name || 'export')}_export.xlsx`)
}

async function exportStatsPng(
  projectName: string,
  statsContainer: HTMLDivElement,
): Promise<void> {
  const { toBlob } = await import('html-to-image')
  const safeName = sanitizeFileName(projectName || 'export')
  const opts = { pixelRatio: 2, backgroundColor: undefined as string | undefined }

  // Force all Chart.js canvases to finish animations before capture
  const canvases = statsContainer.querySelectorAll('canvas')
  if (canvases.length > 0) {
    const { Chart } = await import('chart.js')
    for (const canvas of canvases) {
      const chart = Chart.getChart(canvas)
      if (chart) {
        chart.stop()
        chart.render()
      }
    }
  }

  const kpiSections = statsContainer.querySelectorAll<HTMLElement>('[data-export="kpi"]')
  const chartSections = statsContainer.querySelectorAll<HTMLElement>('[data-export="chart"]')

  let fileIndex = 1
  for (const el of kpiSections) {
    const blob = await toBlob(el, opts)
    if (blob) {
      downloadBlob(blob, `${safeName}_kpi_${fileIndex}.png`)
      fileIndex++
    }
  }
  for (const el of chartSections) {
    const blob = await toBlob(el, opts)
    if (blob) {
      downloadBlob(blob, `${safeName}_chart_${fileIndex}.png`)
      fileIndex++
    }
  }

  if (fileIndex === 1) {
    throw new Error('Aucune section exportable trouvée')
  }
}

export function ProjectDetail({
  project,
  responses,
  responsesLoading,
  onProjectUpdated,
  onProjectDeleted,
  onResponsesChanged,
  existingFolders = [],
  activeTab: controlledTab,
  onTabChange,
}: Props) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [internalTab, setInternalTab] = useState<ProjectTab>('stats')

  const activeTab = controlledTab ?? internalTab
  const setActiveTab = onTabChange ?? setInternalTab
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [copied, setCopied] = useState(false)
  const [visualExporting, setVisualExporting] = useState<'png' | null>(null)
  const statsContainerRef = useRef<HTMLDivElement>(null)

  const qid = computeQuestionnaireId(project.questionnaireType)
  const questionnaire = qid ? getQuestionnaireById(qid) : undefined
  const activeResponses = responses.filter((r) => !r.archived)

  const isOpen = project.status === 'Ouvert'
  const publicUrl = project.publicToken
    ? `${window.location.origin}/p/${project.publicToken}`
    : null

  const handleToggleStatus = async () => {
    setTogglingStatus(true)
    try {
      const newStatus = isOpen ? 'Fermé' : 'Ouvert'
      const saved = await updateProject(project.id, { name: project.name, status: newStatus })
      onProjectUpdated(saved)
    } catch (err) {
      console.error(err)
    } finally {
      setTogglingStatus(false)
    }
  }

  const handleCopyUrl = () => {
    if (!publicUrl) return
    copyToClipboard(publicUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const answersArray = useMemo(() => {
    return activeResponses
      .map(parsePayload)
      .filter((p): p is { questionnaireId: string; answers: Answers } => !!p?.answers)
      .map((p) => p.answers)
  }, [activeResponses])

  const stats = useMemo<ComputedStats | null>(() => {
    if (!qid || answersArray.length === 0) return null

    switch (qid) {
      case 'sus':
        return { type: 'sus' as const, data: computeSusStats(answersArray) }
      case 'deep':
        return { type: 'deep' as const, data: computeDeepStats(answersArray) }
      case 'umux':
        return { type: 'umux' as const, data: computeUmuxStats(answersArray) }
      case 'umux_lite':
        return { type: 'umux_lite' as const, data: computeUmuxLiteStats(answersArray) }
      case 'ueq':
        return { type: 'ueq' as const, data: computeUeqStats(answersArray) }
      case 'ueq_s':
        return { type: 'ueq_s' as const, data: computeUeqSStats(answersArray) }
      case 'attrakdiff':
        return {
          type: 'attrakdiff' as const,
          data: computeAttrakDiffStats(answersArray, false),
          wordPairs: computeWordPairAverages(answersArray, false),
        }
      case 'attrakdiff_abridged':
        return {
          type: 'attrakdiff_abridged' as const,
          data: computeAttrakDiffStats(answersArray, true),
          wordPairs: computeWordPairAverages(answersArray, true),
        }
      default:
        return null
    }
  }, [qid, answersArray])

  const handleExportPng = async () => {
    if (!qid || visualExporting || !statsContainerRef.current) return
    setVisualExporting('png')
    try {
      await exportStatsPng(project.name, statsContainerRef.current)
    } catch (err) {
      console.error(err)
      window.alert("Impossible de générer l'export PNG.")
    } finally {
      setVisualExporting(null)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteProject(project.id)
      onProjectDeleted()
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const tabs = [
    { id: 'stats' as const, label: 'Résultats' },
    { id: 'responses' as const, label: `Réponses (${activeResponses.length})` },
    { id: 'form' as const, label: 'Paramètres' },
  ]

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-bold text-ink">{project.name || '(Sans titre)'}</h2>
          {activeResponses.length > 0 && qid && (
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => { void exportWorkbook(project, responses, qid, questionnaire, stats) }}
                className="text-xs text-flame hover:text-ink font-medium cursor-pointer flex items-center gap-1 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Exporter Excel
              </button>
              <button
                onClick={() => { void handleExportPng() }}
                disabled={visualExporting !== null}
                className="text-xs text-flame hover:text-ink font-medium cursor-pointer flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-wait"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {visualExporting === 'png' ? 'Export PNG...' : 'Exporter PNG'}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 mt-2 flex-wrap">
          {/* Status toggle */}
          <button
            onClick={handleToggleStatus}
            disabled={togglingStatus}
            className={`inline-flex items-center gap-1.5 text-xs font-medium pl-2 pr-2.5 py-1 rounded-full transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait ${
              isOpen
                ? 'bg-success-50 text-success-700 hover:bg-success-100'
                : 'bg-slate-100 text-taupe hover:bg-slate-200'
            }`}
          >
            <span className="relative flex h-4 w-7 items-center">
              <span
                className={`absolute inset-0 rounded-full transition-colors ${
                  isOpen ? 'bg-success-400' : 'bg-slate-300'
                }`}
              />
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                  isOpen ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </span>
            {togglingStatus ? '...' : isOpen ? 'Ouvert' : 'Fermé'}
          </button>

          {/* Questionnaire type badge */}
          {project.questionnaireType && (
            <span className="text-xs font-medium text-taupe bg-slate-100 px-2 py-1 rounded-full">
              {project.questionnaireType}
            </span>
          )}

          {/* Séparateur */}
          {publicUrl && (
            <span className="w-px h-4 bg-stone" />
          )}

          {/* Public URL + copy */}
          {publicUrl && (
            <div className="inline-flex items-center gap-1.5 min-w-0">
              <code className="text-[11px] text-taupe truncate max-w-[280px]">
                {publicUrl}
              </code>
              <button
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1 text-xs text-flame hover:text-ink font-medium cursor-pointer shrink-0 transition-colors"
              >
                {copied ? (
                  <>
                    <svg className="w-3 h-3 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sage">Copié</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copier
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-stone mb-6">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'border-flame text-flame'
                  : 'border-transparent text-taupe hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div ref={statsContainerRef} className={activeTab !== 'stats' ? 'hidden' : undefined}>
          {responsesLoading ? (
            <p className="text-sm text-taupe py-8">Chargement des résultats...</p>
          ) : !stats?.data ? (
            <div className="text-center py-12">
              <p className="text-sm text-taupe">
                {answersArray.length === 0
                  ? 'Aucune réponse pour calculer les statistiques.'
                  : 'Type de questionnaire non reconnu.'}
              </p>
            </div>
          ) : (
            <>
              {stats.type === 'sus' && stats.data && <SusStats stats={stats.data} />}
              {stats.type === 'deep' && stats.data && <DeepStats stats={stats.data} />}
              {stats.type === 'umux' && stats.data && <UmuxStats stats={stats.data} />}
              {stats.type === 'umux_lite' && stats.data && <UmuxLiteStats stats={stats.data} />}
              {stats.type === 'ueq' && stats.data && <UeqStats stats={stats.data} />}
              {stats.type === 'ueq_s' && stats.data && <UeqSStats stats={stats.data} />}
              {(stats.type === 'attrakdiff' || stats.type === 'attrakdiff_abridged') && stats.data && questionnaire && (
                <AttrakDiffStats
                  stats={stats.data}
                  wordPairs={(stats as { wordPairs: Record<string, number> }).wordPairs}
                  questionnaire={questionnaire}
                  abridged={stats.type === 'attrakdiff_abridged'}
                />
              )}
            </>
          )}
      </div>

      {activeTab === 'responses' && (
        <div>
          {responsesLoading ? (
            <p className="text-sm text-taupe py-8">Chargement des réponses...</p>
          ) : (
            <ResponsesTable
              project={project}
              responses={responses}
              onResponsesChanged={onResponsesChanged}
            />
          )}
        </div>
      )}

      {activeTab === 'form' && (
        <div className="max-w-lg">
          <ProjectForm
            project={project}
            hasResponses={activeResponses.length > 0}
            existingFolders={existingFolders}
            onSaved={onProjectUpdated}
          />

          <div className="mt-8 pt-6 border-t border-stone">
            <button
              onClick={() => setShowDeleteModal(true)}
              className="text-sm text-berry hover:text-berry/80 font-medium cursor-pointer transition-colors"
            >
              Supprimer ce projet
            </button>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <DeleteConfirmModal
          title="Supprimer le projet"
          message={`Le projet « ${project.name} » et toutes ses réponses seront archivés. Cette action est réversible via Notion.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleting}
        />
      )}
    </div>
  )
}
