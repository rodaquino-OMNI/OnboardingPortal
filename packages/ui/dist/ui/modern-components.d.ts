/**
 * Modern UI Components Library
 * Comprehensive collection of components using the modern design system
 */
import { LucideIcon } from 'lucide-react';
interface StatCardProps {
    title: string;
    value: string | number;
    description?: string;
    icon?: LucideIcon;
    iconColor?: string;
    iconBg?: string;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    className?: string;
}
export declare function StatCard({ title, value, description, icon: Icon, iconColor, iconBg, trend, className }: StatCardProps): import("react/jsx-runtime").JSX.Element;
interface ActionCardProps {
    title: string;
    description: string;
    icon: LucideIcon;
    iconColor?: string;
    iconBg?: string;
    onClick?: () => void;
    className?: string;
}
export declare function ActionCard({ title, description, icon: Icon, iconColor, iconBg, onClick, className }: ActionCardProps): import("react/jsx-runtime").JSX.Element;
interface FeatureCardProps {
    title: string;
    description: string;
    features: string[];
    icon: LucideIcon;
    badge?: string;
    className?: string;
}
export declare function FeatureCard({ title, description, features, icon: Icon, badge, className }: FeatureCardProps): import("react/jsx-runtime").JSX.Element;
interface TimelineItemProps {
    title: string;
    description: string;
    date: string;
    icon?: LucideIcon;
    isActive?: boolean;
    isCompleted?: boolean;
    className?: string;
}
export declare function TimelineItem({ title, description, date, icon: Icon, isActive, isCompleted, className }: TimelineItemProps): import("react/jsx-runtime").JSX.Element;
interface NotificationCardProps {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    icon?: LucideIcon;
    onClose?: () => void;
    className?: string;
}
export declare function NotificationCard({ title, message, type, icon: Icon, onClose, className }: NotificationCardProps): import("react/jsx-runtime").JSX.Element;
interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}
export declare function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps): import("react/jsx-runtime").JSX.Element;
interface SectionHeaderProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}
export declare function SectionHeader({ title, description, icon: Icon, action, className }: SectionHeaderProps): import("react/jsx-runtime").JSX.Element;
export declare function LoadingCard({ className }: {
    className?: string;
}): import("react/jsx-runtime").JSX.Element;
interface ButtonGroupOption {
    value: string;
    label: string;
    icon?: LucideIcon;
}
interface ButtonGroupProps {
    options: ButtonGroupOption[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
}
export declare function ButtonGroup({ options, value, onChange, className }: ButtonGroupProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=modern-components.d.ts.map