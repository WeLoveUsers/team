import { readAuthToken, type AuthRole, type AuthSession, type AuthStatus, type AuthUser } from './lib/auth'
import type { DocumentTemplatePhase, DocumentTemplateType } from './lib/documentTemplates'

export type { AuthRole, AuthSession, AuthStatus, AuthUser }
export type { DocumentTemplatePhase, DocumentTemplateType }

export type Project = {
  id: string
  name: string
  questionnaireType: string | null
  status: string | null
  publicToken: string | null
  folder: string | null
  productType: string | null
  productName: string | null
  instructions: string | null
}

export type ProjectPayload = {
  name: string
  questionnaireType?: string | null
  status?: string | null
  publicToken?: string | null
  folder?: string | null
  productType?: string | null
  productName?: string | null
  instructions?: string | null
}

export type ProjectResponse = {
  id: string
  archived: boolean
  createdTime: string
  lastEditedTime: string
  properties: unknown
}

export type ProjectStatus = {
  status: string
  name: string
  questionnaireType: string | null
  productType: string | null
  productName: string | null
  instructions: string | null
}

export type DocumentTemplate = {
  id: string
  name: string
  url: string
  phase: DocumentTemplatePhase
  type: DocumentTemplateType
}

export type DocumentTemplatePayload = {
  name: string
  url: string
  phase: DocumentTemplatePhase
  type: DocumentTemplateType
}

export type AdminUserPayload = {
  name: string
  email: string
  password: string
  role: AuthRole
  status?: AuthStatus
  expiresAt: string
}

export type AdminUserUpdatePayload = {
  name?: string
  email?: string
  password?: string
  role?: AuthRole
  status?: AuthStatus
  expiresAt?: string
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.toString().replace(/\/+$/, '') ||
  'http://localhost:8787'

function authHeaders(includeJson = false): HeadersInit {
  const headers: HeadersInit = {}
  if (includeJson) {
    headers['Content-Type'] = 'application/json'
  }
  const token = readAuthToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE_URL}/projects`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur API /projects (${res.status}) : ${text}`)
  }
  const data = (await res.json()) as { projects?: Project[] }
  return data.projects ?? []
}

export async function fetchProjectResponses(projectId: string): Promise<ProjectResponse[]> {
  const res = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/responses`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur API réponses (${res.status}) : ${text}`)
  }
  const data = (await res.json()) as { responses?: ProjectResponse[] }
  return data.responses ?? []
}

export async function createProject(payload: ProjectPayload): Promise<Project> {
  const res = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur création projet (${res.status}) : ${text}`)
  }
  const data = (await res.json()) as { project?: Project }
  if (!data.project) throw new Error('Réponse création projet invalide')
  return data.project
}

export async function updateProject(id: string, payload: ProjectPayload): Promise<Project> {
  const res = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur mise à jour projet (${res.status}) : ${text}`)
  }
  const data = (await res.json()) as { project?: Project }
  if (!data.project) throw new Error('Réponse mise à jour projet invalide')
  return data.project
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur suppression projet (${res.status}) : ${text}`)
  }
}

export async function deleteResponse(projectId: string, responseId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/responses/${encodeURIComponent(responseId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur suppression réponse (${res.status}) : ${text}`)
  }
}

export async function recoverResponse(projectId: string, responseId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/responses/${encodeURIComponent(responseId)}/recover`,
    {
      method: 'POST',
      headers: authHeaders(),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur récupération réponse (${res.status}) : ${text}`)
  }
}

export async function fetchDocumentTemplates(): Promise<DocumentTemplate[]> {
  const res = await fetch(`${API_BASE_URL}/document-templates`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur modèles (${res.status}) : ${text}`)
  }
  const data = (await res.json()) as { templates?: DocumentTemplate[] }
  return data.templates ?? []
}

export async function createDocumentTemplate(payload: DocumentTemplatePayload): Promise<DocumentTemplate> {
  const res = await fetch(`${API_BASE_URL}/document-templates`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur création modèle (${res.status}) : ${text}`)
  }
  const data = (await res.json()) as { template?: DocumentTemplate }
  if (!data.template) throw new Error('Réponse création modèle invalide')
  return data.template
}

export async function deleteDocumentTemplate(templateId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/document-templates/${encodeURIComponent(templateId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur suppression modèle (${res.status}) : ${text}`)
  }
}

export async function loginApi(email: string, password: string): Promise<AuthSession> {
  const loginUrl = `${API_BASE_URL}/login`
  const res = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur de connexion (${res.status}) [${loginUrl}] : ${text}`)
  }
  const data = (await res.json()) as { token?: string; user?: AuthUser }
  if (!data.token || !data.user) throw new Error('Réponse de connexion invalide')
  return { token: data.token, user: data.user }
}

export async function fetchAuthMe(): Promise<AuthUser> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur récupération utilisateur (${res.status}) : ${text}`)
  }
  const data = (await res.json()) as { user?: AuthUser }
  if (!data.user) throw new Error('Réponse utilisateur invalide')
  return data.user
}

export async function fetchAdminUsers(): Promise<AuthUser[]> {
  const res = await fetch(`${API_BASE_URL}/admin/users`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur chargement utilisateurs (${res.status}) : ${text}`)
  }
  const data = (await res.json()) as { users?: AuthUser[] }
  return data.users ?? []
}

export async function createAdminUser(payload: AdminUserPayload): Promise<AuthUser> {
  const res = await fetch(`${API_BASE_URL}/admin/users`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur création utilisateur (${res.status}) : ${text}`)
  }
  const data = (await res.json()) as { user?: AuthUser }
  if (!data.user) throw new Error('Réponse création utilisateur invalide')
  return data.user
}

export async function updateAdminUser(
  userId: string,
  payload: AdminUserUpdatePayload,
): Promise<AuthUser> {
  const res = await fetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur mise à jour utilisateur (${res.status}) : ${text}`)
  }
  const data = (await res.json()) as { user?: AuthUser }
  if (!data.user) throw new Error('Réponse mise à jour utilisateur invalide')
  return data.user
}

export async function deleteAdminUser(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur suppression utilisateur (${res.status}) : ${text}`)
  }
}

export type PublicAnswers = Record<string, number | null>

export async function submitPublicResponse(params: {
  projectToken: string
  answers: PublicAnswers
}): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/public/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null) as { closed?: boolean; error?: string } | null
    if (data?.closed) {
      throw new Error('CLOSED')
    }
    throw new Error(data?.error ?? `Erreur enregistrement réponses (${res.status})`)
  }
}

export async function fetchProjectStatus(token: string): Promise<ProjectStatus> {
  const res = await fetch(`${API_BASE_URL}/public/project-status/${encodeURIComponent(token)}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur statut projet (${res.status}) : ${text}`)
  }
  return (await res.json()) as ProjectStatus
}
