import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const targetRef = useRef<HTMLDivElement>(null);

    const updatePosition = () => {
        if (targetRef.current) {
            const rect = targetRef.current.getBoundingClientRect();
            setCoords({
                x: rect.left + rect.width / 2,
                y: rect.top - 8
            });
        }
    };

    const handleMouseEnter = () => {
        updatePosition();
        setIsVisible(true);
    };

    return (
        <>
            <div
                ref={targetRef}
                className="w-full h-full cursor-help"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setIsVisible(false)}
            >
                {children}
            </div>
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {isVisible && (
                        <div
                            className="fixed z-[9999] pointer-events-none"
                            style={{
                                left: coords.x,
                                top: coords.y,
                                transform: 'translate(-50%, -100%)'
                            }}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                className="bg-[var(--card)] border border-[var(--border)] px-3 py-2 rounded-xl shadow-[var(--shadow-xl)] backdrop-blur-xl ring-1 ring-white/20"
                            >
                                <div className="text-[11px] font-bold text-[var(--foreground)] whitespace-pre-line text-center leading-relaxed">
                                    {content}
                                </div>
                                <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-[var(--card)] border-r border-b border-[var(--border)] rotate-45" />
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};

