import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Radar } from 'react-chartjs-2'
import type { DeepResult } from '../../lib/stats'
import { DEEP_GROUP_LABELS } from '../../lib/stats'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

export function DeepRadarChart({ stats }: { stats: DeepResult }) {
  const groups = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const
  const labels = groups.map((g) => DEEP_GROUP_LABELS[g])
  const values = groups.map((g) => stats[g].mean)

  const data = {
    labels,
    datasets: [
      {
        label: 'Score moyen',
        data: values,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: 'rgba(59, 130, 246, 0.8)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#fff',
        pointRadius: 4,
        pointBorderWidth: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      r: {
        beginAtZero: true,
        min: 0,
        max: 5,
        ticks: {
          stepSize: 1,
          font: { size: 10 },
          backdropColor: 'transparent',
        },
        pointLabels: {
          font: { size: 11 },
          color: '#475569',
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.3)',
        },
        angleLines: {
          color: 'rgba(148, 163, 184, 0.3)',
        },
      },
    },
  } as const

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
        Profil DEEP - 6 dimensions
      </p>
      <div className="max-w-md mx-auto">
        <Radar data={data} options={options} />
      </div>
    </div>
  )
}
