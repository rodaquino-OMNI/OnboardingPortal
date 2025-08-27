/**
 * Console Optimization Plugin for Next.js
 * 
 * This plugin removes console statements from production builds
 * while preserving critical error logging.
 */

class ConsoleOptimizationPlugin {
  constructor(options = {}) {
    this.options = {
      // Keep console.error in production for monitoring
      preserveError: true,
      // Keep console.warn in development and staging
      preserveWarnInDev: true,
      // Remove console.log, console.debug, console.info
      removeDebugLogs: true,
      // Custom patterns to preserve
      preservePatterns: [],
      ...options
    };
  }

  apply(compiler) {
    const { webpack } = compiler;
    
    // Only apply in production builds
    if (compiler.options.mode !== 'production') {
      return;
    }

    compiler.hooks.compilation.tap('ConsoleOptimizationPlugin', (compilation) => {
      compilation.hooks.optimizeChunkAssets.tapAsync(
        'ConsoleOptimizationPlugin',
        (chunks, callback) => {
          chunks.forEach((chunk) => {
            chunk.files.forEach((fileName) => {
              if (fileName.endsWith('.js')) {
                const asset = compilation.assets[fileName];
                let source = asset.source();
                
                // Remove console.log statements
                if (this.options.removeDebugLogs) {
                  source = source.replace(/console\.log\s*\([^)]*\);?/g, '');
                  source = source.replace(/console\.debug\s*\([^)]*\);?/g, '');
                  source = source.replace(/console\.info\s*\([^)]*\);?/g, '');
                }
                
                // Wrap console.warn in environment check
                if (this.options.preserveWarnInDev) {
                  source = source.replace(
                    /console\.warn\s*\(([^)]*)\);?/g,
                    'if (process.env.NODE_ENV !== "production") { console.warn($1); }'
                  );
                }
                
                // Keep console.error but with additional safety
                if (this.options.preserveError) {
                  source = source.replace(
                    /console\.error\s*\(([^)]*)\);?/g,
                    'if (typeof console !== "undefined" && console.error) { console.error($1); }'
                  );
                }
                
                // Update the asset
                compilation.assets[fileName] = {
                  source: () => source,
                  size: () => source.length
                };
              }
            });
          });
          
          callback();
        }
      );
    });
  }
}

module.exports = ConsoleOptimizationPlugin;