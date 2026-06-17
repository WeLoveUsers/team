import { useState } from 'react'
import type { MecueDimensionKey, MecueResult } from '../../lib/stats'
import { MECUE_DIMENSION_LABELS } from '../../lib/stats'
import { StatsCard } from './StatsCard'
import { MeanCiBarChart } from '../charts/MeanCiBarChart'

const DIM_COLORS: Record<MecueDimensionKey | 'GLOBAL', string> = {
  U: 'text-primary-600',
  F: 'text-teal-600',
  A: 'text-pink-600',
  S: 'text-amber-600',
  C: 'text-violet-600',
  EMO_POS: 'text-emerald-600',
  EMO_NEG: 'text-red-600',
  INT: 'text-sky-600',
  L: 'text-indigo-600',
  GLOBAL: 'text-primary-700',
}

const DIM_CHART_COLORS: Record<MecueDimensionKey | 'GLOBAL', string> = {
  U: 'rgba(2, 132, 199, 0.75)',
  F: 'rgba(13, 148, 136, 0.75)',
  A: 'rgba(219, 39, 119, 0.75)',
  S: 'rgba(217, 119, 6, 0.75)',
  C: 'rgba(124, 58, 237, 0.75)',
  EMO_POS: 'rgba(5, 150, 105, 0.75)',
  EMO_NEG: 'rgba(220, 38, 38, 0.75)',
  INT: 'rgba(14, 165, 233, 0.75)',
  L: 'rgba(79, 70, 229, 0.75)',
  GLOBAL: 'rgba(2, 132, 199, 0.85)',
}

const MODULE_I_DIMS: MecueDimensionKey[] = ['U', 'F', 'A', 'S', 'C']
const MODULE_II_DIMS: MecueDimensionKey[] = ['EMO_POS', 'EMO_NEG']
const MODULE_III_DIMS: MecueDimensionKey[] = ['INT', 'L']

type CiLevel = '90' | '95' | '99'

function DimensionSection({
  title,
  dims,
  stats,
  ciLevel,
}: {
  title: string
  dims: MecueDimensionKey[]
  stats: MecueResult
  ciLevel: CiLevel
}) {
  const present = dims.filter((dim) => stats.dimensions[dim])
  if (present.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {present.map((dim) => (
          <StatsCard
            key={dim}
            label={MECUE_DIMENSION_LABELS[dim]}
            summary={stats.dimensions[dim]!}
            ciLevel={ciLevel}
            colorClass={DIM_COLORS[dim]}
          />
        ))}
      </div>
    </div>
  )
}

export function MeCueStats({ stats }: { stats: MecueResult }) {
  const [ciLevel, setCiLevel] = useState<CiLevel>('95')

  // Profil 1–7 (modules I à III) : on n'affiche que les dimensions présentes.
  const profileDims: MecueDimensionKey[] = [...MODULE_I_DIMS, ...MODULE_II_DIMS, ...MODULE_III_DIMS]
  const profileRows = profileDims
    .filter((dim) => stats.dimensions[dim])
    .map((dim) => ({
      label: MECUE_DIMENSION_LABELS[dim],
      summary: stats.dimensions[dim]!,
      color: DIM_CHART_COLORS[dim],
    }))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Statistiques meCUE</h3>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">n = {stats.n}</span>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-slate-500">IC</span>
          {(['90', '95', '99'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setCiLevel(level)}
              className={`text-xs px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                ciLevel === level
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {level}%
            </button>
          ))}
        </div>
      </div>

      <div data-export="kpi" className="space-y-4">
        <DimensionSection title="Module I — Perception du produit" dims={MODULE_I_DIMS} stats={stats} ciLevel={ciLevel} />
        <DimensionSection title="Module II — Émotions" dims={MODULE_II_DIMS} stats={stats} ciLevel={ciLevel} />
        <DimensionSection title="Module III — Conséquences sur l'usage" dims={MODULE_III_DIMS} stats={stats} ciLevel={ciLevel} />

        {stats.global && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
              Module IV — Évaluation globale
            </p>
            <div className="max-w-sm">
              <StatsCard
                label={MECUE_DIMENSION_LABELS.GLOBAL}
                summary={stats.global}
                ciLevel={ciLevel}
                colorClass={DIM_COLORS.GLOBAL}
              />
            </div>
          </div>
        )}
      </div>

      {profileRows.length > 0 && (
        <div data-export="chart">
          <MeanCiBarChart
            title="Profil meCUE — Moyennes et IC (échelle 1 à 7)"
            ciLevel={ciLevel}
            rows={profileRows}
            xMin={1}
            xMax={7}
          />
        </div>
      )}

      {stats.global && (
        <div data-export="chart">
          <MeanCiBarChart
            title="Évaluation globale — Moyenne et IC (échelle -5 à +5)"
            ciLevel={ciLevel}
            rows={[
              {
                label: MECUE_DIMENSION_LABELS.GLOBAL,
                summary: stats.global,
                color: DIM_CHART_COLORS.GLOBAL,
              },
            ]}
            xMin={-5}
            xMax={5}
          />
        </div>
      )}

      <p className="text-xs text-slate-500">
        Modules I à III : moyennes sur l'échelle d'accord de 1 à 7. Les émotions négatives sont inversées
        (codification Lallemand) : une note élevée signifie <em>peu</em> d'émotions négatives ressenties —
        toutes les dimensions vont donc du négatif au positif. Module IV : évaluation globale de -5 (mauvais)
        à +5 (bon).
      </p>
    </div>
  )
}
