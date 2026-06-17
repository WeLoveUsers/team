import { useState, useEffect, useMemo } from 'react'
import { createProject, updateProject, type Project, type ProjectPayload } from '../api'
import { computeQuestionnaireId } from './Sidebar'
import { copyToClipboard } from '../lib/clipboard'
import {
  DEFAULT_INSTRUCTIONS,
  MECUE_ALL_SELECTION_KEYS,
  MECUE_SELECTION_GROUPS,
  buildMecueDirective,
  parseMecueSelection,
  stripMecueDirective,
  type MecueSelectionKey,
} from '../questionnaires'

const QUESTIONNAIRE_OPTIONS = [
  { value: 'SUS', label: 'SUS' },
  { value: 'DEEP', label: 'DEEP' },
  { value: 'UMUX', label: 'UMUX' },
  { value: 'UMUX (Lite)', label: 'UMUX (Lite)' },
  { value: 'UEQ', label: 'UEQ' },
  { value: 'UEQ-S', label: 'UEQ-S' },
  { value: 'AttrakDiff', label: 'AttrakDiff' },
  { value: 'AttrakDiff (abrégé)', label: 'AttrakDiff (abrégé)' },
  { value: 'meCUE', label: 'meCUE' },
]

const STATUS_OPTIONS = [
  { value: 'Ouvert', label: 'Ouvert' },
  { value: 'Fermé', label: 'Fermé' },
]

const PRODUCT_TYPE_OPTIONS = [
  { value: 'Site Web', label: 'Site Web' },
  { value: 'Site E-Commerce', label: 'Site E-Commerce' },
  { value: 'Application mobile', label: 'Application mobile' },
  { value: 'Application tablette', label: 'Application tablette' },
  { value: 'Logiciel', label: 'Logiciel' },
  { value: 'Autre', label: 'Autre' },
]

type Props = {
  project: Project | null
  hasResponses: boolean
  existingFolders: string[]
  onSaved: (project: Project) => void
  onCancel?: () => void
}

export function ProjectForm({ project, hasResponses, existingFolders, onSaved, onCancel }: Props) {
  const [name, setName] = useState('')
  const [questionnaireType, setQuestionnaireType] = useState('')
  const [status, setStatus] = useState('Ouvert')
  const [publicToken, setPublicToken] = useState('')
  const [folder, setFolder] = useState('')
  const [productType, setProductType] = useState('')
  const [productName, setProductName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [mecueDims, setMecueDims] = useState<MecueSelectionKey[]>(MECUE_ALL_SELECTION_KEYS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (project) {
      setName(project.name ?? '')
      setQuestionnaireType(project.questionnaireType ?? '')
      setStatus(project.status ?? 'Ouvert')
      setPublicToken(project.publicToken ?? '')
      setFolder(project.folder ?? '')
      setProductType(project.productType ?? '')
      setProductName(project.productName ?? '')
      // Les instructions peuvent contenir la directive meCUE @mecue:... : on l'extrait
      // dans la sélection des dimensions et on n'affiche que le texte « propre ».
      setInstructions(stripMecueDirective(project.instructions ?? ''))
      setMecueDims(parseMecueSelection(project.instructions) ?? MECUE_ALL_SELECTION_KEYS)
    } else {
      setName('')
      setQuestionnaireType('')
      setStatus('Ouvert')
      setPublicToken('')
      setFolder('')
      setProductType('')
      setProductName('')
      setInstructions('')
      setMecueDims(MECUE_ALL_SELECTION_KEYS)
    }
    setError(null)
  }, [project])

  // En mode création, pré-remplir les instructions quand le type de questionnaire change
  useEffect(() => {
    if (project) return // Ne pas écraser les instructions en mode édition
    const qid = computeQuestionnaireId(questionnaireType)
    if (qid && DEFAULT_INSTRUCTIONS[qid]) {
      setInstructions(DEFAULT_INSTRUCTIONS[qid])
    } else {
      setInstructions('')
    }
    if (qid === 'mecue') setMecueDims(MECUE_ALL_SELECTION_KEYS)
  }, [questionnaireType, project])

  const ensureToken = (): string => {
    if (publicToken.trim()) return publicToken.trim()
    let raw: string
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      raw = crypto.randomUUID()
    } else {
      const buf = new Uint8Array(16)
      crypto.getRandomValues(buf)
      raw = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
    }
    const token = raw.replace(/-/g, '').slice(0, 12)
    setPublicToken(token)
    return token
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      if (!name.trim()) throw new Error('Le nom du projet est requis.')
      if (!productType) throw new Error('Le type de produit est requis.')
      if (!productName.trim()) throw new Error('Le nom du produit est requis.')
      if (isMecue && mecueDims.length === 0) {
        throw new Error('Sélectionnez au moins une dimension meCUE à évaluer.')
      }

      // Pour meCUE, on encode la sélection des dimensions dans les instructions
      // via la directive @mecue:... (vide si la sélection est complète).
      let instructionsPayload: string | null = instructions || null
      if (isMecue) {
        const base = stripMecueDirective(instructions)
        const directive = buildMecueDirective(mecueDims)
        instructionsPayload = [base, directive].filter(Boolean).join('\n\n') || null
      }

      const payload: ProjectPayload = {
        name: name.trim(),
        questionnaireType: questionnaireType || null,
        status: status || null,
        publicToken: ensureToken(),
        folder: folder.trim() || null,
        productType: productType || null,
        productName: productName.trim(),
        instructions: instructionsPayload,
      }

      const saved = project
        ? await updateProject(project.id, payload)
        : await createProject(payload)

      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer le projet")
    } finally {
      setSaving(false)
    }
  }

  const publicUrl = publicToken
    ? `${window.location.origin}/p/${publicToken}`
    : null

  const isMecue = computeQuestionnaireId(questionnaireType) === 'mecue'

  const toggleMecueDim = (key: MecueSelectionKey) => {
    setMecueDims((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  // Regroupe les dimensions meCUE sélectionnables par module pour l'affichage.
  const mecueGroupsByModule = useMemo(() => {
    const map = new Map<string, typeof MECUE_SELECTION_GROUPS>()
    for (const group of MECUE_SELECTION_GROUPS) {
      const list = map.get(group.moduleFr) ?? []
      list.push(group)
      map.set(group.moduleFr, list)
    }
    return Array.from(map.entries())
  }, [])

  const folderSuggestions = useMemo(() => {
    return existingFolders.filter((f) => f.trim().length > 0)
  }, [existingFolders])

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="pf-name" className="block text-sm font-medium text-ink mb-1">
          Nom du projet
        </label>
        <input
          id="pf-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="field-input"
          placeholder="Mon projet"
        />
      </div>

      <div>
        <label htmlFor="pf-product-name" className="block text-sm font-medium text-ink mb-1">
          Nom du produit évalué
        </label>
        <input
          id="pf-product-name"
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          required
          className="field-input"
          placeholder="Ex : Google Maps, Mon application..."
        />
        <p className="text-xs text-taupe mt-1">
          Utilisé dans les instructions et remplace <code className="bg-cream px-1 rounded border border-stone text-graphite">@product_name</code>.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="pf-type" className="block text-sm font-medium text-ink mb-1">
            Questionnaire
          </label>
          <select
            id="pf-type"
            value={questionnaireType}
            onChange={(e) => setQuestionnaireType(e.target.value)}
            disabled={hasResponses}
            required
            className="field-select disabled:opacity-60"
          >
            <option value="">Choisir...</option>
            {QUESTIONNAIRE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {hasResponses && (
            <p className="text-xs text-taupe mt-1">Non modifiable (réponses existantes)</p>
          )}
        </div>

        <div>
          <label htmlFor="pf-product-type" className="block text-sm font-medium text-ink mb-1">
            Type de produit
          </label>
          <select
            id="pf-product-type"
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            required
            className="field-select"
          >
            <option value="">Choisir...</option>
            {PRODUCT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {isMecue && (
        <div className="rounded-brand border border-stone bg-cream p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-medium text-ink">Dimensions évaluées</p>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMecueDims(MECUE_ALL_SELECTION_KEYS)}
                className="text-flame hover:text-ink font-medium cursor-pointer transition-colors"
              >
                Tout
              </button>
              <span className="text-stone">·</span>
              <button
                type="button"
                onClick={() => setMecueDims([])}
                className="text-taupe hover:text-ink font-medium cursor-pointer transition-colors"
              >
                Aucune
              </button>
            </div>
          </div>
          <p className="text-xs text-taupe mb-3">
            meCUE est modulaire : ne conservez que les dimensions pertinentes pour cette étude.
            Les répondants ne verront que les items correspondants.
          </p>
          <div className="space-y-3">
            {mecueGroupsByModule.map(([moduleName, groups]) => (
              <div key={moduleName}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-taupe mb-1.5">
                  {moduleName}
                </p>
                <div className="flex flex-wrap gap-2">
                  {groups.map((group) => {
                    const checked = mecueDims.includes(group.key)
                    return (
                      <label
                        key={group.key}
                        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-flame text-white border-flame'
                            : 'bg-white text-graphite border-stone hover:border-flame/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMecueDim(group.key)}
                          className="sr-only"
                        />
                        {group.labelFr}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          {mecueDims.length === 0 && (
            <p className="text-xs text-berry mt-2">Sélectionnez au moins une dimension.</p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="pf-status" className="block text-sm font-medium text-ink mb-1">
          Statut
        </label>
        <select
          id="pf-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          required
          className="field-select"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="pf-folder" className="block text-sm font-medium text-ink mb-1">
          Dossier
        </label>
        <input
          id="pf-folder"
          type="text"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          list="pf-folder-suggestions"
          className="field-input"
          placeholder="Aucun dossier"
        />
        {folderSuggestions.length > 0 && (
          <datalist id="pf-folder-suggestions">
            {folderSuggestions.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        )}
        <p className="text-xs text-taupe mt-1">
          Saisissez un nom de dossier ou choisissez un existant. Laissez vide pour aucun dossier.
        </p>
      </div>

      <div>
        <label htmlFor="pf-instructions" className="block text-sm font-medium text-ink mb-1">
          Instructions aux répondants
        </label>
        <textarea
          id="pf-instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={5}
          className="field-textarea"
          placeholder="Instructions affichées aux répondants en haut du questionnaire..."
        />
        <p className="text-xs text-taupe mt-1">
          <code className="bg-cream px-1 rounded border border-stone text-graphite">@product_name</code> sera remplacé par le nom du produit évalué.
        </p>
        {productName.trim() && instructions.includes('@product_name') && (
          <div className="mt-2 p-3 bg-cream rounded-brand border border-stone">
            <p className="text-xs font-medium text-taupe mb-1">Aperçu pour le répondant :</p>
            <p className="text-sm text-ink whitespace-pre-line">
              {instructions.replace(/@product_name/g, productName.trim())}
            </p>
          </div>
        )}
      </div>

      {publicUrl && (
        <div className="bg-cream rounded-brand border border-stone p-3">
          <p className="text-xs font-medium text-taupe mb-1">URL publique du questionnaire</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-flame bg-wash px-2 py-1 rounded flex-1 truncate">
              {publicUrl}
            </code>
            <button
              type="button"
              onClick={() => {
                copyToClipboard(publicUrl).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                })
              }}
              className="shrink-0 text-xs text-flame hover:text-ink font-medium cursor-pointer transition-colors"
            >
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-berry bg-danger-50 px-3 py-2 rounded-lg">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving ? 'Enregistrement...' : project ? 'Mettre à jour' : 'Créer le projet'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary-sm cursor-pointer"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  )
}
