import { useMutation } from '@tanstack/react-query'
import { useEffect, useReducer, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { burnSubtitles, transcribeVideo } from '../features/transcription/transcriptionApi'
import { transcriptReducer } from '../features/transcription/transcriptReducer'
import {
  downloadBlob,
  downloadTextFile,
  findActiveSegmentId,
  formatSrt,
  formatTimecode,
  formatTxt,
  segmentMatchesSearch,
} from '../features/transcription/transcriptionUtils'
import type { TranscriptSegment } from '../features/transcription/types'
import { useVideoFile } from '../features/transcription/useVideoFile'

function readPositiveEnvironmentNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const MAX_UPLOAD_SIZE_MB = readPositiveEnvironmentNumber(import.meta.env.VITE_MAX_UPLOAD_SIZE_MB, 200)
const MAX_VIDEO_DURATION_SECONDS = readPositiveEnvironmentNumber(
  import.meta.env.VITE_MAX_VIDEO_DURATION_SECONDS,
  180,
)

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

type SegmentRowProps = {
  segment: TranscriptSegment
  isActive: boolean
  isSearchMatch: boolean
  isBusy: boolean
  onSeek: (time: number) => void
  onUpdateText: (id: string, text: string) => void
}

function SegmentRow({ segment, isActive, isSearchMatch, isBusy, onSeek, onUpdateText }: SegmentRowProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-3 py-2 transition-colors ${
        isActive
          ? 'border-flame bg-wash'
          : isSearchMatch
            ? 'border-ochre bg-warning-50'
            : 'border-transparent hover:bg-cream'
      }`}
    >
      <button
        type="button"
        onClick={() => onSeek(segment.start)}
        disabled={isBusy}
        className="mt-1.5 shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 font-mono text-xs text-graphite transition-colors hover:bg-stone hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
        aria-label={`Lire la vidéo à partir de ${formatTimecode(segment.start)}`}
      >
        {formatTimecode(segment.start).slice(3, 8)}
      </button>
      <textarea
        className="field-sizing-content w-full resize-none rounded-md bg-transparent px-2 py-1.5 text-sm leading-relaxed text-ink focus:bg-white focus:outline-2 focus:outline-flame disabled:opacity-60"
        rows={1}
        value={segment.text}
        onChange={(event) => onUpdateText(segment.id, event.target.value)}
        disabled={isBusy}
        aria-label={`Texte du segment à ${formatTimecode(segment.start)}`}
      />
    </div>
  )
}

export function TranscriptionPage() {
  const { state: videoFile, select, reset: resetVideoFile } = useVideoFile(MAX_UPLOAD_SIZE_MB, MAX_VIDEO_DURATION_SECONDS)
  const [segments, dispatch] = useReducer(transcriptReducer, [])
  const [search, setSearch] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [dropActive, setDropActive] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const segmentRefs = useRef(new Map<string, HTMLElement>())
  const activeSegmentId = findActiveSegmentId(segments, currentTime)

  const transcription = useMutation({
    mutationFn: transcribeVideo,
    onSuccess: (response) => {
      dispatch({ type: 'reset', segments: response.segments })
      setCopyFeedback(null)
    },
  })

  const burn = useMutation({
    mutationFn: ({ video, srt }: { video: File; srt: string }) => burnSubtitles(video, srt),
    onSuccess: (blob, { video }) => {
      const baseName = video.name.replace(/\.[^.]+$/, '') || 'video'
      downloadBlob(`${baseName}-sous-titres.mp4`, blob)
    },
  })

  useEffect(() => {
    if (!activeSegmentId) return
    segmentRefs.current.get(activeSegmentId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeSegmentId])

  const isBusy = transcription.isPending
  const isBurning = burn.isPending
  const searchMatchCount = segments.filter((segment) => segmentMatchesSearch(segment, search)).length

  const clearTranscript = () => {
    resetVideoFile()
    dispatch({ type: 'reset', segments: [] })
    transcription.reset()
    burn.reset()
    setSearch('')
    setCurrentTime(0)
    setCopyFeedback(null)
  }

  const handleFile = (file: File | undefined) => {
    if (!file || isBusy || isBurning) return
    transcription.reset()
    burn.reset()
    dispatch({ type: 'reset', segments: [] })
    setCurrentTime(0)
    setCopyFeedback(null)
    select(file)
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDropActive(false)
    handleFile(event.dataTransfer.files[0])
  }

  const seekTo = (time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = time
    setCurrentTime(time)
    void video.play().catch(() => undefined)
  }

  const copy = async (content: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopyFeedback(successMessage)
    } catch {
      setCopyFeedback('La copie a échoué. Vérifiez les autorisations du navigateur.')
    }
  }

  const errorMessage = videoFile.error ?? (transcription.error instanceof Error ? transcription.error.message : null)
  const burnError = burn.error instanceof Error ? burn.error.message : null
  const canTranscribe = videoFile.status === 'ready' && !!videoFile.file && !isBusy
  const hasResult = segments.length > 0
  const exportDisabled = !hasResult || isBusy

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 pb-24">
      <header className="max-w-3xl">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-flame">Outil interne</p>
        <h1 className="font-serif text-4xl leading-tight text-ink md:text-5xl">Transcription vidéo</h1>
        <p className="mt-4 text-lg leading-relaxed text-graphite">Déposez une vidéo, corrigez sa transcription au fil de la lecture, puis exportez un texte prêt à partager.</p>
      </header>

      <section aria-labelledby="upload-title" className="rounded-brand border border-stone bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h2 id="upload-title" className="text-lg font-bold text-ink">1. Déposer une vidéo</h2>
            <p className="mt-1 text-sm text-graphite">MP4, MOV, WebM ou M4V · {MAX_UPLOAD_SIZE_MB} Mo maximum · {MAX_VIDEO_DURATION_SECONDS} secondes maximum</p>
          </div>
          {videoFile.file && (
            <button type="button" onClick={clearTranscript} disabled={isBusy || isBurning} className="btn-secondary-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-45">Choisir une autre vidéo</button>
          )}
        </div>

        {!videoFile.file && videoFile.status !== 'reading' && (
          <label
            onDragOver={(event) => { event.preventDefault(); setDropActive(true) }}
            onDragLeave={() => setDropActive(false)}
            onDrop={handleDrop}
            className={`mt-5 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 text-center transition-colors ${
              dropActive ? 'border-flame bg-wash' : 'border-stone bg-cream hover:border-flame hover:bg-wash/60'
            }`}
          >
            <svg className="mb-4 h-9 w-9 text-flame" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5.5 5.5 0 0116.5 9.5H17a3.5 3.5 0 010 7h-1m-4-8v9m0-9l-3 3m3-3l3 3" /></svg>
            <span className="text-base font-bold text-ink">Glissez votre vidéo ici</span>
            <span className="mt-1 text-sm text-graphite">ou cliquez pour la sélectionner</span>
            <input className="sr-only" type="file" accept=".mp4,.mov,.webm,.m4v,video/mp4,video/quicktime,video/webm" onChange={handleInputChange} disabled={isBusy} />
          </label>
        )}

        {videoFile.status === 'reading' && (
          <div className="mt-5 flex min-h-36 items-center gap-3 rounded-xl border border-stone bg-cream px-5 text-sm text-graphite" role="status">
            <span className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-flame border-t-transparent" />
            Lecture des métadonnées vidéo…
          </div>
        )}

        {videoFile.file && videoFile.status === 'ready' && (
          <div className="mt-5 flex flex-col gap-4 rounded-xl border border-success-500/30 bg-success-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-ink">{videoFile.file.name}</p>
              <p className="mt-1 text-sm text-graphite">{formatFileSize(videoFile.file.size)}{videoFile.duration !== null ? ` · ${formatTimecode(videoFile.duration)}` : ' · durée non disponible'}</p>
            </div>
            <button type="button" onClick={() => videoFile.file && transcription.mutate(videoFile.file)} disabled={!canTranscribe} className="btn-primary-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-45">Lancer la transcription</button>
          </div>
        )}

        <p className="mt-4 text-xs leading-relaxed text-graphite">Les contrôles de format, taille et durée accélèrent le parcours, mais ne remplacent pas les validations du serveur.</p>
        {errorMessage && <p className="mt-4 rounded-lg border border-danger-500/30 bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">{errorMessage}</p>}
      </section>

      {isBusy && (
        <section className="rounded-brand border border-stone bg-white p-6 shadow-sm" role="status" aria-live="polite">
          <div className="flex items-center gap-3 text-ink"><span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-flame border-t-transparent" /> <div><p className="font-bold">Transcription en cours…</p><p className="text-sm text-graphite">Cette opération peut prendre quelques secondes.</p></div></div>
        </section>
      )}

      {transcription.isSuccess && !hasResult && (
        <section className="rounded-brand border border-warning-500/30 bg-warning-50 p-5 text-sm text-ink">La transcription est terminée, mais aucun segment éditable n’a été retourné.</section>
      )}

      {hasResult && videoFile.objectUrl && (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="xl:sticky xl:top-0 xl:self-start">
            <div className="rounded-brand border border-stone bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-flame">2. Vérifier à la lecture</p>
              <video ref={videoRef} className="mt-4 w-full rounded-xl bg-ink" controls src={videoFile.objectUrl} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onSeeked={(event) => setCurrentTime(event.currentTarget.currentTime)} />
              <p className="mt-3 text-sm text-graphite">Cliquez sur un timecode pour placer la lecture au début du segment.</p>
            </div>
          </div>

          <div className="rounded-brand border border-stone bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-flame">3. Corriger</p><h2 className="mt-1 text-xl font-bold text-ink">{segments.length} segment{segments.length > 1 ? 's' : ''}</h2></div>
              <label className="block text-xs font-medium text-graphite sm:w-64">Rechercher
                <input className="field-input mt-1" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher dans le texte" disabled={isBusy} />
                {search.trim() && (
                  <span className="mt-1 block text-xs text-graphite" role="status">
                    {searchMatchCount === 0
                      ? 'Aucun segment ne correspond à cette recherche.'
                      : `${searchMatchCount} segment${searchMatchCount > 1 ? 's' : ''} en évidence.`}
                  </span>
                )}
              </label>
            </div>
            <div className="space-y-1">
              {segments.map((segment) => (
                <div key={segment.id} ref={(node) => { if (node) segmentRefs.current.set(segment.id, node); else segmentRefs.current.delete(segment.id) }}>
                  <SegmentRow
                    segment={segment}
                    isActive={segment.id === activeSegmentId}
                    isSearchMatch={segmentMatchesSearch(segment, search)}
                    isBusy={isBusy}
                    onSeek={seekTo}
                    onUpdateText={(id, text) => dispatch({ type: 'update-text', id, text })}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="sticky bottom-0 z-10 -mx-2 border border-stone bg-white/95 p-3 shadow-lg backdrop-blur sm:mx-0 sm:rounded-brand sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-bold text-ink">4. Exporter</p>
            {copyFeedback && <p className="text-xs text-success-700" role="status">{copyFeedback}</p>}
            {isBurning && <p className="text-xs text-graphite" role="status">Incrustation des sous-titres en cours… Cette opération peut prendre quelques minutes.</p>}
            {burnError && <p className="text-xs text-danger-700" role="alert">{burnError}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-45" onClick={() => downloadTextFile('transcription.srt', formatSrt(segments))} disabled={exportDisabled}>Exporter SRT</button>
            <button type="button" className="btn-secondary-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-45" onClick={() => downloadTextFile('transcription.txt', formatTxt(segments))} disabled={exportDisabled}>Exporter TXT</button>
            <button type="button" className="btn-secondary-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-45" onClick={() => void copy(formatTxt(segments), 'Texte copié.') } disabled={exportDisabled}>Copier le texte</button>
            <button
              type="button"
              className="btn-primary-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
              onClick={() => videoFile.file && burn.mutate({ video: videoFile.file, srt: formatSrt(segments) })}
              disabled={exportDisabled || isBurning || !videoFile.file}
            >
              {isBurning ? 'Incrustation en cours…' : 'Exporter la vidéo sous-titrée'}
            </button>
            <button type="button" className="btn-secondary-sm cursor-pointer border-danger-500 text-danger-700 disabled:cursor-not-allowed disabled:opacity-45" onClick={clearTranscript} disabled={isBusy || isBurning || (videoFile.status === 'empty' && !hasResult)}>Réinitialiser</button>
          </div>
        </div>
      </div>
    </div>
  )
}
