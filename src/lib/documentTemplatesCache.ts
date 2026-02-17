import { fetchDocumentTemplates, type DocumentTemplate } from '../api'

type DocumentTemplatesCacheState = {
  token: string | null
  templates: DocumentTemplate[] | null
  inFlight: Promise<DocumentTemplate[]> | null
}

let documentTemplatesCache: DocumentTemplatesCacheState = {
  token: null,
  templates: null,
  inFlight: null,
}

type DocumentTemplatesListener = (templates: DocumentTemplate[] | null) => void
const listeners = new Set<DocumentTemplatesListener>()

function notifyListeners(templates: DocumentTemplate[] | null) {
  for (const listener of listeners) {
    listener(templates)
  }
}

function readAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('authToken')
}

function getScopedState(): DocumentTemplatesCacheState {
  const token = readAuthToken()
  if (documentTemplatesCache.token !== token) {
    documentTemplatesCache = {
      token,
      templates: null,
      inFlight: null,
    }
  }
  return documentTemplatesCache
}

export function getCachedDocumentTemplates(): DocumentTemplate[] | null {
  return getScopedState().templates
}

export function setCachedDocumentTemplates(templates: DocumentTemplate[]): void {
  const state = getScopedState()
  state.templates = templates
  notifyListeners(templates)
}

export async function ensureDocumentTemplatesLoaded(): Promise<DocumentTemplate[]> {
  const state = getScopedState()
  const requestToken = state.token

  if (state.templates) {
    return state.templates
  }

  if (state.inFlight) {
    return state.inFlight
  }

  state.inFlight = fetchDocumentTemplates()
    .then((templates) => {
      const latest = getScopedState()
      if (latest.token === requestToken) {
        latest.templates = templates
        notifyListeners(templates)
      }
      return templates
    })
    .finally(() => {
      const latest = getScopedState()
      if (latest.token === requestToken) {
        latest.inFlight = null
      }
    })

  return state.inFlight
}

export function clearCachedDocumentTemplates(): void {
  documentTemplatesCache = {
    token: null,
    templates: null,
    inFlight: null,
  }
  notifyListeners(null)
}

export function subscribeDocumentTemplates(listener: DocumentTemplatesListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
