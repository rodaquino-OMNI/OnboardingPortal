import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SkipLinks } from '@/components/ui/SkipLinks';
import { ClearDemoData } from '@/components/ClearDemoData';
import { ServiceWorkerCleanup } from '@/components/ServiceWorkerCleanup';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Omni Portal - Employee Onboarding",
  description: "Your onboarding journey starts here - Complete your employee onboarding process with ease",
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
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ErrorBoundary>
          <ServiceWorkerCleanup />
          <ClearDemoData />
          <SkipLinks />
          <main id="main-content">{children}</main>
        </ErrorBoundary>
      </body>
    </html>
  );
}
