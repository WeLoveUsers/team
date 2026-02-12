import { useState } from 'react'
import type { SusResult } from '../../lib/stats'
import { SusGauge } from '../charts/SusGauge'

const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-emerald-600', 'A': 'text-emerald-600', 'A-': 'text-green-600',
  'B+': 'text-lime-600', 'B': 'text-lime-600', 'B-': 'text-yellow-600',
  'C+': 'text-amber-600', 'C': 'text-amber-600', 'C-': 'text-orange-600',
  'D': 'text-red-600', 'F': 'text-red-700',
}

export function SusStats({ stats }: { stats: SusResult }) {
  const [ciLevel, setCiLevel] = useState<'90' | '95' | '99'>('95')
  const ci = ciLevel === '90' ? stats.ci90 : ciLevel === '99' ? stats.ci99 : stats.ci95

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Statistiques SUS</h3>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          n = {stats.n}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Score moyen</p>
          <p className="text-3xl font-bold text-primary-600">{stats.mean.toFixed(1)}</p>
          <p className="text-xs text-slate-400 mt-0.5">/ 100</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Note</p>
          <p className={`text-3xl font-bold ${GRADE_COLORS[stats.grade] ?? 'text-slate-600'}`}>
            {stats.grade}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Sauro & Lewis (2012)</p>
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

      <SusGauge score={stats.mean} grade={stats.grade} />
    </div>
  )
}
