import type { ReactNode } from 'react'

type LayoutProps = {
  sidebar?: ReactNode
  children: ReactNode
}

export function Layout({ sidebar, children }: LayoutProps) {
  return (
    <div className="h-full min-h-0 bg-slate-50 flex">
      {sidebar && (
        <aside className="w-72 bg-white/60 border-r border-stone flex flex-col shrink-0">
          <div className="px-4 py-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-flame">
              Questionnaires UX
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sidebar}
          </div>
        </aside>
      )}

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
