import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createAdminUser,
  createDocumentTemplate,
  deleteAdminUser,
  deleteDocumentTemplate,
  fetchAdminUsers,
  type AuthRole,
  type AuthUser,
  type DocumentTemplate,
  type DocumentTemplatePhase,
  type DocumentTemplateType,
  updateAdminUser,
} from '../api'
import {
  ensureDocumentTemplatesLoaded,
  getCachedDocumentTemplates,
  setCachedDocumentTemplates,
  subscribeDocumentTemplates,
} from '../lib/documentTemplatesCache'
import { DOCUMENT_TEMPLATE_PHASES, DOCUMENT_TEMPLATE_TYPES } from '../lib/documentTemplates'
import { DeleteConfirmModal } from '../components/DeleteConfirmModal'

function defaultExpiryDateInput(): string {
  const oneYearLater = new Date()
  oneYearLater.setUTCFullYear(oneYearLater.getUTCFullYear() + 1)
  return oneYearLater.toISOString().slice(0, 10)
}

function toEndOfDayIso(dateInput: string): string {
  return new Date(`${dateInput}T23:59:59.999Z`).toISOString()
}

function plusOneYearIso(fromIso: string): string {
  const parsed = Date.parse(fromIso)
  const source = Number.isNaN(parsed) || parsed < Date.now() ? new Date() : new Date(parsed)
  source.setUTCFullYear(source.getUTCFullYear() + 1)
  source.setUTCHours(23, 59, 59, 999)
  return source.toISOString()
}

function formatDate(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return 'Date invalide'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(parsed)
}

function compareTemplates(a: DocumentTemplate, b: DocumentTemplate): number {
  if (a.phase !== b.phase) return a.phase.localeCompare(b.phase, 'fr')
  return a.name.localeCompare(b.name, 'fr')
}

export function AdministrationPage() {
  const [accounts, setAccounts] = useState<AuthUser[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [accountBusyUserId, setAccountBusyUserId] = useState<string | null>(null)
  const [pendingUserDeletion, setPendingUserDeletion] = useState<AuthUser | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<AuthRole>('team')
  const [expiresAtDate, setExpiresAtDate] = useState(defaultExpiryDateInput())
  const [submitAccountLoading, setSubmitAccountLoading] = useState(false)

  const initialCachedTemplates = getCachedDocumentTemplates()
  const [templates, setTemplates] = useState<DocumentTemplate[]>(
    () => initialCachedTemplates ?? [],
  )
  const [templatesLoading, setTemplatesLoading] = useState(!initialCachedTemplates)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [templateBusyId, setTemplateBusyId] = useState<string | null>(null)
  const [pendingTemplateDeletion, setPendingTemplateDeletion] = useState<DocumentTemplate | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateUrl, setTemplateUrl] = useState('')
  const [templatePhase, setTemplatePhase] = useState<DocumentTemplatePhase>('Préparation')
  const [templateType, setTemplateType] = useState<DocumentTemplateType>('Google Doc')
  const [templateSubmitLoading, setTemplateSubmitLoading] = useState(false)

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.email.localeCompare(b.email, 'fr')),
    [accounts],
  )

  const sortedTemplates = useMemo(
    () => [...templates].sort(compareTemplates),
    [templates],
  )

  const groupedTemplates = useMemo(
    () => DOCUMENT_TEMPLATE_PHASES.map((phase) => ({
      phase,
      templates: sortedTemplates.filter((template) => template.phase === phase),
    })),
    [sortedTemplates],
  )

  const loadUsers = async () => {
    setAccountsLoading(true)
    setAccountError(null)
    try {
      const users = await fetchAdminUsers()
      setAccounts(users)
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Impossible de charger les utilisateurs')
    } finally {
      setAccountsLoading(false)
    }
  }

  useEffect(() => {
    loadUsers().catch((err) => {
      console.error('Failed to load users:', err)
    })
  }, [])

  useEffect(() => {
    let active = true

    const cachedTemplates = getCachedDocumentTemplates()
    if (cachedTemplates) {
      setTemplates(cachedTemplates)
      setTemplatesLoading(false)
    } else {
      setTemplatesLoading(true)
    }

    const unsubscribe = subscribeDocumentTemplates((nextTemplates) => {
      if (!active) return
      setTemplates(nextTemplates ?? [])
      setTemplatesLoading(false)
    })

    if (!cachedTemplates) {
      ensureDocumentTemplatesLoaded().catch((err) => {
        if (!active) return
        setTemplateError(err instanceof Error ? err.message : 'Impossible de charger les modèles')
        setTemplatesLoading(false)
      })
    }

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const handleUserSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAccountError(null)

    if (!name.trim()) {
      setAccountError('Le nom est requis.')
      return
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail.includes('@')) {
      setAccountError("L'email semble invalide.")
      return
    }

    if (password.trim().length < 8) {
      setAccountError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    if (!expiresAtDate) {
      setAccountError("La date d'expiration est requise.")
      return
    }

    setSubmitAccountLoading(true)
    try {
      const created = await createAdminUser({
        name: name.trim(),
        email: normalizedEmail,
        password,
        role,
        status: 'active',
        expiresAt: toEndOfDayIso(expiresAtDate),
      })
      setAccounts((prev) => [created, ...prev])
      setName('')
      setEmail('')
      setPassword('')
      setRole('team')
      setExpiresAtDate(defaultExpiryDateInput())
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Impossible de créer le compte')
    } finally {
      setSubmitAccountLoading(false)
    }
  }

  const toggleUserStatus = async (account: AuthUser) => {
    setAccountBusyUserId(account.id)
    setAccountError(null)
    try {
      const updated = await updateAdminUser(account.id, {
        status: account.status === 'active' ? 'suspended' : 'active',
      })
      setAccounts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Impossible de changer le statut')
    } finally {
      setAccountBusyUserId(null)
    }
  }

  const renewUserOneYear = async (account: AuthUser) => {
    setAccountBusyUserId(account.id)
    setAccountError(null)
    try {
      const updated = await updateAdminUser(account.id, {
        expiresAt: plusOneYearIso(account.expiresAt),
      })
      setAccounts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Impossible de prolonger le compte')
    } finally {
      setAccountBusyUserId(null)
    }
  }

  const removeUser = async (account: AuthUser) => {
    setAccountBusyUserId(account.id)
    setAccountError(null)
    try {
      await deleteAdminUser(account.id)
      setAccounts((prev) => prev.filter((item) => item.id !== account.id))
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Impossible de supprimer le compte')
    } finally {
      setAccountBusyUserId(null)
    }
  }

  const handleTemplateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setTemplateError(null)

    if (!templateName.trim()) {
      setTemplateError('Le nom du document est requis.')
      return
    }

    let normalizedUrl: string
    try {
      normalizedUrl = new URL(templateUrl.trim()).toString()
    } catch {
      setTemplateError('Le lien doit être une URL valide (ex: https://drive.google.com/...).')
      return
    }

    setTemplateSubmitLoading(true)
    try {
      const created = await createDocumentTemplate({
        name: templateName.trim(),
        url: normalizedUrl,
        phase: templatePhase,
        type: templateType,
      })
      const nextTemplates = [created, ...(getCachedDocumentTemplates() ?? templates)]
      setCachedDocumentTemplates(nextTemplates)
      setTemplateName('')
      setTemplateUrl('')
      setTemplatePhase('Préparation')
      setTemplateType('Google Doc')
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'Impossible de créer le modèle')
    } finally {
      setTemplateSubmitLoading(false)
    }
  }

  const removeTemplate = async (template: DocumentTemplate) => {
    setTemplateBusyId(template.id)
    setTemplateError(null)
    try {
      await deleteDocumentTemplate(template.id)
      const current = getCachedDocumentTemplates() ?? templates
      setCachedDocumentTemplates(current.filter((item) => item.id !== template.id))
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'Impossible de supprimer le modèle')
    } finally {
      setTemplateBusyId(null)
    }
  }

  const confirmRemoveUser = async () => {
    if (!pendingUserDeletion) return
    const nextUser = pendingUserDeletion
    await removeUser(nextUser)
    setPendingUserDeletion(null)
  }

  const confirmRemoveTemplate = async () => {
    if (!pendingTemplateDeletion) return
    const nextTemplate = pendingTemplateDeletion
    await removeTemplate(nextTemplate)
    setPendingTemplateDeletion(null)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10">
      <header className="border-b border-stone pb-10">
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-flame">Administration</p>
        <h1 className="mb-5 font-serif text-5xl text-ink md:text-6xl">Gestion des accès</h1>
        <p className="max-w-3xl text-lg font-light text-graphite md:text-xl">
          Gestion des utilisateurs Team et des modèles de documents.
        </p>
      </header>

      <section className="rounded-brand border border-stone bg-white p-6">
        <h2 className="mb-4 font-serif text-2xl text-ink">Ajouter un compte</h2>
        <form onSubmit={handleUserSubmit} className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="admin-name" className="mb-1 block text-sm font-medium text-ink">
              Nom
            </label>
            <input
              id="admin-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field-input"
              placeholder="Prénom Nom"
              required
            />
          </div>

          <div>
            <label htmlFor="admin-email" className="mb-1 block text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input"
              placeholder="nom@weloveusers.com"
              required
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-1 block text-sm font-medium text-ink">
              Mot de passe
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
              placeholder="Minimum 8 caractères"
              required
            />
          </div>

          <div>
            <label htmlFor="admin-role" className="mb-1 block text-sm font-medium text-ink">
              Rôle
            </label>
            <select
              id="admin-role"
              value={role}
              onChange={(e) => {
                const nextRole = e.target.value === 'admin' ? 'admin' : 'team'
                setRole(nextRole)
              }}
              className="field-select"
            >
              <option value="team">team</option>
              <option value="admin">admin</option>
            </select>
          </div>

          <div>
            <label htmlFor="admin-expiry" className="mb-1 block text-sm font-medium text-ink">
              Expiration
            </label>
            <input
              id="admin-expiry"
              type="date"
              value={expiresAtDate}
              onChange={(e) => setExpiresAtDate(e.target.value)}
              className="field-input"
              required
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={submitAccountLoading}
              className="btn-primary-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitAccountLoading ? 'Création...' : 'Ajouter le compte'}
            </button>
          </div>

          {accountError && (
            <div className="md:col-span-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-berry">
              {accountError}
            </div>
          )}
        </form>
      </section>

      <section className="rounded-brand border border-stone bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl text-ink">Comptes enregistrés</h2>
          <span className="text-xs font-medium uppercase tracking-wide text-taupe">
            {accounts.length} compte(s)
          </span>
        </div>

        {accountsLoading ? (
          <p className="text-sm text-graphite">Chargement...</p>
        ) : sortedAccounts.length === 0 ? (
          <p className="text-sm text-graphite">Aucun compte ajouté pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {sortedAccounts.map((account) => {
              const isBusy = accountBusyUserId === account.id
              const expired = Date.parse(account.expiresAt) <= Date.now()
              return (
                <li
                  key={account.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone px-3 py-2"
                >
                  <div className="min-w-[220px]">
                    <p className="text-sm font-medium text-ink">{account.name}</p>
                    <p className="text-xs text-graphite">{account.email}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase text-taupe">{account.role}</span>
                    <span className={`badge-severity ${account.status === 'active' ? 'badge-severity-sage' : 'badge-severity-flame'}`}>
                      {account.status === 'active' ? 'Actif' : 'Suspendu'}
                    </span>
                    {expired && (
                      <span className="badge-severity badge-severity-flame">Expiré</span>
                    )}
                  </div>

                  <div className="min-w-[180px] text-xs text-graphite">
                    Expire le {formatDate(account.expiresAt)}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => renewUserOneYear(account)}
                      disabled={isBusy}
                      className="text-xs text-flame hover:underline disabled:opacity-70"
                    >
                      Prolonger +1 an
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleUserStatus(account)}
                      disabled={isBusy}
                      className="text-xs text-flame hover:underline disabled:opacity-70"
                    >
                      {account.status === 'active' ? 'Suspendre' : 'Réactiver'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingUserDeletion(account)}
                      disabled={isBusy}
                      className="text-xs text-graphite hover:text-berry disabled:opacity-70"
                    >
                      Supprimer
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-brand border border-stone bg-white p-6">
        <h2 className="mb-4 font-serif text-2xl text-ink">Ajouter un modèle de document</h2>
        <form onSubmit={handleTemplateSubmit} className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="tpl-name" className="mb-1 block text-sm font-medium text-ink">
              Nom
            </label>
            <input
              id="tpl-name"
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="field-input"
              placeholder="Ex : Guide d'entretien découverte"
              required
            />
          </div>

          <div>
            <label htmlFor="tpl-phase" className="mb-1 block text-sm font-medium text-ink">
              Phase
            </label>
            <select
              id="tpl-phase"
              value={templatePhase}
              onChange={(e) => setTemplatePhase(e.target.value as DocumentTemplatePhase)}
              className="field-select"
            >
              {DOCUMENT_TEMPLATE_PHASES.map((phase) => (
                <option key={phase} value={phase}>{phase}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tpl-type" className="mb-1 block text-sm font-medium text-ink">
              Type
            </label>
            <select
              id="tpl-type"
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value as DocumentTemplateType)}
              className="field-select"
            >
              {DOCUMENT_TEMPLATE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label htmlFor="tpl-url" className="mb-1 block text-sm font-medium text-ink">
              URL
            </label>
            <input
              id="tpl-url"
              type="url"
              value={templateUrl}
              onChange={(e) => setTemplateUrl(e.target.value)}
              className="field-input"
              placeholder="https://..."
              required
            />
          </div>

          <div className="md:col-span-4">
            <button
              type="submit"
              disabled={templateSubmitLoading}
              className="btn-primary-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              {templateSubmitLoading ? 'Ajout...' : 'Ajouter le modèle'}
            </button>
          </div>

          {templateError && (
            <div className="md:col-span-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-berry">
              {templateError}
            </div>
          )}
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl text-ink">Modèles enregistrés</h2>
          <span className="text-xs font-medium uppercase tracking-wide text-taupe">
            {templates.length} modèle(s)
          </span>
        </div>

        {templatesLoading ? (
          <p className="rounded-brand border border-stone bg-white p-4 text-sm text-graphite">
            Chargement...
          </p>
        ) : (
          groupedTemplates.map((group) => (
            <article key={group.phase} className="rounded-brand border border-stone bg-white p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-serif text-2xl text-ink">{group.phase}</h3>
                <span className="text-xs font-medium uppercase tracking-wide text-taupe">
                  {group.templates.length} modèle(s)
                </span>
              </div>

              {group.templates.length === 0 ? (
                <p className="text-sm text-graphite">Aucun modèle pour cette phase.</p>
              ) : (
                <ul className="space-y-2">
                  {group.templates.map((template) => {
                    const isBusy = templateBusyId === template.id
                    return (
                      <li
                        key={template.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone px-3 py-2"
                      >
                        <div className="min-w-[220px]">
                          <a
                            href={template.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-flame hover:underline"
                          >
                            {template.name}
                          </a>
                          <p className="text-xs uppercase tracking-wide text-taupe">{template.type}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingTemplateDeletion(template)}
                          disabled={isBusy}
                          className="text-xs text-graphite hover:text-berry disabled:opacity-70"
                        >
                          Supprimer
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </article>
          ))
        )}
      </section>

      {pendingUserDeletion && (
        <DeleteConfirmModal
          title="Supprimer le compte"
          message={`Le compte « ${pendingUserDeletion.email} » sera supprimé définitivement.`}
          onConfirm={confirmRemoveUser}
          onCancel={() => setPendingUserDeletion(null)}
          loading={accountBusyUserId === pendingUserDeletion.id}
        />
      )}

      {pendingTemplateDeletion && (
        <DeleteConfirmModal
          title="Supprimer le modèle"
          message={`Le modèle « ${pendingTemplateDeletion.name} » sera supprimé.`}
          onConfirm={confirmRemoveTemplate}
          onCancel={() => setPendingTemplateDeletion(null)}
          loading={templateBusyId === pendingTemplateDeletion.id}
        />
      )}
    </div>
  )
}
