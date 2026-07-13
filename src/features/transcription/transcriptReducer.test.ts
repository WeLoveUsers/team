import { describe, expect, it } from 'vitest'
import { transcriptReducer } from './transcriptReducer'
import type { TranscriptSegment } from './types'

function makeSegments(): TranscriptSegment[] {
  return [
    { id: 'a', start: 0, end: 2, text: 'Bonjour.' },
    { id: 'b', start: 2, end: 5, text: 'Je cherche le bouton.' },
    { id: 'c', start: 5, end: 8, text: 'Le voilà.' },
  ]
}

describe('transcriptReducer', () => {
  it('remplace le texte d’un segment', () => {
    const next = transcriptReducer(makeSegments(), { type: 'update-text', id: 'b', text: 'Corrigé.' })
    expect(next[1].text).toBe('Corrigé.')
    expect(next[0].text).toBe('Bonjour.')
  })

  it('met à jour des timecodes valides', () => {
    const next = transcriptReducer(makeSegments(), { type: 'update-times', id: 'a', start: 0.5, end: 1.5 })
    expect(next[0]).toMatchObject({ start: 0.5, end: 1.5 })
  })

  it('refuse un timecode invalide (start >= end ou négatif)', () => {
    const segments = makeSegments()
    expect(transcriptReducer(segments, { type: 'update-times', id: 'a', start: 3, end: 2 })).toBe(segments)
    expect(transcriptReducer(segments, { type: 'update-times', id: 'a', start: -1, end: 2 })).toBe(segments)
  })

  it('supprime un segment', () => {
    const next = transcriptReducer(makeSegments(), { type: 'remove', id: 'b' })
    expect(next.map((segment) => segment.id)).toEqual(['a', 'c'])
  })

  it('fusionne avec le suivant : textes concaténés, début du premier, fin du suivant', () => {
    const next = transcriptReducer(makeSegments(), { type: 'merge-next', id: 'a' })
    expect(next).toHaveLength(2)
    expect(next[0]).toMatchObject({ id: 'a', start: 0, end: 5, text: 'Bonjour. Je cherche le bouton.' })
  })

  it('ne fusionne pas le dernier segment', () => {
    const segments = makeSegments()
    expect(transcriptReducer(segments, { type: 'merge-next', id: 'c' })).toBe(segments)
  })

  it('scinde au curseur en répartissant la durée au prorata des longueurs', () => {
    const segments: TranscriptSegment[] = [{ id: 'a', start: 0, end: 10, text: 'aaaa bbbb' }]
    const next = transcriptReducer(segments, { type: 'split', id: 'a', index: 4, newId: 'a2' })
    expect(next).toHaveLength(2)
    expect(next[0]).toMatchObject({ id: 'a', start: 0, end: 5, text: 'aaaa' })
    expect(next[1]).toMatchObject({ id: 'a2', start: 5, end: 10, text: 'bbbb' })
  })

  it('ignore une scission qui produirait une partie vide', () => {
    const segments = makeSegments()
    expect(transcriptReducer(segments, { type: 'split', id: 'a', index: 0, newId: 'x' })).toBe(segments)
    expect(transcriptReducer(segments, { type: 'split', id: 'a', index: 99, newId: 'x' })).toBe(segments)
  })

  it('déplace un segment vers le haut ou le bas', () => {
    const down = transcriptReducer(makeSegments(), { type: 'move', id: 'a', direction: 'down' })
    expect(down.map((segment) => segment.id)).toEqual(['b', 'a', 'c'])
    const up = transcriptReducer(makeSegments(), { type: 'move', id: 'b', direction: 'up' })
    expect(up.map((segment) => segment.id)).toEqual(['b', 'a', 'c'])
  })

  it('ignore un déplacement hors limites', () => {
    const segments = makeSegments()
    expect(transcriptReducer(segments, { type: 'move', id: 'a', direction: 'up' })).toBe(segments)
    expect(transcriptReducer(segments, { type: 'move', id: 'c', direction: 'down' })).toBe(segments)
  })

  it('réinitialise la liste', () => {
    expect(transcriptReducer(makeSegments(), { type: 'reset', segments: [] })).toEqual([])
  })
})
