import { useState, useCallback, useRef } from 'react'
import { fetchProjectResponses, type ProjectResponse } from '../api'

const RESPONSES_STALE_AFTER_MS = 60_000

/**
 * Cache session des réponses par projet (scopé par token d'auth).
 *
 * Quand on navigue vers un projet déjà visité :
 * 1. Les données en cache sont affichées immédiatement
 * 2. Un refresh en arrière-plan est lancé
 * 3. Si de nouvelles données arrivent, l'affichage est mis à jour
 *
 * Le cache est purgé explicitement à la déconnexion.
 */
type ResponsesCacheState = {
  token: string | null
  byProject: Map<string, { responses: ProjectResponse[]; fetchedAt: number }>
}

let responsesCacheState: ResponsesCacheState = {
  token: null,
  byProject: new Map(),
}

function readAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('authToken')
}

function getScopedResponsesStore() {
  const token = readAuthToken()
  if (responsesCacheState.token !== token) {
    responsesCacheState = {
      token,
      byProject: new Map(),
    }
  }
  return responsesCacheState.byProject
}

export function clearCachedResponses(): void {
  responsesCacheState = {
    token: null,
    byProject: new Map(),
  }
}

export function useResponsesCache() {
  const [responses, setResponses] = useState<ProjectResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false)
  const currentProjectIdRef = useRef<string | null>(null)

  /**
   * Charge les réponses d'un projet. Si en cache, affiche d'abord le cache,
   * puis rafraîchit en arrière-plan.
   */
  const loadResponses = useCallback(async (projectId: string): Promise<void> => {
    currentProjectIdRef.current = projectId
    const store = getScopedResponsesStore()
    const cached = store.get(projectId)

    if (cached) {
      // Affichage immédiat du cache
      setResponses(cached.responses)
      setLoading(false)

      if (Date.now() - cached.fetchedAt < RESPONSES_STALE_AFTER_MS) {
        setBackgroundRefreshing(false)
        return
      }

      // Refresh en arrière-plan
      setBackgroundRefreshing(true)
      try {
        const fresh = await fetchProjectResponses(projectId)
        // Vérifie qu'on est toujours sur le même projet
        if (currentProjectIdRef.current === projectId) {
          setResponses(fresh)
          store.set(projectId, { responses: fresh, fetchedAt: Date.now() })
        }
      } catch (err) {
        console.error('Background refresh failed:', err)
        // On garde les données en cache, pas de problème
      } finally {
        if (currentProjectIdRef.current === projectId) {
          setBackgroundRefreshing(false)
        }
      }
    } else {
      // Premier chargement : pas de cache, loading classique
      setResponses([])
      setLoading(true)
      setBackgroundRefreshing(false)
      try {
        const fresh = await fetchProjectResponses(projectId)
        if (currentProjectIdRef.current === projectId) {
          setResponses(fresh)
          store.set(projectId, { responses: fresh, fetchedAt: Date.now() })
        }
      } catch (err) {
        console.error('Load responses failed:', err)
        if (currentProjectIdRef.current === projectId) {
          setResponses([])
        }
      } finally {
        if (currentProjectIdRef.current === projectId) {
          setLoading(false)
        }
      }
    }
  }, [])

  /**
   * Force un refresh des réponses du projet courant (après delete/recover).
   */
  const refreshCurrent = useCallback(async () => {
    const pid = currentProjectIdRef.current
    if (!pid) return

    setBackgroundRefreshing(true)
    try {
      const fresh = await fetchProjectResponses(pid)
      if (currentProjectIdRef.current === pid) {
        setResponses(fresh)
        const store = getScopedResponsesStore()
        store.set(pid, { responses: fresh, fetchedAt: Date.now() })
      }
    } catch (err) {
      console.error('Refresh responses failed:', err)
    } finally {
      if (currentProjectIdRef.current === pid) {
        setBackgroundRefreshing(false)
      }
    }
  }, [])

  /**
   * Invalide le cache pour un projet (ex: après suppression projet).
   */
  const invalidate = useCallback((projectId: string) => {
    const store = getScopedResponsesStore()
    store.delete(projectId)
  }, [])

  /**
   * Remet à zéro quand on déselectionne tout.
   */
  const clear = useCallback(() => {
    currentProjectIdRef.current = null
    setResponses([])
    setLoading(false)
    setBackgroundRefreshing(false)
  }, [])

  return {
    responses,
    loading,
    backgroundRefreshing,
    loadResponses,
    refreshCurrent,
    invalidate,
    clear,
  }
}
