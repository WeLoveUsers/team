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

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.toString().replace(/\/+$/, '') ||
  'http://localhost:8787'

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('authToken')
}

function authHeaders(includeJson = false): HeadersInit {
  const headers: HeadersInit = {}
  if (includeJson) {
    headers['Content-Type'] = 'application/json'
  }
  const token = getAuthToken()
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

export async function loginApi(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erreur de connexion (${res.status}) : ${text}`)
  }
  const data = (await res.json()) as { token?: string }
  if (!data.token) throw new Error('Réponse de connexion invalide (pas de token)')
  return data.token
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
