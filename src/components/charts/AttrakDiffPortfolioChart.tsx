import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Scatter } from 'react-chartjs-2'

ChartJS.register(LinearScale, PointElement, Tooltip, Legend)

export function AttrakDiffPortfolioChart({ qp, qh }: { qp: number; qh: number }) {
  const data = {
    datasets: [
      {
        label: 'Produit',
        data: [{ x: qp, y: qh }],
        backgroundColor: 'rgba(59, 130, 246, 1)',
        borderColor: '#fff',
        borderWidth: 2,
        pointRadius: 8,
        pointHoverRadius: 10,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { x: number | null; y: number | null } }) =>
            `QP: ${(ctx.parsed.x ?? 0).toFixed(2)}, QH: ${(ctx.parsed.y ?? 0).toFixed(2)}`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Qualité Pragmatique (QP)', font: { size: 11 } },
        min: -3,
        max: 3,
        grid: { color: 'rgba(148, 163, 184, 0.2)' },
        ticks: { font: { size: 10 } },
      },
      y: {
        title: { display: true, text: 'Qualité Hédonique (QH)', font: { size: 11 } },
        min: -3,
        max: 3,
        grid: { color: 'rgba(148, 163, 184, 0.2)' },
        ticks: { font: { size: 10 } },
      },
    },
  } as const

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
        Portfolio AttrakDiff
      </p>
      <Scatter data={data} options={options} />
    </div>
  )
}
