import { useState, useMemo } from 'react'
import type { Project } from '../api'

type QuestionnaireId = 'sus' | 'deep' | 'umux' | 'umux_lite' | 'ueq' | 'attrakdiff' | 'attrakdiff_abridged'

const BADGE_COLORS: Record<string, string> = {
  SUS: 'bg-wash text-flame',
  DEEP: 'bg-slate-100 text-slate-700',
  UMUX: 'bg-success-50 text-success-700',
  'UMUX (Lite)': 'bg-slate-200 text-slate-700',
  UEQ: 'bg-rose text-flame',
  AttrakDiff: 'bg-warning-50 text-warning-600',
  'AttrakDiff (abrégé)': 'bg-danger-50 text-danger-700',
}

export function computeQuestionnaireId(
  questionnaireType: string | null,
): QuestionnaireId | null {
  if (!questionnaireType) return null
  const raw = questionnaireType.toLowerCase()
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')

  if (normalized.includes('sus')) return 'sus'
  if (normalized.includes('deep')) return 'deep'
  if (normalized.includes('umuxlite'))
    return 'umux_lite'
  if (normalized.includes('umux')) return 'umux'
  if (normalized.includes('ueq') || normalized.includes('userexperiencequestionnaire')) return 'ueq'
  if (normalized.includes('abrige') || normalized.includes('abridged'))
    return 'attrakdiff_abridged'
  if (normalized.includes('attrakdiff')) return 'attrakdiff'
  return null
}

const NO_FOLDER = '__sans_dossier__'

type SidebarProps = {
  projects: Project[]
  selectedId: string | null
  onSelect: (project: Project) => void
  onNewProject: () => void
}

function ProjectItem({
  project,
  isSelected,
  onSelect,
}: {
  project: Project
  isSelected: boolean
  onSelect: (project: Project) => void
}) {
  const badgeColor = project.questionnaireType
    ? BADGE_COLORS[project.questionnaireType] ?? 'bg-slate-100 text-slate-600'
    : ''

  return (
    <button
      onClick={() => onSelect(project)}
      className={`w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-all cursor-pointer ${
        isSelected
          ? 'bg-primary-50 border-l-3 border-primary-500'
          : 'hover:bg-slate-50 border-l-3 border-transparent'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            project.status === 'Ouvert' ? 'bg-success-500' : 'bg-slate-300'
          }`}
        />
        <span className={`text-sm truncate ${isSelected ? 'font-medium text-primary-900' : 'text-slate-700'}`}>
          {project.name || '(Sans titre)'}
        </span>
      </div>
      {project.questionnaireType && (
        <span
          className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-1 ml-4 ${badgeColor}`}
        >
          {project.questionnaireType}
        </span>
      )}
    </button>
  )
}

export function Sidebar({ projects, selectedId, onSelect, onNewProject }: SidebarProps) {
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())

  // Groupe les projets par dossier, en gardant l'ordre alphabétique des dossiers
  const { folders, ungrouped } = useMemo(() => {
    const folderMap = new Map<string, Project[]>()
    const ungrouped: Project[] = []

    for (const project of projects) {
      const folder = project.folder?.trim()
      if (folder) {
        if (!folderMap.has(folder)) {
          folderMap.set(folder, [])
        }
        folderMap.get(folder)!.push(project)
      } else {
        ungrouped.push(project)
      }
    }

    // Tri alphabétique des dossiers
    const sortedFolders = Array.from(folderMap.entries()).sort(([a], [b]) =>
      a.localeCompare(b, 'fr'),
    )

    return { folders: sortedFolders, ungrouped }
  }, [projects])

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

  const hasFolders = folders.length > 0

  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <button
          onClick={onNewProject}
          className="w-full py-2 px-3 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nouveau projet
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {projects.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Aucun projet</p>
        )}

        {/* Dossiers */}
        {folders.map(([folderName, folderProjects]) => {
          const isCollapsed = collapsedFolders.has(folderName)
          const count = folderProjects.length

          return (
            <div key={folderName} className="mb-1">
              <button
                onClick={() => toggleFolder(folderName)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700 transition-colors cursor-pointer rounded hover:bg-slate-50"
              >
                <svg
                  className={`w-3 h-3 transition-transform shrink-0 ${isCollapsed ? '' : 'rotate-90'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="truncate">{folderName}</span>
                <span className="ml-auto text-[10px] text-slate-400 font-normal">{count}</span>
              </button>

              {!isCollapsed && (
                <div className="ml-1">
                  {folderProjects.map((project) => (
                    <ProjectItem
                      key={project.id}
                      project={project}
                      isSelected={selectedId === project.id}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Projets sans dossier */}
        {hasFolders && ungrouped.length > 0 && (
          <div className="mb-1">
            <button
              onClick={() => toggleFolder(NO_FOLDER)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700 transition-colors cursor-pointer rounded hover:bg-slate-50"
            >
              <svg
                className={`w-3 h-3 transition-transform shrink-0 ${collapsedFolders.has(NO_FOLDER) ? '' : 'rotate-90'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="truncate">Sans dossier</span>
              <span className="ml-auto text-[10px] text-slate-400 font-normal">{ungrouped.length}</span>
            </button>
            {!collapsedFolders.has(NO_FOLDER) && (
              <div className="ml-1">
                {ungrouped.map((project) => (
                  <ProjectItem
                    key={project.id}
                    project={project}
                    isSelected={selectedId === project.id}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* S'il n'y a pas de dossiers du tout, affichage plat classique */}
        {!hasFolders &&
          ungrouped.map((project) => (
            <ProjectItem
              key={project.id}
              project={project}
              isSelected={selectedId === project.id}
              onSelect={onSelect}
            />
          ))}
      </div>
    </div>
  )
}
