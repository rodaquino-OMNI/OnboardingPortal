import { PerformanceMetric } from '@/types/admin';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface PerformanceChartProps {
  data: PerformanceMetric[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  // Group metrics by type
  const responseTimeData = data.filter(m => m.metric_name === 'response_time');
  const errorRateData = data.filter(m => m.metric_name === 'error_rate');
  const throughputData = data.filter(m => m.metric_name === 'throughput');

  const chartData = {
    labels: ['API Response', 'Error Rate', 'Throughput', 'CPU Usage', 'Memory', 'Disk I/O'],
    datasets: [
      {
        label: 'Current',
        data: [
          responseTimeData[0]?.metric_value || 0,
          (errorRateData[0]?.metric_value || 0) * 100,
          throughputData[0]?.metric_value || 0,
          65, // Mock CPU usage
          72, // Mock Memory usage
          45, // Mock Disk I/O
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(236, 72, 153, 0.8)',
        ],
        borderWidth: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            let label = context.label || '';
            if (label) {
              label += ': ';
            }
            
            switch (context.dataIndex) {
              case 0: // Response time
                label += context.parsed.y + 'ms';
                break;
              case 1: // Error rate
                label += context.parsed.y.toFixed(2) + '%';
                break;
              case 2: // Throughput
                label += context.parsed.y + ' req/s';
                break;
              default: // Others
                label += context.parsed.y + '%';
            }
            
            return label;
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
        max: 100,
        ticks: {
          callback: function(value: any) {
            return value + '%';
          },
        },
      },
    },
  };

  const performanceScore = () => {
    const avgResponseTime = responseTimeData[0]?.metric_value || 0;
    const avgErrorRate = (errorRateData[0]?.metric_value || 0) * 100;
    
    if (avgResponseTime < 200 && avgErrorRate < 1) return { score: 'Excellent', color: 'text-green-600' };
    if (avgResponseTime < 500 && avgErrorRate < 5) return { score: 'Good', color: 'text-blue-600' };
    if (avgResponseTime < 1000 && avgErrorRate < 10) return { score: 'Fair', color: 'text-yellow-600' };
    return { score: 'Poor', color: 'text-red-600' };
  };

  const score = performanceScore();

  return (
    <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">System Performance</h3>
          <p className="text-sm text-gray-500">Real-time performance metrics</p>
        </div>
        <a
          href="/admin/monitoring"
          className="text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          View details
        </a>
      </div>

      <div className="h-64 mb-6">
        <Bar data={chartData} options={options} />
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div>
          <p className="text-sm text-gray-500">Overall Performance</p>
          <p className={`text-2xl font-semibold ${score.color}`}>{score.score}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Avg Response Time</p>
          <p className="text-2xl font-semibold text-gray-900">
            {responseTimeData[0]?.metric_value || 0}ms
          </p>
        </div>
      </div>
    </div>
  );
}