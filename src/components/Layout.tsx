import type { ReactNode } from 'react'

type LayoutProps = {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="h-full min-h-0 bg-cream flex">
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto h-full w-full max-w-5xl">
          {children}
        </div>
      </main>
    </div>
  )
}
