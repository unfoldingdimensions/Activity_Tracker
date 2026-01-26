import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const targetRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
        setIsVisible(true);
        if (targetRef.current) {
            const rect = targetRef.current.getBoundingClientRect();
            setPosition({
                x: rect.left + rect.width / 2,
                y: rect.top - 8
            });
        }
    };

    return (
        <div
            ref={targetRef}
            className="relative flex items-center justify-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div className="fixed z-[100] pointer-events-none transform -translate-x-1/2 -translate-y-full"
                    style={{ left: position.x, top: position.y }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-[var(--card)] border border-[var(--border)] px-3 py-2 rounded-lg shadow-xl backdrop-blur-md"
                    >
                        <div className="text-xs font-medium text-[var(--foreground)] whitespace-pre-line text-center">
                            {content}
                        </div>
                        {/* Arrow */}
                        <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-[var(--card)] border-r border-b border-[var(--border)] rotate-45" />
                    </motion.div>
                </div>
            )}
        </div>
    );
};
