/**
 * Cloudflare Worker — UX Tools Notion API
 */

const NOTION_ENDPOINT = 'https://api.notion.com/v1'
const NOTION_VERSION = '2025-09-03'

const dataSourceCache = new Map()
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const AUTH_ROLES = ['admin', 'team']
const AUTH_STATUSES = ['active', 'suspended']
const DEFAULT_JWT_TTL_SECONDS = 60 * 60 * 12
const DOCUMENT_TEMPLATE_PHASES = ['Préparation', 'Passation', 'Restitution']
const DOCUMENT_TEMPLATE_TYPES = ['Google Doc', 'Google Slide', 'Google Sheet', 'Google Form']
const DOCUMENT_TEMPLATE_PHASE_BY_NORMALIZED = {
  preparation: 'Préparation',
  passation: 'Passation',
  restitution: 'Restitution',
}
const DOCUMENT_TEMPLATE_TYPE_BY_NORMALIZED = {
  googledoc: 'Google Doc',
  googledocs: 'Google Doc',
  googledocument: 'Google Doc',
  doc: 'Google Doc',
  googlefiledoc: 'Google Doc',
  googleslide: 'Google Slide',
  googleslides: 'Google Slide',
  slide: 'Google Slide',
  slides: 'Google Slide',
  presentation: 'Google Slide',
  googlepresentation: 'Google Slide',
  googlesheet: 'Google Sheet',
  googlesheets: 'Google Sheet',
  sheet: 'Google Sheet',
  sheets: 'Google Sheet',
  googletableur: 'Google Sheet',
  googleform: 'Google Form',
  googleforms: 'Google Form',
  form: 'Google Form',
  formulaire: 'Google Form',
  googlequestionnaire: 'Google Form',
}

let bootstrapAdminPromise = null

/**
 * Normalise le label Notion "Questionnaire type" en identifiant technique.
 * Miroir de computeQuestionnaireId côté front (src/components/Sidebar.tsx).
 */
function computeQuestionnaireIdFromType(questionnaireType) {
  if (!questionnaireType) return null
  const raw = questionnaireType.toLowerCase()
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')

  if (normalized.includes('sus')) return 'sus'
  if (normalized.includes('deep')) return 'deep'
  if (normalized.includes('umuxlite'))
    return 'umux_lite'
  if (normalized.includes('umux')) return 'umux'
  if (
    normalized.includes('ueqs')
    || normalized.includes('ueqshort')
    || normalized.includes('userexperiencequestionnaireshort')
  ) return 'ueq_s'
  if (normalized.includes('ueq') || normalized.includes('userexperiencequestionnaire')) return 'ueq'
  if (normalized.includes('abrige') || normalized.includes('abridged'))
    return 'attrakdiff_abridged'
  if (normalized.includes('attrakdiff')) return 'attrakdiff'
  return null
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

function normalizeRole(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return AUTH_ROLES.includes(normalized) ? normalized : null
}

function normalizeStatus(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return AUTH_STATUSES.includes(normalized) ? normalized : null
}

function normalizeLooseLabel(value) {
  if (typeof value !== 'string') return ''
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function normalizeDocumentTemplatePhase(value) {
  const normalized = normalizeLooseLabel(value)
  return DOCUMENT_TEMPLATE_PHASE_BY_NORMALIZED[normalized] ?? null
}

function normalizeDocumentTemplateType(value) {
  const normalized = normalizeLooseLabel(value)
  return DOCUMENT_TEMPLATE_TYPE_BY_NORMALIZED[normalized] ?? null
}

function findNotionProperty(properties, aliases) {
  if (!properties || typeof properties !== 'object') return null
  const byNormalizedAlias = new Set(aliases.map((alias) => normalizeLooseLabel(alias)))
  const entries = Object.entries(properties)
  for (const [key, value] of entries) {
    if (byNormalizedAlias.has(normalizeLooseLabel(key))) {
      return value
    }
  }
  return null
}

function readNotionTitle(property) {
  if (!property) return ''
  const title = property.title
  if (!Array.isArray(title)) return ''
  return title.map((part) => part?.plain_text || '').join('').trim()
}

function readNotionRichText(property) {
  if (!property) return ''
  const richText = property.rich_text
  if (!Array.isArray(richText)) return ''
  return richText.map((part) => part?.plain_text || '').join('').trim()
}

function readNotionUrl(property) {
  if (!property) return ''
  if (typeof property.url === 'string' && property.url.trim()) {
    return property.url.trim()
  }
  return readNotionRichText(property)
}

function readNotionSelectName(property) {
  if (!property) return ''
  return typeof property.select?.name === 'string' ? property.select.name.trim() : ''
}

function normalizeExpiresAt(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const trimmed = value.trim()

  // Date-only values are interpreted as end of day UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const endOfDay = new Date(`${trimmed}T23:59:59.999Z`)
    return Number.isNaN(endOfDay.getTime()) ? null : endOfDay.toISOString()
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function isExpiredAt(expiresAtIso) {
  const parsed = Date.parse(expiresAtIso)
  if (Number.isNaN(parsed)) return true
  return parsed <= Date.now()
}

function readBearerToken(request) {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

function bytesToBase64Url(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Base64Url invalide')
  }
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(base64 + padding)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function stringToBase64Url(value) {
  return bytesToBase64Url(textEncoder.encode(value))
}

function base64UrlToString(value) {
  return textDecoder.decode(base64UrlToBytes(value))
}

function timingSafeEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

async function derivePasswordBits(password, saltBytes, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    keyMaterial,
    256,
  )
  return new Uint8Array(bits)
}

async function hashPassword(plainPassword) {
  const iterations = 100_000
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const digest = await derivePasswordBits(plainPassword, saltBytes, iterations)
  return `pbkdf2$${iterations}$${bytesToBase64Url(saltBytes)}$${bytesToBase64Url(digest)}`
}

async function verifyPassword(plainPassword, storedHash) {
  try {
    if (typeof storedHash !== 'string') return false
    const parts = storedHash.split('$')
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false

    const iterations = Number.parseInt(parts[1], 10)
    if (!Number.isFinite(iterations) || iterations < 10_000) return false

    const salt = base64UrlToBytes(parts[2])
    const expected = base64UrlToBytes(parts[3])
    const actual = await derivePasswordBits(plainPassword, salt, iterations)
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

async function signHmacSHA256(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    textEncoder.encode(message),
  )
  return new Uint8Array(signature)
}

async function signJwt(payload, secret) {
  const encodedHeader = stringToBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const encodedPayload = stringToBase64Url(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = await signHmacSHA256(signingInput, secret)
  return `${signingInput}.${bytesToBase64Url(signature)}`
}

async function verifyJwt(token, secret) {
  if (typeof token !== 'string') return null
  const segments = token.split('.')
  if (segments.length !== 3) return null

  const [encodedHeader, encodedPayload, encodedSignature] = segments
  let header
  let payload
  try {
    header = JSON.parse(base64UrlToString(encodedHeader))
    payload = JSON.parse(base64UrlToString(encodedPayload))
  } catch {
    return null
  }

  if (header?.alg !== 'HS256' || header?.typ !== 'JWT') return null
  if (!payload || typeof payload !== 'object') return null

  const signingInput = `${encodedHeader}.${encodedPayload}`
  const expectedSignature = await signHmacSHA256(signingInput, secret)
  let providedSignature
  try {
    providedSignature = base64UrlToBytes(encodedSignature)
  } catch {
    return null
  }

  if (!timingSafeEqual(expectedSignature, providedSignature)) return null

  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.nbf === 'number' && now < payload.nbf) return null
  if (typeof payload.exp === 'number' && now >= payload.exp) return null
  return payload
}

function ensureAuthSetup(env) {
  if (!env.DB) {
    return jsonResponse({ error: 'Configuration D1 manquante (binding DB).' }, 500)
  }
  if (!env.JWT_SECRET) {
    return jsonResponse({ error: 'Configuration JWT_SECRET manquante.' }, 500)
  }
  return null
}

function userToSafeJson(userRow) {
  return {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    role: userRow.role,
    status: userRow.status,
    expiresAt: userRow.expires_at,
    createdAt: userRow.created_at ?? null,
    updatedAt: userRow.updated_at ?? null,
  }
}

async function fetchUserById(env, userId) {
  return env.DB
    .prepare(
      `SELECT id, name, email, role, status, expires_at, password_hash, created_at, updated_at
       FROM users
       WHERE id = ?1
       LIMIT 1`,
    )
    .bind(userId)
    .first()
}

async function countActiveAdmins(env, excludedUserId = null) {
  const query = excludedUserId
    ? env.DB.prepare('SELECT id, status, expires_at FROM users WHERE role = ?1 AND id != ?2').bind('admin', excludedUserId)
    : env.DB.prepare('SELECT id, status, expires_at FROM users WHERE role = ?1').bind('admin')
  const rows = await query.all()
  const admins = rows?.results ?? []
  return admins.filter((row) => row.status === 'active' && !isExpiredAt(row.expires_at)).length
}

function isMissingUsersTableError(error) {
  return error instanceof Error && /no such table:\s*users/i.test(error.message)
}

async function ensureBootstrapAdmin(env) {
  if (!env.DB) return
  if (bootstrapAdminPromise) {
    await bootstrapAdminPromise
    return
  }

  bootstrapAdminPromise = (async () => {
    const countRow = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first()
    const count = Number.parseInt(String(countRow?.count ?? '0'), 10)
    if (Number.isFinite(count) && count > 0) return

    const email = normalizeEmail(env.BOOTSTRAP_ADMIN_EMAIL)
    const password = typeof env.BOOTSTRAP_ADMIN_PASSWORD === 'string' ? env.BOOTSTRAP_ADMIN_PASSWORD : ''
    if (!email || !password) {
      return
    }

    const name = typeof env.BOOTSTRAP_ADMIN_NAME === 'string' && env.BOOTSTRAP_ADMIN_NAME.trim()
      ? env.BOOTSTRAP_ADMIN_NAME.trim()
      : 'Admin'
    const expiresAt = normalizeExpiresAt(
      typeof env.BOOTSTRAP_ADMIN_EXPIRES_AT === 'string'
        ? env.BOOTSTRAP_ADMIN_EXPIRES_AT
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    )

    if (!expiresAt || isExpiredAt(expiresAt)) {
      console.warn('BOOTSTRAP_ADMIN_EXPIRES_AT est invalide ou déjà expiré; aucun admin bootstrap créé.')
      return
    }

    const passwordHash = await hashPassword(password)
    const nowIso = new Date().toISOString()

    await env.DB.prepare(
      `INSERT OR IGNORE INTO users
      (id, name, email, password_hash, role, status, expires_at, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, 'admin', 'active', ?5, ?6, ?7)`,
    ).bind(
      crypto.randomUUID(),
      name,
      email,
      passwordHash,
      expiresAt,
      nowIso,
      nowIso,
    ).run()
  })()

  try {
    await bootstrapAdminPromise
  } finally {
    bootstrapAdminPromise = null
  }
}

async function createAccessTokenForUser(user, env) {
  const ttl = Number.parseInt(String(env.JWT_TTL_SECONDS ?? DEFAULT_JWT_TTL_SECONDS), 10)
  const ttlSeconds = Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_JWT_TTL_SECONDS
  const now = Math.floor(Date.now() / 1000)
  return signJwt(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: now,
      exp: now + ttlSeconds,
    },
    env.JWT_SECRET,
  )
}

async function requireAuth(request, env, options = {}) {
  const setupError = ensureAuthSetup(env)
  if (setupError) {
    return { ok: false, response: setupError }
  }

  const token = readBearerToken(request)
  if (!token) {
    return { ok: false, response: jsonResponse({ error: 'Non autorisé' }, 401) }
  }

  const payload = await verifyJwt(token, env.JWT_SECRET)
  if (!payload || typeof payload.sub !== 'string') {
    return { ok: false, response: jsonResponse({ error: 'Non autorisé' }, 401) }
  }

  const user = await fetchUserById(env, payload.sub)
  if (!user) {
    return { ok: false, response: jsonResponse({ error: 'Non autorisé' }, 401) }
  }

  if (user.status !== 'active') {
    return { ok: false, response: jsonResponse({ error: 'Compte suspendu' }, 403) }
  }

  if (isExpiredAt(user.expires_at)) {
    return { ok: false, response: jsonResponse({ error: 'Compte expiré' }, 403) }
  }

  if (options.roles && Array.isArray(options.roles) && !options.roles.includes(user.role)) {
    return { ok: false, response: jsonResponse({ error: 'Accès refusé' }, 403) }
  }

  return { ok: true, user }
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
  const auth = await requireAuth(request, env)
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
  const auth = await requireAuth(request, env)
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
  const auth = await requireAuth(request, env)
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
  const auth = await requireAuth(request, env)
  if (!auth.ok) return auth.response

  if (request.method !== 'DELETE') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const responsesDbId = env.NOTION_RESPONSES_DB_ID
  if (!env.NOTION_API_KEY || !responsesDbId) {
    return jsonResponse(
      { error: 'NOTION_API_KEY ou NOTION_RESPONSES_DB_ID manquant dans la configuration du worker' },
      500,
    )
  }

  let responsesDataSourceId
  try {
    responsesDataSourceId = await getDataSourceIdForDatabase(responsesDbId, env)
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 502)
  }

  const relatedResponseIds = []
  let nextCursor = null
  while (true) {
    const queryBody = {
      page_size: 100,
      filter: {
        property: 'Project',
        relation: { contains: projectId },
      },
      ...(nextCursor ? { start_cursor: nextCursor } : {}),
    }

    const queryRes = await fetch(`${NOTION_ENDPOINT}/data_sources/${responsesDataSourceId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryBody),
    })

    if (!queryRes.ok) {
      const text = await queryRes.text()
      console.error('Notion query responses for project delete error', queryRes.status, text)
      return jsonResponse(
        {
          error: 'Erreur lors de la récupération des réponses liées au projet',
          notionStatus: queryRes.status,
          notionBody: text,
        },
        502,
      )
    }

    const queryData = await queryRes.json()
    const pageIds = (queryData.results || [])
      .filter((page) => page && typeof page.id === 'string' && page.archived !== true)
      .map((page) => page.id)
    relatedResponseIds.push(...pageIds)

    if (!queryData.has_more || !queryData.next_cursor) {
      break
    }
    nextCursor = queryData.next_cursor
  }

  for (const responseId of relatedResponseIds) {
    const archiveResponseRes = await fetch(`${NOTION_ENDPOINT}/pages/${responseId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${env.NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ archived: true }),
    })

    if (!archiveResponseRes.ok) {
      const text = await archiveResponseRes.text()
      console.error('Notion archive response during project delete error', archiveResponseRes.status, text)
      return jsonResponse(
        {
          error: 'Erreur lors de la suppression des réponses liées au projet',
          responseId,
          notionStatus: archiveResponseRes.status,
          notionBody: text,
        },
        502,
      )
    }
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

  return jsonResponse({ ok: true, deletedResponsesCount: relatedResponseIds.length })
}

// ─── Document Templates ─────────────────────────────────────────────────────

function mapDocumentTemplatePage(page) {
  const properties = page?.properties ?? {}
  const name = readNotionTitle(
    findNotionProperty(properties, ['Nom', 'Name', 'Titre', 'Title']),
  )
  const rawUrl = readNotionUrl(
    findNotionProperty(properties, ['URL', 'Url', 'Lien', 'Link']),
  )
  const rawPhase = readNotionSelectName(
    findNotionProperty(properties, ['Phase', 'Phases']),
  )
  const rawType = readNotionSelectName(
    findNotionProperty(properties, ['Type', 'Format']),
  )

  let url = ''
  if (rawUrl) {
    try {
      url = new URL(rawUrl).toString()
    } catch {
      url = ''
    }
  }

  return {
    id: page.id,
    name,
    url,
    phase: normalizeDocumentTemplatePhase(rawPhase),
    type: normalizeDocumentTemplateType(rawType),
    _rawPhase: rawPhase || null,
    _rawType: rawType || null,
    _rawUrl: rawUrl || null,
  }
}

function isValidDocumentTemplate(template) {
  return (
    typeof template?.id === 'string'
    && typeof template?.name === 'string'
    && typeof template?.url === 'string'
    && template.name.trim().length > 0
    && template.url.trim().length > 0
    && typeof template.phase === 'string'
    && DOCUMENT_TEMPLATE_PHASES.includes(template.phase)
    && typeof template.type === 'string'
    && DOCUMENT_TEMPLATE_TYPES.includes(template.type)
  )
}

async function handleDocumentTemplates(request, env) {
  const requiresAdmin = request.method === 'POST'
  const auth = await requireAuth(request, env, requiresAdmin ? { roles: ['admin'] } : undefined)
  if (!auth.ok) return auth.response

  if (request.method === 'GET') {
    const databaseId = env.NOTION_TEMPLATES_DB_ID
    if (!env.NOTION_API_KEY || !databaseId) {
      return jsonResponse(
        { error: 'NOTION_API_KEY ou NOTION_TEMPLATES_DB_ID manquant dans la configuration du worker' },
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
      body: JSON.stringify({
        page_size: 100,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('Notion templates query error', res.status, text)
      return jsonResponse(
        {
          error: 'Erreur lors de la récupération des modèles Notion',
          notionStatus: res.status,
          notionBody: text,
        },
        502,
      )
    }

    const data = await res.json()
    const mappedTemplates = (data.results || []).map(mapDocumentTemplatePage)
    const templates = mappedTemplates.filter(isValidDocumentTemplate)
    const skipped = mappedTemplates.length - templates.length

    if (skipped > 0) {
      console.warn('Some Notion templates were skipped due to invalid shape', {
        total: mappedTemplates.length,
        kept: templates.length,
        skipped,
        sample: mappedTemplates
          .filter((template) => !isValidDocumentTemplate(template))
          .slice(0, 5)
          .map((template) => ({
            id: template.id,
            name: template.name,
            url: template.url,
            phase: template.phase,
            type: template.type,
            rawPhase: template._rawPhase,
            rawType: template._rawType,
            rawUrl: template._rawUrl,
          })),
      })
    }

    const sanitizedTemplates = templates.map((template) => ({
      id: template.id,
      name: template.name,
      url: template.url,
      phase: template.phase,
      type: template.type,
    }))

    return jsonResponse({
      templates: sanitizedTemplates,
      meta: {
        total: mappedTemplates.length,
        kept: sanitizedTemplates.length,
        skipped,
      },
    })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const databaseId = env.NOTION_TEMPLATES_DB_ID
  if (!env.NOTION_API_KEY || !databaseId) {
    return jsonResponse(
      { error: 'NOTION_API_KEY ou NOTION_TEMPLATES_DB_ID manquant dans la configuration du worker' },
      500,
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Corps JSON invalide' }, 400)
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const phase = normalizeDocumentTemplatePhase(body?.phase)
  const type = normalizeDocumentTemplateType(body?.type)
  const rawUrl = typeof body?.url === 'string' ? body.url.trim() : ''

  if (!name) {
    return jsonResponse({ error: 'Le nom du modèle est requis.' }, 400)
  }

  if (!phase) {
    return jsonResponse({ error: 'La phase est invalide.' }, 400)
  }

  if (!type) {
    return jsonResponse({ error: 'Le type est invalide.' }, 400)
  }

  let normalizedUrl
  try {
    normalizedUrl = new URL(rawUrl).toString()
  } catch {
    return jsonResponse({ error: "L'URL du modèle est invalide." }, 400)
  }

  let dataSourceId
  try {
    dataSourceId = await getDataSourceIdForDatabase(databaseId, env)
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 502)
  }

  const notionBody = {
    parent: {
      type: 'data_source_id',
      data_source_id: dataSourceId,
    },
    properties: {
      Nom: {
        title: [{ text: { content: name } }],
      },
      URL: {
        url: normalizedUrl,
      },
      Phase: {
        select: { name: phase },
      },
      Type: {
        select: { name: type },
      },
    },
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
    console.error('Notion create template error', res.status, text)
    return jsonResponse(
      {
        error: 'Erreur lors de la création du modèle Notion',
        notionStatus: res.status,
        notionBody: text,
      },
      502,
    )
  }

  const page = await res.json()
  const template = mapDocumentTemplatePage(page)
  const sanitizedTemplate = {
    id: template.id,
    name: template.name,
    url: template.url,
    phase: template.phase,
    type: template.type,
  }
  if (!isValidDocumentTemplate(template)) {
    return jsonResponse(
      {
        template: {
          id: page.id,
          name,
          url: normalizedUrl,
          phase,
          type,
        },
      },
      201,
    )
  }
  return jsonResponse({ template: sanitizedTemplate }, 201)
}

async function handleDeleteDocumentTemplate(request, env, templateId) {
  const auth = await requireAuth(request, env, { roles: ['admin'] })
  if (!auth.ok) return auth.response

  if (request.method !== 'DELETE') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  if (!env.NOTION_API_KEY) {
    return jsonResponse({ error: 'NOTION_API_KEY manquant dans la configuration du worker' }, 500)
  }

  const res = await fetch(`${NOTION_ENDPOINT}/pages/${templateId}`, {
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
    console.error('Notion archive template error', res.status, text)
    return jsonResponse(
      {
        error: 'Erreur lors de la suppression du modèle',
        notionStatus: res.status,
        notionBody: text,
      },
      502,
    )
  }

  return jsonResponse({ ok: true })
}

// ─── Responses ──────────────────────────────────────────────────────────────

async function handleProjectResponses(request, env, projectId) {
  const auth = await requireAuth(request, env)
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
  const auth = await requireAuth(request, env)
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
  const auth = await requireAuth(request, env)
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

  const { projectToken, answers } = body || {}

  if (!projectToken || typeof projectToken !== 'string') {
    return jsonResponse({ error: 'projectToken manquant' }, 400)
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

  // Derive questionnaireId from the project (source of truth)
  const questionnaireType = projectPage.properties?.['Questionnaire type']?.select?.name
  if (!questionnaireType) {
    return jsonResponse({ error: 'Type de questionnaire non défini pour ce projet' }, 400)
  }
  const questionnaireId = computeQuestionnaireIdFromType(questionnaireType)
  if (!questionnaireId) {
    return jsonResponse({ error: 'Type de questionnaire non reconnu' }, 400)
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

  const setupError = ensureAuthSetup(env)
  if (setupError) {
    return setupError
  }

  await ensureBootstrapAdmin(env)

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Corps JSON invalide' }, 400)
  }

  const email = normalizeEmail(body?.email)
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !email.includes('@') || !password) {
    return jsonResponse({ error: 'Identifiants invalides' }, 401)
  }

  const user = await env.DB.prepare(
    `SELECT id, name, email, role, status, expires_at, password_hash, created_at, updated_at
     FROM users
     WHERE email = ?1
     LIMIT 1`,
  ).bind(email).first()

  if (!user) {
    const usersCountRow = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first()
    const usersCount = Number.parseInt(String(usersCountRow?.count ?? '0'), 10)
    if (Number.isFinite(usersCount) && usersCount === 0) {
      return jsonResponse(
        {
          error: 'Aucun utilisateur trouvé. Configurez BOOTSTRAP_ADMIN_EMAIL et BOOTSTRAP_ADMIN_PASSWORD pour créer le premier admin.',
        },
        503,
      )
    }
    return jsonResponse({ error: 'Identifiants invalides' }, 401)
  }

  const passwordOk = await verifyPassword(password, user.password_hash)
  if (!passwordOk) {
    return jsonResponse({ error: 'Identifiants invalides' }, 401)
  }

  if (user.status !== 'active') {
    return jsonResponse({ error: 'Compte suspendu' }, 403)
  }

  if (isExpiredAt(user.expires_at)) {
    return jsonResponse({ error: 'Compte expiré' }, 403)
  }

  const token = await createAccessTokenForUser(user, env)
  return jsonResponse({ token, user: userToSafeJson(user) })
}

async function handleAuthMe(request, env) {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const auth = await requireAuth(request, env)
  if (!auth.ok) return auth.response
  return jsonResponse({ user: userToSafeJson(auth.user) })
}

async function handleAdminUsers(request, env) {
  const auth = await requireAuth(request, env, { roles: ['admin'] })
  if (!auth.ok) return auth.response

  if (request.method === 'GET') {
    const rows = await env.DB
      .prepare(
        `SELECT id, name, email, role, status, expires_at, created_at, updated_at
         FROM users
         ORDER BY created_at DESC, email ASC`,
      )
      .all()

    const users = (rows?.results ?? []).map(userToSafeJson)
    return jsonResponse({ users })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Corps JSON invalide' }, 400)
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = normalizeEmail(body?.email)
  const password = typeof body?.password === 'string' ? body.password : ''
  const role = normalizeRole(body?.role) ?? 'team'
  const status = normalizeStatus(body?.status) ?? 'active'
  const expiresAt = normalizeExpiresAt(body?.expiresAt)

  if (!name) {
    return jsonResponse({ error: 'Le nom est requis.' }, 400)
  }

  if (!email || !email.includes('@')) {
    return jsonResponse({ error: "L'email est invalide." }, 400)
  }

  if (password.trim().length < 8) {
    return jsonResponse({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, 400)
  }

  if (!expiresAt) {
    return jsonResponse({ error: "La date d'expiration est invalide." }, 400)
  }

  if (isExpiredAt(expiresAt)) {
    return jsonResponse({ error: "La date d'expiration doit être dans le futur." }, 400)
  }

  const existingByEmail = await env.DB
    .prepare('SELECT id FROM users WHERE email = ?1 LIMIT 1')
    .bind(email)
    .first()
  if (existingByEmail) {
    return jsonResponse({ error: 'Un compte avec cet email existe déjà.' }, 409)
  }

  const passwordHash = await hashPassword(password)
  const userId = crypto.randomUUID()
  const nowIso = new Date().toISOString()

  await env.DB.prepare(
    `INSERT INTO users
    (id, name, email, password_hash, role, status, expires_at, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  ).bind(
    userId,
    name,
    email,
    passwordHash,
    role,
    status,
    expiresAt,
    nowIso,
    nowIso,
  ).run()

  const createdUser = await fetchUserById(env, userId)
  if (!createdUser) {
    return jsonResponse({ error: 'Impossible de relire le compte créé.' }, 500)
  }
  return jsonResponse({ user: userToSafeJson(createdUser) }, 201)
}

function isActiveAdmin(user) {
  return user.role === 'admin' && user.status === 'active' && !isExpiredAt(user.expires_at)
}

async function handleAdminUserUpdate(request, env, userId) {
  if (request.method !== 'PATCH') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const auth = await requireAuth(request, env, { roles: ['admin'] })
  if (!auth.ok) return auth.response

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Corps JSON invalide' }, 400)
  }

  const existingUser = await fetchUserById(env, userId)
  if (!existingUser) {
    return jsonResponse({ error: 'Compte introuvable.' }, 404)
  }

  const nextName = body?.name === undefined
    ? existingUser.name
    : (typeof body.name === 'string' ? body.name.trim() : '')
  if (!nextName) {
    return jsonResponse({ error: 'Le nom est requis.' }, 400)
  }

  let nextEmail = existingUser.email
  if (body?.email !== undefined) {
    nextEmail = normalizeEmail(body.email)
    if (!nextEmail || !nextEmail.includes('@')) {
      return jsonResponse({ error: "L'email est invalide." }, 400)
    }
    const emailOwner = await env.DB
      .prepare('SELECT id FROM users WHERE email = ?1 LIMIT 1')
      .bind(nextEmail)
      .first()
    if (emailOwner && emailOwner.id !== existingUser.id) {
      return jsonResponse({ error: 'Un compte avec cet email existe déjà.' }, 409)
    }
  }

  let nextRole = existingUser.role
  if (body?.role !== undefined) {
    const normalizedRole = normalizeRole(body.role)
    if (!normalizedRole) {
      return jsonResponse({ error: 'Rôle invalide.' }, 400)
    }
    nextRole = normalizedRole
  }

  let nextStatus = existingUser.status
  if (body?.status !== undefined) {
    const normalizedStatus = normalizeStatus(body.status)
    if (!normalizedStatus) {
      return jsonResponse({ error: 'Statut invalide.' }, 400)
    }
    nextStatus = normalizedStatus
  }

  let nextExpiresAt = existingUser.expires_at
  if (body?.expiresAt !== undefined) {
    const normalizedExpiresAt = normalizeExpiresAt(body.expiresAt)
    if (!normalizedExpiresAt) {
      return jsonResponse({ error: "Date d'expiration invalide." }, 400)
    }
    nextExpiresAt = normalizedExpiresAt
  }

  if (nextStatus === 'active' && isExpiredAt(nextExpiresAt)) {
    return jsonResponse({ error: "Un compte actif ne peut pas avoir une date d'expiration passée." }, 400)
  }

  if (existingUser.id === auth.user.id && nextRole !== 'admin') {
    return jsonResponse({ error: 'Vous ne pouvez pas vous retirer le rôle admin.' }, 400)
  }

  if (existingUser.id === auth.user.id && nextStatus !== 'active') {
    return jsonResponse({ error: 'Vous ne pouvez pas suspendre votre propre compte.' }, 400)
  }

  const existingIsActiveAdmin = isActiveAdmin(existingUser)
  const nextStateIsActiveAdmin = nextRole === 'admin' && nextStatus === 'active' && !isExpiredAt(nextExpiresAt)
  if (existingIsActiveAdmin && !nextStateIsActiveAdmin) {
    const activeAdminsWithoutCurrent = await countActiveAdmins(env, existingUser.id)
    if (activeAdminsWithoutCurrent === 0) {
      return jsonResponse({ error: 'Au moins un admin actif doit être conservé.' }, 400)
    }
  }

  let nextPasswordHash = existingUser.password_hash
  if (body?.password !== undefined) {
    const newPassword = typeof body.password === 'string' ? body.password : ''
    if (newPassword.trim().length < 8) {
      return jsonResponse({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, 400)
    }
    nextPasswordHash = await hashPassword(newPassword)
  }

  const nowIso = new Date().toISOString()
  await env.DB.prepare(
    `UPDATE users
     SET name = ?1,
         email = ?2,
         role = ?3,
         status = ?4,
         expires_at = ?5,
         password_hash = ?6,
         updated_at = ?7
     WHERE id = ?8`,
  ).bind(
    nextName,
    nextEmail,
    nextRole,
    nextStatus,
    nextExpiresAt,
    nextPasswordHash,
    nowIso,
    existingUser.id,
  ).run()

  const updatedUser = await fetchUserById(env, existingUser.id)
  if (!updatedUser) {
    return jsonResponse({ error: 'Impossible de relire le compte mis à jour.' }, 500)
  }
  return jsonResponse({ user: userToSafeJson(updatedUser) })
}

async function handleAdminUserDelete(request, env, userId) {
  if (request.method !== 'DELETE') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const auth = await requireAuth(request, env, { roles: ['admin'] })
  if (!auth.ok) return auth.response

  const targetUser = await fetchUserById(env, userId)
  if (!targetUser) {
    return jsonResponse({ error: 'Compte introuvable.' }, 404)
  }

  if (targetUser.id === auth.user.id) {
    return jsonResponse({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, 400)
  }

  if (isActiveAdmin(targetUser)) {
    const activeAdminsWithoutCurrent = await countActiveAdmins(env, targetUser.id)
    if (activeAdminsWithoutCurrent === 0) {
      return jsonResponse({ error: 'Au moins un admin actif doit être conservé.' }, 400)
    }
  }

  await env.DB.prepare('DELETE FROM users WHERE id = ?1').bind(targetUser.id).run()
  return jsonResponse({ ok: true })
}

async function handleAdminUserRoute(request, env, userId) {
  if (request.method === 'PATCH') {
    return handleAdminUserUpdate(request, env, userId)
  }
  if (request.method === 'DELETE') {
    return handleAdminUserDelete(request, env, userId)
  }
  return jsonResponse({ error: 'Method not allowed' }, 405)
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
    try {
      const url = new URL(request.url)

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS })
      }

      if (url.pathname === '/login') {
        return handleLogin(request, env)
      }

      if (url.pathname === '/auth/me') {
        return handleAuthMe(request, env)
      }

      if (url.pathname === '/admin/users') {
        return handleAdminUsers(request, env)
      }

      const adminUserMatch = url.pathname.match(/^\/admin\/users\/([^/]+)$/)
      if (adminUserMatch) {
        return handleAdminUserRoute(request, env, adminUserMatch[1])
      }

      if (url.pathname === '/public/submit') {
        return handlePublicSubmit(request, env)
      }

      // GET /public/project-status/:token
      if (url.pathname.startsWith('/public/project-status/')) {
        return handleProjectStatus(request, env)
      }

      if (url.pathname === '/document-templates') {
        return handleDocumentTemplates(request, env)
      }

      const documentTemplateMatch = url.pathname.match(/^\/document-templates\/([^/]+)$/)
      if (documentTemplateMatch) {
        return handleDeleteDocumentTemplate(request, env, documentTemplateMatch[1])
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
    } catch (error) {
      console.error('Unhandled worker error', error)
      if (isMissingUsersTableError(error)) {
        return jsonResponse(
          {
            error: 'Table users introuvable sur D1. Exécutez la migration SQL avant de lancer le login.',
          },
          500,
        )
      }
      return jsonResponse({ error: 'Erreur interne du worker' }, 500)
    }
  },
}
