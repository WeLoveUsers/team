import { afterEach, describe, expect, it, vi } from 'vitest'
import { TranscriptionApiError, burnSubtitles, transcribeVideo } from './transcriptionApi'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function makeVideoFile(): File {
  return new File(['fake-video-bytes'], 'demo.mp4', { type: 'video/mp4' })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('transcribeVideo', () => {
  it('envoie un POST multipart avec le champ « video »', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ language: 'fr', duration: 1, segments: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const file = makeVideoFile()
    await transcribeVideo(file)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url.endsWith('/api/transcribe')).toBe(true)
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('video')).toBe(file)
  })

  it('parse la réponse et tolère l’absence de « words »', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      language: 'fr',
      duration: 64.18,
      segments: [
        { id: 1, start: 0, end: 2.1, text: 'Bonjour.', words: [{ word: 'Bonjour', start: 0, end: 0.5 }] },
        { id: 2, start: 2.1, end: 5, text: 'Suite.' },
      ],
    })))

    const result = await transcribeVideo(makeVideoFile())
    expect(result.language).toBe('fr')
    expect(result.duration).toBe(64.18)
    expect(result.segments).toHaveLength(2)
    expect(result.segments[0].words).toEqual([{ word: 'Bonjour', start: 0, end: 0.5 }])
    expect(result.segments[1].words).toBeUndefined()
  })

  it('traduit 400 « Unsupported format »', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Unsupported format' }, 400)))
    await expect(transcribeVideo(makeVideoFile())).rejects.toThrow('Ce format vidéo n’est pas pris en charge.')
  })

  it('traduit 400 « File too large »', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'File too large' }, 400)))
    await expect(transcribeVideo(makeVideoFile())).rejects.toThrow('Cette vidéo dépasse la taille maximale autorisée.')
  })

  it('traduit 400 fichier absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'No video file uploaded' }, 400)))
    await expect(transcribeVideo(makeVideoFile())).rejects.toThrow('Sélectionnez une vidéo avant de lancer la transcription.')
  })

  it('traduit une erreur réseau', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(transcribeVideo(makeVideoFile())).rejects.toThrow('Impossible de joindre le service de transcription.')
  })

  it('traduit toute autre erreur serveur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Internal error' }, 500)))
    const promise = transcribeVideo(makeVideoFile())
    await expect(promise).rejects.toBeInstanceOf(TranscriptionApiError)
    await expect(promise).rejects.toThrow('La transcription a échoué. Réessayez avec une autre vidéo.')
  })

  it('rejette une réponse OK sans liste de segments', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ language: 'fr' })))
    await expect(transcribeVideo(makeVideoFile())).rejects.toThrow('La transcription a échoué. Réessayez avec une autre vidéo.')
  })
})

describe('burnSubtitles', () => {
  const srt = '1\n00:00:00,000 --> 00:00:02,100\nBonjour.'

  it('envoie un POST multipart avec la vidéo et les sous-titres', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(['mp4']), {
      status: 200,
      headers: { 'content-type': 'video/mp4' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const file = makeVideoFile()
    await burnSubtitles(file, srt)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url.endsWith('/api/burn-subtitles')).toBe(true)
    expect(init.method).toBe('POST')
    const body = init.body as FormData
    expect(body.get('video')).toBe(file)
    expect(body.get('subtitles')).toBe(srt)
  })

  it('retourne la vidéo sous forme de blob', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['mp4-bytes']), {
      status: 200,
      headers: { 'content-type': 'video/mp4' },
    })))

    const blob = await burnSubtitles(makeVideoFile(), srt)
    expect(await blob.text()).toBe('mp4-bytes')
  })

  it('traduit une erreur réseau', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(burnSubtitles(makeVideoFile(), srt)).rejects.toThrow('Impossible de joindre le service de transcription.')
  })

  it('utilise un message d’échec dédié à l’incrustation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Transcription failed' }, 500)))
    const promise = burnSubtitles(makeVideoFile(), srt)
    await expect(promise).rejects.toBeInstanceOf(TranscriptionApiError)
    await expect(promise).rejects.toThrow('L’incrustation des sous-titres a échoué. Réessayez.')
  })
})
