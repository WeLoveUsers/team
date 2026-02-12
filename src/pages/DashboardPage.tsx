import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { fetchProjects, type Project } from '../api'
import { Layout } from '../components/Layout'
import { Sidebar } from '../components/Sidebar'
import { ProjectForm } from '../components/ProjectForm'
import { ProjectDetail } from '../components/ProjectDetail'
import { useResponsesCache } from '../lib/useResponsesCache'
import type { SyncState } from '../components/SyncIndicator'

type Props = {
  onLogout: () => void
}

// ─── Hash helpers ────────────────────────────────────────────────────
// Format :  #project/{id}/{tab}  |  #new  |  (vide = accueil)
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

function readHash(): HashState {
  const h = window.location.hash.replace(/^#/, '')
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

function writeHash(mode: 'detail' | 'new', projectId: string | null, tab: ProjectTab) {
  let target = ''
  if (mode === 'new') {
    target = '#new'
  } else if (projectId) {
    const slug = TAB_TO_SLUG[tab] ?? 'stats'
    target = slug === 'stats'
      ? `#project/${projectId}`
      : `#project/${projectId}/${slug}`
  }

  const current = window.location.hash
  if (current === target) return
  if (target === '' && (current === '' || current === '#')) return

  window.history.replaceState(
    null,
    '',
    target || window.location.pathname + window.location.search,
  )
}

// ─────────────────────────────────────────────────────────────────────

export function DashboardPage({ onLogout }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [mode, setMode] = useState<'detail' | 'new'>('detail')
  const [activeTab, setActiveTab] = useState<ProjectTab>('stats')

  // État initial lu depuis le hash — résolu après le chargement des projets
  const initialHashRef = useRef(readHash())

  // Cache des réponses
  const cache = useResponsesCache()

  // SyncState dérivé du cache
  const syncStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [syncOverride, setSyncOverride] = useState<SyncState | null>(null)

  const syncState: SyncState = useMemo(() => {
    if (syncOverride) return syncOverride
    if (cache.loading) return 'syncing'
    if (cache.backgroundRefreshing) return 'syncing'
    return 'idle'
  }, [cache.loading, cache.backgroundRefreshing, syncOverride])

  // Affiche "saved" brièvement après la fin d'une synchro
  const prevSyncingRef = useRef(false)
  useEffect(() => {
    const isSyncing = cache.loading || cache.backgroundRefreshing
    if (prevSyncingRef.current && !isSyncing) {
      setSyncOverride('saved')
      if (syncStateTimerRef.current) clearTimeout(syncStateTimerRef.current)
      syncStateTimerRef.current = setTimeout(() => {
        setSyncOverride(null)
        syncStateTimerRef.current = null
      }, 2000)
    }
    prevSyncingRef.current = isSyncing
  }, [cache.loading, cache.backgroundRefreshing])

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
        const data = await fetchProjects()
        if (cancelled) return

        setProjects(data)

        // Restaure l'état depuis le hash
        const { mode: initMode, projectId, tab } = initialHashRef.current
        if (initMode === 'new') {
          setMode('new')
        } else if (projectId) {
          const found = data.find((p) => p.id === projectId)
          if (found) {
            setSelectedProject(found)
            setMode('detail')
            setActiveTab(tab)
            cache.loadResponses(found.id)
          }
          // Si le projet n'existe plus, on reste à l'accueil (hash sera nettoyé)
        }
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

  // Synchronise le hash quand le state change
  useEffect(() => {
    writeHash(mode, selectedProject?.id ?? null, activeTab)
  }, [mode, selectedProject?.id, activeTab])

  // Écoute les changements de hash (back/forward du navigateur)
  useEffect(() => {
    const onHashChange = () => {
      const { mode: newMode, projectId, tab } = readHash()
      if (newMode === 'new') {
        setSelectedProject(null)
        setMode('new')
        cache.clear()
      } else if (projectId) {
        const found = projects.find((p) => p.id === projectId)
        if (found) {
          setSelectedProject(found)
          setMode('detail')
          setActiveTab(tab)
          cache.loadResponses(found.id)
        }
      } else {
        setSelectedProject(null)
        setMode('detail')
        cache.clear()
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [projects, cache])

  // Liste des dossiers existants (dédupliquée)
  const existingFolders = useMemo(() => {
    const set = new Set<string>()
    for (const p of projects) {
      if (p.folder?.trim()) set.add(p.folder.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [projects])

  const handleSelectProject = useCallback((project: Project) => {
    setSelectedProject(project)
    setMode('detail')
    setActiveTab('stats')
    cache.loadResponses(project.id)
  }, [cache])

  const handleNewProject = () => {
    setSelectedProject(null)
    setMode('new')
    cache.clear()
  }

  const handleProjectSaved = useCallback((saved: Project) => {
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id)
      if (idx === -1) return [saved, ...prev]
      const copy = [...prev]
      copy[idx] = saved
      return copy
    })
    setSelectedProject(saved)
    setMode('detail')
    cache.loadResponses(saved.id)
  }, [cache])

  const handleProjectDeleted = useCallback(() => {
    if (selectedProject) {
      cache.invalidate(selectedProject.id)
      setProjects((prev) => prev.filter((p) => p.id !== selectedProject.id))
    }
    setSelectedProject(null)
    setMode('detail')
    cache.clear()
  }, [selectedProject, cache])

  const handleResponsesChanged = useCallback(() => {
    cache.refreshCurrent()
  }, [cache])

  const sidebar = (
    <Sidebar
      projects={projects}
      selectedId={selectedProject?.id ?? null}
      onSelect={handleSelectProject}
      onNewProject={handleNewProject}
    />
  )

  return (
    <Layout sidebar={sidebar} onLogout={onLogout} syncState={syncState}>
      {loading ? (
        <div className="flex items-center justify-center h-full py-32">
          <div className="text-center">
            <div className="inline-block w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-500">Chargement des projets...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full py-32">
          <div className="text-center max-w-sm">
            <p className="text-sm text-danger-600 mb-2">Impossible de charger les projets.</p>
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        </div>
      ) : mode === 'new' ? (
        <div className="p-6 max-w-lg">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Nouveau projet</h2>
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
          responses={cache.responses}
          responsesLoading={cache.loading}
          onProjectUpdated={handleProjectSaved}
          onProjectDeleted={handleProjectDeleted}
          onResponsesChanged={handleResponsesChanged}
          existingFolders={existingFolders}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      ) : (
        <div className="flex items-center justify-center h-full py-32">
          <div className="text-center">
            <p className="text-sm text-slate-400 mb-3">
              {projects.length === 0
                ? 'Aucun projet. Créez votre premier projet.'
                : 'Sélectionnez un projet dans la liste.'}
            </p>
            {projects.length === 0 && (
              <button
                onClick={handleNewProject}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                Créer un projet
              </button>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
