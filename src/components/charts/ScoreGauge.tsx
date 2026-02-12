export function ScoreGauge({ score, max, label }: { score: number; max: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100))

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">{label}</p>

      <div className="relative">
        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-400 via-amber-400 via-50% to-emerald-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div
          className="absolute -top-1 w-5 h-5 bg-white border-2 border-slate-800 rounded-full shadow-sm transform -translate-x-1/2 transition-all duration-500"
          style={{ left: `${pct}%` }}
        />

        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-slate-400">0</span>
          <span className="text-[10px] text-slate-400">{max}</span>
        </div>
      </div>

      <p className="text-center text-sm font-semibold text-slate-700 mt-2">
        {score.toFixed(1)} / {max}
      </p>
    </div>
  )
}
