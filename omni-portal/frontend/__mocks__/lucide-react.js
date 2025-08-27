// Mock for lucide-react icons
const React = require('react');

// Create a mock component for any lucide icon
const MockIcon = ({ className, size, ...props }) => (
  React.createElement('svg', {
    className,
    width: size || 24,
    height: size || 24,
    'data-testid': 'mock-icon',
    ...props
  })
);

// Export common icons used in the app
module.exports = {
  User: MockIcon,
  Lock: MockIcon,
  Mail: MockIcon,
  Eye: MockIcon,
  EyeOff: MockIcon,
  ArrowRight: MockIcon,
  Loader2: MockIcon,
  AlertCircle: MockIcon,
  CheckCircle: MockIcon,
  X: MockIcon,
  Calendar: MockIcon,
  Clock: MockIcon,
  FileText: MockIcon,
  Upload: MockIcon,
  Settings: MockIcon,
  LogOut: MockIcon,
  Shield: MockIcon,
  Activity: MockIcon,
  Users: MockIcon,
  BarChart: MockIcon,
  Home: MockIcon,
  ChevronDown: MockIcon,
  ChevronUp: MockIcon,
  ChevronRight: MockIcon,
  ChevronLeft: MockIcon,
  Check: MockIcon,
  Menu: MockIcon,
  Search: MockIcon,
  Bell: MockIcon,
  // Missing icons from TouchFriendlySlider
  Minus: MockIcon,
  Plus: MockIcon,
  // Add more icons as needed
  default: MockIcon,
  __esModule: true,
};