import { UserAnalytic } from '@/types/admin';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface UserAnalyticsChartProps {
  data: UserAnalytic[];
}

export function UserAnalyticsChart({ data }: UserAnalyticsChartProps) {
  const sortedData = [...data].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  ).slice(-30); // Last 30 days

  const chartData = {
    labels: sortedData.map(d => format(new Date(d.date), 'dd/MM', { locale: ptBR })),
    datasets: [
      {
        label: 'New Users',
        data: sortedData.map(d => d.new_users),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Active Users',
        data: sortedData.map(d => d.active_users),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          title: (context: any) => {
            const index = context[0].dataIndex;
            return format(new Date(sortedData[index].date), "dd 'de' MMMM", { locale: ptBR });
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
  };

  const avgRetention = sortedData.length > 0
    ? (sortedData.reduce((sum, d) => sum + d.retention_rate, 0) / sortedData.length * 100).toFixed(1)
    : 0;

  const avgCompletion = sortedData.length > 0
    ? (sortedData.reduce((sum, d) => sum + d.completion_rate, 0) / sortedData.length * 100).toFixed(1)
    : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">User Analytics</h3>
          <p className="text-sm text-gray-500">User activity over the last 30 days</p>
        </div>
        <a
          href="/admin/analytics"
          className="text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          View details
        </a>
      </div>

      <div className="h-64 mb-6">
        <Line data={chartData} options={options} />
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
        <div>
          <p className="text-sm text-gray-500">Average Retention Rate</p>
          <p className="text-2xl font-semibold text-gray-900">{avgRetention}%</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Average Completion Rate</p>
          <p className="text-2xl font-semibold text-gray-900">{avgCompletion}%</p>
        </div>
      </div>
    </div>
  );
}