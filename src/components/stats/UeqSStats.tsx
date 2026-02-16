import { useState } from 'react'
import type { UeqSResult } from '../../lib/stats'
import { UEQ_S_DIMENSION_LABELS } from '../../lib/stats'
import { StatsCard } from './StatsCard'

const DIM_COLORS: Record<'GLOBAL' | 'PRAG' | 'HED', string> = {
  GLOBAL: 'text-primary-600',
  PRAG: 'text-teal-600',
  HED: 'text-pink-600',
}

const DIMS = ['GLOBAL', 'PRAG', 'HED'] as const

export function UeqSStats({ stats }: { stats: UeqSResult }) {
  const [ciLevel, setCiLevel] = useState<'90' | '95' | '99'>('95')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Statistiques UEQ-S</h3>
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

      <div className="grid grid-cols-3 gap-3">
        {DIMS.map((dimension) => (
          <StatsCard
            key={dimension}
            label={UEQ_S_DIMENSION_LABELS[dimension]}
            summary={stats[dimension]}
            ciLevel={ciLevel}
            colorClass={DIM_COLORS[dimension]}
          />
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Échelle UEQ-S normalisée de -3 (négatif) à +3 (positif).
      </p>
    </div>
  )
}
