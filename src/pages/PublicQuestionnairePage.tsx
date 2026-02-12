import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getQuestionnaireById,
  type QuestionnaireDefinition,
  type QuestionnaireQuestion,
  type LikertQuestion,
  type BipolarQuestion,
} from '../questionnaires'
import { submitPublicResponse, fetchProjectStatus, type PublicAnswers } from '../api'

type Answers = Record<string, number | null>

/**
 * Correspondance entre la valeur du select "Product type" et le texte
 * affiché dans les questions (avec article / déterminant).
 */
const PRODUCT_TYPE_LABELS: Record<string, string> = {
  'Site Web': 'ce site web',
  'Site E-Commerce': 'ce site e-commerce',
  'Application mobile': 'cette application mobile',
  'Application tablette': 'cette application tablette',
  'Logiciel': 'ce logiciel',
  'Autre': 'ce produit',
}

function resolveProductType(productType: string | null): string {
  if (!productType) return 'ce produit'
  return PRODUCT_TYPE_LABELS[productType] ?? 'ce produit'
}

/**
 * Remplace toutes les occurrences de @product_type dans les textes des questions.
 */
function replaceProductType(
  questions: QuestionnaireQuestion[],
  label: string,
): QuestionnaireQuestion[] {
  return questions.map((q) => {
    if (q.type === 'likert') {
      return { ...q, textFr: q.textFr.replace(/@product_type/g, label) }
    }
    // bipolar : pas de @product_type en principe, mais au cas où
    return {
      ...q,
      leftFr: q.leftFr.replace(/@product_type/g, label),
      rightFr: q.rightFr.replace(/@product_type/g, label),
    }
  })
}

function LikertQuestionView({
  q,
  index,
  value,
  onChange,
  showError,
}: {
  q: LikertQuestion
  index: number
  value: number | null
  onChange: (v: number) => void
  showError: boolean
}) {
  return (
    <div className={`py-5 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
      <p className={`text-sm font-medium mb-3 ${showError && value === null ? 'text-danger-600' : 'text-slate-800'}`}>
        <span className="text-slate-400 mr-2">{index + 1}.</span>
        {q.textFr}
      </p>
      <div className="flex flex-wrap gap-2">
        {q.scale.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-all cursor-pointer ${
              value === opt.value
                ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-300 hover:border-primary-300 hover:bg-primary-50'
            }`}
          >
            {opt.labelFr}
          </button>
        ))}
      </div>
      {showError && value === null && (
        <p className="text-xs text-danger-500 mt-1.5">Veuillez répondre à cette question.</p>
      )}
    </div>
  )
}

function DeepLikertQuestionView({
  q,
  index,
  value,
  onChange,
  showError,
}: {
  q: LikertQuestion
  index: number
  value: number | null
  onChange: (v: number) => void
  showError: boolean
}) {
  return (
    <div className={`py-5 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
      <p className={`text-sm font-medium mb-3 ${showError && value === null ? 'text-danger-600' : 'text-slate-800'}`}>
        <span className="text-slate-400 mr-2">{index + 1}.</span>
        {q.textFr}
      </p>
      <div className="flex flex-wrap gap-2">
        {q.scale.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-all cursor-pointer ${
              value === opt.value
                ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-300 hover:border-primary-300 hover:bg-primary-50'
            }`}
          >
            {opt.labelFr}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(0)}
          className={`px-3 py-1.5 text-xs rounded-full border transition-all cursor-pointer ${
            value === 0
              ? 'bg-slate-600 text-white border-slate-600 shadow-sm'
              : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          Non applicable
        </button>
      </div>
      {showError && value === null && (
        <p className="text-xs text-danger-500 mt-1.5">Veuillez répondre à cette question.</p>
      )}
    </div>
  )
}

function BipolarQuestionView({
  q,
  index,
  value,
  onChange,
  showError,
}: {
  q: BipolarQuestion
  index: number
  value: number | null
  onChange: (v: number) => void
  showError: boolean
}) {
  return (
    <div className={`py-5 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-medium ${showError && value === null ? 'text-danger-600' : 'text-slate-600'}`}>
          {q.leftFr}
        </span>
        <span className={`text-sm font-medium text-right ${showError && value === null ? 'text-danger-600' : 'text-slate-600'}`}>
          {q.rightFr}
        </span>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        {q.scaleValues.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`w-9 h-9 rounded-full border-2 text-xs font-medium transition-all cursor-pointer flex items-center justify-center ${
              value === v
                ? 'bg-primary-600 text-white border-primary-600 shadow-sm scale-110'
                : 'bg-white text-slate-500 border-slate-300 hover:border-primary-300 hover:bg-primary-50'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      {showError && value === null && (
        <p className="text-xs text-danger-500 mt-1.5 text-center">Veuillez répondre à cette question.</p>
      )}
    </div>
  )
}

export function PublicQuestionnairePage() {
  const params = useParams()
  const questionnaireId = (params.questionnaireId as QuestionnaireDefinition['id']) ?? 'sus'
  const projectToken = params.projectToken as string | undefined

  const questionnaire = useMemo(() => getQuestionnaireById(questionnaireId), [questionnaireId])

  const [answers, setAnswers] = useState<Answers>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showValidation, setShowValidation] = useState(false)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [productType, setProductType] = useState<string | null>(null)
  const [productName, setProductName] = useState<string | null>(null)
  const [projectInstructions, setProjectInstructions] = useState<string | null>(null)
  const [projectClosed, setProjectClosed] = useState(false)
  const [statusLoading, setStatusLoading] = useState(!!projectToken)

  // Check project status
  useEffect(() => {
    if (!projectToken) return
    let cancelled = false
    const check = async () => {
      try {
        const info = await fetchProjectStatus(projectToken)
        if (cancelled) return
        setProjectName(info.name)
        setProductType(info.productType)
        setProductName(info.productName)
        setProjectInstructions(info.instructions)
        if (info.status === 'Fermé') setProjectClosed(true)
      } catch {
        // Continue anyway
      } finally {
        if (!cancelled) setStatusLoading(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [projectToken])

  // Questions avec @product_type remplacé
  const resolvedQuestions = useMemo(() => {
    if (!questionnaire) return []
    const label = resolveProductType(productType)
    return replaceProductType(questionnaire.questions, label)
  }, [questionnaire, productType])

  // Instructions avec @product_name remplacé par le nom du produit évalué
  const resolvedInstructions = useMemo(() => {
    if (!projectInstructions) return null
    const name = productName || ''
    return projectInstructions.replace(/@product_name/g, name)
  }, [projectInstructions, productName])

  if (!questionnaire) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center max-w-sm">
          <p className="text-slate-600">Questionnaire introuvable.</p>
        </div>
      </div>
    )
  }

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="inline-block w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (projectClosed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center max-w-sm">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Questionnaire fermé</h2>
          <p className="text-sm text-slate-500">Ce questionnaire n'est plus disponible.</p>
        </div>
      </div>
    )
  }

  const totalQuestions = resolvedQuestions.length
  const answeredCount = resolvedQuestions.filter((q) => answers[q.id] != null).length
  const allAnswered = answeredCount === totalQuestions

  const handleSetAnswer = (id: string, v: number) => {
    setAnswers((prev) => ({ ...prev, [id]: v }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!allAnswered) {
      setShowValidation(true)
      // Scroll to first unanswered
      const firstUnanswered = resolvedQuestions.find((q) => answers[q.id] == null)
      if (firstUnanswered) {
        const el = document.getElementById(`q-${firstUnanswered.id}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    if (!projectToken) {
      setError('Ce lien de questionnaire est incomplet (token manquant).')
      return
    }

    try {
      setSubmitting(true)
      await submitPublicResponse({
        projectToken,
        questionnaireId,
        answers: answers as PublicAnswers,
      })
      setSubmitted(true)
    } catch (err) {
      if (err instanceof Error && err.message === 'CLOSED') {
        setProjectClosed(true)
      } else {
        setError(err instanceof Error ? err.message : "Une erreur est survenue lors de l'enregistrement.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center max-w-sm">
          <div className="w-14 h-14 bg-success-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Merci pour votre participation</h2>
          <p className="text-sm text-slate-500">Vos réponses ont été enregistrées avec succès.</p>
        </div>
      </div>
    )
  }

  const isDeep = questionnaireId === 'deep'

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h1 className="text-lg font-bold text-slate-900">{questionnaire.nameFr}</h1>
          {projectName && (
            <p className="text-sm text-primary-600 font-medium mt-1">{projectName}</p>
          )}
          {resolvedInstructions ? (
            <div className="text-sm text-slate-600 mt-2 whitespace-pre-line">
              {resolvedInstructions}
            </div>
          ) : (
            <div
              className="text-sm text-slate-600 mt-2 [&_strong]:font-semibold [&_em]:italic"
              dangerouslySetInnerHTML={{ __html: questionnaire.descriptionHtmlFr }}
            />
          )}
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Progression</span>
            <span className="text-xs font-medium text-slate-700">
              {answeredCount} / {totalQuestions}
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Questions */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {resolvedQuestions.map((q, i) => (
            <div key={q.id} id={`q-${q.id}`}>
              {q.type === 'likert' && !isDeep && (
                <LikertQuestionView
                  q={q}
                  index={i}
                  value={answers[q.id] ?? null}
                  onChange={(v) => handleSetAnswer(q.id, v)}
                  showError={showValidation}
                />
              )}
              {q.type === 'likert' && isDeep && (
                <DeepLikertQuestionView
                  q={q as LikertQuestion}
                  index={i}
                  value={answers[q.id] ?? null}
                  onChange={(v) => handleSetAnswer(q.id, v)}
                  showError={showValidation}
                />
              )}
              {q.type === 'bipolar' && (
                <BipolarQuestionView
                  q={q}
                  index={i}
                  value={answers[q.id] ?? null}
                  onChange={(v) => handleSetAnswer(q.id, v)}
                  showError={showValidation}
                />
              )}
            </div>
          ))}

          {error && (
            <div className="text-sm text-danger-600 bg-danger-50 px-3 py-2 rounded-lg mt-4">{error}</div>
          )}

          {showValidation && !allAnswered && (
            <div className="text-sm text-warning-600 bg-warning-50 px-3 py-2 rounded-lg mt-4">
              Veuillez répondre à toutes les questions avant d'envoyer.
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? 'Envoi en cours...' : 'Envoyer mes réponses'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
