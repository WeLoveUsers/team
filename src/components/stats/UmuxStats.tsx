import { useState } from 'react'
import type { UmuxResult } from '../../lib/stats'
import { ScoreGauge } from '../charts/ScoreGauge'

export function UmuxStats({ stats }: { stats: UmuxResult }) {
  const [ciLevel, setCiLevel] = useState<'90' | '95' | '99'>('95')
  const ci = ciLevel === '90' ? stats.ci90 : ciLevel === '99' ? stats.ci99 : stats.ci95

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Statistiques UMUX</h3>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          n = {stats.n}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Score moyen</p>
          <p className="text-3xl font-bold text-primary-600">{stats.mean.toFixed(1)}</p>
          <p className="text-xs text-slate-400 mt-0.5">/ 100</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Variabilité</p>
          <p className="text-sm text-slate-700 mt-1">
            <span className="font-medium">&sigma;</span> = {stats.sd.toFixed(2)}
          </p>
          <div className="flex items-center gap-1 mt-2">
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
          <p className="text-xs text-slate-500 mt-1">
            [{ci[0].toFixed(1)} ; {ci[1].toFixed(1)}]
          </p>
        </div>
      </div>

      <ScoreGauge score={stats.mean} max={100} label="Score UMUX" />
    </div>
  )
}
