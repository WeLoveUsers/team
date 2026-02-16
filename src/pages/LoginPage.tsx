import { useState } from 'react'
import { loginApi } from '../api'

type LoginPageProps = {
  onLogin: () => void
  title?: string
  subtitle?: string
}

export function LoginPage({
  onLogin,
  title = 'Bienvenue sur We Love Users - Team',
  subtitle = 'Espace questionnaires We Love Users',
}: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const token = await loginApi(email.trim(), password)
      localStorage.setItem('authToken', token)
      onLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de se connecter')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <h1 className="font-serif text-4xl text-ink leading-none">We Love Users</h1>
            <span className="brand-chip">TEAM</span>
          </div>
          <div>
            <h2 className="text-base font-medium text-ink">{title}</h2>
            <p className="text-sm text-graphite mt-1">{subtitle}</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-brand border border-stone p-6 space-y-4"
        >
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="field-input"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink mb-1">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="field-input"
            />
          </div>

          {error && (
            <div className="text-sm text-danger-700 bg-danger-50 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 btn-primary-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
