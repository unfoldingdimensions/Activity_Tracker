
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface BreathingWidgetProps {
    isOpen: boolean;
    onClose: () => void;
}

export const BreathingWidget: React.FC<BreathingWidgetProps> = ({ isOpen, onClose }) => {
    const [phase, setPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');

    const isActiveRef = useRef(isOpen);
    isActiveRef.current = isOpen;

    useEffect(() => {
        if (!isOpen) return;

        const cycle = async () => {
            while (isActiveRef.current) {
                setPhase('Inhale');
                await new Promise(r => setTimeout(r, 4000));
                if (!isActiveRef.current) break;

                setPhase('Hold');
                await new Promise(r => setTimeout(r, 4000));
                if (!isActiveRef.current) break;

                setPhase('Exhale');
                await new Promise(r => setTimeout(r, 4000));
                if (!isActiveRef.current) break;
            }
        };

        cycle();
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                >
                    <div className="relative flex flex-col items-center">
                        <button
                            onClick={onClose}
                            className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white"
                        >
                            <X size={24} />
                        </button>

                        <motion.div
                            className="w-64 h-64 rounded-full bg-emerald-500/20 blur-xl absolute"
                            animate={{
                                scale: phase === 'Inhale' ? 1.5 : phase === 'Exhale' ? 0.8 : 1.2,
                                opacity: phase === 'Hold' ? 0.8 : 0.5,
                            }}
                            transition={{ duration: 4, ease: "easeInOut" }}
                        />

                        <motion.div
                            className="w-48 h-48 rounded-full border-4 border-emerald-400 flex items-center justify-center relative z-10 bg-black/20 backdrop-blur-md"
                            animate={{
                                scale: phase === 'Inhale' ? 1.2 : phase === 'Exhale' ? 0.9 : 1.1,
                            }}
                            transition={{ duration: 4, ease: "easeInOut" }}
                        >
                            <motion.span
                                key={phase}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-2xl font-light text-white tracking-widest"
                            >
                                {phase}
                            </motion.span>
                        </motion.div>

                        <p className="mt-8 text-white/60 text-sm">Focus on your breath</p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
