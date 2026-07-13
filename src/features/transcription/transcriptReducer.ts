import { isValidTimeRange } from './transcriptionUtils'
import type { TranscriptSegment } from './types'

export type TranscriptAction =
  | { type: 'reset'; segments: TranscriptSegment[] }
  | { type: 'update-text'; id: string; text: string }
  | { type: 'update-times'; id: string; start: number; end: number }
  | { type: 'remove'; id: string }
  | { type: 'merge-next'; id: string }
  | { type: 'split'; id: string; index: number; newId: string }
  | { type: 'move'; id: string; direction: 'up' | 'down' }

function updateSegment(
  segments: TranscriptSegment[],
  id: string,
  update: (segment: TranscriptSegment) => TranscriptSegment,
): TranscriptSegment[] {
  return segments.map((segment) => segment.id === id ? update(segment) : segment)
}

export function transcriptReducer(
  segments: TranscriptSegment[],
  action: TranscriptAction,
): TranscriptSegment[] {
  switch (action.type) {
    case 'reset':
      return action.segments
    case 'update-text':
      return updateSegment(segments, action.id, (segment) => ({ ...segment, text: action.text }))
    case 'update-times':
      if (!isValidTimeRange(action.start, action.end)) return segments
      return updateSegment(segments, action.id, (segment) => ({
        ...segment,
        start: action.start,
        end: action.end,
      }))
    case 'remove':
      return segments.filter((segment) => segment.id !== action.id)
    case 'merge-next': {
      const index = segments.findIndex((segment) => segment.id === action.id)
      if (index < 0 || index === segments.length - 1) return segments
      const current = segments[index]
      const next = segments[index + 1]
      const merged: TranscriptSegment = {
        ...current,
        end: next.end,
        text: [current.text.trim(), next.text.trim()].filter(Boolean).join(' '),
        words: current.words || next.words ? [...(current.words ?? []), ...(next.words ?? [])] : undefined,
      }
      return [...segments.slice(0, index), merged, ...segments.slice(index + 2)]
    }
    case 'split': {
      const index = segments.findIndex((segment) => segment.id === action.id)
      if (index < 0) return segments
      const current = segments[index]
      if (action.index <= 0 || action.index >= current.text.length) return segments
      const firstText = current.text.slice(0, action.index).trim()
      const secondText = current.text.slice(action.index).trim()
      if (!firstText || !secondText) return segments

      const totalLength = firstText.length + secondText.length
      const splitTime = current.start + ((current.end - current.start) * firstText.length) / totalLength
      const first: TranscriptSegment = { ...current, end: splitTime, text: firstText, words: undefined }
      const second: TranscriptSegment = {
        ...current,
        id: action.newId,
        start: splitTime,
        text: secondText,
        words: undefined,
      }
      return [...segments.slice(0, index), first, second, ...segments.slice(index + 1)]
    }
    case 'move': {
      const index = segments.findIndex((segment) => segment.id === action.id)
      const target = action.direction === 'up' ? index - 1 : index + 1
      if (index < 0 || target < 0 || target >= segments.length) return segments
      const next = [...segments]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    }
  }
}
