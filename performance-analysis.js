#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * REAL Performance Analysis Tool
 * Analyzes actual bundle sizes, identifies performance issues, and provides actionable insights
 */

class PerformanceAnalyzer {
  constructor(buildDir) {
    this.buildDir = buildDir;
    this.results = {
      bundleAnalysis: {},
      performanceIssues: [],
      recommendations: [],
      realMetrics: {}
    };
  }

  analyzeBundleSizes() {
    console.log('📊 ANALYZING REAL BUNDLE SIZES...');
    
    const chunksDir = path.join(this.buildDir, 'static', 'chunks');
    if (!fs.existsSync(chunksDir)) {
      console.error('❌ Build directory not found. Run npm run build first.');
      return;
    }

    const files = fs.readdirSync(chunksDir);
    const bundles = [];
    let totalSize = 0;

    files.forEach(file => {
      if (file.endsWith('.js')) {
        const filePath = path.join(chunksDir, file);
        const stats = fs.statSync(filePath);
        const sizeKB = Math.round(stats.size / 1024);
        totalSize += stats.size;
        
        bundles.push({
          file,
          sizeKB,
          sizeBytes: stats.size
        });
      }
    });

    bundles.sort((a, b) => b.sizeKB - a.sizeKB);

    this.results.bundleAnalysis = {
      totalSizeKB: Math.round(totalSize / 1024),
      totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
      fileCount: bundles.length,
      largestBundles: bundles.slice(0, 10),
      allBundles: bundles
    };

    console.log(`📦 Total Bundle Size: ${this.results.bundleAnalysis.totalSizeMB} MB`);
    console.log(`📁 Total Files: ${this.results.bundleAnalysis.fileCount}`);
    
    return this.results.bundleAnalysis;
  }

  identifyPerformanceIssues() {
    console.log('🔍 IDENTIFYING PERFORMANCE ISSUES...');
    
    const { bundleAnalysis } = this.results;
    const issues = [];

    // Issue 1: Large bundle size
    if (bundleAnalysis.totalSizeMB > 5) {
      issues.push({
        type: 'CRITICAL',
        category: 'Bundle Size',
        issue: `Total bundle size is ${bundleAnalysis.totalSizeMB} MB (exceeds 5MB threshold)`,
        impact: 'Slow initial page load, poor mobile performance',
        solution: 'Implement code splitting, remove unused dependencies, optimize images'
      });
    }

    // Issue 2: Large individual chunks
    bundleAnalysis.largestBundles.forEach(bundle => {
      if (bundle.sizeKB > 500) {
        issues.push({
          type: 'HIGH',
          category: 'Large Chunks',
          issue: `${bundle.file} is ${bundle.sizeKB}KB (exceeds 500KB threshold)`,
          impact: 'Slow loading for specific routes/components',
          solution: 'Split large components, implement dynamic imports, lazy loading'
        });
      }
    });

    // Issue 3: Too many small chunks (overhead)
    const smallChunks = bundleAnalysis.allBundles.filter(b => b.sizeKB < 10);
    if (smallChunks.length > 20) {
      issues.push({
        type: 'MEDIUM',
        category: 'Bundle Fragmentation',
        issue: `${smallChunks.length} chunks are smaller than 10KB`,
        impact: 'HTTP overhead, multiple round trips',
        solution: 'Optimize webpack splitChunks configuration, merge small chunks'
      });
    }

    this.results.performanceIssues = issues;
    console.log(`🚨 Found ${issues.length} performance issues`);
    
    return issues;
  }

  generateRecommendations() {
    console.log('💡 GENERATING RECOMMENDATIONS...');
    
    const recommendations = [];
    const { bundleAnalysis, performanceIssues } = this.results;

    // Bundle optimization recommendations
    if (bundleAnalysis.totalSizeMB > 3) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Bundle Optimization',
        recommendation: 'Implement advanced code splitting',
        implementation: `
// Add to next.config.js
experimental: {
  optimizePackageImports: ['@radix-ui', 'lucide-react', '@opentelemetry'],
},
webpack: (config) => {
  config.optimization.splitChunks.maxSize = 200000;
  return config;
}`
      });
    }

    // Dependency optimization
    recommendations.push({
      priority: 'HIGH',
      category: 'Dependencies',
      recommendation: 'Optimize heavy dependencies',
      implementation: `
// Replace heavy libraries:
// 1. Replace moment.js with date-fns (already done ✅)
// 2. Use dynamic imports for Chart.js
// 3. Lazy load OpenTelemetry
// 4. Tree-shake Lodash imports`
    });

    // Performance monitoring
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Monitoring',
      recommendation: 'Implement Core Web Vitals monitoring',
      implementation: `
// Add to _app.tsx
export function reportWebVitals(metric) {
  console.log('Web Vital:', metric);
  // Send to analytics
}`
    });

    this.results.recommendations = recommendations;
    return recommendations;
  }

  measureBuildPerformance() {
    console.log('⏱️ MEASURING BUILD PERFORMANCE...');
    
    // Check if build artifacts exist
    const buildInfo = {
      hasNextBuild: fs.existsSync(path.join(this.buildDir, 'server')),
      hasStaticAssets: fs.existsSync(path.join(this.buildDir, 'static')),
      buildTimestamp: null
    };

    try {
      const buildId = fs.readFileSync(path.join(this.buildDir, 'BUILD_ID'), 'utf8');
      buildInfo.buildId = buildId.trim();
    } catch (e) {
      buildInfo.buildId = 'unknown';
    }

    this.results.realMetrics.buildInfo = buildInfo;
    return buildInfo;
  }

  generateReport() {
    console.log('📋 GENERATING PERFORMANCE REPORT...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalBundleSize: `${this.results.bundleAnalysis.totalSizeMB} MB`,
        criticalIssues: this.results.performanceIssues.filter(i => i.type === 'CRITICAL').length,
        highPriorityIssues: this.results.performanceIssues.filter(i => i.type === 'HIGH').length,
        totalRecommendations: this.results.recommendations.length
      },
      ...this.results
    };

    const reportPath = path.join(process.cwd(), 'performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`✅ Report saved to: ${reportPath}`);
    return report;
  }

  printSummary() {
    console.log('\n🎯 PERFORMANCE ANALYSIS SUMMARY');
    console.log('================================');
    
    const { bundleAnalysis, performanceIssues } = this.results;
    
    console.log(`📦 Bundle Size: ${bundleAnalysis.totalSizeMB} MB`);
    console.log(`📁 Total Chunks: ${bundleAnalysis.fileCount}`);
    console.log(`🚨 Critical Issues: ${performanceIssues.filter(i => i.type === 'CRITICAL').length}`);
    console.log(`⚠️  High Priority Issues: ${performanceIssues.filter(i => i.type === 'HIGH').length}`);
    
    console.log('\n🔥 LARGEST BUNDLES:');
    bundleAnalysis.largestBundles.slice(0, 5).forEach((bundle, i) => {
      console.log(`${i + 1}. ${bundle.file}: ${bundle.sizeKB}KB`);
    });
    
    console.log('\n🚨 CRITICAL ISSUES:');
    performanceIssues.filter(i => i.type === 'CRITICAL').forEach(issue => {
      console.log(`- ${issue.issue}`);
      console.log(`  Solution: ${issue.solution}`);
    });
    
    console.log('\n💡 TOP RECOMMENDATIONS:');
    this.results.recommendations.slice(0, 3).forEach((rec, i) => {
      console.log(`${i + 1}. ${rec.recommendation} (${rec.priority})`);
    });
  }
}

// Main execution
const buildDir = path.join(process.cwd(), '.next');
const analyzer = new PerformanceAnalyzer(buildDir);

analyzer.analyzeBundleSizes();
analyzer.identifyPerformanceIssues();
analyzer.generateRecommendations();
analyzer.measureBuildPerformance();
analyzer.generateReport();
analyzer.printSummary();

module.exports = PerformanceAnalyzer;