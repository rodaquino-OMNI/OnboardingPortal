// Mock for lucide-react icons
import React from 'react';

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
export const User = MockIcon;
export const Lock = MockIcon;
export const Mail = MockIcon;
export const Eye = MockIcon;
export const EyeOff = MockIcon;
export const ArrowRight = MockIcon;
export const Loader2 = MockIcon;
export const AlertCircle = MockIcon;
export const CheckCircle = MockIcon;
export const X = MockIcon;
export const Calendar = MockIcon;
export const Clock = MockIcon;
export const FileText = MockIcon;
export const Upload = MockIcon;
export const Settings = MockIcon;
export const LogOut = MockIcon;
export const Shield = MockIcon;
export const Activity = MockIcon;
export const Users = MockIcon;
export const BarChart = MockIcon;
export const Home = MockIcon;
export const ChevronDown = MockIcon;
export const ChevronRight = MockIcon;
export const Menu = MockIcon;
export const Search = MockIcon;
export const Bell = MockIcon;

// Default export for any other icons
export default MockIcon;