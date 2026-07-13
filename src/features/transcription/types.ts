export type TranscriptWord = {
  word: string
  start: number
  end: number
}

export type TranscriptSegment = {
  id: string
  start: number
  end: number
  text: string
  words?: TranscriptWord[]
}

export type TranscriptionResponse = {
  language: string
  duration: number
  segments: TranscriptSegment[]
}
