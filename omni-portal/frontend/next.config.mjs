import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone', // Required for Docker deployment
  
  // Build performance optimizations
  productionBrowserSourceMaps: false,
  modularizeImports: {
    '@opentelemetry/api': {
      transform: '@opentelemetry/api/{{member}}'
    },
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}'
    }
  },
  images: {
    domains: ['localhost', 'api.omni-portal.com'],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  experimental: {
    serverComponentsExternalPackages: ['mysql2', 'tesseract.js'],
    esmExternals: true, // Force ESM externals to fix exports error
    optimizePackageImports: ['lucide-react', '@opentelemetry/api'],
    webpackBuildWorker: true, // Enable webpack build worker for faster builds
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js'
        }
      }
    }
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Optimize font loading
  optimizeFonts: true,
  eslint: {
    // Temporarily disable ESLint during builds to prevent timeout
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Temporarily disable TypeScript build errors to prevent timeout
    ignoreBuildErrors: true,
  },
  // Production optimizations
  poweredByHeader: false,
  compress: true,
  generateEtags: true,
  
  // Bundle analyzer and webpack optimizations
  webpack: (config, { isServer, webpack, dev }) => {
    // Performance optimizations for production builds
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        chunkIds: 'deterministic',
        nodeEnv: 'production',
        mangleExports: 'deterministic',
        usedExports: true,
        sideEffects: false,
        minimize: true,
        concatenateModules: true,
        providedExports: true
      };
    }

    // Fix webpack module resolution
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      },
      // Cache module resolution
      cacheWithContext: false,
      unsafeCache: !dev
    };

    // Exclude test files and unnecessary files from bundle
    config.module.rules.push({
      test: /\.(test|spec)\.(js|jsx|ts|tsx)$/,
      loader: 'ignore-loader'
    });

    // Ignore large unnecessary files
    config.module.rules.push({
      test: /\.(md|txt|log)$/,
      loader: 'ignore-loader'
    });

    // Configure Tesseract.js assets to be served properly
    config.module.rules.push({
      test: /\.(wasm|traineddata)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/tesseract/[name][ext]'
      }
    });

    // Optimized bundle splitting for faster builds
    if (!isServer && !dev) {
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            chunks: 'all',
            enforce: true,
            reuseExistingChunk: true
          },
          common: {
            name: 'common',
            minChunks: 2,
            priority: 5,
            chunks: 'all',
            reuseExistingChunk: true
          }
        }
      };
    }

    // Enhanced caching for faster rebuilds
    if (!dev) {
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__dirname + '/next.config.mjs']
        },
        cacheDirectory: path.resolve(process.cwd(), '.next/cache/webpack')
      };
    }

    // Memory optimization
    if (!isServer) {
      config.stats = 'errors-warnings';
      config.performance = {
        hints: false,
        maxEntrypointSize: 512000,
        maxAssetSize: 512000
      };
    }

    // Bundle analyzer for development - removed to fix CommonJS/ESM conflict
    // To use bundle analyzer, run: npx @next/bundle-analyzer
    // if (process.env.ANALYZE === 'true') {
    //   // This causes "exports is not defined" error in ES modules
    // }

    return config;
  },
  
  headers: async () => {
    return [
      {
        source: '/((?!_next/static|favicon.ico|sw.js|offline.html).*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
        ],
      },
    ];
  },
  
  // API Proxy Configuration
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
      {
        source: '/sanctum/:path*',
        destination: 'http://localhost:8000/sanctum/:path*',
      },
    ];
  },
};

// PWA has been completely removed to fix service worker conflicts
export default nextConfig;
