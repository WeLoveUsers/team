import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { type Project } from '../api'
import { Layout } from '../components/Layout'
import { ProjectForm } from '../components/ProjectForm'
import { ProjectDetail } from '../components/ProjectDetail'
import { ensureProjectsListLoaded, getCachedProjectsList, setCachedProjectsList } from '../lib/projectsListCache'
import { useResponsesCache } from '../lib/useResponsesCache'
import type { SyncState } from '../components/SyncIndicator'

// ─── Hash helpers ────────────────────────────────────────────────────
// Format :  #presentation  |  #project/{id}/{tab}  |  #new
// tab = stats | responses | settings  (défaut : stats)

export type ProjectTab = 'stats' | 'responses' | 'form'

const TAB_SLUGS: Record<string, ProjectTab> = {
  stats: 'stats',
  responses: 'responses',
  settings: 'form',
}
const TAB_TO_SLUG: Record<ProjectTab, string> = {
  stats: 'stats',
  responses: 'responses',
  form: 'settings',
}

type HashState = {
  mode: 'detail' | 'new'
  projectId: string | null
  tab: ProjectTab
}

function readHash(hashValue: string): HashState {
  const h = hashValue.replace(/^#/, '')
  if (h === '' || h === 'presentation') {
    return { mode: 'detail', projectId: null, tab: 'stats' }
  }
  if (h === 'new') return { mode: 'new', projectId: null, tab: 'stats' }
  if (h.startsWith('project/')) {
    const rest = h.slice('project/'.length)
    const slashIdx = rest.indexOf('/')
    if (slashIdx === -1) {
      return { mode: 'detail', projectId: rest || null, tab: 'stats' }
    }
    const id = rest.slice(0, slashIdx)
    const tabSlug = rest.slice(slashIdx + 1)
    const tab = TAB_SLUGS[tabSlug] ?? 'stats'
    return { mode: 'detail', projectId: id || null, tab }
  }
  return { mode: 'detail', projectId: null, tab: 'stats' }
}

function buildHash(mode: 'detail' | 'new', projectId: string | null, tab: ProjectTab): string {
  if (mode === 'new') {
    return '#new'
  } else if (projectId) {
    const slug = TAB_TO_SLUG[tab] ?? 'stats'
    return slug === 'stats'
      ? `#project/${projectId}`
      : `#project/${projectId}/${slug}`
  }
  return '#presentation'
}

// ─────────────────────────────────────────────────────────────────────

type DashboardPageProps = {
  onSyncStateChange?: (state: SyncState) => void
}

export function DashboardPage({ onSyncStateChange }: DashboardPageProps = {}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [mode, setMode] = useState<'detail' | 'new'>('detail')
  const [activeTab, setActiveTab] = useState<ProjectTab>('stats')
  const modeRef = useRef(mode)
  const selectedProjectIdRef = useRef<string | null>(null)
  const activeTabRef = useRef(activeTab)

  // État initial lu depuis le hash — résolu après le chargement des projets
  const initialHashRef = useRef(readHash(location.hash))

  // Cache des réponses
  const {
    responses,
    loading: responsesLoading,
    backgroundRefreshing,
    loadResponses,
    refreshCurrent,
    invalidate,
    clear,
  } = useResponsesCache()

  // SyncState dérivé du cache
  const syncStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextHashSyncRef = useRef(false)
  const [syncOverride, setSyncOverride] = useState<SyncState | null>(null)

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    selectedProjectIdRef.current = selectedProject?.id ?? null
  }, [selectedProject?.id])

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  const syncState: SyncState = useMemo(() => {
    if (syncOverride) return syncOverride
    if (responsesLoading) return 'syncing'
    if (backgroundRefreshing) return 'syncing'
    return 'idle'
  }, [responsesLoading, backgroundRefreshing, syncOverride])

  useEffect(() => {
    onSyncStateChange?.(syncState)
  }, [syncState, onSyncStateChange])

  useEffect(() => {
    return () => {
      onSyncStateChange?.('idle')
    }
  }, [onSyncStateChange])

  // Affiche "saved" brièvement après la fin d'une synchro
  const prevSyncingRef = useRef(false)
  useEffect(() => {
    const isSyncing = responsesLoading || backgroundRefreshing
    if (prevSyncingRef.current && !isSyncing) {
      setSyncOverride('saved')
      if (syncStateTimerRef.current) clearTimeout(syncStateTimerRef.current)
      syncStateTimerRef.current = setTimeout(() => {
        setSyncOverride(null)
        syncStateTimerRef.current = null
      }, 2000)
    }
    prevSyncingRef.current = isSyncing
  }, [responsesLoading, backgroundRefreshing])

  // Cleanup du timer
  useEffect(() => {
    return () => {
      if (syncStateTimerRef.current) clearTimeout(syncStateTimerRef.current)
    }
  }, [])

  // Chargement initial des projets + restauration de la navigation depuis le hash
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const applyInitialState = (data: Project[]) => {
          const { mode: initMode, projectId, tab } = initialHashRef.current
          if (initMode === 'new') {
            setMode('new')
          } else if (projectId) {
            const found = data.find((p) => p.id === projectId)
            if (found) {
              setSelectedProject(found)
              setMode('detail')
              setActiveTab(tab)
              loadResponses(found.id)
            }
          }
        }

        const cachedProjects = getCachedProjectsList()
        if (cachedProjects) {
          if (cancelled) return
          setProjects(cachedProjects)
          applyInitialState(cachedProjects)
          return
        }

        const data = await ensureProjectsListLoaded()
        if (cancelled) return

        setProjects(data)
        applyInitialState(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Réagit aux changements de hash déclenchés par React Router (liens #project, back/forward)
  useEffect(() => {
    const { mode: newMode, projectId, tab } = readHash(location.hash)
    const currentMode = modeRef.current
    const currentProjectId = selectedProjectIdRef.current
    const currentTab = activeTabRef.current

    if (newMode === 'new') {
      if (currentMode === 'new' && currentProjectId === null) return
      skipNextHashSyncRef.current = true
      setSelectedProject(null)
      setMode('new')
      clear()
      return
    }
    if (projectId) {
      const found = projects.find((p) => p.id === projectId)
      if (found) {
        if (currentMode === 'detail' && currentProjectId === found.id && currentTab === tab) return
        skipNextHashSyncRef.current = true
        setSelectedProject(found)
        setMode('detail')
        setActiveTab(tab)
        loadResponses(found.id)
      }
      return
    }
    if (currentMode === 'detail' && currentProjectId === null) return
    skipNextHashSyncRef.current = true
    setSelectedProject(null)
    setMode('detail')
    clear()
  }, [location.hash, projects, loadResponses, clear])

  // Synchronise le hash quand le state change
  useEffect(() => {
    if (skipNextHashSyncRef.current) {
      skipNextHashSyncRef.current = false
      return
    }

    const targetHash = buildHash(mode, selectedProject?.id ?? null, activeTab)
    const currentHash = location.hash
    const isSameHash = targetHash === currentHash
      || (targetHash === '' && (currentHash === '' || currentHash === '#'))

    if (isSameHash) return

    navigate(
      `${location.pathname}${location.search}${targetHash}`,
      { replace: true },
    )
  }, [
    mode,
    selectedProject?.id,
    activeTab,
    location.pathname,
    location.search,
    location.hash,
    navigate,
  ])

  // Liste des dossiers existants (dédupliquée)
  const existingFolders = useMemo(() => {
    const set = new Set<string>()
    for (const p of projects) {
      if (p.folder?.trim()) set.add(p.folder.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [projects])


  const handleProjectSaved = useCallback((saved: Project) => {
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id)
      if (idx === -1) {
        const next = [saved, ...prev]
        setCachedProjectsList(next)
        return next
      }
      const next = [...prev]
      next[idx] = saved
      setCachedProjectsList(next)
      return next
    })
    setSelectedProject(saved)
    setMode('detail')
    loadResponses(saved.id)
  }, [loadResponses])

  const handleProjectDeleted = useCallback(() => {
    if (selectedProject) {
      invalidate(selectedProject.id)
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== selectedProject.id)
        setCachedProjectsList(next)
        return next
      })
    }
    setSelectedProject(null)
    setMode('detail')
    clear()
  }, [selectedProject, invalidate, clear])

  const handleResponsesChanged = useCallback(() => {
    refreshCurrent()
  }, [refreshCurrent])

  return (
    <Layout>
      {loading ? (
        <div className="flex items-center justify-center h-full py-32">
          <div className="text-center">
            <div className="inline-block w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-taupe">Chargement des projets...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full py-32">
          <div className="text-center max-w-sm">
            <p className="text-sm text-berry mb-2">Impossible de charger les projets.</p>
            <p className="text-xs text-taupe">{error}</p>
          </div>
        </div>
      ) : mode === 'new' ? (
        <div className="p-6 max-w-lg">
          <h2 className="text-xl font-bold text-ink mb-6">Nouveau projet</h2>
          <ProjectForm
            project={null}
            hasResponses={false}
            existingFolders={existingFolders}
            onSaved={handleProjectSaved}
            onCancel={() => setMode('detail')}
          />
        </div>
      ) : selectedProject ? (
        <ProjectDetail
          key={selectedProject.id}
          project={selectedProject}
          responses={responses}
          responsesLoading={responsesLoading}
          onProjectUpdated={handleProjectSaved}
          onProjectDeleted={handleProjectDeleted}
          onResponsesChanged={handleResponsesChanged}
          existingFolders={existingFolders}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      ) : (
        <div className="flex items-center justify-center h-full py-32">
          <div className="text-center max-w-sm">
            <p className="text-sm text-graphite">
              Sélectionnez un projet dans le panneau latéral ou créez-en un nouveau.
            </p>
            {projects.length > 0 && (
              <p className="mt-3 text-xs text-taupe">
                {projects.length} projet{projects.length > 1 ? 's' : ''} disponible
                {projects.length > 1 ? 's' : ''}.
              </p>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
