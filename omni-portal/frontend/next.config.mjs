import withPWA from '@ducanh2912/next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // output: 'standalone', // Temporarily disabled for development
  images: {
    domains: ['localhost', 'api.omni-portal.com'],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  experimental: {
    // typedRoutes: true, // Temporarily disabled for build
    // optimizeCss removed - fixing critters/util._extend issue
    serverComponentsExternalPackages: ['mysql2'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  eslint: {
    // Build-time linting is now enabled to catch errors early
    // This ensures code quality standards are met before deployment
    // ignoreDuringBuilds: true, // REMOVED: We want to fix all lint errors
  },
  typescript: {
    // TypeScript type checking is now enforced during builds
    // This prevents runtime errors and ensures type safety
    // ignoreBuildErrors: true, // REMOVED: We want to fix all type errors
  },
  // Production optimizations
  poweredByHeader: false,
  compress: true,
  generateEtags: true,
  
  // Bundle analyzer and webpack optimizations
  webpack: (config, { isServer }) => {
    // Fix webpack module resolution for @hookform packages
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

    // CRITICAL FIX: Optimized chunk splitting for stability
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 1000000, // 1MB - prevents too many small chunks
          cacheGroups: {
            vendor: {
              name(module) {
                // Generate stable chunk names
                const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)?.[1];
                return packageName ? `vendor-${packageName.replace('@', '').replace('/', '-')}` : 'vendor';
              },
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
              reuseExistingChunk: true,
            },
            common: {
              name: 'common',
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true,
            },
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            }
          }
        }
      };
    }

    return config;
  },
  
  headers: async () => {
    return [
      {
        source: '/((?!_next/static|favicon.ico).*)',
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
    ];
  },
  
  // API Proxy Configuration
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

// Only enable PWA in production to prevent development issues
const withPWAConfig = process.env.NODE_ENV === 'production' 
  ? withPWA({
      dest: 'public',
      register: true,
      skipWaiting: true,
      disable: false,
      buildExcludes: [/middleware-manifest\.json$/],
      workboxOptions: {
        runtimeCaching: [
          {
            urlPattern: /^https?.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'https-calls',
              networkTimeoutSeconds: 15,
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    })
  : (config) => config; // In development, just return config without PWA

export default withPWAConfig(nextConfig);
