import { fetchProjects, type Project } from '../api'

type ProjectsListCacheState = {
  token: string | null
  projects: Project[] | null
  inFlight: Promise<Project[]> | null
}

let projectsListCache: ProjectsListCacheState = {
  token: null,
  projects: null,
  inFlight: null,
}

type ProjectsListListener = (projects: Project[] | null) => void
const listeners = new Set<ProjectsListListener>()

function notifyListeners(projects: Project[] | null) {
  for (const listener of listeners) {
    listener(projects)
  }
}

function readAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('authToken')
}

function getScopedState(): ProjectsListCacheState {
  const token = readAuthToken()
  if (projectsListCache.token !== token) {
    projectsListCache = {
      token,
      projects: null,
      inFlight: null,
    }
  }
  return projectsListCache
}

export function getCachedProjectsList(): Project[] | null {
  return getScopedState().projects
}

export function setCachedProjectsList(projects: Project[]): void {
  const state = getScopedState()
  state.projects = projects
  notifyListeners(projects)
}

export async function ensureProjectsListLoaded(): Promise<Project[]> {
  const state = getScopedState()
  const requestToken = state.token

  if (state.projects) {
    return state.projects
  }

  if (state.inFlight) {
    return state.inFlight
  }

  state.inFlight = fetchProjects()
    .then((projects) => {
      const latest = getScopedState()
      if (latest.token === requestToken) {
        latest.projects = projects
        notifyListeners(projects)
      }
      return projects
    })
    .finally(() => {
      const latest = getScopedState()
      if (latest.token === requestToken) {
        latest.inFlight = null
      }
    })

  return state.inFlight
}

export function clearCachedProjectsList(): void {
  projectsListCache = {
    token: null,
    projects: null,
    inFlight: null,
  }
  notifyListeners(null)
}

export function subscribeProjectsList(listener: ProjectsListListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
