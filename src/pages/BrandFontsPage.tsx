const FONTSHARE_SATOSHI_URL = 'https://www.fontshare.com/fonts/satoshi'
const GOOGLE_URBANIST_URL = 'https://fonts.google.com/specimen/Urbanist'

export function BrandFontsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-12">
      <header className="border-b border-stone pb-10">
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-flame">Charte graphique</p>
        <h1 className="mb-5 font-serif text-5xl text-ink md:text-6xl">Fonts</h1>
        <p className="max-w-3xl text-lg font-light text-graphite md:text-xl">
          Référentiel des polices à utiliser sur les livrables Team.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-brand border border-stone bg-white p-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-flame">Sans principale</p>
          <h2 className="mb-2 font-serif text-2xl text-ink">Satoshi</h2>
          <p className="text-sm leading-relaxed text-graphite">
            Police sans-serif officielle pour l&apos;app, les textes UI et la majorité des contenus.
          </p>
          <a
            href={FONTSHARE_SATOSHI_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center text-sm font-medium text-flame hover:underline"
          >
            Télécharger Satoshi
          </a>
        </article>

        <article className="rounded-brand border border-stone bg-white p-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-flame">Serif titre</p>
          <h2 className="mb-2 font-serif text-2xl text-ink">Times New Roman</h2>
          <p className="text-sm leading-relaxed text-graphite">
            Police serif de référence pour les titres éditoriaux et la hiérarchie de lecture.
          </p>
        </article>

        <article className="rounded-brand border border-stone bg-white p-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-flame">Alternative Docs</p>
          <h2 className="mb-2 font-serif text-2xl text-ink">Urbanist</h2>
          <p className="text-sm leading-relaxed text-graphite">
            À utiliser dans Google Docs quand Satoshi n&apos;est pas disponible.
          </p>
          <a
            href={GOOGLE_URBANIST_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center text-sm font-medium text-flame hover:underline"
          >
            Ouvrir Urbanist (Google Fonts)
          </a>
        </article>
      </section>
    </div>
  )
}
