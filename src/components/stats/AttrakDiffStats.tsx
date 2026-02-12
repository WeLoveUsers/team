import { useState } from 'react'
import type { AttrakDiffResult, WordPairAverages } from '../../lib/stats'
import { ATTRAKDIFF_DIMENSION_LABELS } from '../../lib/stats'
import { StatsCard } from './StatsCard'
import { AttrakDiffPortfolioChart } from '../charts/AttrakDiffPortfolioChart'
import { AttrakDiffWordPairsChart } from '../charts/AttrakDiffWordPairsChart'
import type { QuestionnaireDefinition } from '../../questionnaires'

const DIM_COLORS: Record<string, string> = {
  QP: 'text-blue-600',
  QHS: 'text-purple-600',
  QHI: 'text-pink-600',
  ATT: 'text-amber-600',
  QH: 'text-teal-600',
}

type Props = {
  stats: AttrakDiffResult
  wordPairs: WordPairAverages
  questionnaire: QuestionnaireDefinition
  abridged: boolean
}

export function AttrakDiffStats({ stats, wordPairs, questionnaire, abridged }: Props) {
  const [ciLevel, setCiLevel] = useState<'90' | '95' | '99'>('95')
  const dims = ['QP', 'QHS', 'QHI', 'ATT', 'QH'] as const

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Statistiques AttrakDiff{abridged ? ' (abrégé)' : ''}
        </h3>
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

      <div className="grid grid-cols-5 gap-3">
        {dims.map((d) => (
          <StatsCard
            key={d}
            label={ATTRAKDIFF_DIMENSION_LABELS[d]}
            summary={stats[d]}
            ciLevel={ciLevel}
            colorClass={DIM_COLORS[d]}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <AttrakDiffPortfolioChart qp={stats.QP.mean} qh={stats.QH.mean} />
        <AttrakDiffWordPairsChart wordPairs={wordPairs} questionnaire={questionnaire} />
      </div>
    </div>
  )
}
