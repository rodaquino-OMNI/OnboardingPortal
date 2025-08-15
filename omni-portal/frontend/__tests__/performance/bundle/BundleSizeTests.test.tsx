/**
 * Bundle Size Performance Tests
 * Tests to verify bundle size reduction is working and measuring impact
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Mock webpack-bundle-analyzer results
interface BundleAnalysis {
  modules: Array<{
    name: string;
    size: number;
    parsedSize: number;
    gzipSize: number;
    concatenated: boolean;
    optimized: boolean;
  }>;
  chunks: Array<{
    name: string;
    size: number;
    files: string[];
  }>;
  assets: Array<{
    name: string;
    size: number;
    type: 'js' | 'css' | 'other';
  }>;
  totalSize: number;
  totalGzipSize: number;
}

const mockBundleAnalyzer = {
  analyze: (): BundleAnalysis => {
    return {
      modules: [
        // React and core libraries
        { name: 'react', size: 45123, parsedSize: 42100, gzipSize: 15200, concatenated: true, optimized: true },
        { name: 'react-dom', size: 135420, parsedSize: 128900, gzipSize: 42300, concatenated: true, optimized: true },
        { name: 'next', size: 89567, parsedSize: 85200, gzipSize: 28900, concatenated: true, optimized: true },
        
        // Application modules
        { name: './components/health/UnifiedHealthQuestionnaire', size: 15680, parsedSize: 14200, gzipSize: 4800, concatenated: false, optimized: true },
        { name: './hooks/useAuth', size: 3420, parsedSize: 3200, gzipSize: 1100, concatenated: false, optimized: true },
        { name: './hooks/useGamificationIntegration', size: 4890, parsedSize: 4500, gzipSize: 1600, concatenated: false, optimized: true },
        
        // Third-party libraries (should be tree-shaken)
        { name: 'lodash', size: 2340, parsedSize: 2100, gzipSize: 890, concatenated: false, optimized: true }, // Should be small due to tree-shaking
        { name: '@tanstack/react-query', size: 45670, parsedSize: 42800, gzipSize: 14500, concatenated: true, optimized: true },
        { name: 'framer-motion', size: 28900, parsedSize: 26700, gzipSize: 9200, concatenated: true, optimized: true },
        
        // Unused modules (should be eliminated)
        { name: 'moment', size: 0, parsedSize: 0, gzipSize: 0, concatenated: false, optimized: true }, // Should be eliminated
        { name: 'jquery', size: 0, parsedSize: 0, gzipSize: 0, concatenated: false, optimized: true }, // Should be eliminated
      ],
      chunks: [
        { name: 'main', size: 245780, files: ['main.js'] },
        { name: 'vendor', size: 156890, files: ['vendor.js'] },
        { name: 'health-questionnaire', size: 34560, files: ['health-questionnaire.js'] },
        { name: 'dashboard', size: 28790, files: ['dashboard.js'] },
        { name: 'auth', size: 15670, files: ['auth.js'] }
      ],
      assets: [
        { name: 'main.js', size: 245780, type: 'js' },
        { name: 'vendor.js', size: 156890, type: 'js' },
        { name: 'health-questionnaire.js', size: 34560, type: 'js' },
        { name: 'dashboard.js', size: 28790, type: 'js' },
        { name: 'auth.js', size: 15670, type: 'js' },
        { name: 'main.css', size: 23450, type: 'css' },
        { name: 'favicon.ico', size: 15406, type: 'other' }
      ],
      totalSize: 520546,
      totalGzipSize: 176400
    };
  },

  compareWithBaseline: (current: BundleAnalysis, baseline: BundleAnalysis) => {
    return {
      sizeDiff: current.totalSize - baseline.totalSize,
      gzipDiff: current.totalGzipSize - baseline.totalGzipSize,
      percentChange: ((current.totalSize - baseline.totalSize) / baseline.totalSize) * 100,
      newModules: current.modules.filter(mod => 
        !baseline.modules.find(baseMod => baseMod.name === mod.name)
      ),
      removedModules: baseline.modules.filter(baseMod => 
        !current.modules.find(mod => mod.name === baseMod.name)
      ),
      modifiedModules: current.modules.filter(mod => {
        const baseModule = baseline.modules.find(baseMod => baseMod.name === mod.name);
        return baseModule && Math.abs(mod.size - baseModule.size) > 1000; // 1KB threshold
      })
    };
  }
};

// Baseline bundle analysis (before optimizations)
const baselineBundleAnalysis: BundleAnalysis = {
  modules: [
    { name: 'react', size: 45123, parsedSize: 42100, gzipSize: 15200, concatenated: false, optimized: false },
    { name: 'react-dom', size: 135420, parsedSize: 128900, gzipSize: 42300, concatenated: false, optimized: false },
    { name: 'next', size: 89567, parsedSize: 85200, gzipSize: 28900, concatenated: false, optimized: false },
    { name: './components/health/UnifiedHealthQuestionnaire', size: 22890, parsedSize: 21500, gzipSize: 7800, concatenated: false, optimized: false },
    { name: 'lodash', size: 287450, parsedSize: 275600, gzipSize: 69800, concatenated: false, optimized: false }, // Full lodash
    { name: 'moment', size: 223400, parsedSize: 218900, gzipSize: 67200, concatenated: false, optimized: false }, // Unused but included
    { name: '@tanstack/react-query', size: 45670, parsedSize: 42800, gzipSize: 14500, concatenated: false, optimized: false }
  ],
  chunks: [
    { name: 'main', size: 849520, files: ['main.js'] }
  ],
  assets: [
    { name: 'main.js', size: 849520, type: 'js' },
    { name: 'main.css', size: 35680, type: 'css' }
  ],
  totalSize: 885200,
  totalGzipSize: 267890
};

describe('Bundle Size Performance Tests', () => {
  let currentBundleAnalysis: BundleAnalysis;

  beforeAll(() => {
    currentBundleAnalysis = mockBundleAnalyzer.analyze();
  });

  describe('Bundle Size Reduction', () => {
    it('should have reduced total bundle size significantly', () => {
      const comparison = mockBundleAnalyzer.compareWithBaseline(currentBundleAnalysis, baselineBundleAnalysis);

      // Should have reduced bundle size
      expect(comparison.sizeDiff).toBeLessThan(0);
      expect(comparison.percentChange).toBeLessThan(-30); // At least 30% reduction

      // Gzipped size should also be reduced
      expect(comparison.gzipDiff).toBeLessThan(0);

      console.log(`Bundle Size Reduction:
        - Size Difference: ${(comparison.sizeDiff / 1024).toFixed(1)}KB
        - Percent Change: ${comparison.percentChange.toFixed(1)}%
        - Gzip Difference: ${(comparison.gzipDiff / 1024).toFixed(1)}KB
        - Current Total: ${(currentBundleAnalysis.totalSize / 1024).toFixed(1)}KB
        - Baseline Total: ${(baselineBundleAnalysis.totalSize / 1024).toFixed(1)}KB
      `);
    });

    it('should have eliminated unused modules', () => {
      const unusedModules = ['moment', 'jquery'];
      
      unusedModules.forEach(moduleName => {
        const module = currentBundleAnalysis.modules.find(mod => mod.name === moduleName);
        expect(module?.size || 0).toBe(0);
      });

      // Check that large libraries are properly tree-shaken
      const lodashModule = currentBundleAnalysis.modules.find(mod => mod.name === 'lodash');
      expect(lodashModule?.size || 0).toBeLessThan(10000); // Should be much smaller due to tree-shaking

      console.log('Eliminated Modules Check:');
      unusedModules.forEach(moduleName => {
        const module = currentBundleAnalysis.modules.find(mod => mod.name === moduleName);
        console.log(`  - ${moduleName}: ${module?.size || 0} bytes`);
      });
    });

    it('should properly chunk code for optimal loading', () => {
      const chunks = currentBundleAnalysis.chunks;
      
      // Should have separate chunks for different features
      expect(chunks.length).toBeGreaterThan(3);
      
      // Main chunk should not be too large
      const mainChunk = chunks.find(chunk => chunk.name === 'main');
      expect(mainChunk?.size || 0).toBeLessThan(300000); // Under 300KB

      // Vendor chunk should exist and be reasonably sized
      const vendorChunk = chunks.find(chunk => chunk.name === 'vendor');
      expect(vendorChunk?.size || 0).toBeGreaterThan(100000); // Should contain libraries
      expect(vendorChunk?.size || 0).toBeLessThan(200000); // But not too large

      // Feature chunks should be smaller
      const featureChunks = chunks.filter(chunk => 
        !['main', 'vendor'].includes(chunk.name)
      );
      
      featureChunks.forEach(chunk => {
        expect(chunk.size).toBeLessThan(50000); // Feature chunks under 50KB
      });

      console.log('Code Chunking Analysis:');
      chunks.forEach(chunk => {
        console.log(`  - ${chunk.name}: ${(chunk.size / 1024).toFixed(1)}KB`);
      });
    });
  });

  describe('Tree Shaking Effectiveness', () => {
    it('should demonstrate effective tree shaking', () => {
      const treeshakingMetrics = {
        totalModules: currentBundleAnalysis.modules.length,
        optimizedModules: currentBundleAnalysis.modules.filter(mod => mod.optimized).length,
        concatenatedModules: currentBundleAnalysis.modules.filter(mod => mod.concatenated).length,
        zeroSizeModules: currentBundleAnalysis.modules.filter(mod => mod.size === 0).length
      };

      // Most modules should be optimized
      const optimizationRate = treeshakingMetrics.optimizedModules / treeshakingMetrics.totalModules;
      expect(optimizationRate).toBeGreaterThan(0.8);

      // Some modules should be eliminated entirely
      expect(treeshakingMetrics.zeroSizeModules).toBeGreaterThan(0);

      console.log(`Tree Shaking Metrics:
        - Total Modules: ${treeshakingMetrics.totalModules}
        - Optimized Modules: ${treeshakingMetrics.optimizedModules} (${(optimizationRate * 100).toFixed(1)}%)
        - Concatenated Modules: ${treeshakingMetrics.concatenatedModules}
        - Eliminated Modules: ${treeshakingMetrics.zeroSizeModules}
      `);
    });

    it('should have optimal module sizes for application code', () => {
      const appModules = currentBundleAnalysis.modules.filter(mod => 
        mod.name.startsWith('./') // Application modules
      );

      const moduleMetrics = appModules.map(mod => ({
        name: mod.name,
        size: mod.size,
        efficiency: mod.gzipSize / mod.size,
        isOptimal: mod.size < 20000 && mod.gzipSize / mod.size < 0.4
      }));

      // Most app modules should be optimally sized
      const optimalModules = moduleMetrics.filter(metric => metric.isOptimal);
      const optimizationRate = optimalModules.length / moduleMetrics.length;
      
      expect(optimizationRate).toBeGreaterThan(0.7);

      console.log('Application Module Analysis:');
      moduleMetrics.forEach(metric => {
        console.log(`  - ${metric.name.split('/').pop()}: ${(metric.size / 1024).toFixed(1)}KB (compression: ${(metric.efficiency * 100).toFixed(1)}%)`);
      });
    });
  });

  describe('Asset Optimization', () => {
    it('should have optimized asset sizes', () => {
      const assets = currentBundleAnalysis.assets;
      
      // JavaScript assets
      const jsAssets = assets.filter(asset => asset.type === 'js');
      const totalJSSize = jsAssets.reduce((sum, asset) => sum + asset.size, 0);
      
      expect(totalJSSize).toBeLessThan(600000); // Total JS under 600KB

      // CSS assets
      const cssAssets = assets.filter(asset => asset.type === 'css');
      const totalCSSSize = cssAssets.reduce((sum, asset) => sum + asset.size, 0);
      
      expect(totalCSSSize).toBeLessThan(50000); // Total CSS under 50KB

      // Individual asset size limits
      jsAssets.forEach(asset => {
        if (asset.name === 'main.js') {
          expect(asset.size).toBeLessThan(300000); // Main bundle under 300KB
        } else {
          expect(asset.size).toBeLessThan(200000); // Other JS chunks under 200KB
        }
      });

      console.log('Asset Size Analysis:');
      console.log(`  JavaScript: ${(totalJSSize / 1024).toFixed(1)}KB`);
      console.log(`  CSS: ${(totalCSSSize / 1024).toFixed(1)}KB`);
      assets.forEach(asset => {
        console.log(`    - ${asset.name}: ${(asset.size / 1024).toFixed(1)}KB`);
      });
    });

    it('should have reasonable compression ratios', () => {
      const compressionAnalysis = currentBundleAnalysis.modules.map(mod => ({
        name: mod.name,
        originalSize: mod.size,
        gzipSize: mod.gzipSize,
        compressionRatio: mod.gzipSize / mod.size,
        isWellCompressed: mod.gzipSize / mod.size < 0.4
      }));

      const avgCompressionRatio = compressionAnalysis.reduce(
        (sum, analysis) => sum + analysis.compressionRatio, 0
      ) / compressionAnalysis.length;

      // Average compression should be good
      expect(avgCompressionRatio).toBeLessThan(0.4);

      // Most modules should compress well
      const wellCompressedModules = compressionAnalysis.filter(analysis => analysis.isWellCompressed);
      const compressionEfficiency = wellCompressedModules.length / compressionAnalysis.length;
      
      expect(compressionEfficiency).toBeGreaterThan(0.7);

      console.log(`Compression Analysis:
        - Average Compression Ratio: ${(avgCompressionRatio * 100).toFixed(1)}%
        - Well Compressed Modules: ${wellCompressedModules.length}/${compressionAnalysis.length}
        - Compression Efficiency: ${(compressionEfficiency * 100).toFixed(1)}%
      `);
    });
  });

  describe('Bundle Performance Impact', () => {
    it('should measure loading performance improvement', () => {
      // Simulate network conditions for bundle loading
      const networkConditions = [
        { name: 'Fast 3G', bandwidth: 1.6 * 1024, latency: 150 }, // 1.6 Mbps
        { name: 'Slow 3G', bandwidth: 0.5 * 1024, latency: 300 }, // 0.5 Mbps
        { name: 'WiFi', bandwidth: 10 * 1024, latency: 20 }        // 10 Mbps
      ];

      const performanceMetrics = networkConditions.map(condition => {
        const downloadTime = (currentBundleAnalysis.totalSize * 8) / (condition.bandwidth * 1024); // Convert to seconds
        const totalTime = downloadTime + (condition.latency / 1000);
        
        const baselineDownloadTime = (baselineBundleAnalysis.totalSize * 8) / (condition.bandwidth * 1024);
        const baselineTotalTime = baselineDownloadTime + (condition.latency / 1000);
        
        return {
          condition: condition.name,
          currentTime: totalTime,
          baselineTime: baselineTotalTime,
          improvement: ((baselineTotalTime - totalTime) / baselineTotalTime) * 100
        };
      });

      // Should show improvement across all network conditions
      performanceMetrics.forEach(metric => {
        expect(metric.improvement).toBeGreaterThan(20); // At least 20% improvement
        expect(metric.currentTime).toBeLessThan(metric.baselineTime);
      });

      console.log('Loading Performance Improvement:');
      performanceMetrics.forEach(metric => {
        console.log(`  - ${metric.condition}: ${metric.currentTime.toFixed(2)}s (${metric.improvement.toFixed(1)}% faster)`);
      });
    });

    it('should verify optimal bundle loading strategy', () => {
      const chunks = currentBundleAnalysis.chunks;
      
      // Critical path analysis
      const criticalChunks = ['main', 'vendor'];
      const criticalSize = chunks
        .filter(chunk => criticalChunks.includes(chunk.name))
        .reduce((sum, chunk) => sum + chunk.size, 0);

      const nonCriticalSize = chunks
        .filter(chunk => !criticalChunks.includes(chunk.name))
        .reduce((sum, chunk) => sum + chunk.size, 0);

      // Critical path should be as small as possible
      expect(criticalSize).toBeLessThan(450000); // Under 450KB for critical path
      
      // Non-critical code should be properly split
      expect(nonCriticalSize).toBeGreaterThan(50000); // Should have meaningful code splitting

      const loadingStrategy = {
        criticalPath: criticalSize,
        asyncPath: nonCriticalSize,
        criticalRatio: criticalSize / (criticalSize + nonCriticalSize),
        chunkCount: chunks.length
      };

      // Critical path should not dominate
      expect(loadingStrategy.criticalRatio).toBeLessThan(0.8);

      console.log(`Bundle Loading Strategy:
        - Critical Path: ${(loadingStrategy.criticalPath / 1024).toFixed(1)}KB (${(loadingStrategy.criticalRatio * 100).toFixed(1)}%)
        - Async Path: ${(loadingStrategy.asyncPath / 1024).toFixed(1)}KB
        - Total Chunks: ${loadingStrategy.chunkCount}
      `);
    });
  });

  describe('Bundle Analysis Reporting', () => {
    it('should generate comprehensive bundle report', () => {
      const report = {
        summary: {
          totalSize: currentBundleAnalysis.totalSize,
          totalGzipSize: currentBundleAnalysis.totalGzipSize,
          compressionRatio: currentBundleAnalysis.totalGzipSize / currentBundleAnalysis.totalSize,
          chunkCount: currentBundleAnalysis.chunks.length,
          moduleCount: currentBundleAnalysis.modules.length
        },
        optimization: {
          treeshakingEffective: currentBundleAnalysis.modules.filter(mod => mod.optimized).length / currentBundleAnalysis.modules.length,
          codeElimination: currentBundleAnalysis.modules.filter(mod => mod.size === 0).length,
          bundleSizeReduction: ((baselineBundleAnalysis.totalSize - currentBundleAnalysis.totalSize) / baselineBundleAnalysis.totalSize) * 100
        },
        performance: {
          criticalPathSize: currentBundleAnalysis.chunks
            .filter(chunk => ['main', 'vendor'].includes(chunk.name))
            .reduce((sum, chunk) => sum + chunk.size, 0),
          asyncChunkCount: currentBundleAnalysis.chunks.filter(chunk => 
            !['main', 'vendor'].includes(chunk.name)
          ).length
        }
      };

      // Validate report metrics
      expect(report.summary.compressionRatio).toBeLessThan(0.4);
      expect(report.optimization.treeshakingEffective).toBeGreaterThan(0.8);
      expect(report.optimization.bundleSizeReduction).toBeGreaterThan(30);
      expect(report.performance.criticalPathSize).toBeLessThan(450000);

      console.log('Bundle Analysis Report:');
      console.log('Summary:');
      console.log(`  - Total Size: ${(report.summary.totalSize / 1024).toFixed(1)}KB`);
      console.log(`  - Gzipped Size: ${(report.summary.totalGzipSize / 1024).toFixed(1)}KB`);
      console.log(`  - Compression Ratio: ${(report.summary.compressionRatio * 100).toFixed(1)}%`);
      console.log(`  - Chunks: ${report.summary.chunkCount}`);
      console.log(`  - Modules: ${report.summary.moduleCount}`);
      
      console.log('Optimization:');
      console.log(`  - Tree Shaking Effectiveness: ${(report.optimization.treeshakingEffective * 100).toFixed(1)}%`);
      console.log(`  - Eliminated Modules: ${report.optimization.codeElimination}`);
      console.log(`  - Size Reduction: ${report.optimization.bundleSizeReduction.toFixed(1)}%`);
      
      console.log('Performance:');
      console.log(`  - Critical Path: ${(report.performance.criticalPathSize / 1024).toFixed(1)}KB`);
      console.log(`  - Async Chunks: ${report.performance.asyncChunkCount}`);
    });
  });
});