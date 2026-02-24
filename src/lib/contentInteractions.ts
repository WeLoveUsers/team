type Cleanup = () => void

type AccordionOptions = {
  itemSelector: string
  toggleSelector: string
  panelSelector: string
  openClass: string
  singleOpen: boolean
}

type ScrollSpyOptions = {
  navSelector: string
  linkSelector: string
  activeClass: string
  activeAriaCurrent: string
  activeOffset: number
  smoothScroll: boolean
}

const DEFAULT_ACCORDION_OPTIONS: AccordionOptions = {
  itemSelector: '.note-principle',
  toggleSelector: '.note-principle-toggle',
  panelSelector: '.note-principle-panel',
  openClass: 'is-open',
  singleOpen: true,
}

const DEFAULT_SCROLL_SPY_OPTIONS: ScrollSpyOptions = {
  navSelector: 'nav[aria-label="Sommaire"]',
  linkSelector: 'a[href^="#"]',
  activeClass: 'is-active',
  activeAriaCurrent: 'location',
  activeOffset: 12,
  smoothScroll: true,
}

type AccordionItem = {
  card: HTMLElement
  button: HTMLButtonElement
  panel: HTMLElement
}

function getClosestScrollableAncestor(element: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element.parentElement
  while (current) {
    const { overflowY } = window.getComputedStyle(current)
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return current
    }
    current = current.parentElement
  }
  return null
}

function getHashTargetId(link: HTMLAnchorElement): string | null {
  const href = link.getAttribute('href')
  if (!href || !href.startsWith('#')) return null
  const rawId = href.slice(1).trim()
  if (!rawId) return null
  try {
    return decodeURIComponent(rawId)
  } catch {
    return rawId
  }
}

export function setupAccordion(root: HTMLElement, options: Partial<AccordionOptions> = {}): Cleanup {
  const config = { ...DEFAULT_ACCORDION_OPTIONS, ...options }
  const items = Array.from(root.querySelectorAll<HTMLElement>(config.itemSelector))
    .map<AccordionItem | null>((card) => {
      const button = card.querySelector<HTMLButtonElement>(config.toggleSelector)
      const panel = card.querySelector<HTMLElement>(config.panelSelector)
      if (!button || !panel) return null
      return { card, button, panel }
    })
    .filter((item): item is AccordionItem => !!item)

  if (items.length === 0) return () => {}

  const cleanups: Cleanup[] = []
  const byCard = new Map(items.map((item) => [item.card, item]))

  const closeItem = (card: HTMLElement) => {
    const item = byCard.get(card)
    if (!item) return
    card.classList.remove(config.openClass)
    item.button.setAttribute('aria-expanded', 'false')
    item.panel.style.maxHeight = '0px'
  }

  const openItem = (card: HTMLElement) => {
    const item = byCard.get(card)
    if (!item) return
    card.classList.add(config.openClass)
    item.button.setAttribute('aria-expanded', 'true')
    item.panel.style.maxHeight = `${item.panel.scrollHeight}px`
  }

  const refreshOpenHeights = () => {
    items.forEach(({ card, panel }) => {
      if (!card.classList.contains(config.openClass)) return
      panel.style.maxHeight = `${panel.scrollHeight}px`
    })
  }

  items.forEach(({ card, button }) => {
    closeItem(card)
    const onClick = () => {
      const wasOpen = card.classList.contains(config.openClass)
      if (config.singleOpen) {
        items.forEach(({ card: currentCard }) => closeItem(currentCard))
      } else if (wasOpen) {
        closeItem(card)
        return
      }
      if (!wasOpen) {
        openItem(card)
      }
    }
    button.addEventListener('click', onClick)
    cleanups.push(() => button.removeEventListener('click', onClick))
  })

  window.addEventListener('resize', refreshOpenHeights)
  cleanups.push(() => window.removeEventListener('resize', refreshOpenHeights))

  return () => {
    cleanups.forEach((cleanup) => cleanup())
  }
}

export function setupScrollSpy(root: HTMLElement, options: Partial<ScrollSpyOptions> = {}): Cleanup {
  const config = { ...DEFAULT_SCROLL_SPY_OPTIONS, ...options }
  const nav = root.querySelector<HTMLElement>(config.navSelector)
  if (!nav) return () => {}

  const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>(config.linkSelector))
  if (links.length === 0) return () => {}

  const sectionsById = new Map<string, HTMLElement>()
  const orderedSections: HTMLElement[] = []

  links.forEach((link) => {
    const targetId = getHashTargetId(link)
    if (!targetId) return
    const section = document.getElementById(targetId)
    if (!(section instanceof HTMLElement)) return
    if (!root.contains(section)) return
    if (sectionsById.has(targetId)) return
    sectionsById.set(targetId, section)
    orderedSections.push(section)
  })

  if (orderedSections.length === 0) return () => {}

  const scrollContainer = getClosestScrollableAncestor(root)
  const cleanups: Cleanup[] = []

  const setActiveLink = (activeSectionId: string) => {
    links.forEach((link) => {
      const targetId = getHashTargetId(link)
      const isActive = targetId === activeSectionId
      link.classList.toggle(config.activeClass, isActive)
      if (isActive) {
        link.setAttribute('aria-current', config.activeAriaCurrent)
      } else {
        link.removeAttribute('aria-current')
      }
    })
  }

  const syncActiveLink = () => {
    const containerTop = scrollContainer?.getBoundingClientRect().top ?? 0
    const navBottom = nav.getBoundingClientRect().bottom || (containerTop + 96)
    const probeY = navBottom + config.activeOffset
    let activeSectionId = orderedSections[0].id

    for (const section of orderedSections) {
      if (section.getBoundingClientRect().top <= probeY) {
        activeSectionId = section.id
      } else {
        break
      }
    }

    setActiveLink(activeSectionId)
  }

  const scrollToSection = (sectionId: string, behavior: ScrollBehavior) => {
    const section = sectionsById.get(sectionId)
    if (!section) return
    section.scrollIntoView({ behavior, block: 'start', inline: 'nearest' })
  }

  let rafId: number | null = null
  const queueSync = () => {
    if (rafId !== null) return
    rafId = window.requestAnimationFrame(() => {
      rafId = null
      syncActiveLink()
    })
  }

  links.forEach((link) => {
    const onClick = (event: Event) => {
      const targetId = getHashTargetId(link)
      if (!targetId || !sectionsById.has(targetId)) return
      event.preventDefault()
      setActiveLink(targetId)
      scrollToSection(targetId, config.smoothScroll ? 'smooth' : 'auto')
      const nextHash = `#${targetId}`
      if (window.location.hash !== nextHash) {
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${nextHash}`)
      }
      queueSync()
    }
    link.addEventListener('click', onClick)
    cleanups.push(() => link.removeEventListener('click', onClick))
  })

  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', queueSync, { passive: true })
    cleanups.push(() => scrollContainer.removeEventListener('scroll', queueSync))
  }
  window.addEventListener('scroll', queueSync, { passive: true })
  cleanups.push(() => window.removeEventListener('scroll', queueSync))
  window.addEventListener('resize', queueSync)
  cleanups.push(() => window.removeEventListener('resize', queueSync))

  const initialHashId = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : ''
  if (initialHashId && sectionsById.has(initialHashId)) {
    setActiveLink(initialHashId)
    window.requestAnimationFrame(() => scrollToSection(initialHashId, 'auto'))
  } else {
    setActiveLink(orderedSections[0].id)
  }
  queueSync()

  return () => {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId)
    }
    cleanups.forEach((cleanup) => cleanup())
  }
}
