import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { DocumentTemplate, Project } from '../api'
import { DOCUMENT_TEMPLATE_PHASE_TO_SLUG } from '../lib/documentTemplates'
import {
  ensureDocumentTemplatesLoaded,
  getCachedDocumentTemplates,
  subscribeDocumentTemplates,
} from '../lib/documentTemplatesCache'
import {
  ensureProjectsListLoaded,
  getCachedProjectsList,
  subscribeProjectsList,
} from '../lib/projectsListCache'
import { SyncIndicator, type SyncState } from './SyncIndicator'

type TeamShellProps = {
  children: ReactNode
  onLogout: () => void
  fullBleed?: boolean
  headerSyncState?: SyncState
  canAccessAdministration?: boolean
}

type NavSubItem = {
  to: string
  label: string
  end?: boolean
}

type NavItem = {
  to: string
  label: string
  end?: boolean
  separatorBefore?: boolean
  children?: NavSubItem[]
  icon?: ReactNode
}

/* ── Icônes SVG (outline, 20×20 viewBox) ────────────────────────────── */

const IconHome = (
  <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
  </svg>
)

const IconCompass = (
  <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
)

const IconClipboard = (
  <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
)

const IconPalette = (
  <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
  </svg>
)

const IconDocument = (
  <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
)

const IconSettings = (
  <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const IconLogout = (
  <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
)

/* ── Données de navigation ──────────────────────────────────────────── */

const DOC_CATEGORY_LINKS: NavSubItem[] = [
  { to: '/modeles-documents/preparation', label: 'Préparation', end: true },
  { to: '/modeles-documents/passation', label: 'Passation', end: true },
  { to: '/modeles-documents/restitution', label: 'Restitution', end: true },
]

const BASE_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Accueil', end: true, icon: IconHome },
  { to: '/notre-facon-de-travailler', label: 'Notre façon de travailler', icon: IconCompass },
  { to: '/questionnaires', label: 'Questionnaires UX', icon: IconClipboard },
  {
    to: '/charte-graphique',
    label: 'Charte graphique',
    icon: IconPalette,
    children: [
      { to: '/charte-graphique/fonts', label: 'Fonts' },
      { to: '/charte-graphique/slides', label: 'Slides' },
      { to: '/charte-graphique', label: 'Design system', end: true },
    ],
  },
  {
    to: '/modeles-documents',
    label: 'Modèles de documents',
    icon: IconDocument,
    children: DOC_CATEGORY_LINKS,
  },
]

const ADMIN_NAV_ITEM: NavItem = {
  to: '/administration',
  label: 'Administration',
  separatorBefore: true,
  icon: IconSettings,
}

const NO_FOLDER = '__sans_dossier__'

function hasSecondLevel(item: NavItem): boolean {
  return item.to === '/questionnaires' || !!item.children?.length
}

function findParentWithSecondLevel(pathname: string, navItems: NavItem[]): NavItem | undefined {
  return navItems.find((item) => (
    hasSecondLevel(item)
    && (pathname === item.to || pathname.startsWith(`${item.to}/`))
  ))
}

function getTopLevelTarget(item: NavItem): string {
  if (item.to === '/charte-graphique') return '/charte-graphique/fonts'
  if (item.to === '/questionnaires') return '/questionnaires'
  if (item.to === '/modeles-documents') return '/modeles-documents/preparation'
  return item.to
}

export function TeamShell({
  children,
  onLogout,
  fullBleed = false,
  headerSyncState,
  canAccessAdministration = false,
}: TeamShellProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const navItems = useMemo(
    () => (canAccessAdministration ? [...BASE_NAV_ITEMS, ADMIN_NAV_ITEM] : BASE_NAV_ITEMS),
    [canAccessAdministration],
  )
  const locationParent = findParentWithSecondLevel(location.pathname, navItems)
  const [openParentTo, setOpenParentTo] = useState<string | null>(locationParent?.to ?? null)
  const initialCachedProjects = getCachedProjectsList()
  const initialCachedDocumentTemplates = getCachedDocumentTemplates()
  const [questionnaireProjects, setQuestionnaireProjects] = useState<Project[]>(
    () => initialCachedProjects ?? [],
  )
  const [questionnairesLoading, setQuestionnairesLoading] = useState(!initialCachedProjects)
  const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplate[]>(
    () => initialCachedDocumentTemplates ?? [],
  )
  const [documentTemplatesLoading, setDocumentTemplatesLoading] = useState(!initialCachedDocumentTemplates)
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())

  const isTopLevelItemActive = (item: NavItem) => {
    if (item.end) {
      return location.pathname === item.to
    }
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  }

  const isSubItemActive = (item: NavSubItem) => {
    const [pathname, hash] = item.to.split('#')
    if (hash) {
      return location.pathname === pathname && location.hash === `#${hash}`
    }
    if (item.end) {
      return location.pathname === pathname
    }
    return location.pathname === pathname || location.pathname.startsWith(`${pathname}/`)
  }

  useEffect(() => {
    setOpenParentTo(locationParent?.to ?? null)
  }, [location.pathname, locationParent?.to])

  useEffect(() => {
    let active = true

    const cachedProjects = getCachedProjectsList()
    if (cachedProjects) {
      setQuestionnaireProjects(cachedProjects)
      setQuestionnairesLoading(false)
    } else {
      setQuestionnairesLoading(true)
    }

    const unsubscribe = subscribeProjectsList((projects) => {
      if (!active) return
      setQuestionnaireProjects(projects ?? [])
      setQuestionnairesLoading(false)
    })

    if (!cachedProjects) {
      ensureProjectsListLoaded().catch((err) => {
        console.error('Load questionnaires list failed:', err)
        if (active) {
          setQuestionnairesLoading(false)
        }
      })
    }

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true

    const unsubscribe = subscribeDocumentTemplates((templates) => {
      if (!active) return
      setDocumentTemplates(templates ?? [])
      setDocumentTemplatesLoading(false)
    })

    const cachedTemplates = getCachedDocumentTemplates()
    if (!cachedTemplates) {
      ensureDocumentTemplatesLoaded().catch((err) => {
        console.error('Load document templates failed:', err)
        if (active) {
          setDocumentTemplatesLoading(false)
        }
      })
    }

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const openParent = navItems.find((item) => item.to === openParentTo && hasSecondLevel(item))
  const isSecondLevelOpen = !!openParent?.children
    || openParent?.to === '/questionnaires'

  const isQuestionnaireProjectActive = (projectId: string) => (
    location.pathname === '/questionnaires'
    && (
      location.hash === `#project/${projectId}`
      || location.hash.startsWith(`#project/${projectId}/`)
    )
  )

  const { folders, ungrouped } = useMemo(() => {
    const folderMap = new Map<string, Project[]>()
    const projectsWithoutFolder: Project[] = []

    for (const project of questionnaireProjects) {
      const folder = project.folder?.trim()
      if (folder) {
        if (!folderMap.has(folder)) {
          folderMap.set(folder, [])
        }
        folderMap.get(folder)!.push(project)
      } else {
        projectsWithoutFolder.push(project)
      }
    }

    const sortedFolders = Array.from(folderMap.entries()).sort(([a], [b]) =>
      a.localeCompare(b, 'fr'),
    )

    return { folders: sortedFolders, ungrouped: projectsWithoutFolder }
  }, [questionnaireProjects])

  const documentTemplatesCountBySlug = useMemo(() => {
    const counts = new Map<string, number>()
    for (const slug of Object.values(DOCUMENT_TEMPLATE_PHASE_TO_SLUG)) {
      counts.set(slug, 0)
    }
    for (const template of documentTemplates) {
      const slug = DOCUMENT_TEMPLATE_PHASE_TO_SLUG[template.phase]
      counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
    return counts
  }, [documentTemplates])

  const toggleFolder = (folder: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folder)) {
        next.delete(folder)
      } else {
        next.add(folder)
      }
      return next
    })
  }

  return (
    <div className="h-screen bg-cream text-ink flex flex-col">
      <header className="w-full bg-cream">
        <div className="flex w-full items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-serif text-2xl leading-none text-ink md:text-3xl">
              We Love Users
            </span>
            <span className="brand-chip">TEAM</span>
          </Link>

          {headerSyncState && <SyncIndicator state={headerSyncState} />}
        </div>
      </header>

      <div className="min-h-0 flex flex-1">
        <aside className="w-72 shrink-0 px-3 pb-3">
          <div className="relative h-full overflow-hidden rounded-brand border border-stone bg-white shadow-sm flex flex-col">
            {/* ── Panneau niveau 1 ────────────────────────────────── */}
            <div
              className={`absolute inset-0 flex flex-col transition-transform duration-300 ease-out ${
                isSecondLevelOpen ? '-translate-x-full' : 'translate-x-0'
              }`}
            >
              <nav className="flex-1 overflow-y-auto px-3 py-4">
                <ul className="space-y-1">
                  {navItems.map((item) => (
                    <li key={item.to} className={item.separatorBefore ? 'nav-item-separator' : ''}>
                      {hasSecondLevel(item) ? (
                        <button
                          type="button"
                          aria-expanded={openParentTo === item.to}
                          onClick={() => {
                            setOpenParentTo(item.to)
                            navigate(getTopLevelTarget(item))
                          }}
                          className={`nav-link nav-link-toggle cursor-pointer ${
                            isTopLevelItemActive(item) ? 'active' : ''
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            {item.icon}
                            <span>{item.label}</span>
                          </span>
                          <svg
                            className={`h-4 w-4 shrink-0 ${
                              isTopLevelItemActive(item) ? 'text-flame' : 'text-taupe'
                            }`}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.22 4.22a.75.75 0 0 1 1.06 0l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 0 1 0-1.06Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      ) : (
                        <NavLink
                          to={item.to}
                          end={item.end}
                          onClick={() => setOpenParentTo(null)}
                          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                          <span className="flex items-center gap-2.5">
                            {item.icon}
                            <span>{item.label}</span>
                          </span>
                        </NavLink>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Déconnexion — ancré en bas */}
              <div className="border-t border-stone px-3 py-3">
                <button
                  type="button"
                  onClick={onLogout}
                  className="nav-link flex w-full items-center gap-2.5 text-left cursor-pointer"
                >
                  {IconLogout}
                  <span>Déconnexion</span>
                </button>
              </div>
            </div>

            {/* ── Panneau niveau 2 ────────────────────────────────── */}
            <div
              className={`absolute inset-0 overflow-y-auto border-l border-stone/70 bg-white/60 px-4 py-4 transition-transform duration-300 ease-out ${
                isSecondLevelOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenParentTo(null)}
                className="btn-secondary-sm mb-3 cursor-pointer"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                <span>Retour</span>
              </button>

              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-flame">
                {openParent?.label}
              </p>

              {openParent?.to === '/questionnaires' ? (
                <nav>
                  {/* Bouton Nouveau projet */}
                  <Link
                    to="/questionnaires#new"
                    className="btn-primary-sm mb-4 flex w-full cursor-pointer items-center justify-center gap-1.5"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Nouveau projet
                  </Link>

                  <ul className="space-y-1">
                    {questionnairesLoading ? (
                      <li>
                        <span className="subnav-link opacity-70">Chargement...</span>
                      </li>
                    ) : (
                      <>
                        {folders.map(([folderName, projects]) => {
                          const isCollapsed = collapsedFolders.has(folderName)
                          return (
                            <li key={folderName} className="pt-1">
                              <button
                                type="button"
                                onClick={() => toggleFolder(folderName)}
                                className="flex w-full items-center gap-1.5 rounded-brand px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-taupe transition-colors hover:bg-wash hover:text-ink"
                              >
                                <svg
                                  className={`h-3 w-3 shrink-0 transition-transform ${
                                    isCollapsed ? '' : 'rotate-90'
                                  }`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2.25}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                                <svg
                                  className="h-3.5 w-3.5 shrink-0 text-taupe/80"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <span className="truncate">{folderName}</span>
                                <span className="ml-auto text-[10px] font-normal tracking-normal text-taupe">
                                  {projects.length}
                                </span>
                              </button>

                              {!isCollapsed && (
                                <ul className="ml-1 mt-1 space-y-1">
                                  {projects.map((project) => (
                                    <li key={project.id}>
                                      <Link
                                        to={`/questionnaires#project/${project.id}`}
                                        className={`subnav-link ${
                                          isQuestionnaireProjectActive(project.id) ? 'active' : ''
                                        }`}
                                      >
                                        {project.name || '(Sans titre)'}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          )
                        })}

                        {folders.length > 0 && ungrouped.length > 0 && (
                          <li className="pt-1">
                            <button
                              type="button"
                              onClick={() => toggleFolder(NO_FOLDER)}
                              className="flex w-full items-center gap-1.5 rounded-brand px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-taupe transition-colors hover:bg-wash hover:text-ink"
                            >
                              <svg
                                className={`h-3 w-3 shrink-0 transition-transform ${
                                  collapsedFolders.has(NO_FOLDER) ? '' : 'rotate-90'
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.25}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                              <span className="truncate">Sans dossier</span>
                              <span className="ml-auto text-[10px] font-normal tracking-normal text-taupe">
                                {ungrouped.length}
                              </span>
                            </button>

                            {!collapsedFolders.has(NO_FOLDER) && (
                              <ul className="ml-1 mt-1 space-y-1">
                                {ungrouped.map((project) => (
                                  <li key={project.id}>
                                    <Link
                                      to={`/questionnaires#project/${project.id}`}
                                      className={`subnav-link ${
                                        isQuestionnaireProjectActive(project.id) ? 'active' : ''
                                      }`}
                                    >
                                      {project.name || '(Sans titre)'}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        )}

                        {folders.length === 0 && ungrouped.map((project) => (
                          <li key={project.id}>
                            <Link
                              to={`/questionnaires#project/${project.id}`}
                              className={`subnav-link ${
                                isQuestionnaireProjectActive(project.id) ? 'active' : ''
                              }`}
                            >
                              {project.name || '(Sans titre)'}
                            </Link>
                          </li>
                        ))}
                      </>
                    )}
                  </ul>
                  {!questionnairesLoading && questionnaireProjects.length === 0 && (
                    <p className="px-3 py-2 text-xs text-taupe">Aucun projet</p>
                  )}
                </nav>
              ) : (
                <nav>
                  <ul className="space-y-1.5">
                    {openParent?.children?.map((child) => (
                      <li key={child.to}>
                        <Link
                          to={child.to}
                          className={`subnav-link ${isSubItemActive(child) ? 'active' : ''}`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span>{child.label}</span>
                            {openParent?.to === '/modeles-documents' && (
                              <span className={`text-[10px] ${isSubItemActive(child) ? 'text-flame' : 'text-taupe'}`}>
                                {documentTemplatesLoading
                                  ? '...'
                                  : (documentTemplatesCountBySlug.get(child.to.split('/').pop() ?? '') ?? 0)}
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </div>
          </div>
        </aside>

        <main
          className={fullBleed
            ? 'min-w-0 flex-1 min-h-0 overflow-hidden'
            : 'min-w-0 flex-1 min-h-0 overflow-y-auto px-6 py-10 md:px-8 md:py-12'}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
