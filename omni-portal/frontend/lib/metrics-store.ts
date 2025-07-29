interface MetricData {
  value?: number;
  values?: number[];
  labels: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram';
  sum?: number;
  count?: number;
}

// Simple in-memory metrics store
class MetricsStore {
  private metrics: Map<string, MetricData> = new Map();
  
  increment(name: string, labels: Record<string, string> = {}) {
    const key = this.getKey(name, labels);
    const current = this.metrics.get(key) || { value: 0, labels, type: 'counter' };
    current.value = (current.value || 0) + 1;
    this.metrics.set(key, current);
  }
  
  set(name: string, value: number, labels: Record<string, string> = {}) {
    const key = this.getKey(name, labels);
    this.metrics.set(key, { value, labels, type: 'gauge' });
  }
  
  observe(name: string, value: number, labels: Record<string, string> = {}) {
    const key = this.getKey(name, labels);
    const current = this.metrics.get(key) || { 
      values: [], 
      labels, 
      type: 'histogram',
      sum: 0,
      count: 0
    };
    
    if (!current.values) current.values = [];
    current.values.push(value);
    current.sum = (current.sum || 0) + value;
    current.count = (current.count || 0) + 1;
    
    this.metrics.set(key, current);
  }
  
  private getKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    
    return labelStr ? `${name}{${labelStr}}` : name;
  }
  
  getPrometheusFormat(): string {
    const output: string[] = [];
    const grouped = new Map<string, (MetricData & { key: string })[]>();
    
    // Group metrics by name
    for (const [key, metric] of Array.from(this.metrics)) {
      const name = key.split('{')[0] || key;
      if (!grouped.has(name)) {
        grouped.set(name, []);
      }
      const group = grouped.get(name);
      if (group) {
        group.push({ key, ...metric });
      }
    }
    
    // Generate Prometheus format
    for (const [name, metrics] of grouped) {
      const firstMetric = metrics[0];
      
      // Add TYPE comment
      output.push(`# TYPE ${name} ${firstMetric.type}`);
      
      // Add metrics
      for (const metric of metrics) {
        const labelStr = metric.key.includes('{') ? metric.key.substring(metric.key.indexOf('{')) : '';
        
        if (metric.type === 'histogram') {
          output.push(`${name}_sum${labelStr} ${metric.sum || 0}`);
          output.push(`${name}_count${labelStr} ${metric.count || 0}`);
        } else {
          output.push(`${name}${labelStr} ${metric.value || 0}`);
        }
      }
      
      output.push(''); // Empty line between metric families
    }
    
    return output.join('\n');
  }
  
  clear() {
    this.metrics.clear();
  }
  
  getMetrics() {
    return new Map(this.metrics);
  }
}

// Global metrics store instance
export const metricsStore = new MetricsStore();