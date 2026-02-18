import { useMemo, useState } from 'react'
import type { Project, ProjectResponse } from '../api'
import { deleteResponse, recoverResponse } from '../api'
import { computeQuestionnaireId } from './Sidebar'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import {
  computeSusStats,
  computeDeepStats,
  computeUmuxStats,
  computeUmuxLiteStats,
  computeUeqStats,
  computeUeqSStats,
  computeAttrakDiffStats,
} from '../lib/stats'
import type { Answers } from '../lib/stats'

type Props = {
  project: Project
  responses: ProjectResponse[]
  onResponsesChanged: () => void
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

type MetricValue = number | string | null
type MetricMap = Record<string, MetricValue>

type MetricColumn = {
  key: string
  label: string
  decimals?: number
  kind?: 'grade' | 'integer'
}

type ActiveRow = {
  response: ProjectResponse
  metrics: MetricMap
}

function readAnswer(answers: Answers, key: string): number | null {
  const value = answers[key]
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) return null
  return value
}

function getMetricColumns(qid: ReturnType<typeof computeQuestionnaireId>): MetricColumn[] {
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
      return [
        { key: 'answered', label: 'Réponses', kind: 'integer' },
      ]
  }
}

function buildMetrics(
  qid: ReturnType<typeof computeQuestionnaireId>,
  answers: Answers | null,
): MetricMap {
  if (!answers) return {}

  switch (qid) {
    case 'sus': {
      const stats = computeSusStats([answers])
      const metrics: MetricMap = {}
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
      const metrics: MetricMap = { naCount }
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

function renderMetricValue(value: MetricValue, column: MetricColumn): string {
  if (value == null) return '—'
  if (typeof value === 'number') {
    if (column.kind === 'integer') return String(Math.round(value))
    return value.toFixed(column.decimals ?? 2)
  }
  return String(value)
}

const GRADE_COLORS: Record<string, string> = {
  'A+': 'bg-emerald-100 text-emerald-800',
  'A': 'bg-emerald-100 text-emerald-700',
  'A-': 'bg-green-100 text-green-700',
  'B+': 'bg-lime-100 text-lime-700',
  'B': 'bg-lime-100 text-lime-700',
  'B-': 'bg-yellow-100 text-yellow-700',
  'C+': 'bg-amber-100 text-amber-700',
  'C': 'bg-amber-100 text-amber-700',
  'C-': 'bg-orange-100 text-orange-700',
  'D': 'bg-red-100 text-red-700',
  'F': 'bg-red-200 text-red-800',
}

export function ResponsesTable({ project, responses, onResponsesChanged }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [pendingDeletion, setPendingDeletion] = useState<ProjectResponse | null>(null)

  const handleDelete = async (responseId: string) => {
    setLoadingId(responseId)
    try {
      await deleteResponse(project.id, responseId)
      onResponsesChanged()
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingId(null)
    }
  }

  const handleRecover = async (responseId: string) => {
    setLoadingId(responseId)
    try {
      await recoverResponse(project.id, responseId)
      onResponsesChanged()
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingId(null)
    }
  }

  const qid = computeQuestionnaireId(project.questionnaireType)
  const activeResponses = responses.filter((r) => !r.archived)
  const archivedResponses = responses.filter((r) => r.archived)
  const metricColumns = useMemo(() => getMetricColumns(qid), [qid])
  const metricColumnCount = metricColumns.length > 0 ? metricColumns.length : 1
  const activeRows = useMemo<ActiveRow[]>(() => (
    activeResponses.map((response) => {
      const payload = parsePayload(response)
      const answers = payload?.answers ?? null
      return {
        response,
        metrics: buildMetrics(qid, answers),
      }
    })
  ), [activeResponses, qid])

  const confirmDelete = async () => {
    if (!pendingDeletion) return
    const responseToDelete = pendingDeletion
    await handleDelete(responseToDelete.id)
    setPendingDeletion(null)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-sm font-semibold text-ink">
          Réponses
        </h3>
        <span className="text-xs text-taupe bg-slate-100 px-2 py-0.5 rounded-full">
          {activeResponses.length} active{activeResponses.length > 1 ? 's' : ''}
        </span>
      </div>

      {responses.length === 0 ? (
        <p className="text-sm text-taupe py-4">Aucune réponse pour le moment.</p>
      ) : (
        <div className="border border-stone rounded-brand overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="bg-cream border-b border-stone">
                  <th className="px-3 py-2 text-left text-xs font-medium text-taupe uppercase">#</th>
                  {metricColumns.map((column) => (
                    <th
                      key={column.key}
                      className="px-3 py-2 text-left text-xs font-medium text-taupe uppercase whitespace-nowrap"
                    >
                      {column.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left text-xs font-medium text-taupe uppercase">Date</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-taupe uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeRows.map((row, i) => (
                  <tr key={row.response.id} className="hover:bg-cream/50">
                    <td className="px-3 py-2 text-taupe">{i + 1}</td>
                    {metricColumns.map((column) => {
                      const value = row.metrics[column.key]
                      if (column.kind === 'grade' && typeof value === 'string') {
                        return (
                          <td key={column.key} className="px-3 py-2">
                            <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded ${GRADE_COLORS[value] ?? 'bg-slate-100 text-graphite'}`}>
                              {value}
                            </span>
                          </td>
                        )
                      }
                      return (
                        <td key={column.key} className="px-3 py-2 text-ink whitespace-nowrap">
                          {renderMetricValue(value ?? null, column)}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-taupe text-xs whitespace-nowrap">
                      {new Date(row.response.createdTime).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setPendingDeletion(row.response)}
                        disabled={loadingId === row.response.id}
                        className="text-xs text-berry hover:text-berry/80 font-medium cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}

                {archivedResponses.map((r, i) => (
                  <tr key={r.id} className="bg-cream/30 opacity-50">
                    <td className="px-3 py-2 text-taupe line-through">{activeRows.length + i + 1}</td>
                    <td className="px-3 py-2 text-taupe line-through" colSpan={metricColumnCount}>Supprimée</td>
                    <td className="px-3 py-2 text-taupe text-xs line-through whitespace-nowrap">
                      {new Date(r.createdTime).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleRecover(r.id)}
                        disabled={loadingId === r.id}
                        className="text-xs text-flame hover:text-ink font-medium cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        Récupérer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pendingDeletion && (
        <DeleteConfirmModal
          title="Supprimer la réponse"
          message="Cette réponse sera archivée et retirée des statistiques."
          onConfirm={confirmDelete}
          onCancel={() => setPendingDeletion(null)}
          loading={loadingId === pendingDeletion.id}
        />
      )}
    </div>
  )
}
