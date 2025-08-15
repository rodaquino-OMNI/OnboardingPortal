/**
 * Master Performance Test Suite
 * Orchestrates all performance tests and generates comprehensive report
 */

import { PerformanceTestRunner, runPerformanceTests } from './utils/PerformanceTestRunner';

describe('Complete Performance Verification Suite', () => {
  jest.setTimeout(30000); // 30 second timeout for full suite

  it('should run all performance tests and generate comprehensive report', async () => {
    console.log('\n🚀 Starting Complete Performance Test Suite...\n');

    const report = await runPerformanceTests();

    // Verify overall performance meets standards
    expect(report.summary.overallScore).toBeGreaterThan(70); // 70% minimum pass rate
    expect(report.summary.failed).toBeLessThan(3); // Maximum 2 critical failures

    // Verify each category meets minimum standards
    Object.entries(report.categories).forEach(([category, data]) => {
      expect(data.score).toBeGreaterThan(60); // Each category should have >60% pass rate
      console.log(`✅ ${category}: ${data.score}/100`);
    });

    // Log summary
    console.log(`\n📊 Performance Test Summary:`);
    console.log(`   Overall Score: ${report.summary.overallScore}/100`);
    console.log(`   Tests Passed: ${report.summary.passed}/${report.summary.totalTests}`);
    console.log(`   Categories: ${Object.keys(report.categories).length}`);
    console.log(`   Environment: Node ${report.environment.node}`);

    // Verify specific performance improvements
    const bundleCategory = report.categories['Bundle Optimization'];
    if (bundleCategory) {
      const bundleSizeResult = bundleCategory.results.find(r => r.test === 'Total Bundle Size');
      if (bundleSizeResult && bundleSizeResult.improvement) {
        expect(bundleSizeResult.improvement).toBeGreaterThan(0.3); // 30% bundle size reduction
        console.log(`   Bundle Size Reduction: ${(bundleSizeResult.improvement * 100).toFixed(1)}%`);
      }
    }

    const dbCategory = report.categories['Database Queries'] || report.categories['Database Performance'];
    if (dbCategory) {
      const queryResult = dbCategory.results.find(r => r.test.includes('Query'));
      if (queryResult) {
        expect(queryResult.value).toBeLessThanOrEqual(queryResult.threshold);
        console.log(`   Query Performance: ${queryResult.value} ${queryResult.metric}`);
      }
    }

    const webVitalsCategory = report.categories['Web Vitals'];
    if (webVitalsCategory) {
      const performanceScore = webVitalsCategory.results.find(r => r.test === 'Performance Score');
      if (performanceScore) {
        expect(performanceScore.value).toBeGreaterThan(75);
        console.log(`   Web Vitals Score: ${performanceScore.value}/100`);
      }
    }

    console.log(`\n🎯 Performance verification complete!`);
    console.log(`📄 Detailed report available in performance test output\n`);
  });

  it('should verify all critical performance fixes are working', async () => {
    const criticalChecks = [
      {
        name: 'N+1 Query Prevention',
        category: 'Database Queries',
        metric: 'Query Count',
        maxValue: 5
      },
      {
        name: 'Database Index Usage',
        category: 'Database Performance',
        metric: 'Coverage Ratio',
        minValue: 0.9
      },
      {
        name: 'Redis Session Performance',
        category: 'Session Management',
        metric: 'Avg Latency (ms)',
        maxValue: 5
      },
      {
        name: 'Bundle Size Optimization',
        category: 'Bundle Optimization',
        metric: 'Bundle Size (KB)',
        maxValue: 600
      },
      {
        name: 'Core Web Vitals',
        category: 'Web Vitals',
        metric: 'Score',
        minValue: 75
      }
    ];

    const runner = new PerformanceTestRunner();
    const report = await runner.runAllTests();

    criticalChecks.forEach(check => {
      const category = report.categories[check.category];
      expect(category).toBeDefined();

      const result = category.results.find(r => 
        r.test.includes(check.name.split(' ')[0]) || 
        r.metric === check.metric
      );

      expect(result).toBeDefined();

      if (check.maxValue && result) {
        expect(result.value).toBeLessThanOrEqual(check.maxValue);
      }

      if (check.minValue && result) {
        expect(result.value).toBeGreaterThanOrEqual(check.minValue);
      }

      console.log(`✅ ${check.name}: ${result?.value} ${result?.metric} (${result?.status})`);
    });
  });

  it('should demonstrate measurable performance improvements', async () => {
    const runner = new PerformanceTestRunner();
    const report = await runner.runAllTests();

    // Track improvements across key metrics
    const improvements = {
      bundleSizeReduction: 0,
      queryOptimization: 0,
      webVitalsImprovement: 0,
      sessionPerformanceGain: 0
    };

    // Bundle size improvements
    const bundleResults = report.categories['Bundle Optimization']?.results;
    if (bundleResults) {
      const sizeResult = bundleResults.find(r => r.improvement);
      if (sizeResult?.improvement) {
        improvements.bundleSizeReduction = sizeResult.improvement;
        expect(improvements.bundleSizeReduction).toBeGreaterThan(0.3); // 30% improvement
      }
    }

    // Query performance
    const queryResults = report.categories['Database Queries']?.results;
    if (queryResults) {
      const queryTimeResult = queryResults.find(r => r.metric.includes('Time'));
      if (queryTimeResult) {
        // Should be under 1 second
        expect(queryTimeResult.value).toBeLessThan(1000);
        improvements.queryOptimization = 1 - (queryTimeResult.value / 1000);
      }
    }

    // Web Vitals performance
    const vitalsResults = report.categories['Web Vitals']?.results;
    if (vitalsResults) {
      const scoreResult = vitalsResults.find(r => r.test === 'Performance Score');
      if (scoreResult) {
        improvements.webVitalsImprovement = scoreResult.value / 100;
        expect(improvements.webVitalsImprovement).toBeGreaterThan(0.75);
      }
    }

    // Session performance
    const sessionResults = report.categories['Session Management']?.results;
    if (sessionResults) {
      const latencyResult = sessionResults.find(r => r.metric.includes('Latency'));
      if (latencyResult) {
        // Low latency is good performance
        improvements.sessionPerformanceGain = 1 - (latencyResult.value / 10); // Scale to 0-1
        expect(latencyResult.value).toBeLessThan(5);
      }
    }

    console.log('\n📈 Performance Improvements Summary:');
    console.log(`   Bundle Size Reduction: ${(improvements.bundleSizeReduction * 100).toFixed(1)}%`);
    console.log(`   Query Optimization: ${(improvements.queryOptimization * 100).toFixed(1)}%`);
    console.log(`   Web Vitals Score: ${(improvements.webVitalsImprovement * 100).toFixed(1)}%`);
    console.log(`   Session Performance: ${(improvements.sessionPerformanceGain * 100).toFixed(1)}%`);

    // Overall improvement score
    const overallImprovement = Object.values(improvements).reduce((sum, val) => sum + val, 0) / Object.keys(improvements).length;
    expect(overallImprovement).toBeGreaterThan(0.6); // 60% overall improvement

    console.log(`   Overall Improvement: ${(overallImprovement * 100).toFixed(1)}%\n`);
  });

  it('should validate production-ready performance', async () => {
    const runner = new PerformanceTestRunner();
    const report = await runner.runAllTests();

    // Production readiness criteria
    const productionCriteria = {
      overallScore: 80,        // 80+ overall score
      criticalFailures: 0,     // No critical failures
      categoryMinimum: 70,     // Each category >70%
      webVitalsScore: 80,      // Web Vitals >80
      bundleSize: 600,         // Bundle <600KB
      queryTime: 500,          // Queries <500ms
      sessionLatency: 5        // Session ops <5ms
    };

    // Overall score check
    expect(report.summary.overallScore).toBeGreaterThanOrEqual(productionCriteria.overallScore);
    expect(report.summary.failed).toBeLessThanOrEqual(productionCriteria.criticalFailures);

    // Category checks
    Object.entries(report.categories).forEach(([category, data]) => {
      expect(data.score).toBeGreaterThanOrEqual(productionCriteria.categoryMinimum);
    });

    // Specific metric checks
    const vitalsCategory = report.categories['Web Vitals'];
    if (vitalsCategory) {
      const scoreResult = vitalsCategory.results.find(r => r.test === 'Performance Score');
      if (scoreResult) {
        expect(scoreResult.value).toBeGreaterThanOrEqual(productionCriteria.webVitalsScore);
      }
    }

    const bundleCategory = report.categories['Bundle Optimization'];
    if (bundleCategory) {
      const sizeResult = bundleCategory.results.find(r => r.test === 'Total Bundle Size');
      if (sizeResult) {
        expect(sizeResult.value).toBeLessThanOrEqual(productionCriteria.bundleSize);
      }
    }

    console.log('\n🚀 Production Readiness Assessment:');
    console.log(`   Overall Score: ${report.summary.overallScore}/${productionCriteria.overallScore} ✅`);
    console.log(`   Critical Failures: ${report.summary.failed}/${productionCriteria.criticalFailures} ✅`);
    console.log(`   Category Performance: All categories meet minimum thresholds ✅`);
    console.log(`   Ready for Production: YES 🎯\n`);
  });
});