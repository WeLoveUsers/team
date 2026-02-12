import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { WordPairAverages } from '../../lib/stats'
import type { QuestionnaireDefinition, BipolarQuestion } from '../../questionnaires'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const DIMENSION_COLORS: Record<string, string> = {
  QP: 'rgba(59, 130, 246, 0.7)',
  QHS: 'rgba(168, 85, 247, 0.7)',
  QHI: 'rgba(236, 72, 153, 0.7)',
  ATT: 'rgba(245, 158, 11, 0.7)',
}

function getDimension(id: string): string {
  if (id.startsWith('QP')) return 'QP'
  if (id.startsWith('QHS')) return 'QHS'
  if (id.startsWith('QHI')) return 'QHI'
  if (id.startsWith('ATT')) return 'ATT'
  return 'QP'
}

type Props = {
  wordPairs: WordPairAverages
  questionnaire: QuestionnaireDefinition
}

export function AttrakDiffWordPairsChart({ wordPairs, questionnaire }: Props) {
  const bipolarQuestions = questionnaire.questions.filter(
    (q): q is BipolarQuestion => q.type === 'bipolar',
  )

  const labels = bipolarQuestions.map((q) => `${q.leftFr} / ${q.rightFr}`)
  const values = bipolarQuestions.map((q) => wordPairs[q.id] ?? 0)
  const colors = bipolarQuestions.map((q) => DIMENSION_COLORS[getDimension(q.id)] ?? 'rgba(100,100,100,0.5)')

  const data = {
    labels,
    datasets: [
      {
        label: 'Moyenne',
        data: values,
        backgroundColor: colors,
        borderWidth: 0,
        borderRadius: 3,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        min: -3,
        max: 3,
        grid: { color: 'rgba(148, 163, 184, 0.2)' },
        ticks: { font: { size: 10 } },
      },
      y: {
        ticks: { font: { size: 10 } },
        grid: { display: false },
      },
    },
  }

  const chartHeight = Math.max(300, bipolarQuestions.length * 28)

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
        Paires de mots - Moyennes
      </p>
      <div style={{ height: `${chartHeight}px` }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  )
}
