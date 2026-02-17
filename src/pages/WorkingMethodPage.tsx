import { useEffect, useRef } from 'react'
import content from '../content/internal/working-method.html?raw'

const TOC_SECTION_IDS = ['changement', 'ia', 'principes', 'implications'] as const

function getClosestScrollableAncestor(element: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element.parentElement
  while (current) {
    const { overflowY } = window.getComputedStyle(current)
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return current
    }
    current = current.parentElement
  }
  return null
}

export function WorkingMethodPage() {
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const cards = Array.from(root.querySelectorAll<HTMLElement>('.note-principle'))
    const cleanups: Array<() => void> = []

    const closeCard = (card: HTMLElement) => {
      const button = card.querySelector<HTMLButtonElement>('.note-principle-toggle')
      const panel = card.querySelector<HTMLElement>('.note-principle-panel')
      if (!button || !panel) return

      card.classList.remove('is-open')
      button.setAttribute('aria-expanded', 'false')
      panel.style.maxHeight = '0px'
    }

    const openCard = (card: HTMLElement) => {
      const button = card.querySelector<HTMLButtonElement>('.note-principle-toggle')
      const panel = card.querySelector<HTMLElement>('.note-principle-panel')
      if (!button || !panel) return

      card.classList.add('is-open')
      button.setAttribute('aria-expanded', 'true')
      panel.style.maxHeight = `${panel.scrollHeight}px`
    }

    cards.forEach((card) => {
      const button = card.querySelector<HTMLButtonElement>('.note-principle-toggle')
      if (!button) return

      const onClick = () => {
        const wasOpen = card.classList.contains('is-open')
        cards.forEach(closeCard)
        if (!wasOpen) {
          openCard(card)
        }
      }

      button.addEventListener('click', onClick)
      cleanups.push(() => button.removeEventListener('click', onClick))
    })

    const onResize = () => {
      cards.forEach((card) => {
        if (!card.classList.contains('is-open')) return
        const panel = card.querySelector<HTMLElement>('.note-principle-panel')
        if (!panel) return
        panel.style.maxHeight = `${panel.scrollHeight}px`
      })
    }

    window.addEventListener('resize', onResize)
    cleanups.push(() => window.removeEventListener('resize', onResize))

    const tocNav = root.querySelector<HTMLElement>('nav[aria-label="Sommaire"]')
    const tocLinks = Array.from(
      root.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Sommaire"] a[href^="#"]'),
    )
    const tocSections = TOC_SECTION_IDS
      .map((sectionId) => document.getElementById(sectionId))
      .filter((section): section is HTMLElement => !!section)

    const setActiveTocLink = (activeSectionId: string) => {
      tocLinks.forEach((link) => {
        const isActive = link.getAttribute('href') === `#${activeSectionId}`
        link.classList.toggle('is-active', isActive)
        if (isActive) {
          link.setAttribute('aria-current', 'location')
        } else {
          link.removeAttribute('aria-current')
        }
      })
    }

    const scrollContainer = getClosestScrollableAncestor(root)
    const syncActiveTocLink = () => {
      if (tocSections.length === 0) return
      const containerTop = scrollContainer?.getBoundingClientRect().top ?? 0
      const navBottom = tocNav?.getBoundingClientRect().bottom ?? (containerTop + 96)
      const probeY = navBottom + 12
      let activeSectionId = tocSections[0].id

      for (const section of tocSections) {
        if (section.getBoundingClientRect().top <= probeY) {
          activeSectionId = section.id
        } else {
          break
        }
      }

      setActiveTocLink(activeSectionId)
    }

    if (tocLinks.length > 0 && tocSections.length > 0) {
      setActiveTocLink(tocSections[0].id)
    }

    tocLinks.forEach((link) => {
      const onClick = () => {
        const targetSectionId = link.getAttribute('href')?.slice(1)
        if (!targetSectionId) return
        setActiveTocLink(targetSectionId)
      }
      link.addEventListener('click', onClick)
      cleanups.push(() => link.removeEventListener('click', onClick))
    })

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', syncActiveTocLink, { passive: true })
      cleanups.push(() => scrollContainer.removeEventListener('scroll', syncActiveTocLink))
    }
    window.addEventListener('scroll', syncActiveTocLink, { passive: true })
    cleanups.push(() => window.removeEventListener('scroll', syncActiveTocLink))
    window.addEventListener('resize', syncActiveTocLink)
    cleanups.push(() => window.removeEventListener('resize', syncActiveTocLink))
    syncActiveTocLink()
    requestAnimationFrame(syncActiveTocLink)

    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className="mx-auto w-full max-w-5xl"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
