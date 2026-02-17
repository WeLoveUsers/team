export const DOCUMENT_TEMPLATE_PHASES = [
  'Préparation',
  'Passation',
  'Restitution',
] as const

export type DocumentTemplatePhase = (typeof DOCUMENT_TEMPLATE_PHASES)[number]

export const DOCUMENT_TEMPLATE_TYPES = [
  'Google Doc',
  'Google Slide',
  'Google Sheet',
  'Google Form',
] as const

export type DocumentTemplateType = (typeof DOCUMENT_TEMPLATE_TYPES)[number]

export const DOCUMENT_TEMPLATE_PHASE_TO_SLUG: Record<DocumentTemplatePhase, string> = {
  Préparation: 'preparation',
  Passation: 'passation',
  Restitution: 'restitution',
}

export const DOCUMENT_TEMPLATE_SLUG_TO_PHASE: Record<string, DocumentTemplatePhase> = Object.fromEntries(
  Object.entries(DOCUMENT_TEMPLATE_PHASE_TO_SLUG).map(([phase, slug]) => [slug, phase]),
) as Record<string, DocumentTemplatePhase>

export function isDocumentTemplatePhase(value: string): value is DocumentTemplatePhase {
  return DOCUMENT_TEMPLATE_PHASES.includes(value as DocumentTemplatePhase)
}

export function isDocumentTemplateType(value: string): value is DocumentTemplateType {
  return DOCUMENT_TEMPLATE_TYPES.includes(value as DocumentTemplateType)
}
