import type { ReactNode } from 'react'
import { SyncIndicator, type SyncState } from './SyncIndicator'

type LayoutProps = {
  sidebar: ReactNode
  children: ReactNode
  onLogout: () => void
  syncState?: SyncState
}

export function Layout({ sidebar, children, onLogout, syncState = 'idle' }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 h-screen sticky top-0">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-slate-900">UX Tools</h1>
            <button
              onClick={onLogout}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              Déconnexion
            </button>
          </div>
          {/* Sync indicator */}
          <div className="mt-1.5 h-4">
            <SyncIndicator state={syncState} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sidebar}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
