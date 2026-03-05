import { useState, useMemo } from 'react'
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

type ExportSheet = {
  name: string
  rows: ExportCell[][]
}

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

function toDisplayText(value: ExportCell): string {
  if (value == null) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return value
}

function getHeaderWidthOverride(header: string): number | null {
  const normalized = header.toLowerCase()
  if (normalized === '#') return 6
  if (normalized.includes('date')) return 20
  if (normalized.includes('id réponse') || normalized.includes('id reponse')) return 38
  if (normalized.includes('statut')) return 12
  if (normalized.includes('paire de mots')) return 52
  if (/^q\d+$/i.test(header)) return 8
  if (['qp', 'qhs', 'qhi', 'att', 'qh', 'att', 'persp', 'eff', 'dep', 'stim', 'nov', 'prag', 'hed'].includes(normalized)) return 10
  return null
}

function buildColumnWidths(rows: ExportCell[][]): Array<{ wch: number }> {
  const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const widths: Array<{ wch: number }> = []

  for (let col = 0; col < colCount; col += 1) {
    let maxLen = 0
    for (const row of rows) {
      const text = toDisplayText(row[col] ?? null)
      const len = [...text].length
      if (len > maxLen) maxLen = len
    }

    const header = toDisplayText(rows[0]?.[col] ?? null)
    const headerOverride = header ? getHeaderWidthOverride(header) : null
    const padded = Math.min(60, Math.max(8, maxLen + 2))
    widths.push({ wch: headerOverride != null ? Math.max(padded, headerOverride) : padded })
  }

  return widths
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

async function exportWorkbook(
  project: Project,
  responses: ProjectResponse[],
  qid: ReturnType<typeof computeQuestionnaireId>,
  questionnaire: ReturnType<typeof getQuestionnaireById>,
  stats: {
    type: 'sus' | 'deep' | 'umux' | 'umux_lite' | 'ueq' | 'ueq_s' | 'attrakdiff' | 'attrakdiff_abridged'
    data: unknown
    wordPairs?: Record<string, number>
  } | null,
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

  const sheets: ExportSheet[] = [
    { name: 'Résultats', rows: sheetResults },
    { name: 'Réponses', rows: sheetResponses },
    { name: 'Données brutes', rows: sheetRaw },
  ]

  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  const usedNames = new Set<string>()
  for (const sheet of sheets) {
    const name = normalizeSheetName(sheet.name, usedNames)
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows)
    worksheet['!cols'] = buildColumnWidths(sheet.rows)
    XLSX.utils.book_append_sheet(workbook, worksheet, name)
  }

  const fileData = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  })
  const blob = new Blob([fileData], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFileName(project.name || 'export')}_export.xlsx`
  a.click()
  URL.revokeObjectURL(url)
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

  const stats = useMemo(() => {
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
            <button
              onClick={() => { void exportWorkbook(project, responses, qid, questionnaire, stats) }}
              className="text-xs text-flame hover:text-ink font-medium cursor-pointer flex items-center gap-1 shrink-0 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exporter Excel
            </button>
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
      {activeTab === 'stats' && (
        <div>
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
      )}

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
