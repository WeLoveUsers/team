import { useEffect, useRef } from 'react'
import content from '../content/internal/guidelines-intervention.html?raw'
import { setupScrollSpy } from '../lib/contentInteractions'

export function GuidelinesInterventionPage() {
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const cleanups = [
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
