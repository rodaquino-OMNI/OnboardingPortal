'use client';
import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
export function TouchFriendlySlider({ min, max, step = 1, value, onChange, label, disabled = false, className, showLabels = true, showValue = true, hapticFeedback = true, size = 'large', orientation = 'horizontal' }) {
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartValue, setDragStartValue] = useState(value);
    const sliderRef = useRef(null);
    const thumbRef = useRef(null);
    // Size configurations for optimal touch targets
    const sizeConfig = {
        small: {
            thumb: 'w-8 h-8',
            track: orientation === 'horizontal' ? 'h-2' : 'w-2',
            container: orientation === 'horizontal' ? 'h-12' : 'w-12',
            minTouchArea: 32
        },
        medium: {
            thumb: 'w-10 h-10',
            track: orientation === 'horizontal' ? 'h-3' : 'w-3',
            container: orientation === 'horizontal' ? 'h-14' : 'w-14',
            minTouchArea: 40
        },
        large: {
            thumb: 'w-12 h-12',
            track: orientation === 'horizontal' ? 'h-4' : 'w-4',
            container: orientation === 'horizontal' ? 'h-16' : 'w-16',
            minTouchArea: 48
        }
    };
    const config = sizeConfig[size];
    // Haptic feedback function
    const triggerHaptic = (pattern = 'light') => {
        if (!hapticFeedback || !('vibrate' in navigator))
            return;
        const patterns = {
            light: 10,
            medium: 20,
            heavy: 30
        };
        navigator.vibrate(patterns[pattern]);
    };
    // Calculate position from value
    const getPositionFromValue = (currentValue) => {
        const percentage = ((currentValue - min) / (max - min)) * 100;
        return Math.max(0, Math.min(100, percentage));
    };
    // Calculate value from position
    const getValueFromPosition = (position) => {
        const percentage = position / 100;
        const rawValue = min + percentage * (max - min);
        return Math.round(rawValue / step) * step;
    };
    // Handle touch start
    const handleTouchStart = (e) => {
        if (disabled)
            return;
        e.preventDefault();
        setIsDragging(true);
        setDragStartValue(value);
        triggerHaptic('light');
        // Focus management for accessibility
        if (thumbRef.current) {
            thumbRef.current.focus();
        }
    };
    // Handle touch move
    const handleTouchMove = (e) => {
        if (!isDragging || disabled || !sliderRef.current)
            return;
        e.preventDefault();
        const touch = e.touches[0];
        const rect = sliderRef.current.getBoundingClientRect();
        let position;
        if (orientation === 'horizontal') {
            position = ((touch.clientX - rect.left) / rect.width) * 100;
        }
        else {
            position = ((rect.bottom - touch.clientY) / rect.height) * 100;
        }
        position = Math.max(0, Math.min(100, position));
        const newValue = getValueFromPosition(position);
        if (newValue !== value) {
            onChange(newValue);
            triggerHaptic('light');
        }
    };
    // Handle touch end
    const handleTouchEnd = () => {
        if (!isDragging)
            return;
        setIsDragging(false);
        triggerHaptic('medium');
        // Announce value change for screen readers
        if (value !== dragStartValue) {
            const announcement = `${label ? label + ' ' : ''}value changed to ${value}`;
            announceToScreenReader(announcement);
        }
    };
    // Handle click/tap on track
    const handleTrackClick = (e) => {
        if (disabled || !sliderRef.current)
            return;
        e.preventDefault();
        const rect = sliderRef.current.getBoundingClientRect();
        let position;
        if ('touches' in e) {
            const touch = e.touches[0] || e.changedTouches[0];
            if (orientation === 'horizontal') {
                position = ((touch.clientX - rect.left) / rect.width) * 100;
            }
            else {
                position = ((rect.bottom - touch.clientY) / rect.height) * 100;
            }
        }
        else {
            if (orientation === 'horizontal') {
                position = ((e.clientX - rect.left) / rect.width) * 100;
            }
            else {
                position = ((rect.bottom - e.clientY) / rect.height) * 100;
            }
        }
        position = Math.max(0, Math.min(100, position));
        const newValue = getValueFromPosition(position);
        onChange(newValue);
        triggerHaptic('medium');
    };
    // Keyboard handling
    const handleKeyDown = (e) => {
        if (disabled)
            return;
        let newValue = value;
        const largeStep = step * 10;
        switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowDown':
                newValue = Math.max(min, value - step);
                break;
            case 'ArrowRight':
            case 'ArrowUp':
                newValue = Math.min(max, value + step);
                break;
            case 'PageDown':
                newValue = Math.max(min, value - largeStep);
                break;
            case 'PageUp':
                newValue = Math.min(max, value + largeStep);
                break;
            case 'Home':
                newValue = min;
                break;
            case 'End':
                newValue = max;
                break;
            default:
                return;
        }
        e.preventDefault();
        onChange(newValue);
        triggerHaptic('light');
    };
    // Screen reader announcements
    const announceToScreenReader = (message) => {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        document.body.appendChild(announcement);
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    };
    const position = getPositionFromValue(value);
    return (_jsxs("div", { className: cn('relative w-full', orientation === 'vertical' && 'h-64', className), role: "group", "aria-labelledby": label ? 'slider-label' : undefined, children: [label && (_jsxs("label", { id: "slider-label", className: "block text-sm font-medium text-gray-700 mb-2", children: [label, showValue && (_jsxs("span", { className: "ml-2 text-gray-500", children: ["(", value, ")"] }))] })), _jsx("div", { className: cn('relative flex items-center justify-center', config.container, orientation === 'vertical' && 'flex-col h-full w-16'), children: _jsxs("div", { ref: sliderRef, className: cn('relative bg-gray-200 rounded-full cursor-pointer transition-colors', config.track, orientation === 'horizontal' ? 'flex-1' : 'flex-1', disabled && 'opacity-50 cursor-not-allowed', 'focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2'), onClick: handleTrackClick, onTouchStart: handleTrackClick, children: [_jsx("div", { className: cn('absolute bg-blue-500 rounded-full transition-all duration-150', orientation === 'horizontal'
                                ? `${config.track} left-0 top-0`
                                : `${config.track} bottom-0 left-0`), style: {
                                [orientation === 'horizontal' ? 'width' : 'height']: `${position}%`
                            } }), _jsx("div", { ref: thumbRef, className: cn('absolute bg-white border-2 border-blue-500 rounded-full shadow-lg cursor-grab', 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2', 'transition-all duration-150 hover:scale-110 active:scale-95', config.thumb, isDragging && 'cursor-grabbing scale-110 ring-2 ring-blue-500', disabled && 'opacity-50 cursor-not-allowed'), style: {
                                [orientation === 'horizontal' ? 'left' : 'bottom']: `${position}%`,
                                transform: orientation === 'horizontal'
                                    ? 'translateX(-50%) translateY(-50%)'
                                    : 'translateX(-50%) translateY(50%)',
                                [orientation === 'horizontal' ? 'top' : 'left']: '50%'
                            }, tabIndex: disabled ? -1 : 0, role: "slider", "aria-valuenow": value, "aria-valuemin": min, "aria-valuemax": max, "aria-orientation": orientation, "aria-label": label || 'Slider', onTouchStart: handleTouchStart, onTouchMove: handleTouchMove, onTouchEnd: handleTouchEnd, onKeyDown: handleKeyDown, "data-testid": "slider-thumb" })] }) }), showLabels && (_jsxs("div", { className: cn('flex justify-between text-xs text-gray-500 mt-1', orientation === 'vertical' && 'flex-col h-full justify-between mt-0 ml-2'), children: [_jsx("span", { children: min }), _jsx("span", { children: max })] })), process.env.NODE_ENV === 'development' && (_jsx("div", { className: "absolute inset-0 pointer-events-none opacity-20", children: _jsx("div", { className: "absolute border border-red-500", style: {
                        width: config.minTouchArea,
                        height: config.minTouchArea,
                        left: `${position}%`,
                        top: '50%',
                        transform: 'translateX(-50%) translateY(-50%)'
                    } }) }))] }));
}
