import { useState, useCallback, useRef } from 'react'
import { fetchProjectResponses, type ProjectResponse } from '../api'

/**
 * Cache local des réponses par projet.
 *
 * Quand on navigue vers un projet déjà visité :
 * 1. Les données en cache sont affichées immédiatement
 * 2. Un refresh en arrière-plan est lancé
 * 3. Si de nouvelles données arrivent, l'affichage est mis à jour
 *
 * Le cache est purgé quand on se déconnecte (remontage du composant).
 */
export function useResponsesCache() {
  const cacheRef = useRef<Map<string, { responses: ProjectResponse[]; fetchedAt: number }>>(new Map())
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
    const cached = cacheRef.current.get(projectId)

    if (cached) {
      // Affichage immédiat du cache
      setResponses(cached.responses)
      setLoading(false)

      // Refresh en arrière-plan
      setBackgroundRefreshing(true)
      try {
        const fresh = await fetchProjectResponses(projectId)
        // Vérifie qu'on est toujours sur le même projet
        if (currentProjectIdRef.current === projectId) {
          setResponses(fresh)
          cacheRef.current.set(projectId, { responses: fresh, fetchedAt: Date.now() })
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
          cacheRef.current.set(projectId, { responses: fresh, fetchedAt: Date.now() })
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
        cacheRef.current.set(pid, { responses: fresh, fetchedAt: Date.now() })
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
    cacheRef.current.delete(projectId)
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
