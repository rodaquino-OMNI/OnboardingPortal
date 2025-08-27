'use client';

import React from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // CRITICAL FIX: Remove all loading logic from layout
  // The landing page should ALWAYS render, regardless of auth state
  // Let the page components handle their own loading states
  
  return <>{children}</>;
}