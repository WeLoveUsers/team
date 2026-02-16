/**
 * Normalise le label Notion « Questionnaire type » en identifiant technique.
 * Utilisé par ProjectForm, ProjectDetail, ResponsesTable, PublicQuestionnairePage.
 */
type QuestionnaireId = 'sus' | 'deep' | 'umux' | 'umux_lite' | 'ueq' | 'ueq_s' | 'attrakdiff' | 'attrakdiff_abridged'

export function computeQuestionnaireId(
  questionnaireType: string | null,
): QuestionnaireId | null {
  if (!questionnaireType) return null
  const raw = questionnaireType.toLowerCase()
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')

  if (normalized.includes('sus')) return 'sus'
  if (normalized.includes('deep')) return 'deep'
  if (normalized.includes('umuxlite'))
    return 'umux_lite'
  if (normalized.includes('umux')) return 'umux'
  if (
    normalized.includes('ueqs')
    || normalized.includes('ueqshort')
    || normalized.includes('userexperiencequestionnaireshort')
  ) return 'ueq_s'
  if (normalized.includes('ueq') || normalized.includes('userexperiencequestionnaire')) return 'ueq'
  if (normalized.includes('abrige') || normalized.includes('abridged'))
    return 'attrakdiff_abridged'
  if (normalized.includes('attrakdiff')) return 'attrakdiff'
  return null
}
