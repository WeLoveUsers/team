import { useEffect, useRef } from 'react'
import content from '../content/internal/working-method.html?raw'

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
