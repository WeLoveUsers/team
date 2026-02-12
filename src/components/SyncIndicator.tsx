export type SyncState = 'idle' | 'syncing' | 'saved' | 'error'

export function SyncIndicator({ state }: { state: SyncState }) {
  if (state === 'idle') return null

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {state === 'syncing' && (
        <>
          <div className="w-3 h-3 border-[1.5px] border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400">Synchronisation...</span>
        </>
      )}
      {state === 'saved' && (
        <>
          <svg className="w-3.5 h-3.5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-slate-400">Synchronisé</span>
        </>
      )}
      {state === 'error' && (
        <>
          <svg className="w-3.5 h-3.5 text-danger-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="text-danger-500">Erreur de sync</span>
        </>
      )}
    </div>
  )
}
