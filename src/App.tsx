import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { SyncState } from './components/SyncIndicator'
import { TeamShell } from './components/TeamShell'
import { clearCachedProjectsList, ensureProjectsListLoaded } from './lib/projectsListCache'
import { clearCachedResponses } from './lib/useResponsesCache'
import { DashboardPage } from './pages/DashboardPage'
import { AdministrationPage } from './pages/AdministrationPage'
import { BrandFontsPage } from './pages/BrandFontsPage'
import { BrandGuidelinesPage } from './pages/BrandGuidelinesPage'
import { BrandSlidesPage } from './pages/BrandSlidesPage'
import { DocumentTemplatesPage } from './pages/DocumentTemplatesPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { WorkingMethodPage } from './pages/WorkingMethodPage'

function App() {
  const location = useLocation()
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('authToken'))
  const [headerSyncState, setHeaderSyncState] = useState<SyncState>('idle')

  useEffect(() => {
    if (!isLoggedIn) return
    ensureProjectsListLoaded().catch((err) => {
      console.error('Preload projects failed:', err)
    })
  }, [isLoggedIn])

  const handleLogin = () => {
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    clearCachedProjectsList()
    clearCachedResponses()
    localStorage.removeItem('authToken')
    setIsLoggedIn(false)
  }

  if (!isLoggedIn) {
    return (
      <LoginPage
        onLogin={handleLogin}
        title="Connexion requise"
        subtitle="Connectez-vous pour accéder à l'espace Team."
      />
    )
  }

  const isQuestionnairesRoute = location.pathname === '/questionnaires'

  return (
    <TeamShell
      onLogout={handleLogout}
      fullBleed={isQuestionnairesRoute}
      headerSyncState={isQuestionnairesRoute ? headerSyncState : undefined}
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/notre-facon-de-travailler" element={<WorkingMethodPage />} />
        <Route path="/charte-graphique" element={<BrandGuidelinesPage />} />
        <Route path="/charte-graphique/slides" element={<BrandSlidesPage />} />
        <Route path="/charte-graphique/fonts" element={<BrandFontsPage />} />
        <Route path="/modeles-documents" element={<DocumentTemplatesPage />} />
        <Route
          path="/questionnaires"
          element={<DashboardPage onSyncStateChange={setHeaderSyncState} />}
        />
        <Route path="/administration" element={<AdministrationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </TeamShell>
  )
}

export default App
