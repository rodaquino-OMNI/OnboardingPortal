// Chart.js Dynamic Loader
// Optimizes Chart.js loading for analytics components

import type { ChartConfiguration, ChartType } from 'chart.js';

let chartJSLoaded = false;
let chartComponents: any = null;

/**
 * Dynamically load Chart.js with only required components
 */
export const loadChartJS = async () => {
  if (chartJSLoaded && chartComponents) {
    return chartComponents;
  }

  const [
    { Chart, registerables },
    { Line },
    { Bar },
    { Pie },
    { Doughnut }
  ] = await Promise.all([
    import('chart.js'),
    import('react-chartjs-2'),
    import('react-chartjs-2'),
    import('react-chartjs-2'),
    import('react-chartjs-2')
  ]);

  // Register only the components we need
  Chart.register(...registerables);

  chartComponents = {
    Chart,
    Line,
    Bar,
    Pie,
    Doughnut
  };

  chartJSLoaded = true;
  return chartComponents;
};

/**
 * Create a lazy chart component
 */
export const createLazyChart = (chartType: ChartType) => {
  return async (props: any) => {
    const { Chart, [chartType]: ChartComponent } = await loadChartJS();
    return ChartComponent ? ChartComponent : null;
  };
};

/**
 * Preload charts for admin dashboard
 */
export const preloadChartsForAdmin = () => {
  setTimeout(() => {
    loadChartJS().catch(console.error);
  }, 100);
};

/**
 * Common chart configurations for consistent styling
 */
export const getChartConfig = (type: ChartType): Partial<ChartConfiguration> => {
  const baseConfig = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
      },
    },
  };

  switch (type) {
    case 'line':
      return {
        ...baseConfig,
        scales: {
          x: {
            grid: {
              display: false,
            },
          },
          y: {
            grid: {
              color: 'rgba(0, 0, 0, 0.1)',
            },
            beginAtZero: true,
          },
        },
      };
    
    case 'bar':
      return {
        ...baseConfig,
        scales: {
          x: {
            grid: {
              display: false,
            },
          },
          y: {
            grid: {
              color: 'rgba(0, 0, 0, 0.1)',
            },
            beginAtZero: true,
          },
        },
      };
    
    case 'pie':
    case 'doughnut':
      return {
        ...baseConfig,
        scales: undefined, // Pie charts don't use scales
      };
    
    default:
      return baseConfig;
  }
};