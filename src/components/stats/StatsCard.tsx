import type { StatsSummary } from '../../lib/stats'

type Props = {
  label: string
  summary: StatsSummary
  unit?: string
  showVariability?: boolean
  ciLevel?: '90' | '95' | '99'
  colorClass?: string
}

export function StatsCard({ label, summary, unit = '', showVariability = true, ciLevel = '95', colorClass = 'text-primary-600' }: Props) {
  const ci = ciLevel === '90' ? summary.ci90 : ciLevel === '99' ? summary.ci99 : summary.ci95

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>
        {summary.mean.toFixed(2)}
        {unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
      </p>
      {showVariability && (
        <div className="mt-2 space-y-0.5">
          <p className="text-xs text-slate-500">
            <span className="font-medium">&sigma;</span> = {summary.sd.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500">
            IC{ciLevel}% = [{ci[0].toFixed(2)} ; {ci[1].toFixed(2)}]
          </p>
        </div>
      )}
    </div>
  )
}
