import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SkipLinks } from '@/components/ui/SkipLinks';
import { ClearDemoData } from '@/components/ClearDemoData';
import { ServiceWorkerCleanup } from '@/components/ServiceWorkerCleanup';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Providers } from './providers';
import { ServiceWorkerProvider } from '@/components/ServiceWorkerProvider';

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Omni Portal - Employee Onboarding",
  description: "Your onboarding journey starts here - Complete your employee onboarding process with ease",
  manifest: "/manifest.json",
  themeColor: "#667eea",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head />
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
