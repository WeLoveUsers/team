import { useMemo, useState } from 'react'
import type { Project, ProjectResponse } from '../api'
import { deleteResponse, recoverResponse, batchUpdateResponseTags } from '../api'
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

const TAG_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-orange-100 text-orange-700',
]

function getTagColor(tag: string, allTags: string[]): string {
  const index = allTags.indexOf(tag)
  return TAG_COLORS[index % TAG_COLORS.length]
}

export function ResponsesTable({ project, responses, onResponsesChanged }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [pendingDeletion, setPendingDeletion] = useState<ProjectResponse | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [tagInput, setTagInput] = useState('')
  const [tagging, setTagging] = useState(false)
  const [showTagBar, setShowTagBar] = useState(false)

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
  const activeResponses = useMemo(
    () => responses.filter((r) => !r.archived).sort(sortByCreatedTimeDesc),
    [responses],
  )
  const archivedResponses = useMemo(
    () => responses.filter((r) => r.archived).sort(sortByCreatedTimeDesc),
    [responses],
  )
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

  // Collect all unique tags across responses
  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const r of activeResponses) {
      for (const tag of r.tags) set.add(tag)
    }
    return Array.from(set).sort()
  }, [activeResponses])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === activeResponses.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(activeResponses.map((r) => r.id)))
    }
  }

  const handleApplyTag = async (tagName: string) => {
    if (!tagName.trim() || selectedIds.size === 0) return
    setTagging(true)
    try {
      // For each selected response, merge the new tag with existing tags
      const ids = Array.from(selectedIds)
      const tagsByResponse = new Map<string, string[]>()
      for (const id of ids) {
        const resp = activeResponses.find((r) => r.id === id)
        const existing = resp?.tags ?? []
        const merged = [...new Set([...existing, tagName.trim()])]
        tagsByResponse.set(id, merged)
      }
      // Update each response individually (different tags per response)
      const promises = Array.from(tagsByResponse.entries()).map(([id, tags]) =>
        batchUpdateResponseTags(project.id, [id], tags)
      )
      await Promise.all(promises)
      setTagInput('')
      setSelectedIds(new Set())
      setShowTagBar(false)
      onResponsesChanged()
    } catch (err) {
      console.error(err)
    } finally {
      setTagging(false)
    }
  }

  const handleRemoveTagFromSelected = async (tagName: string) => {
    if (selectedIds.size === 0) return
    setTagging(true)
    try {
      const ids = Array.from(selectedIds)
      const promises = ids.map((id) => {
        const resp = activeResponses.find((r) => r.id === id)
        const remaining = (resp?.tags ?? []).filter((t) => t !== tagName)
        return batchUpdateResponseTags(project.id, [id], remaining)
      })
      await Promise.all(promises)
      setSelectedIds(new Set())
      setShowTagBar(false)
      onResponsesChanged()
    } catch (err) {
      console.error(err)
    } finally {
      setTagging(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDeletion) return
    const responseToDelete = pendingDeletion
    await handleDelete(responseToDelete.id)
    setPendingDeletion(null)
  }

  // Tags of selected responses
  const selectedTags = useMemo(() => {
    const set = new Set<string>()
    for (const id of selectedIds) {
      const resp = activeResponses.find((r) => r.id === id)
      if (resp) for (const tag of resp.tags) set.add(tag)
    }
    return Array.from(set).sort()
  }, [selectedIds, activeResponses])

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

      {/* Tag toolbar */}
      {(selectedIds.size > 0 || showTagBar) && (
        <div className="mb-3 p-3 bg-wash rounded-brand border border-stone flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink">
            {selectedIds.size} sélectionnée{selectedIds.size > 1 ? 's' : ''}
          </span>
          <span className="w-px h-4 bg-stone" />

          {/* Existing tags to apply quickly */}
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => { void handleApplyTag(tag) }}
              disabled={tagging}
              className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer transition-opacity disabled:opacity-50 ${getTagColor(tag, allTags)}`}
              title={`Appliquer "${tag}"`}
            >
              + {tag}
            </button>
          ))}

          {/* New tag input */}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tagInput.trim()) {
                  void handleApplyTag(tagInput)
                }
              }}
              placeholder="Nouveau tag..."
              className="text-xs px-2 py-1 border border-stone rounded-brand bg-white text-ink w-32 focus:outline-none focus:border-flame"
              disabled={tagging}
            />
            {tagInput.trim() && (
              <button
                onClick={() => { void handleApplyTag(tagInput) }}
                disabled={tagging}
                className="text-xs px-2 py-1 bg-flame text-white rounded-brand font-medium cursor-pointer disabled:opacity-50"
              >
                Ajouter
              </button>
            )}
          </div>

          {/* Remove tags from selected */}
          {selectedTags.length > 0 && (
            <>
              <span className="w-px h-4 bg-stone" />
              <span className="text-xs text-taupe">Retirer :</span>
              {selectedTags.map((tag) => (
                <button
                  key={`rm-${tag}`}
                  onClick={() => { void handleRemoveTagFromSelected(tag) }}
                  disabled={tagging}
                  className="text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer bg-slate-100 text-graphite hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  x {tag}
                </button>
              ))}
            </>
          )}

          <button
            onClick={() => { setSelectedIds(new Set()); setShowTagBar(false) }}
            className="ml-auto text-xs text-taupe hover:text-ink cursor-pointer"
          >
            Annuler
          </button>
        </div>
      )}

      {responses.length === 0 ? (
        <p className="text-sm text-taupe py-4">Aucune réponse pour le moment.</p>
      ) : (
        <div className="border border-stone rounded-brand overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="bg-cream border-b border-stone">
                  <th className="px-2 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={activeResponses.length > 0 && selectedIds.size === activeResponses.length}
                      onChange={toggleSelectAll}
                      className="rounded accent-flame cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-taupe uppercase">#</th>
                  {allTags.length > 0 && (
                    <th className="px-3 py-2 text-left text-xs font-medium text-taupe uppercase">Tags</th>
                  )}
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
                  <tr
                    key={row.response.id}
                    className={`hover:bg-cream/50 ${selectedIds.has(row.response.id) ? 'bg-wash/50' : ''}`}
                  >
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.response.id)}
                        onChange={() => toggleSelect(row.response.id)}
                        className="rounded accent-flame cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 text-taupe">{i + 1}</td>
                    {allTags.length > 0 && (
                      <td className="px-3 py-2">
                        <div className="flex gap-1 flex-wrap">
                          {row.response.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getTagColor(tag, allTags)}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                    )}
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
                    <td className="px-2 py-2" />
                    <td className="px-3 py-2 text-taupe line-through">{activeRows.length + i + 1}</td>
                    {allTags.length > 0 && <td className="px-3 py-2" />}
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
