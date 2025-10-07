import React from 'react';
import { DocumentsContainer } from '@/containers/DocumentsContainer';
import { MainLayout } from '@/components/layouts/MainLayout';

export default function DocumentsPage() {
  return (
    <MainLayout title="Upload Documents">
      <DocumentsContainer />
    </MainLayout>
  );
}
