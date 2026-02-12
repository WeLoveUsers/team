const ZONES = [
  { label: 'Pire imaginable', max: 25, color: 'bg-red-500' },
  { label: 'Mauvais', max: 39, color: 'bg-orange-500' },
  { label: 'Acceptable', max: 52, color: 'bg-amber-400' },
  { label: 'Bon', max: 73, color: 'bg-lime-400' },
  { label: 'Excellent', max: 86, color: 'bg-green-500' },
  { label: 'Meilleur imaginable', max: 100, color: 'bg-emerald-500' },
]

export function SusGauge({ score, grade }: { score: number; grade: string }) {
  const clampedScore = Math.max(0, Math.min(100, score))
  const pct = clampedScore

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Échelle SUS</p>

      <div className="relative">
        {/* Scale bar */}
        <div className="flex h-3 rounded-full overflow-hidden">
          {ZONES.map((zone, i) => {
            const prevMax = i > 0 ? ZONES[i - 1].max : 0
            const width = zone.max - prevMax
            return (
              <div
                key={zone.label}
                className={`${zone.color}`}
                style={{ width: `${width}%` }}
              />
            )
          })}
        </div>

        {/* Marker */}
        <div
          className="absolute -top-1 w-5 h-5 bg-white border-2 border-slate-800 rounded-full shadow-sm transform -translate-x-1/2"
          style={{ left: `${pct}%` }}
        />

        {/* Labels */}
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-slate-400">0</span>
          {ZONES.map((zone) => (
            <span
              key={zone.label}
              className="text-[10px] text-slate-400"
              style={{ position: 'absolute', left: `${zone.max}%`, transform: 'translateX(-50%)' }}
            >
              {zone.max}
            </span>
          ))}
        </div>

        {/* Zone labels */}
        <div className="flex mt-4 gap-px">
          {ZONES.map((zone, i) => {
            const prevMax = i > 0 ? ZONES[i - 1].max : 0
            const width = zone.max - prevMax
            return (
              <div key={zone.label} style={{ width: `${width}%` }} className="text-center">
                <span className="text-[9px] text-slate-500 leading-tight block">{zone.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="text-center mt-3">
        <span className="text-sm font-semibold text-slate-700">
          {clampedScore.toFixed(1)} / 100
        </span>
        <span className="text-xs text-slate-400 ml-2">
          Note : {grade}
        </span>
      </div>
    </div>
  )
}
