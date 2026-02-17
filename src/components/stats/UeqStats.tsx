import { useState } from 'react'
import type { UeqResult } from '../../lib/stats'
import { UEQ_DIMENSION_LABELS } from '../../lib/stats'
import { StatsCard } from './StatsCard'
import { MeanCiBarChart } from '../charts/MeanCiBarChart'

const DIM_COLORS: Record<'GLOBAL' | 'ATT' | 'PERSP' | 'EFF' | 'DEP' | 'STIM' | 'NOV', string> = {
  GLOBAL: 'text-primary-600',
  ATT: 'text-amber-600',
  PERSP: 'text-blue-600',
  EFF: 'text-teal-600',
  DEP: 'text-indigo-600',
  STIM: 'text-pink-600',
  NOV: 'text-purple-600',
}

const DIM_CHART_COLORS: Record<'GLOBAL' | 'ATT' | 'PERSP' | 'EFF' | 'DEP' | 'STIM' | 'NOV', string> = {
  GLOBAL: 'rgba(2, 132, 199, 0.75)',
  ATT: 'rgba(217, 119, 6, 0.75)',
  PERSP: 'rgba(37, 99, 235, 0.75)',
  EFF: 'rgba(13, 148, 136, 0.75)',
  DEP: 'rgba(79, 70, 229, 0.75)',
  STIM: 'rgba(219, 39, 119, 0.75)',
  NOV: 'rgba(147, 51, 234, 0.75)',
}

const DETAIL_DIMS = ['ATT', 'PERSP', 'EFF', 'DEP', 'STIM', 'NOV'] as const

export function UeqStats({ stats }: { stats: UeqResult }) {
  const [ciLevel, setCiLevel] = useState<'90' | '95' | '99'>('95')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Statistiques UEQ</h3>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          n = {stats.n}
        </span>
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

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
          Score global
        </p>
        <div className="max-w-sm">
          <StatsCard
            label={UEQ_DIMENSION_LABELS.GLOBAL}
            summary={stats.GLOBAL}
            ciLevel={ciLevel}
            colorClass={DIM_COLORS.GLOBAL}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Dimensions detaillees
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {DETAIL_DIMS.map((dimension) => (
            <StatsCard
              key={dimension}
              label={UEQ_DIMENSION_LABELS[dimension]}
              summary={stats[dimension]}
              ciLevel={ciLevel}
              colorClass={DIM_COLORS[dimension]}
            />
          ))}
        </div>
      </div>

      <MeanCiBarChart
        title="Profil UEQ - Moyennes et IC"
        ciLevel={ciLevel}
        rows={[
          {
            label: UEQ_DIMENSION_LABELS.GLOBAL,
            summary: stats.GLOBAL,
            color: DIM_CHART_COLORS.GLOBAL,
          },
          ...DETAIL_DIMS.map((dimension) => ({
            label: UEQ_DIMENSION_LABELS[dimension],
            summary: stats[dimension],
            color: DIM_CHART_COLORS[dimension],
          })),
        ]}
        xMin={-3}
        xMax={3}
      />

      <p className="text-xs text-slate-500">
        Échelle UEQ normalisée de -3 (négatif) à +3 (positif).
      </p>
    </div>
  )
}
