import type { TranscriptSegment } from './types'

const TIMECODE_PATTERN = /^(\d{2,}):([0-5]\d):([0-5]\d)(?:[.,](\d{1,3}))?$/

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0')
}

export function formatTimecode(seconds: number, decimalSeparator = '.'): string {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000))
  const hours = Math.floor(totalMilliseconds / 3_600_000)
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000)
  const secondsPart = Math.floor((totalMilliseconds % 60_000) / 1000)
  const milliseconds = totalMilliseconds % 1000

  return `${pad(hours)}:${pad(minutes)}:${pad(secondsPart)}${decimalSeparator}${pad(milliseconds, 3)}`
}

export function parseTimecode(value: string): number | null {
  const match = value.trim().match(TIMECODE_PATTERN)
  if (!match) return null

  const [, hours, minutes, seconds, rawMilliseconds = '0'] = match
  const milliseconds = Number(rawMilliseconds.padEnd(3, '0'))
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + milliseconds / 1000
}

export function isValidTimeRange(start: number, end: number): boolean {
  return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && start < end
}

export function formatSrt(segments: TranscriptSegment[]): string {
  return segments.map((segment, index) => (
    `${index + 1}\n${formatTimecode(segment.start, ',')} --> ${formatTimecode(segment.end, ',')}\n${segment.text.trim()}`
  )).join('\n\n')
}

export function formatTxt(segments: TranscriptSegment[]): string {
  return segments.map((segment) => segment.text.trim()).join('\n')
}

export function findActiveSegmentId(segments: TranscriptSegment[], currentTime: number): string | null {
  return segments.find((segment) => currentTime >= segment.start && currentTime < segment.end)?.id ?? null
}

export function segmentMatchesSearch(segment: TranscriptSegment, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase('fr')
  return normalizedQuery.length > 0 && segment.text.toLocaleLowerCase('fr').includes(normalizedQuery)
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function downloadTextFile(filename: string, content: string): void {
  downloadBlob(filename, new Blob([content], { type: 'text/plain;charset=utf-8' }))
}
