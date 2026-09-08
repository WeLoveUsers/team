import { describe, expect, it } from 'vitest'
import {
  buildFirstNameDirective,
  buildMecueDirective,
  parseCollectFirstName,
  parseMecueSelection,
  stripProjectDirectives,
} from './questionnaires'

describe('directive @firstname', () => {
  it('détecte la directive quel que soit sa casse', () => {
    expect(parseCollectFirstName('Merci de participer.\n\n@firstname')).toBe(true)
    expect(parseCollectFirstName('@FirstName')).toBe(true)
  })

  it('reste inactive sans directive', () => {
    expect(parseCollectFirstName('Merci de participer.')).toBe(false)
    expect(parseCollectFirstName(null)).toBe(false)
    expect(parseCollectFirstName('')).toBe(false)
  })

  it('ne confond pas la directive avec un mot plus long', () => {
    expect(parseCollectFirstName('@firstnamefoo')).toBe(false)
  })

  it('construit la directive seulement si l\'option est activée', () => {
    expect(buildFirstNameDirective(true)).toBe('@firstname')
    expect(buildFirstNameDirective(false)).toBe('')
  })
})

describe('stripProjectDirectives', () => {
  it('retire toutes les directives du texte affiché au répondant', () => {
    const stored = ['Évaluez @product_name.', buildMecueDirective(['U', 'F']), buildFirstNameDirective(true)]
      .filter(Boolean)
      .join('\n\n')

    expect(stored).toContain('@mecue:U,F')
    expect(stripProjectDirectives(stored)).toBe('Évaluez @product_name.')
  })

  it('préserve les instructions sans directive', () => {
    expect(stripProjectDirectives('Ligne 1\n\nLigne 2')).toBe('Ligne 1\n\nLigne 2')
    expect(stripProjectDirectives(null)).toBe('')
  })

  it('conserve un aller-retour lisible entre le formulaire et le répondant', () => {
    const stored = ['Bonjour.', buildFirstNameDirective(true)].join('\n\n')
    expect(parseCollectFirstName(stored)).toBe(true)
    expect(parseMecueSelection(stored)).toBeNull()
    expect(stripProjectDirectives(stored)).toBe('Bonjour.')
  })
})
