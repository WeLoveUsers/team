import { useEffect, useRef, useState } from 'react'

export type VideoFileState = {
  file: File | null
  objectUrl: string | null
  duration: number | null
  status: 'empty' | 'reading' | 'ready' | 'error'
  error: string | null
}

type ObjectUrlApi = {
  createObjectURL: (file: Blob) => string
  revokeObjectURL: (url: string) => void
}

export function createObjectUrlLease(urlApi: ObjectUrlApi) {
  let currentUrl: string | null = null

  return {
    replace(file: File): string {
      if (currentUrl) urlApi.revokeObjectURL(currentUrl)
      currentUrl = urlApi.createObjectURL(file)
      return currentUrl
    },
    release(): void {
      if (!currentUrl) return
      urlApi.revokeObjectURL(currentUrl)
      currentUrl = null
    },
    current(): string | null {
      return currentUrl
    },
  }
}

const SUPPORTED_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v']

function hasSupportedExtension(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase('en')
  return !!extension && SUPPORTED_EXTENSIONS.includes(extension)
}

export function useVideoFile(maxSizeMb: number, maxDurationSeconds: number) {
  const [state, setState] = useState<VideoFileState>({
    file: null,
    objectUrl: null,
    duration: null,
    status: 'empty',
    error: null,
  })
  const leaseRef = useRef<ReturnType<typeof createObjectUrlLease> | null>(null)
  if (leaseRef.current == null) {
    leaseRef.current = createObjectUrlLease(URL)
  }

  const reset = () => {
    leaseRef.current?.release()
    setState({ file: null, objectUrl: null, duration: null, status: 'empty', error: null })
  }

  const select = (file: File) => {
    const lease = leaseRef.current!
    lease.release()
    if (!hasSupportedExtension(file)) {
      setState({ file: null, objectUrl: null, duration: null, status: 'error', error: 'Ce format vidéo n’est pas pris en charge.' })
      return
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setState({
        file: null,
        objectUrl: null,
        duration: null,
        status: 'error',
        error: 'Cette vidéo dépasse la taille maximale autorisée.',
      })
      return
    }

    const objectUrl = lease.replace(file)
    setState({ file, objectUrl, duration: null, status: 'reading', error: null })
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = objectUrl

    const cleanUpVideo = () => {
      video.removeAttribute('src')
      video.load()
    }

    video.onloadedmetadata = () => {
      if (lease.current() !== objectUrl) return
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null
      cleanUpVideo()
      if (duration !== null && duration > maxDurationSeconds) {
        lease.release()
        setState({
          file: null,
          objectUrl: null,
          duration: null,
          status: 'error',
          error: `Cette vidéo dépasse la durée maximale autorisée (${maxDurationSeconds} secondes).`,
        })
        return
      }
      setState({ file, objectUrl, duration, status: 'ready', error: null })
    }
    video.onerror = () => {
      if (lease.current() !== objectUrl) return
      cleanUpVideo()
      lease.release()
      setState({
        file: null,
        objectUrl: null,
        duration: null,
        status: 'error',
        error: 'Impossible de lire les métadonnées de cette vidéo.',
      })
    }
  }

  useEffect(() => () => leaseRef.current?.release(), [])

  return { state, select, reset }
}
