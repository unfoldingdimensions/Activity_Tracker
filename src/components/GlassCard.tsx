import { useRef } from 'react';
import type { ReactNode, MouseEvent, CSSProperties } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    hover?: boolean;
    spotlight?: boolean;
    glass?: boolean;
    style?: CSSProperties;
    onClick?: () => void;
}

export function GlassCard({
    children,
    className = '',
    hover = true,
    spotlight = false,
    glass = false,
    style,
    onClick,
}: CardProps) {
    const cardRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        if (!spotlight || !cardRef.current) return;

        const rect = cardRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        cardRef.current.style.setProperty('--mouse-x', `${x}%`);
        cardRef.current.style.setProperty('--mouse-y', `${y}%`);
    };

    return (
        <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onClick={onClick}
            style={style}
            className={`
        ${glass ? 'card-glass' : 'card'}
        ${hover ? 'card-hover' : ''}
        ${spotlight ? 'card-spotlight' : ''}
        ${className}
      `}
        >
            {children}
        </div>
    );
}

// Convenience export for semantic naming
export { GlassCard as Card };
