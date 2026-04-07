import { useEffect, useState } from 'react'
import { copyToClipboard } from '../lib/clipboard'

type CopyableField = 'tva' | 'siren' | 'siret'

type SiretRow = {
  label: string
  value: string
  copyKey?: CopyableField
}

const SIRET_ROWS: SiretRow[] = [
  { label: 'Code NAF/APE', value: '7022Z' },
  { label: 'TVA intracom.', value: 'FR 66 810 746 388', copyKey: 'tva' },
  { label: 'SIREN', value: '810 746 388', copyKey: 'siren' },
  { label: 'SIRET', value: '810 746 388 00034', copyKey: 'siret' },
]

export function SiretPage() {
  const [copiedField, setCopiedField] = useState<CopyableField | null>(null)

  useEffect(() => {
    if (!copiedField) return undefined
    const timeoutId = window.setTimeout(() => {
      setCopiedField(null)
    }, 2000)
    return () => window.clearTimeout(timeoutId)
  }, [copiedField])

  const handleCopy = (field: CopyableField, value: string) => {
    copyToClipboard(value).then(() => {
      setCopiedField(field)
    })
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10">
      <header className="border-b border-stone pb-10">
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-flame">Administration</p>
        <h1 className="mb-5 font-serif text-5xl text-ink md:text-6xl">Siret</h1>
        <p className="max-w-3xl text-lg font-light text-graphite md:text-xl">
          Informations administratives statiques de We Love Users.
        </p>
      </header>

      <section className="rounded-brand border border-stone bg-white p-6 md:p-8">
        <div className="space-y-3">
          {SIRET_ROWS.map((row) => {
            const copyKey = row.copyKey

            return (
              <div
                key={row.label}
                className="flex flex-col gap-3 rounded-brand border border-stone bg-cream/60 px-4 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 md:w-56">
                  <p className="text-xs font-bold uppercase tracking-widest text-taupe">
                    {row.label}
                  </p>
                </div>

                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <code className="truncate text-sm font-medium text-ink md:text-base">
                    {row.value}
                  </code>

                  {copyKey ? (
                    <button
                      type="button"
                      onClick={() => handleCopy(copyKey, row.value)}
                      className="btn-secondary-sm shrink-0 cursor-pointer"
                    >
                      {copiedField === copyKey ? 'Copié !' : 'Copier'}
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
