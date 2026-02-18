import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type Plugin,
  type TooltipItem,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { StatsSummary } from '../../lib/stats'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

type CiLevel = '90' | '95' | '99'

export type MeanCiBarRow = {
  label: string
  summary: StatsSummary
  color: string
}

type Props = {
  title: string
  rows: MeanCiBarRow[]
  ciLevel: CiLevel
  xMin?: number
  xMax?: number
}

function getCi(summary: StatsSummary, ciLevel: CiLevel): [number, number] {
  if (ciLevel === '90') return summary.ci90
  if (ciLevel === '99') return summary.ci99
  return summary.ci95
}

const meanCiErrorBarsPlugin: Plugin<'bar'> = {
  id: 'mean-ci-error-bars',
  afterDatasetsDraw: (chart) => {
    const xScale = chart.scales.x
    const datasetMeta = chart.getDatasetMeta(0)
    const dataset = chart.data.datasets[0] as {
      ciLow?: number[]
      ciHigh?: number[]
    } | undefined
    if (!xScale || !datasetMeta || !dataset?.ciLow || !dataset?.ciHigh) return

    const { ctx } = chart
    const capHalfSize = 4
    const axisMin = typeof xScale.min === 'number' ? xScale.min : -Infinity
    const axisMax = typeof xScale.max === 'number' ? xScale.max : Infinity

    ctx.save()
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 1.5

    datasetMeta.data.forEach((bar, index) => {
      const lowRaw = dataset.ciLow?.[index]
      const highRaw = dataset.ciHigh?.[index]
      if (typeof lowRaw !== 'number' || typeof highRaw !== 'number') return

      const low = Math.max(axisMin, Math.min(axisMax, lowRaw))
      const high = Math.max(axisMin, Math.min(axisMax, highRaw))

      const y = (bar as BarElement).y
      const xLow = xScale.getPixelForValue(low)
      const xHigh = xScale.getPixelForValue(high)

      ctx.beginPath()
      ctx.moveTo(xLow, y)
      ctx.lineTo(xHigh, y)
      ctx.moveTo(xLow, y - capHalfSize)
      ctx.lineTo(xLow, y + capHalfSize)
      ctx.moveTo(xHigh, y - capHalfSize)
      ctx.lineTo(xHigh, y + capHalfSize)
      ctx.stroke()
    })

    ctx.restore()
  },
}

export function MeanCiBarChart({ title, rows, ciLevel, xMin = -3, xMax = 3 }: Props) {
  const intervals = rows.map((row) => getCi(row.summary, ciLevel))

  const data = {
    labels: rows.map((row) => row.label),
    datasets: [
      {
        label: 'Moyenne',
        data: rows.map((row) => row.summary.mean),
        backgroundColor: rows.map((row) => row.color),
        borderWidth: 0,
        borderRadius: 4,
        maxBarThickness: 28,
        ciLow: intervals.map((ci) => ci[0]),
        ciHigh: intervals.map((ci) => ci[1]),
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => {
            const row = rows[ctx.dataIndex]
            if (!row) return ''
            const [ciLow, ciHigh] = getCi(row.summary, ciLevel)
            return `Moyenne ${row.summary.mean.toFixed(2)} | IC${ciLevel}% [${ciLow.toFixed(2)} ; ${ciHigh.toFixed(2)}]`
          },
        },
      },
    },
    scales: {
      x: {
        min: xMin,
        max: xMax,
        ticks: {
          stepSize: 1,
          font: { size: 10 },
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.2)',
        },
      },
      y: {
        ticks: { font: { size: 11 } },
        grid: { display: false },
      },
    },
  }

  const chartHeight = Math.max(220, rows.length * 42)

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
        {title}
      </p>
      <div style={{ height: `${chartHeight}px` }}>
        <Bar key={ciLevel} data={data} options={options} plugins={[meanCiErrorBarsPlugin]} />
      </div>
      <p className="text-xs text-slate-500 mt-2">
        Barres: moyenne. Traits noirs: intervalle de confiance (IC{ciLevel}%, tronqué a [{xMin}; {xMax}] si besoin).
      </p>
    </div>
  )
}
