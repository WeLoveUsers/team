import { useState } from 'react'
import type { UmuxLiteResult } from '../../lib/stats'
import { StatsCard } from './StatsCard'
import { ScoreGauge } from '../charts/ScoreGauge'

export function UmuxLiteStats({ stats }: { stats: UmuxLiteResult }) {
  const [ciLevel, setCiLevel] = useState<'90' | '95' | '99'>('95')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Statistiques UMUX-Lite</h3>
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
        <StatsCard label="Score global" summary={stats.global} unit="/ 100" ciLevel={ciLevel} colorClass="text-primary-600" />
        <StatsCard label="Utilisabilité (Q3)" summary={stats.usability} unit="/ 100" ciLevel={ciLevel} colorClass="text-teal-600" />
        <StatsCard label="Utilité (Q1)" summary={stats.usefulness} unit="/ 100" ciLevel={ciLevel} colorClass="text-purple-600" />
      </div>

      <ScoreGauge score={stats.global.mean} max={100} label="Score global UMUX-Lite" />
    </div>
  )
}
