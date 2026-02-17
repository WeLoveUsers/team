import { Link } from 'react-router-dom'

const QUICK_LINKS = [
  {
    title: 'Notre façon de travailler',
    description: 'Cadre de collaboration, principes et posture de travail du collectif.',
    to: '/notre-facon-de-travailler',
  },
  {
    title: 'Charte graphique',
    description: 'Palette, typographies, composants et standards de restitution.',
    to: '/charte-graphique',
  },
  {
    title: 'Modèles de documents',
    description: 'Espace centralisé pour référencer vos liens Google Drive.',
    to: '/modeles-documents',
  },
  {
    title: 'Questionnaires UX',
    description: 'Création, pilotage des projets et lecture des résultats.',
    to: '/questionnaires',
  },
]

export function HomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-12">
      <section className="rounded-brand border border-stone bg-white p-8 md:p-10">
        <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-flame">
          Espace interne
        </p>
        <div className="mb-6 flex items-center gap-3">
          <h1 className="font-serif text-5xl leading-tight text-ink md:text-6xl">
            We Love Users
          </h1>
          <span className="brand-chip">TEAM</span>
        </div>
        <p className="max-w-3xl text-lg font-light text-graphite md:text-xl">
          Le point d&apos;entrée de l&apos;équipe We Love Users : méthode de travail, charte,
          modèles et questionnaires.
        </p>
      </section>

      <section>
        <h2 className="mb-6 font-serif text-3xl text-ink">Navigation</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {QUICK_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group rounded-brand border border-stone bg-white p-6 transition-colors hover:border-flame/50"
            >
              <h3 className="mb-2 text-lg font-medium text-ink transition-colors group-hover:text-flame">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-graphite">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
