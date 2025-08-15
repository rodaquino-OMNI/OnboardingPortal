/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone', // Required for Docker deployment
  images: {
    domains: ['localhost', 'api.omni-portal.com'],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  experimental: {
    serverComponentsExternalPackages: ['mysql2', 'tesseract.js'],
    esmExternals: true, // Force ESM externals to fix exports error
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Optimize font loading
  optimizeFonts: true,
  eslint: {
    // Re-enabled ESLint checking after fixing critical errors
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Re-enabled TypeScript checking after fixing runtime issues
    ignoreBuildErrors: false,
  },
  // Production optimizations
  poweredByHeader: false,
  compress: true,
  generateEtags: true,
  
  // Bundle analyzer and webpack optimizations
  webpack: (config, { isServer, webpack }) => {
    // Fix webpack module resolution
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
    };

    // Configure Tesseract.js assets to be served properly
    config.module.rules.push({
      test: /\.(wasm|traineddata)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/tesseract/[name][ext]'
      }
    });

    // Bundle optimization - Simplified for Next.js 14 compatibility
    // Removed custom splitChunks to prevent vendor.js issues
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
            commons: {
              test: /[\\/]node_modules[\\/]/,
              name: 'commons',
              priority: -10,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }

    // Tree shaking optimization for production - Fixed for Next.js 14
    // Removed usedExports to prevent webpack conflict with cacheUnaffected
    if (!isServer && process.env.NODE_ENV === 'production') {
      config.optimization.sideEffects = false;
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
