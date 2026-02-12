/**
 * Cloudflare Worker — UX Tools Notion API
 */

const NOTION_ENDPOINT = 'https://api.notion.com/v1'
const NOTION_VERSION = '2025-09-03'

const dataSourceCache = new Map()

function checkAuth(request, env) {
  const bearerSecret = env.AUTH_BEARER_TOKEN
  if (!bearerSecret) {
    return {
      ok: false,
      response: jsonResponse(
        { error: 'Configuration AUTH_BEARER_TOKEN manquante sur le worker' },
        500,
      ),
    }
  }

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      response: jsonResponse({ error: 'Non autorisé' }, 401),
    }
  }

  const token = authHeader.slice('Bearer '.length).trim()
  if (token !== bearerSecret) {
    return {
      ok: false,
      response: jsonResponse({ error: 'Non autorisé' }, 401),
    }
  }

  return { ok: true }
}

async function getDataSourceIdForDatabase(databaseId, env) {
  const cached = dataSourceCache.get(databaseId)
  if (cached) return cached

  const res = await fetch(`${NOTION_ENDPOINT}/databases/${databaseId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('Notion get database error', res.status, text)
    throw new Error('Erreur lors de la récupération du data_source_id Notion')
  }

  const db = await res.json()
  const firstDataSource = db.data_sources?.[0]
  if (!firstDataSource?.id) {
    console.error('Réponse Notion /databases sans data_sources utilisable', db)
    throw new Error("Aucune data_source trouvée pour cette base Notion")
  }

  dataSourceCache.set(databaseId, firstDataSource.id)
  return firstDataSource.id
}

// ─── Projects ───────────────────────────────────────────────────────────────

function mapProjectPage(page) {
  return {
    id: page.id,
    name: page.properties?.Name?.title?.[0]?.plain_text ?? '',
    questionnaireType: page.properties?.['Questionnaire type']?.select?.name ?? null,
    status: page.properties?.Status?.select?.name ?? null,
    publicToken: page.properties?.['Public token']?.rich_text?.[0]?.plain_text ?? null,
    folder: page.properties?.Folder?.select?.name ?? null,
    productType: page.properties?.['Product type']?.select?.name ?? null,
    productName: page.properties?.['Product name']?.rich_text?.[0]?.plain_text ?? null,
    instructions: page.properties?.Instructions?.rich_text?.map((t) => t.plain_text || '').join('') ?? null,
  }
}

async function handleProjects(request, env) {
  const auth = checkAuth(request, env)
  if (!auth.ok) return auth.response

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const databaseId = env.NOTION_PROJECTS_DB_ID
  if (!env.NOTION_API_KEY || !databaseId) {
    return jsonResponse(
      { error: 'NOTION_API_KEY ou NOTION_PROJECTS_DB_ID manquant dans la configuration du worker' },
      500,
    )
  }

  let dataSourceId
  try {
    dataSourceId = await getDataSourceIdForDatabase(databaseId, env)
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 502)
  }

  const res = await fetch(`${NOTION_ENDPOINT}/data_sources/${dataSourceId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ page_size: 50 }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('Notion error', res.status, text)
    return jsonResponse(
      {
        error: 'Erreur lors de la récupération des projets Notion',
        notionStatus: res.status,
        notionBody: text,
      },
      502,
    )
  }

  const data = await res.json()
  const projects = (data.results || []).map(mapProjectPage)

  return jsonResponse({ projects })
}

async function handleCreateProject(request, env) {
  const auth = checkAuth(request, env)
  if (!auth.ok) return auth.response

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const databaseId = env.NOTION_PROJECTS_DB_ID
  if (!env.NOTION_API_KEY || !databaseId) {
    return jsonResponse(
      { error: 'NOTION_API_KEY ou NOTION_PROJECTS_DB_ID manquant dans la configuration du worker' },
      500,
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Corps JSON invalide' }, 400)
  }

  const { name, questionnaireType, status, publicToken, folder, productType, productName, instructions } = body || {}

  if (!name || typeof name !== 'string') {
    return jsonResponse({ error: 'Le champ name est requis' }, 400)
  }

  const dataSourceId = await getDataSourceIdForDatabase(databaseId, env)

  const token =
    typeof publicToken === 'string' && publicToken.trim().length > 0
      ? publicToken.trim()
      : crypto.randomUUID().replace(/-/g, '').slice(0, 12)

  const notionBody = {
    parent: {
      type: 'data_source_id',
      data_source_id: dataSourceId,
    },
    properties: {
      Name: {
        title: [{ text: { content: name } }],
      },
    },
  }

  if (questionnaireType) {
    notionBody.properties['Questionnaire type'] = { select: { name: questionnaireType } }
  }

  if (status) {
    notionBody.properties.Status = { select: { name: status } }
  }

  if (token) {
    notionBody.properties['Public token'] = {
      rich_text: [{ text: { content: token } }],
    }
  }

  if (folder) {
    notionBody.properties.Folder = { select: { name: folder } }
  }

  if (productType) {
    notionBody.properties['Product type'] = { select: { name: productType } }
  }

  if (typeof productName === 'string' && productName.trim()) {
    notionBody.properties['Product name'] = { rich_text: [{ text: { content: productName.trim() } }] }
  }

  if (typeof instructions === 'string') {
    notionBody.properties.Instructions = { rich_text: [{ text: { content: instructions } }] }
  }

  const res = await fetch(`${NOTION_ENDPOINT}/pages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(notionBody),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('Notion create project error', res.status, text)
    return jsonResponse(
      {
        error: 'Erreur lors de la création du projet Notion',
        notionStatus: res.status,
        notionBody: text,
      },
      502,
    )
  }

  const page = await res.json()
  return jsonResponse({ project: mapProjectPage(page) })
}

async function handleUpdateProject(request, env, projectId) {
  const auth = checkAuth(request, env)
  if (!auth.ok) return auth.response

  if (request.method !== 'PATCH') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Corps JSON invalide' }, 400)
  }

  const { name, questionnaireType, status, publicToken, folder, productType, productName, instructions } = body || {}

  const properties = {}

  if (typeof name === 'string') {
    properties.Name = { title: [{ text: { content: name } }] }
  }

  if (typeof questionnaireType === 'string') {
    properties['Questionnaire type'] = { select: { name: questionnaireType } }
  }

  if (typeof status === 'string') {
    properties.Status = { select: { name: status } }
  }

  if (typeof publicToken === 'string') {
    properties['Public token'] = { rich_text: [{ text: { content: publicToken } }] }
  }

  if (typeof folder === 'string') {
    if (folder.trim() === '') {
      properties.Folder = { select: null }
    } else {
      properties.Folder = { select: { name: folder } }
    }
  }

  if (typeof productType === 'string') {
    if (productType.trim() === '') {
      properties['Product type'] = { select: null }
    } else {
      properties['Product type'] = { select: { name: productType } }
    }
  }

  if (typeof productName === 'string') {
    properties['Product name'] = { rich_text: [{ text: { content: productName } }] }
  }

  if (typeof instructions === 'string') {
    properties.Instructions = { rich_text: [{ text: { content: instructions } }] }
  }

  if (Object.keys(properties).length === 0) {
    return jsonResponse({ error: 'Aucun champ à mettre à jour' }, 400)
  }

  const res = await fetch(`${NOTION_ENDPOINT}/pages/${projectId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('Notion update project error', res.status, text)
    return jsonResponse(
      {
        error: 'Erreur lors de la mise à jour du projet Notion',
        notionStatus: res.status,
        notionBody: text,
      },
      502,
    )
  }

  const page = await res.json()
  return jsonResponse({ project: mapProjectPage(page) })
}

async function handleDeleteProject(request, env, projectId) {
  const auth = checkAuth(request, env)
  if (!auth.ok) return auth.response

  if (request.method !== 'DELETE') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const res = await fetch(`${NOTION_ENDPOINT}/pages/${projectId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ archived: true }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('Notion archive project error', res.status, text)
    return jsonResponse(
      { error: 'Erreur lors de la suppression du projet', notionStatus: res.status, notionBody: text },
      502,
    )
  }

  return jsonResponse({ ok: true })
}

// ─── Responses ──────────────────────────────────────────────────────────────

async function handleProjectResponses(request, env, projectId) {
  const auth = checkAuth(request, env)
  if (!auth.ok) return auth.response

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const databaseId = env.NOTION_RESPONSES_DB_ID
  if (!env.NOTION_API_KEY || !databaseId) {
    return jsonResponse(
      { error: 'NOTION_API_KEY ou NOTION_RESPONSES_DB_ID manquant dans la configuration du worker' },
      500,
    )
  }

  let dataSourceId
  try {
    dataSourceId = await getDataSourceIdForDatabase(databaseId, env)
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 502)
  }

  const body = {
    page_size: 100,
    filter: {
      property: 'Project',
      relation: { contains: projectId },
    },
  }

  const res = await fetch(`${NOTION_ENDPOINT}/data_sources/${dataSourceId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('Notion error (responses)', res.status, text)
    return jsonResponse(
      {
        error: 'Erreur lors de la récupération des réponses Notion',
        notionStatus: res.status,
        notionBody: text,
      },
      502,
    )
  }

  const data = await res.json()

  const responses = (data.results || []).map((page) => ({
    id: page.id,
    archived: page.archived ?? false,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
    properties: page.properties,
  }))

  return jsonResponse({ responses })
}

async function handleDeleteResponse(request, env, projectId, responseId) {
  const auth = checkAuth(request, env)
  if (!auth.ok) return auth.response

  if (request.method !== 'DELETE') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const res = await fetch(`${NOTION_ENDPOINT}/pages/${responseId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ archived: true }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('Notion archive response error', res.status, text)
    return jsonResponse(
      { error: 'Erreur lors de la suppression de la réponse', notionStatus: res.status, notionBody: text },
      502,
    )
  }

  return jsonResponse({ ok: true })
}

async function handleRecoverResponse(request, env, projectId, responseId) {
  const auth = checkAuth(request, env)
  if (!auth.ok) return auth.response

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const res = await fetch(`${NOTION_ENDPOINT}/pages/${responseId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ archived: false }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('Notion recover response error', res.status, text)
    return jsonResponse(
      { error: 'Erreur lors de la récupération de la réponse', notionStatus: res.status, notionBody: text },
      502,
    )
  }

  return jsonResponse({ ok: true })
}

// ─── Public ─────────────────────────────────────────────────────────────────

async function handlePublicSubmit(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const projectsDbId = env.NOTION_PROJECTS_DB_ID
  const responsesDbId = env.NOTION_RESPONSES_DB_ID
  if (!env.NOTION_API_KEY || !projectsDbId || !responsesDbId) {
    return jsonResponse(
      { error: 'Configuration NOTION_API_KEY / NOTION_PROJECTS_DB_ID / NOTION_RESPONSES_DB_ID manquante' },
      500,
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Corps JSON invalide' }, 400)
  }

  const { projectToken, questionnaireId, answers } = body || {}

  if (!projectToken || typeof projectToken !== 'string') {
    return jsonResponse({ error: 'projectToken manquant' }, 400)
  }

  if (!questionnaireId || typeof questionnaireId !== 'string') {
    return jsonResponse({ error: 'questionnaireId manquant' }, 400)
  }

  if (!answers || typeof answers !== 'object') {
    return jsonResponse({ error: 'answers manquant ou invalide' }, 400)
  }

  const projectsDataSourceId = await getDataSourceIdForDatabase(projectsDbId, env)

  const projectQueryBody = {
    page_size: 1,
    filter: {
      property: 'Public token',
      rich_text: { equals: projectToken },
    },
  }

  const projectRes = await fetch(
    `${NOTION_ENDPOINT}/data_sources/${projectsDataSourceId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectQueryBody),
    },
  )

  if (!projectRes.ok) {
    const text = await projectRes.text()
    console.error('Notion query project by token error', projectRes.status, text)
    return jsonResponse(
      { error: 'Erreur lors de la recherche du projet', notionStatus: projectRes.status, notionBody: text },
      502,
    )
  }

  const projectData = await projectRes.json()
  const projectPage = (projectData.results || [])[0]
  if (!projectPage) {
    return jsonResponse({ error: 'Projet introuvable pour ce token' }, 404)
  }

  // Check project status
  const projectStatus = projectPage.properties?.Status?.select?.name
  if (projectStatus === 'Fermé') {
    return jsonResponse({ error: 'Ce questionnaire est fermé', closed: true }, 403)
  }

  const responsesDataSourceId = await getDataSourceIdForDatabase(responsesDbId, env)

  const payload = { questionnaireId, answers }

  const newPageBody = {
    parent: {
      type: 'data_source_id',
      data_source_id: responsesDataSourceId,
    },
    properties: {
      Project: { relation: [{ id: projectPage.id }] },
      Questionnaire: { select: { name: questionnaireId } },
      Payload: { rich_text: [{ text: { content: JSON.stringify(payload) } }] },
    },
  }

  const createRes = await fetch(`${NOTION_ENDPOINT}/pages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(newPageBody),
  })

  if (!createRes.ok) {
    const text = await createRes.text()
    console.error('Notion create response error', createRes.status, text)
    return jsonResponse(
      { error: 'Erreur lors de la création de la réponse Notion', notionStatus: createRes.status, notionBody: text },
      502,
    )
  }

  return jsonResponse({ ok: true }, 201)
}

async function handleProjectStatus(request, env) {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const url = new URL(request.url)
  const token = url.pathname.split('/').pop()

  if (!token) {
    return jsonResponse({ error: 'Token manquant' }, 400)
  }

  const projectsDbId = env.NOTION_PROJECTS_DB_ID
  if (!env.NOTION_API_KEY || !projectsDbId) {
    return jsonResponse({ error: 'Configuration manquante' }, 500)
  }

  const dataSourceId = await getDataSourceIdForDatabase(projectsDbId, env)

  const queryBody = {
    page_size: 1,
    filter: {
      property: 'Public token',
      rich_text: { equals: token },
    },
  }

  const res = await fetch(`${NOTION_ENDPOINT}/data_sources/${dataSourceId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(queryBody),
  })

  if (!res.ok) {
    return jsonResponse({ error: 'Erreur Notion' }, 502)
  }

  const data = await res.json()
  const page = (data.results || [])[0]

  if (!page) {
    return jsonResponse({ error: 'Projet introuvable' }, 404)
  }

  const status = page.properties?.Status?.select?.name ?? 'Ouvert'
  const name = page.properties?.Name?.title?.[0]?.plain_text ?? ''
  const questionnaireType = page.properties?.['Questionnaire type']?.select?.name ?? null
  const productType = page.properties?.['Product type']?.select?.name ?? null
  const productName = page.properties?.['Product name']?.rich_text?.[0]?.plain_text ?? null
  const instructions = page.properties?.Instructions?.rich_text?.map((t) => t.plain_text || '').join('') ?? null

  return jsonResponse({ status, name, questionnaireType, productType, productName, instructions })
}

// ─── Login ──────────────────────────────────────────────────────────────────

async function handleLogin(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const expectedEmail = env.AUTH_EMAIL
  const expectedPassword = env.AUTH_PASSWORD
  const bearerSecret = env.AUTH_BEARER_TOKEN

  if (!expectedEmail || !expectedPassword || !bearerSecret) {
    return jsonResponse(
      { error: 'Configuration AUTH_EMAIL / AUTH_PASSWORD / AUTH_BEARER_TOKEN incomplète' },
      500,
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Corps JSON invalide' }, 400)
  }

  const { email, password } = body || {}

  if (email !== expectedEmail || password !== expectedPassword) {
    return jsonResponse({ error: 'Identifiants invalides' }, 401)
  }

  return jsonResponse({ token: bearerSecret })
}

// ─── CORS + JSON helper ─────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  })
}

// ─── Router ─────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (url.pathname === '/login') {
      return handleLogin(request, env)
    }

    if (url.pathname === '/public/submit') {
      return handlePublicSubmit(request, env)
    }

    // GET /public/project-status/:token
    if (url.pathname.startsWith('/public/project-status/')) {
      return handleProjectStatus(request, env)
    }

    if (url.pathname === '/projects') {
      if (request.method === 'GET') {
        return handleProjects(request, env)
      }
      if (request.method === 'POST') {
        return handleCreateProject(request, env)
      }
    }

    // /projects/:id/responses/:responseId/recover
    const recoverMatch = url.pathname.match(/^\/projects\/([^/]+)\/responses\/([^/]+)\/recover$/)
    if (recoverMatch) {
      return handleRecoverResponse(request, env, recoverMatch[1], recoverMatch[2])
    }

    // /projects/:id/responses/:responseId
    const responseMatch = url.pathname.match(/^\/projects\/([^/]+)\/responses\/([^/]+)$/)
    if (responseMatch) {
      if (request.method === 'DELETE') {
        return handleDeleteResponse(request, env, responseMatch[1], responseMatch[2])
      }
    }

    // /projects/:id/responses
    if (url.pathname.startsWith('/projects/') && url.pathname.endsWith('/responses')) {
      const parts = url.pathname.split('/')
      if (parts.length === 4) {
        const projectId = parts[2]
        return handleProjectResponses(request, env, projectId)
      }
    }

    // /projects/:id
    if (url.pathname.startsWith('/projects/')) {
      const parts = url.pathname.split('/')
      if (parts.length === 3) {
        const projectId = parts[2]
        if (request.method === 'DELETE') {
          return handleDeleteProject(request, env, projectId)
        }
        return handleUpdateProject(request, env, projectId)
      }
    }

    return new Response('Not found', { status: 404 })
  },
}
