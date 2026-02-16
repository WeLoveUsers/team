import { FormEvent, useEffect, useState } from 'react'

type AccessStatus = 'Actif' | 'Suspendu'
type AccessRole = 'Admin' | 'Consultant' | 'Contributeur'

type TeamAccount = {
  id: string
  name: string
  email: string
  role: AccessRole
  status: AccessStatus
}

const STORAGE_KEY = 'team_access_registry'

const ROLES: AccessRole[] = ['Admin', 'Consultant', 'Contributeur']
const STATUSES: AccessStatus[] = ['Actif', 'Suspendu']

function readAccounts(): TeamAccount[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is TeamAccount => (
      typeof item?.id === 'string'
      && typeof item?.name === 'string'
      && typeof item?.email === 'string'
      && ROLES.includes(item?.role)
      && STATUSES.includes(item?.status)
    ))
  } catch {
    return []
  }
}

export function AdministrationPage() {
  const [accounts, setAccounts] = useState<TeamAccount[]>(() => readAccounts())
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AccessRole>('Consultant')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
  }, [accounts])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Le nom est requis.')
      return
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError("L'email est requis.")
      return
    }

    if (!normalizedEmail.includes('@')) {
      setError("L'email semble invalide.")
      return
    }

    if (accounts.some((account) => account.email === normalizedEmail)) {
      setError('Un compte avec cet email existe déjà.')
      return
    }

    const next: TeamAccount = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      role,
      status: 'Actif',
    }
    setAccounts((prev) => [next, ...prev])
    setName('')
    setEmail('')
    setRole('Consultant')
  }

  const toggleStatus = (id: string) => {
    setAccounts((prev) => prev.map((account) => {
      if (account.id !== id) return account
      return { ...account, status: account.status === 'Actif' ? 'Suspendu' : 'Actif' }
    }))
  }

  const removeAccount = (id: string) => {
    setAccounts((prev) => prev.filter((account) => account.id !== id))
  }

  return (
    <div className="space-y-10">
      <header className="border-b border-stone pb-10">
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-flame">Administration</p>
        <h1 className="mb-5 font-serif text-5xl text-ink md:text-6xl">Gestion des accès</h1>
        <p className="max-w-3xl text-lg font-light text-graphite md:text-xl">
          Répertoire interne des membres ayant accès à l&apos;interface Team.
        </p>
      </header>

      <section className="rounded-brand border border-flame/20 bg-wash p-5">
        <p className="text-sm leading-relaxed text-graphite">
          L&apos;authentification API actuelle reste configurée côté worker. Cette section vous permet
          de centraliser et piloter la liste d&apos;accès de l&apos;équipe au quotidien.
        </p>
      </section>

      <section className="rounded-brand border border-stone bg-white p-6">
        <h2 className="mb-4 font-serif text-2xl text-ink">Ajouter un compte</h2>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
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
            <label htmlFor="admin-role" className="mb-1 block text-sm font-medium text-ink">
              Rôle
            </label>
            <select
              id="admin-role"
              value={role}
              onChange={(e) => {
                if (ROLES.includes(e.target.value as AccessRole)) {
                  setRole(e.target.value as AccessRole)
                }
              }}
              className="field-select"
            >
              {ROLES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="md:col-span-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
              {error}
            </div>
          )}

          <div className="md:col-span-3">
            <button type="submit" className="btn-primary-sm">Ajouter le compte</button>
          </div>
        </form>
      </section>

      <section className="rounded-brand border border-stone bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl text-ink">Comptes enregistrés</h2>
          <span className="text-xs font-medium uppercase tracking-wide text-taupe">
            {accounts.length} compte(s)
          </span>
        </div>

        {accounts.length === 0 ? (
          <p className="text-sm text-graphite">Aucun compte ajouté pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone px-3 py-2"
              >
                <div className="min-w-[220px]">
                  <p className="text-sm font-medium text-ink">{account.name}</p>
                  <p className="text-xs text-graphite">{account.email}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-taupe">{account.role}</span>
                  <span className={`badge-severity ${account.status === 'Actif' ? 'badge-severity-sage' : 'badge-severity-flame'}`}>
                    {account.status}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleStatus(account.id)}
                    className="text-xs text-flame hover:underline"
                  >
                    {account.status === 'Actif' ? 'Suspendre' : 'Réactiver'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAccount(account.id)}
                    className="text-xs text-graphite hover:text-berry"
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
