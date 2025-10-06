/**
 * Modern UI Components Library
 * Comprehensive collection of components using the modern design system
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

// ===== STAT CARD =====
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

export function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  iconColor = 'text-blue-600',
  iconBg = 'bg-blue-50',
  trend,
  className 
}: StatCardProps) {
  return (
    <div className={cn("card-modern p-6", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-gray-900 mt-1">{value}</p>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
          {trend && (
            <div className={cn(
              "flex items-center gap-1 mt-2 text-xs font-medium",
              trend.isPositive ? "text-green-600" : "text-red-600"
            )}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("p-3 rounded-lg", iconBg)}>
            <Icon className={cn("w-6 h-6", iconColor)} />
          </div>
        )}
      </div>
    </div>
  );
}

// ===== ACTION CARD =====
interface ActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  onClick?: () => void;
  className?: string;
}

export function ActionCard({
  title,
  description,
  icon: Icon,
  iconColor = 'text-blue-600',
  iconBg = 'bg-blue-50',
  onClick,
  className
}: ActionCardProps) {
  return (
    <div 
      className={cn(
        "card-modern p-6 cursor-pointer transition-all duration-300",
        "hover:shadow-lg hover:translate-y-[-2px]",
        className
      )}
      onClick={onClick}
    >
      <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center mb-4", iconBg)}>
        <Icon className={cn("w-6 h-6", iconColor)} />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

// ===== FEATURE CARD =====
interface FeatureCardProps {
  title: string;
  description: string;
  features: string[];
  icon: LucideIcon;
  badge?: string;
  className?: string;
}

export function FeatureCard({
  title,
  description,
  features,
  icon: Icon,
  badge,
  className
}: FeatureCardProps) {
  return (
    <div className={cn("card-modern p-6 relative overflow-hidden", className)}>
      {badge && (
        <div className="absolute top-4 right-4">
          <span className="px-2 py-1 text-xs font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full">
            {badge}
          </span>
        </div>
      )}
      
      <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-white" />
      </div>
      
      <h3 className="text-xl font-bold tracking-tight text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>
      
      <ul className="space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ===== TIMELINE ITEM =====
interface TimelineItemProps {
  title: string;
  description: string;
  date: string;
  icon?: LucideIcon;
  isActive?: boolean;
  isCompleted?: boolean;
  className?: string;
}

export function TimelineItem({
  title,
  description,
  date,
  icon: Icon,
  isActive = false,
  isCompleted = false,
  className
}: TimelineItemProps) {
  return (
    <div className={cn("relative flex gap-4", className)}>
      {/* Timeline line */}
      <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200" />
      
      {/* Icon */}
      <div className={cn(
        "relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
        isActive && "bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg",
        isCompleted && "bg-green-500",
        !isActive && !isCompleted && "bg-gray-200"
      )}>
        {Icon ? (
          <Icon className={cn("w-6 h-6", (isActive || isCompleted) && "text-white")} />
        ) : (
          <div className={cn(
            "w-3 h-3 rounded-full",
            (isActive || isCompleted) ? "bg-white" : "bg-gray-400"
          )} />
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 pb-8">
        <div className={cn(
          "card-modern p-4",
          isActive && "border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50"
        )}>
          <div className="flex items-start justify-between mb-1">
            <h4 className="font-semibold text-gray-900">{title}</h4>
            <span className="text-xs text-gray-500">{date}</span>
          </div>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </div>
  );
}

// ===== NOTIFICATION CARD =====
interface NotificationCardProps {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  icon?: LucideIcon;
  onClose?: () => void;
  className?: string;
}

export function NotificationCard({
  title,
  message,
  type = 'info',
  icon: Icon,
  onClose,
  className
}: NotificationCardProps) {
  const typeStyles = {
    info: {
      bg: 'bg-gradient-to-r from-blue-50 to-blue-100',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      border: 'border-blue-200'
    },
    success: {
      bg: 'bg-gradient-to-r from-green-50 to-green-100',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      border: 'border-green-200'
    },
    warning: {
      bg: 'bg-gradient-to-r from-yellow-50 to-yellow-100',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      border: 'border-yellow-200'
    },
    error: {
      bg: 'bg-gradient-to-r from-red-50 to-red-100',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      border: 'border-red-200'
    }
  };

  const styles = typeStyles[type];

  return (
    <div className={cn(
      "card-modern p-4 border animate-fade-in",
      styles.bg,
      styles.border,
      className
    )}>
      <div className="flex gap-3">
        {Icon && (
          <div className={cn("p-2 rounded-lg", styles.iconBg)}>
            <Icon className={cn("w-5 h-5", styles.iconColor)} />
          </div>
        )}
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
          <p className="text-sm text-gray-600">{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// ===== EMPTY STATE =====
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

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <div className={cn("card-modern p-12 text-center", className)}>
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-10 h-10 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6 max-w-sm mx-auto">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ===== SECTION HEADER =====
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

export function SectionHeader({
  title,
  description,
  icon: Icon,
  action,
  className
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-6", className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <Icon className="w-5 h-5 text-gray-600" />
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">{title}</h2>
          {description && (
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          )}
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ===== LOADING CARD =====
export function LoadingCard({ className }: { className?: string }) {
  return (
    <div className={cn("card-modern p-6", className)}>
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-3/4" />
        <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
        <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-5/6" />
      </div>
    </div>
  );
}

// ===== INTERACTIVE BUTTON GROUP =====
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

export function ButtonGroup({ options, value, onChange, className }: ButtonGroupProps) {
  return (
    <div className={cn("inline-flex rounded-lg bg-gray-100 p-1", className)}>
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;
        
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
              "flex items-center gap-2",
              isActive ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"
            )}
          >
            {Icon && <Icon className="w-4 h-4" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}