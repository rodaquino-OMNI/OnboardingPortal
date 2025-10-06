interface TouchFriendlySliderProps {
    min: number;
    max: number;
    step?: number;
    value: number;
    onChange: (value: number) => void;
    label?: string;
    disabled?: boolean;
    className?: string;
    showLabels?: boolean;
    showValue?: boolean;
    hapticFeedback?: boolean;
    size?: 'small' | 'medium' | 'large';
    orientation?: 'horizontal' | 'vertical';
}
export declare function TouchFriendlySlider({ min, max, step, value, onChange, label, disabled, className, showLabels, showValue, hapticFeedback, size, orientation }: TouchFriendlySliderProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=TouchFriendlySlider.d.ts.map