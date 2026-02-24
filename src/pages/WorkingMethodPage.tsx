import { useEffect, useRef } from 'react'
import content from '../content/internal/working-method.html?raw'
import { setupAccordion, setupScrollSpy } from '../lib/contentInteractions'

export function WorkingMethodPage() {
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const cleanups = [
      setupAccordion(root, {
        itemSelector: '.note-principle',
        toggleSelector: '.note-principle-toggle',
        panelSelector: '.note-principle-panel',
        openClass: 'is-open',
        singleOpen: true,
      }),
      setupScrollSpy(root, {
        navSelector: 'nav[aria-label="Sommaire"]',
        linkSelector: 'a[href^="#"]',
        activeClass: 'is-active',
        activeOffset: 12,
        smoothScroll: true,
      }),
    ]

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
