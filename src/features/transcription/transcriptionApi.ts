import type { TranscriptSegment, TranscriptionResponse, TranscriptWord } from './types'

const API_BASE_URL = (import.meta.env.VITE_TRANSCRIPTION_API_BASE_URL ?? '').replace(/\/$/, '')

export class TranscriptionApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TranscriptionApiError'
  }
}

function readErrorMessage(payload: unknown): string {
  if (typeof payload === 'string') return payload
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    for (const key of ['message', 'error', 'detail']) {
      if (typeof record[key] === 'string') return record[key]
    }
  }
  return ''
}

function getApiErrorMessage(status: number, payload: unknown, fallback: string): string {
  const detail = readErrorMessage(payload).toLocaleLowerCase('en')
  if (status === 400 && detail.includes('unsupported format')) {
    return 'Ce format vidéo n’est pas pris en charge.'
  }
  if (status === 400 && detail.includes('file too large')) {
    return 'Cette vidéo dépasse la taille maximale autorisée.'
  }
  if (status === 400 && (detail.includes('file') && (detail.includes('missing') || detail.includes('required') || detail.includes('uploaded')))) {
    return 'Sélectionnez une vidéo avant de lancer la transcription.'
  }
  return fallback
}

function asWords(value: unknown): TranscriptWord[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.flatMap((word) => {
    if (!word || typeof word !== 'object') return []
    const record = word as Record<string, unknown>
    if (typeof record.word !== 'string' || typeof record.start !== 'number' || typeof record.end !== 'number') {
      return []
    }
    return [{ word: record.word, start: record.start, end: record.end }]
  })
}

function parseResponse(payload: unknown): TranscriptionResponse {
  if (!payload || typeof payload !== 'object') {
    throw new TranscriptionApiError('La transcription a échoué. Réessayez avec une autre vidéo.')
  }

  const record = payload as Record<string, unknown>
  if (!Array.isArray(record.segments)) {
    throw new TranscriptionApiError('La transcription a échoué. Réessayez avec une autre vidéo.')
  }

  const segments: TranscriptSegment[] = record.segments.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const segment = item as Record<string, unknown>
    if (typeof segment.start !== 'number' || typeof segment.end !== 'number' || typeof segment.text !== 'string') {
      return []
    }
    return [{
      id: `segment-${String(segment.id ?? index + 1)}-${index}`,
      start: segment.start,
      end: segment.end,
      text: segment.text,
      words: asWords(segment.words),
    }]
  })

  return {
    language: typeof record.language === 'string' ? record.language : 'fr',
    duration: typeof record.duration === 'number' ? record.duration : 0,
    segments,
  }
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return response.json()
  return response.text()
}

export async function transcribeVideo(video: File): Promise<TranscriptionResponse> {
  const formData = new FormData()
  formData.append('video', video)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/transcribe`, { method: 'POST', body: formData })
  } catch {
    throw new TranscriptionApiError('Impossible de joindre le service de transcription.')
  }

  const payload = await readResponsePayload(response)
  if (!response.ok) {
    throw new TranscriptionApiError(
      getApiErrorMessage(response.status, payload, 'La transcription a échoué. Réessayez avec une autre vidéo.'),
    )
  }
  return parseResponse(payload)
}

export async function burnSubtitles(video: File, subtitles: string): Promise<Blob> {
  const formData = new FormData()
  formData.append('video', video)
  formData.append('subtitles', subtitles)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/burn-subtitles`, { method: 'POST', body: formData })
  } catch {
    throw new TranscriptionApiError('Impossible de joindre le service de transcription.')
  }

  if (!response.ok) {
    const payload = await readResponsePayload(response)
    throw new TranscriptionApiError(
      getApiErrorMessage(response.status, payload, 'L’incrustation des sous-titres a échoué. Réessayez.'),
    )
  }
  return response.blob()
}
