import { describe, expect, it } from 'vitest'
import {
  findActiveSegmentId,
  formatSrt,
  formatTimecode,
  formatTxt,
  isValidTimeRange,
  parseTimecode,
  segmentMatchesSearch,
} from './transcriptionUtils'
import type { TranscriptSegment } from './types'

const segments: TranscriptSegment[] = [
  { id: 'a', start: 0, end: 2.1, text: 'Bonjour.' },
  { id: 'b', start: 2.1, end: 5, text: 'Je cherche le bouton.' },
]

describe('formatTimecode', () => {
  it('formate en HH:MM:SS.mmm', () => {
    expect(formatTimecode(0)).toBe('00:00:00.000')
    expect(formatTimecode(3661.5)).toBe('01:01:01.500')
  })

  it('accepte un séparateur décimal personnalisé pour le SRT', () => {
    expect(formatTimecode(1.5, ',')).toBe('00:00:01,500')
  })

  it('ne produit jamais de valeur négative', () => {
    expect(formatTimecode(-3)).toBe('00:00:00.000')
  })
})

describe('parseTimecode', () => {
  it('lit HH:MM:SS.mmm avec point ou virgule', () => {
    expect(parseTimecode('00:01:02.500')).toBe(62.5)
    expect(parseTimecode('00:01:02,500')).toBe(62.5)
    expect(parseTimecode('00:00:05')).toBe(5)
  })

  it('rejette les valeurs invalides', () => {
    expect(parseTimecode('abc')).toBeNull()
    expect(parseTimecode('00:61:00')).toBeNull()
    expect(parseTimecode('1:2:3')).toBeNull()
  })
})

describe('isValidTimeRange', () => {
  it('exige 0 <= start < end', () => {
    expect(isValidTimeRange(0, 1)).toBe(true)
    expect(isValidTimeRange(1, 1)).toBe(false)
    expect(isValidTimeRange(2, 1)).toBe(false)
    expect(isValidTimeRange(-1, 2)).toBe(false)
    expect(isValidTimeRange(Number.NaN, 2)).toBe(false)
  })
})

describe('exports', () => {
  it('formate le SRT avec des timestamps HH:MM:SS,mmm', () => {
    expect(formatSrt(segments)).toBe(
      '1\n00:00:00,000 --> 00:00:02,100\nBonjour.'
      + '\n\n2\n00:00:02,100 --> 00:00:05,000\nJe cherche le bouton.',
    )
  })

  it('formate le TXT avec un segment par ligne', () => {
    expect(formatTxt(segments)).toBe('Bonjour.\nJe cherche le bouton.')
  })
})

describe('findActiveSegmentId', () => {
  it('retourne le segment couvrant le temps courant', () => {
    expect(findActiveSegmentId(segments, 1)).toBe('a')
    expect(findActiveSegmentId(segments, 2.1)).toBe('b')
  })

  it('retourne null hors de tout segment', () => {
    expect(findActiveSegmentId(segments, 10)).toBeNull()
    expect(findActiveSegmentId([], 0)).toBeNull()
  })
})

describe('segmentMatchesSearch', () => {
  it('trouve le texte sans tenir compte de la casse', () => {
    expect(segmentMatchesSearch(segments[1], 'BOUTON')).toBe(true)
    expect(segmentMatchesSearch(segments[0], 'bouton')).toBe(false)
  })

  it('ignore une recherche vide', () => {
    expect(segmentMatchesSearch(segments[0], '')).toBe(false)
    expect(segmentMatchesSearch(segments[0], '   ')).toBe(false)
  })
})
