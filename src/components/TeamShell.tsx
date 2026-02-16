import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { Project } from '../api'
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
}

const DOC_CATEGORY_LINKS: NavSubItem[] = [
  { to: '/modeles-documents#cadrage', label: 'Cadrage' },
  { to: '/modeles-documents#terrain', label: 'Terrain' },
  { to: '/modeles-documents#analyse', label: 'Analyse' },
  { to: '/modeles-documents#restitution', label: 'Restitution' },
  { to: '/modeles-documents#operationnel', label: 'Opérationnel' },
]

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/notre-facon-de-travailler', label: 'Notre façon de travailler' },
  { to: '/questionnaires', label: 'Questionnaires UX' },
  {
    to: '/charte-graphique',
    label: 'Charte graphique',
    children: [
      { to: '/charte-graphique/fonts', label: 'Fonts' },
      { to: '/charte-graphique/slides', label: 'Slides' },
      { to: '/charte-graphique', label: 'Design system', end: true },
    ],
  },
  {
    to: '/modeles-documents',
    label: 'Modèles de documents',
    children: DOC_CATEGORY_LINKS,
  },
  { to: '/administration', label: 'Administration', separatorBefore: true },
]

const NO_FOLDER = '__sans_dossier__'

function hasSecondLevel(item: NavItem): boolean {
  return item.to === '/questionnaires' || !!item.children?.length
}

function findParentWithSecondLevel(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => (
    hasSecondLevel(item)
    && (pathname === item.to || pathname.startsWith(`${item.to}/`))
  ))
}

function getTopLevelTarget(item: NavItem): string {
  if (item.to === '/charte-graphique') return '/charte-graphique/fonts'
  if (item.to === '/questionnaires') return '/questionnaires#presentation'
  return item.to
}

export function TeamShell({
  children,
  onLogout,
  fullBleed = false,
  headerSyncState,
}: TeamShellProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const locationParent = findParentWithSecondLevel(location.pathname)
  const [openParentTo, setOpenParentTo] = useState<string | null>(locationParent?.to ?? null)
  const initialCachedProjects = getCachedProjectsList()
  const [questionnaireProjects, setQuestionnaireProjects] = useState<Project[]>(
    () => initialCachedProjects ?? [],
  )
  const [questionnairesLoading, setQuestionnairesLoading] = useState(!initialCachedProjects)
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

  const openParent = NAV_ITEMS.find((item) => item.to === openParentTo && hasSecondLevel(item))
  const isSecondLevelOpen = !!openParent?.children
    || openParent?.to === '/questionnaires'

  const isQuestionnairesPresentationActive = (
    location.pathname === '/questionnaires'
    && (location.hash === '' || location.hash === '#' || location.hash === '#presentation')
  )

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

          <div className="flex items-center gap-4">
            {headerSyncState && <SyncIndicator state={headerSyncState} />}
            <button
              onClick={onLogout}
              className="btn-secondary-sm cursor-pointer justify-center"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex flex-1">
        <aside className="w-72 shrink-0 px-3 pb-3">
          <div className="relative h-full overflow-hidden rounded-brand border border-stone bg-white shadow-sm">
            <div
              className={`absolute inset-0 overflow-y-auto px-3 py-4 transition-transform duration-300 ease-out ${
                isSecondLevelOpen ? '-translate-x-full' : 'translate-x-0'
              }`}
            >
              <nav>
                <ul className="space-y-2">
                  {NAV_ITEMS.map((item) => (
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
                          <span>{item.label}</span>
                          <svg
                            className={`h-4 w-4 ${
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
                          {item.label}
                        </NavLink>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

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
                  <ul className="space-y-1">
                    <li>
                      <Link
                        to="/questionnaires#presentation"
                        className={`subnav-link ${
                          isQuestionnairesPresentationActive ? 'active' : ''
                        }`}
                      >
                        Présentation
                      </Link>
                    </li>

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
                                className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-taupe transition-colors hover:bg-wash hover:text-ink"
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
                              className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-taupe transition-colors hover:bg-wash hover:text-ink"
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
                          {child.label}
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
