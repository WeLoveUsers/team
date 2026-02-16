import { useEffect, useMemo, useState, type FormEvent } from 'react'

type TemplateCategory =
  | 'Cadrage'
  | 'Terrain'
  | 'Analyse'
  | 'Restitution'
  | 'Opérationnel'

type TemplateLink = {
  id: string
  title: string
  url: string
  category: TemplateCategory
}

const STORAGE_KEY = 'team_document_templates'

const CATEGORIES: TemplateCategory[] = [
  'Cadrage',
  'Terrain',
  'Analyse',
  'Restitution',
  'Opérationnel',
]

const CATEGORY_ID: Record<TemplateCategory, string> = {
  Cadrage: 'cadrage',
  Terrain: 'terrain',
  Analyse: 'analyse',
  Restitution: 'restitution',
  Opérationnel: 'operationnel',
}

function isTemplateCategory(value: string): value is TemplateCategory {
  return CATEGORIES.includes(value as TemplateCategory)
}

function readStoredLinks(): TemplateLink[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is TemplateLink => (
      typeof item?.id === 'string'
      && typeof item?.title === 'string'
      && typeof item?.url === 'string'
      && typeof item?.category === 'string'
      && isTemplateCategory(item.category)
    ))
  } catch {
    return []
  }
}

export function DocumentTemplatesPage() {
  const [links, setLinks] = useState<TemplateLink[]>(() => readStoredLinks())
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState<TemplateCategory>('Cadrage')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(links))
  }, [links])

  const grouped = useMemo(() => {
    return CATEGORIES.map((cat) => ({
      category: cat,
      links: links.filter((link) => link.category === cat),
    }))
  }, [links])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Le titre du document est requis.')
      return
    }

    let normalizedUrl: string
    try {
      normalizedUrl = new URL(url.trim()).toString()
    } catch {
      setError('Le lien doit être une URL valide (ex: https://drive.google.com/...).')
      return
    }

    const next: TemplateLink = {
      id: crypto.randomUUID(),
      title: title.trim(),
      url: normalizedUrl,
      category,
    }
    setLinks((prev) => [next, ...prev])
    setTitle('')
    setUrl('')
  }

  const removeLink = (id: string) => {
    setLinks((prev) => prev.filter((link) => link.id !== id))
  }

  return (
    <div className="space-y-10">
      <header className="border-b border-stone pb-10">
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-flame">Ressources</p>
        <h1 className="mb-5 font-serif text-5xl text-ink md:text-6xl">Modèles de documents</h1>
        <p className="max-w-3xl text-lg font-light text-graphite md:text-xl">
          Espace pour centraliser vos modèles Google Drive (guides d&apos;entretien, plans, grilles
          d&apos;analyse, decks, etc.).
        </p>
      </header>

      <section className="rounded-brand border border-stone bg-white p-6">
        <h2 className="mb-4 font-serif text-2xl text-ink">Ajouter un lien</h2>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="tpl-title" className="mb-1 block text-sm font-medium text-ink">
              Nom du document
            </label>
            <input
              id="tpl-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="field-input"
              placeholder="Ex : Guide d'entretien découverte"
              required
            />
          </div>

          <div>
            <label htmlFor="tpl-category" className="mb-1 block text-sm font-medium text-ink">
              Catégorie
            </label>
            <select
              id="tpl-category"
              value={category}
              onChange={(e) => {
                if (isTemplateCategory(e.target.value)) {
                  setCategory(e.target.value)
                }
              }}
              className="field-select"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label htmlFor="tpl-url" className="mb-1 block text-sm font-medium text-ink">
              URL Google Drive
            </label>
            <input
              id="tpl-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="field-input"
              placeholder="https://drive.google.com/..."
              required
            />
          </div>

          {error && (
            <div className="md:col-span-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
              {error}
            </div>
          )}

          <div className="md:col-span-4">
            <button type="submit" className="btn-primary-sm">Ajouter</button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        {grouped.map((group) => (
          <article
            key={group.category}
            id={CATEGORY_ID[group.category]}
            className="rounded-brand border border-stone bg-white p-6 scroll-mt-28"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-serif text-2xl text-ink">{group.category}</h3>
              <span className="text-xs font-medium uppercase tracking-wide text-taupe">
                {group.links.length} lien(s)
              </span>
            </div>

            {group.links.length === 0 ? (
              <p className="text-sm text-graphite">Aucun document pour cette catégorie.</p>
            ) : (
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li
                    key={link.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone px-3 py-2"
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-flame hover:underline"
                    >
                      {link.title}
                    </a>
                    <button
                      type="button"
                      onClick={() => removeLink(link.id)}
                      className="text-xs text-graphite hover:text-berry"
                    >
                      Supprimer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </section>
    </div>
  )
}
