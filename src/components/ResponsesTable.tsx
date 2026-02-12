import { useState } from 'react'
import type { Project, ProjectResponse } from '../api'
import { deleteResponse, recoverResponse } from '../api'
import { computeQuestionnaireId } from './Sidebar'
import {
  computeSusScore, susGrade,
  computeUmuxScore,
  computeUmuxLiteScore,
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

function getScore(qType: string | null, answers: Answers): { score: number; label?: string } | null {
  const qid = computeQuestionnaireId(qType)
  if (!qid) return null

  switch (qid) {
    case 'sus': {
      const s = computeSusScore(answers)
      return { score: Math.round(s * 100) / 100, label: susGrade(s) }
    }
    case 'umux': {
      const s = computeUmuxScore(answers)
      return { score: Math.round(s * 100) / 100 }
    }
    case 'umux_lite': {
      const s = computeUmuxLiteScore(answers)
      return { score: Math.round(s * 100) / 100 }
    }
    default:
      return null
  }
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

  const activeResponses = responses.filter((r) => !r.archived)
  const archivedResponses = responses.filter((r) => r.archived)

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Réponses
        </h3>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          {activeResponses.length} active{activeResponses.length > 1 ? 's' : ''}
        </span>
      </div>

      {responses.length === 0 ? (
        <p className="text-sm text-slate-400 py-4">Aucune réponse pour le moment.</p>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Score</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Note</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeResponses.map((r, i) => {
                const payload = parsePayload(r)
                const scoreInfo = payload?.answers ? getScore(project.questionnaireType, payload.answers) : null

                return (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {scoreInfo ? scoreInfo.score.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {scoreInfo?.label ? (
                        <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded ${GRADE_COLORS[scoreInfo.label] ?? 'bg-slate-100 text-slate-600'}`}>
                          {scoreInfo.label}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-500 text-xs">
                      {new Date(r.createdTime).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={loadingId === r.id}
                        className="text-xs text-danger-600 hover:text-danger-700 font-medium cursor-pointer disabled:opacity-50"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                )
              })}

              {archivedResponses.map((r, i) => (
                <tr key={r.id} className="bg-slate-50/30 opacity-50">
                  <td className="px-3 py-2 text-slate-400 line-through">{activeResponses.length + i + 1}</td>
                  <td className="px-3 py-2 text-slate-400 line-through" colSpan={2}>Supprimée</td>
                  <td className="px-3 py-2 text-slate-400 text-xs line-through">
                    {new Date(r.createdTime).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleRecover(r.id)}
                      disabled={loadingId === r.id}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium cursor-pointer disabled:opacity-50"
                    >
                      Récupérer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
