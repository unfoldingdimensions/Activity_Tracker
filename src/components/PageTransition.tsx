import type { ReactNode } from 'react';

interface PageTransitionProps {
    children: ReactNode;
    className?: string;
}

export function PageTransition({ children, className = '' }: PageTransitionProps) {
    return (
        <div className={`animate-fade-in-up ${className}`}>
            {children}
        </div>
    );
}

interface StaggerContainerProps {
    children: ReactNode;
    className?: string;
}

export function StaggerContainer({ children, className = '' }: StaggerContainerProps) {
    return (
        <div className={`stagger-children ${className}`}>
            {children}
        </div>
    );
}
