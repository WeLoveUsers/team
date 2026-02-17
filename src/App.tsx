import { Suspense, lazy, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { SyncState } from './components/SyncIndicator'
import { fetchAuthMe } from './api'
import { TeamShell } from './components/TeamShell'
import {
  clearCachedDocumentTemplates,
  ensureDocumentTemplatesLoaded,
} from './lib/documentTemplatesCache'
import { clearCachedProjectsList, ensureProjectsListLoaded } from './lib/projectsListCache'
import { clearCachedResponses } from './lib/useResponsesCache'
import { clearAuthSession, readAuthSession, storeAuthSession, type AuthSession } from './lib/auth'

const DashboardPage = lazy(async () => {
  const mod = await import('./pages/DashboardPage')
  return { default: mod.DashboardPage }
})
const AdministrationPage = lazy(async () => {
  const mod = await import('./pages/AdministrationPage')
  return { default: mod.AdministrationPage }
})
const BrandFontsPage = lazy(async () => {
  const mod = await import('./pages/BrandFontsPage')
  return { default: mod.BrandFontsPage }
})
const BrandGuidelinesPage = lazy(async () => {
  const mod = await import('./pages/BrandGuidelinesPage')
  return { default: mod.BrandGuidelinesPage }
})
const BrandSlidesPage = lazy(async () => {
  const mod = await import('./pages/BrandSlidesPage')
  return { default: mod.BrandSlidesPage }
})
const DocumentTemplatesPage = lazy(async () => {
  const mod = await import('./pages/DocumentTemplatesPage')
  return { default: mod.DocumentTemplatesPage }
})
const HomePage = lazy(async () => {
  const mod = await import('./pages/HomePage')
  return { default: mod.HomePage }
})
const LoginPage = lazy(async () => {
  const mod = await import('./pages/LoginPage')
  return { default: mod.LoginPage }
})
const WorkingMethodPage = lazy(async () => {
  const mod = await import('./pages/WorkingMethodPage')
  return { default: mod.WorkingMethodPage }
})

function FullscreenLoading() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="inline-block w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function SectionLoading() {
  return (
    <div className="flex items-center justify-center h-full py-24">
      <div className="inline-block w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function App() {
  const location = useLocation()
  const [session, setSession] = useState<AuthSession | null>(() => readAuthSession())
  const [headerSyncState, setHeaderSyncState] = useState<SyncState>('idle')
  const isLoggedIn = !!session
  const isAdmin = session?.user.role === 'admin'
  const sessionToken = session?.token ?? null

  useEffect(() => {
    if (!isLoggedIn) return
    ensureProjectsListLoaded().catch((err) => {
      console.error('Preload projects failed:', err)
    })
    ensureDocumentTemplatesLoaded().catch((err) => {
      console.error('Preload document templates failed:', err)
    })
  }, [isLoggedIn])

  useEffect(() => {
    if (!sessionToken) return
    let cancelled = false

    fetchAuthMe()
      .then((user) => {
        if (cancelled) return
        setSession((prev) => {
          if (!prev || prev.token !== sessionToken) return prev
          const next = { token: prev.token, user }
          storeAuthSession(next)
          return next
        })
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Session refresh failed:', err)
        clearCachedProjectsList()
        clearCachedDocumentTemplates()
        clearCachedResponses()
        clearAuthSession()
        setSession(null)
      })

    return () => {
      cancelled = true
    }
  }, [sessionToken])

  const handleLogin = (nextSession: AuthSession) => {
    storeAuthSession(nextSession)
    setSession(nextSession)
  }

  const handleLogout = () => {
    clearCachedProjectsList()
    clearCachedDocumentTemplates()
    clearCachedResponses()
    clearAuthSession()
    setSession(null)
  }

  if (!isLoggedIn) {
    return (
      <Suspense fallback={<FullscreenLoading />}>
        <LoginPage
          onLogin={handleLogin}
          title="Connexion requise"
          subtitle="Connectez-vous pour accéder à l'espace Team."
        />
      </Suspense>
    )
  }

  const isQuestionnairesRoute = location.pathname === '/questionnaires'

  return (
    <TeamShell
      onLogout={handleLogout}
      fullBleed={isQuestionnairesRoute}
      headerSyncState={isQuestionnairesRoute ? headerSyncState : undefined}
      canAccessAdministration={isAdmin}
    >
      <Suspense fallback={<SectionLoading />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/notre-facon-de-travailler" element={<WorkingMethodPage />} />
          <Route path="/charte-graphique" element={<BrandGuidelinesPage />} />
          <Route path="/charte-graphique/slides" element={<BrandSlidesPage />} />
          <Route path="/charte-graphique/fonts" element={<BrandFontsPage />} />
          <Route path="/modeles-documents" element={<Navigate to="/modeles-documents/preparation" replace />} />
          <Route path="/modeles-documents/:phase" element={<DocumentTemplatesPage />} />
          <Route
            path="/questionnaires"
            element={<DashboardPage onSyncStateChange={setHeaderSyncState} />}
          />
          <Route
            path="/administration"
            element={isAdmin ? <AdministrationPage /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </TeamShell>
  )
}

export default App
