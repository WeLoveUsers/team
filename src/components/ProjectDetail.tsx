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
  computeSusStats,
  computeDeepStats,
  computeUmuxStats,
  computeUmuxLiteStats,
  computeUeqStats,
  computeUeqSStats,
  computeAttrakDiffStats,
  computeWordPairAverages,
  type Answers,
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

function exportCsv(project: Project, responses: ProjectResponse[]) {
  const qid = computeQuestionnaireId(project.questionnaireType)
  if (!qid) return

  const rows: string[][] = []
  const activeResponses = responses.filter((r) => !r.archived)

  for (const r of activeResponses) {
    const payload = parsePayload(r)
    if (!payload?.answers) continue

    if (rows.length === 0) {
      const header = ['Date', ...Object.keys(payload.answers)]
      rows.push(header)
    }

    const date = new Date(r.createdTime).toLocaleString('fr-FR')
    const values = Object.values(payload.answers).map((v) => String(v ?? ''))
    rows.push([date, ...values])
  }

  if (rows.length === 0) return

  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'export'}_reponses.csv`
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

  // Si contrôlé par le parent, on utilise ses props ; sinon fallback interne
  const activeTab = controlledTab ?? internalTab
  const setActiveTab = onTabChange ?? setInternalTab
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [copied, setCopied] = useState(false)

  const qid = computeQuestionnaireId(project.questionnaireType)
  const questionnaire = qid ? getQuestionnaireById(qid) : null
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
          <h2 className="text-xl font-bold text-slate-900">{project.name || '(Sans titre)'}</h2>
          {activeResponses.length > 0 && (
            <button
              onClick={() => exportCsv(project, responses)}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium cursor-pointer flex items-center gap-1 shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exporter CSV
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
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
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
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              {project.questionnaireType}
            </span>
          )}

          {/* Séparateur */}
          {publicUrl && (
            <span className="w-px h-4 bg-slate-200" />
          )}

          {/* Public URL + copy */}
          {publicUrl && (
            <div className="inline-flex items-center gap-1.5 min-w-0">
              <code className="text-[11px] text-slate-400 truncate max-w-[280px]">
                {publicUrl}
              </code>
              <button
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium cursor-pointer shrink-0"
              >
                {copied ? (
                  <>
                    <svg className="w-3 h-3 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-success-600">Copié</span>
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
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
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
            <p className="text-sm text-slate-400 py-8">Chargement des résultats...</p>
          ) : !stats?.data ? (
            <div className="text-center py-12">
              <p className="text-sm text-slate-400">
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
            <p className="text-sm text-slate-400 py-8">Chargement des réponses...</p>
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

          <div className="mt-8 pt-6 border-t border-slate-200">
            <button
              onClick={() => setShowDeleteModal(true)}
              className="text-sm text-danger-600 hover:text-danger-700 font-medium cursor-pointer"
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
