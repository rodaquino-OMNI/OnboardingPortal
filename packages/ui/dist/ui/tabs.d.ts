import * as React from 'react';
interface TabsProps {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
    className?: string;
}
export declare function Tabs({ value: controlledValue, defaultValue, onValueChange, children, className, }: TabsProps): import("react/jsx-runtime").JSX.Element;
interface TabsListProps {
    children: React.ReactNode;
    className?: string;
}
export declare function TabsList({ children, className }: TabsListProps): import("react/jsx-runtime").JSX.Element;
interface TabsTriggerProps {
    value: string;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
}
export declare function TabsTrigger({ value: triggerValue, children, className, disabled, }: TabsTriggerProps): import("react/jsx-runtime").JSX.Element;
interface TabsContentProps {
    value: string;
    children: React.ReactNode;
    className?: string;
}
export declare function TabsContent({ value: contentValue, children, className, }: TabsContentProps): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=tabs.d.ts.map