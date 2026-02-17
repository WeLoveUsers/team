import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import type { DocumentTemplate } from '../api'
import {
  ensureDocumentTemplatesLoaded,
  getCachedDocumentTemplates,
  subscribeDocumentTemplates,
} from '../lib/documentTemplatesCache'
import {
  DOCUMENT_TEMPLATE_PHASES,
  DOCUMENT_TEMPLATE_SLUG_TO_PHASE,
  type DocumentTemplatePhase,
} from '../lib/documentTemplates'

function getPhaseFromSlug(slug: string | undefined): DocumentTemplatePhase | null {
  if (!slug) return null
  return DOCUMENT_TEMPLATE_SLUG_TO_PHASE[slug] ?? null
}

export function DocumentTemplatesPage() {
  const { phase: phaseSlug } = useParams<{ phase: string }>()
  const activePhase = getPhaseFromSlug(phaseSlug)

  const initialCachedTemplates = getCachedDocumentTemplates()
  const [templates, setTemplates] = useState<DocumentTemplate[]>(
    () => initialCachedTemplates ?? [],
  )
  const [loading, setLoading] = useState(!initialCachedTemplates)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const cachedTemplates = getCachedDocumentTemplates()

    const unsubscribe = subscribeDocumentTemplates((nextTemplates) => {
      if (!active) return
      setTemplates(nextTemplates ?? [])
      setLoading(false)
    })

    if (!cachedTemplates) {
      ensureDocumentTemplatesLoaded()
        .then((nextTemplates) => {
          if (!active) return
          setTemplates(nextTemplates)
          setLoading(false)
          setError(null)
        })
        .catch((err) => {
          if (!active) return
          setError(err instanceof Error ? err.message : 'Impossible de charger les modèles')
          setLoading(false)
        })
    }

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const templatesByPhase = useMemo(() => {
    const grouped = new Map<DocumentTemplatePhase, DocumentTemplate[]>()
    for (const phase of DOCUMENT_TEMPLATE_PHASES) {
      grouped.set(phase, [])
    }
    for (const template of templates) {
      grouped.get(template.phase)?.push(template)
    }
    return grouped
  }, [templates])

  if (!activePhase) {
    return <Navigate to="/modeles-documents/preparation" replace />
  }

  const phaseTemplates = templatesByPhase.get(activePhase) ?? []

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10">
      <header className="border-b border-stone pb-10">
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-flame">Ressources</p>
        <h1 className="mb-5 font-serif text-5xl text-ink md:text-6xl">Modèles de documents</h1>
        <p className="max-w-3xl text-lg font-light text-graphite md:text-xl">
          Bibliothèque centralisée des modèles Google Drive par phase de mission.
        </p>
      </header>

      <section className="rounded-brand border border-stone bg-white p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl text-ink">{activePhase}</h2>
          <span className="text-xs font-medium uppercase tracking-wide text-taupe">
            {phaseTemplates.length} document(s)
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-graphite">Chargement...</p>
        ) : error ? (
          <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-berry">{error}</p>
        ) : phaseTemplates.length === 0 ? (
          <p className="text-sm text-graphite">Aucun document pour cette phase.</p>
        ) : (
          <ul className="space-y-2">
            {phaseTemplates.map((template) => (
              <li
                key={template.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone px-3 py-2"
              >
                <a
                  href={template.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-flame hover:underline"
                >
                  {template.name}
                </a>
                <span className="text-xs uppercase tracking-wide text-taupe">{template.type}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
