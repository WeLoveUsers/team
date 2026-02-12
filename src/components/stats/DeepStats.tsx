import { useState } from 'react'
import type { DeepResult } from '../../lib/stats'
import { DEEP_GROUP_LABELS } from '../../lib/stats'
import { StatsCard } from './StatsCard'
import { DeepRadarChart } from '../charts/DeepRadarChart'

const DIMENSION_COLORS = [
  'text-blue-600',
  'text-purple-600',
  'text-teal-600',
  'text-amber-600',
  'text-pink-600',
  'text-emerald-600',
]

export function DeepStats({ stats }: { stats: DeepResult }) {
  const [ciLevel, setCiLevel] = useState<'90' | '95' | '99'>('95')
  const groups = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Statistiques DEEP</h3>
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
        {groups.map((g, i) => (
          <StatsCard
            key={g}
            label={DEEP_GROUP_LABELS[g]}
            summary={stats[g]}
            unit="/ 5"
            ciLevel={ciLevel}
            colorClass={DIMENSION_COLORS[i]}
          />
        ))}
      </div>

      <DeepRadarChart stats={stats} />
    </div>
  )
}
