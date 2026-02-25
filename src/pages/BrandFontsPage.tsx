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

      <section className="space-y-8">
        {/* Sans-serif : Satoshi + Urbanist */}
        <article className="rounded-brand border border-stone bg-white p-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-flame">Sans-serif</p>
          <h2 className="mb-4 font-serif text-3xl text-ink">Satoshi</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-graphite">
            Police sans-serif officielle de la charte. Elle est utilisée pour l&apos;app,
            les textes UI et la majorité des contenus.
          </p>
          <a
            href={FONTSHARE_SATOSHI_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center text-sm font-medium text-flame hover:underline"
          >
            Télécharger Satoshi (Fontshare) &rarr;
          </a>

          <div className="mt-6 border-t border-stone pt-6">
            <div className="flex items-baseline gap-3">
              <h3 className="text-lg font-medium text-ink">Urbanist</h3>
              <span className="rounded-full bg-wash px-2.5 py-0.5 text-xs font-medium text-flame">
                Alternative Google Docs
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-graphite">
              Satoshi n&apos;est pas disponible dans Google Docs. Dans ce contexte, on
              utilise Urbanist comme police de substitution&nbsp;: elle partage les mêmes
              proportions géométriques et offre un rendu très proche.
            </p>
            <a
              href={GOOGLE_URBANIST_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center text-sm font-medium text-flame hover:underline"
            >
              Ouvrir Urbanist (Google Fonts) &rarr;
            </a>
          </div>
        </article>

        {/* Serif : Times New Roman */}
        <article className="rounded-brand border border-stone bg-white p-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-flame">Serif</p>
          <h2 className="mb-4 font-serif text-3xl text-ink">Times New Roman</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-graphite">
            Police serif de référence pour les titres éditoriaux et la hiérarchie de lecture.
          </p>
        </article>
      </section>
    </div>
  )
}
