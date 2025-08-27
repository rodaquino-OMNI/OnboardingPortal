import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SkipLinks } from '@/components/ui/SkipLinks';
import { ClearDemoData } from '@/components/ClearDemoData';
import { ServiceWorkerCleanup } from '@/components/ServiceWorkerCleanup';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Providers } from './providers';
import { ServiceWorkerProvider } from '@/components/ServiceWorkerProvider';
import { initializeChunkRecovery } from '@/lib/chunk-error-recovery';

// Configure Inter font
const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "Omni Portal - Employee Onboarding",
  description: "Your onboarding journey starts here - Complete your employee onboarding process with ease",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Omni Portal",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#667eea",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Initialize chunk error recovery
  if (typeof window !== 'undefined') {
    initializeChunkRecovery();
  }

  return (
    <html lang="en" className={inter.className}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Initialize chunk recovery before any other scripts
                if (typeof window !== 'undefined') {
                  window.__CHUNK_RECOVERY_INITIALIZED__ = true;
                  
                  // Early chunk error detection
                  window.addEventListener('error', function(e) {
                    if (e.message && (e.message.includes('Loading chunk') || e.message.includes('ChunkLoadError'))) {
                      console.warn('[ChunkRecovery] Early chunk error detected, preparing recovery...');
                      sessionStorage.setItem('chunk_error_detected', Date.now().toString());
                    }
                  }, true);
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning={true}>
        <ErrorBoundary>
          <Providers>
            <ServiceWorkerProvider>
              <ServiceWorkerCleanup />
              <ClearDemoData />
              <SkipLinks />
              <main id="main-content">{children}</main>
            </ServiceWorkerProvider>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
