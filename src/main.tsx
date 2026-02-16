import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'

const App = lazy(() => import('./App.tsx'))
const PublicQuestionnairePage = lazy(async () => {
  const mod = await import('./pages/PublicQuestionnairePage.tsx')
  return { default: mod.PublicQuestionnairePage }
})

function FullscreenLoading() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="inline-block w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<FullscreenLoading />}>
        <Routes>
          <Route path="/p/:projectToken" element={<PublicQuestionnairePage />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
