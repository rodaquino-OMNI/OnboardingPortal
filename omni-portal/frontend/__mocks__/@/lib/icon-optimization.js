// Mock for @/lib/icon-optimization.tsx
const React = require('react');

// Create a mock component for any icon
const MockIcon = ({ className, size, ...props }) => (
  React.createElement('svg', {
    className,
    width: size || 24,
    height: size || 24,
    'data-testid': 'mock-icon',
    ...props
  })
);

// Export icons used by the UI components
module.exports = {
  Check: MockIcon,
  ChevronDown: MockIcon,
  ChevronUp: MockIcon,
  ChevronRight: MockIcon,
  ChevronLeft: MockIcon,
  ArrowRight: MockIcon,
  ArrowLeft: MockIcon,
  User: MockIcon,
  Lock: MockIcon,
  Mail: MockIcon,
  Eye: MockIcon,
  EyeOff: MockIcon,
  // Add more as needed
  __esModule: true,
};