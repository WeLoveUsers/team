type Props = {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function DeleteConfirmModal({ title, message, onConfirm, onCancel, loading }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-brand shadow-xl max-w-sm w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-ink mb-2">{title}</h3>
        <p className="text-sm text-graphite mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-secondary-sm cursor-pointer disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-brand bg-berry px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-300 hover:opacity-90 cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}
