'use client';

import Link from 'next/link';
import { Video, MessageCircle, Upload, ExternalLink, TestTube } from 'lucide-react';

const components = [
  {
    id: 'video-conferencing',
    name: 'VideoConferencing',
    description: 'HIPAA-compliant video conferencing with recording and screen sharing',
    icon: Video,
    href: '/ui/video-conferencing',
    status: 'ready',
    features: ['End-to-end encryption', 'Screen sharing', 'Recording', 'HIPAA compliant']
  },
  {
    id: 'video-chat',
    name: 'VideoChat',
    description: 'Secure chat component for video sessions',
    icon: MessageCircle,
    href: '/ui/video-chat',
    status: 'ready',
    features: ['E2E encrypted messaging', 'Typing indicators', 'Emergency alerts', 'Role-based UI']
  },
  {
    id: 'document-upload',
    name: 'EnhancedDocumentUpload',
    description: 'Secure document upload with OCR processing',
    icon: Upload,
    href: '/ui/document-upload',
    status: 'ready',
    features: ['Drag & drop', 'Mobile camera capture', 'File validation', 'Preview generation']
  }
];

const statusColors = {
  ready: 'bg-green-100 text-green-800',
  development: 'bg-yellow-100 text-yellow-800',
  testing: 'bg-blue-100 text-blue-800'
};

export default function SandboxHome() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <TestTube className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          UI Component Sandbox
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Interactive testing environment for UI components from @onboarding-portal/ui package.
          Each component is tested for accessibility compliance using axe-core.
        </p>
      </div>

      {/* Component Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {components.map((component) => {
          const Icon = component.icon;
          return (
            <Link
              key={component.id}
              href={`/ui/${component.id}`}
              className="group block p-6 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {component.name}
                    </h3>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColors[component.status as keyof typeof statusColors]}`}>
                      {component.status}
                    </span>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>

              <p className="text-sm text-gray-600 mb-4">
                {component.description}
              </p>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900">Features:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {component.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Accessibility Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">
          Accessibility Testing
        </h2>
        <p className="text-sm text-blue-800 mb-4">
          All components in this sandbox are automatically tested for accessibility compliance using:
        </p>
        <ul className="text-sm text-blue-800 space-y-1">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
            <strong>axe-core</strong> - Industry standard accessibility testing engine
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
            <strong>Playwright</strong> - End-to-end testing with accessibility checks
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
            <strong>WCAG 2.1 AA</strong> - Compliance with accessibility standards
          </li>
        </ul>
      </div>

      {/* Development Note */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> This sandbox is only available in development environment.
          Components are imported from the <code className="bg-yellow-100 px-1 rounded">@onboarding-portal/ui</code> package
          and tested in isolation to ensure they work correctly when integrated into the main application.
        </p>
      </div>
    </div>
  );
}