import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';

interface LoadingScreenProps {
    status?: string;
    progress?: number;
    isLoading: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
    status = "Loading",
    progress,
    isLoading
}) => {
    return (
        <AnimatePresence>
            {isLoading && (
                <motion.div
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }}
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
                    style={{ backgroundColor: 'var(--background)' }}
                >
                    {/* Logo & Content - EXACT same styling as HTML splash */}
                    <div className="relative flex flex-col items-center">
                        {/* Logo: 80x80px, rounded-[1.75rem], mb-6 (24px) */}
                        <div
                            className="flex items-center justify-center"
                            style={{
                                width: '80px',
                                height: '80px',
                                backgroundColor: 'var(--foreground)',
                                borderRadius: '1.75rem',
                                marginBottom: '1.5rem',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                            }}
                        >
                            <Activity
                                size={40}
                                strokeWidth={2.5}
                                style={{ color: 'var(--background)' }}
                            />
                        </div>

                        {/* Title: 1.5rem, font-weight 900, tracking -0.025em */}
                        <h1
                            style={{
                                color: 'var(--foreground)',
                                fontSize: '1.5rem',
                                fontWeight: 900,
                                letterSpacing: '-0.025em',
                                marginBottom: '0.5rem',
                                fontFamily: 'system-ui, -apple-system, sans-serif'
                            }}
                        >
                            ACTIVITY TRACKER
                        </h1>

                        {/* Loading Animation - only difference from HTML splash */}
                        <div className="flex flex-col items-center" style={{ marginTop: '0.5rem' }}>
                            <span
                                style={{
                                    color: 'var(--muted-foreground)',
                                    fontSize: '10px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.2em',
                                    fontWeight: 900,
                                    marginBottom: '1rem'
                                }}
                            >
                                {status}
                            </span>

                            {progress !== undefined ? (
                                <div
                                    style={{
                                        width: '12rem',
                                        height: '4px',
                                        backgroundColor: 'var(--muted)',
                                        borderRadius: '9999px',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <motion.div
                                        style={{
                                            height: '100%',
                                            backgroundColor: 'var(--primary)',
                                            borderRadius: '9999px'
                                        }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        transition={{ duration: 0.3, ease: 'easeOut' }}
                                    />
                                </div>
                            ) : (
                                <div className="flex gap-1.5">
                                    {[0, 1, 2].map((i) => (
                                        <motion.div
                                            key={i}
                                            animate={{
                                                scale: [1, 1.5, 1],
                                                opacity: [0.3, 1, 0.3]
                                            }}
                                            transition={{
                                                duration: 1,
                                                repeat: Infinity,
                                                delay: i * 0.2
                                            }}
                                            style={{
                                                width: '6px',
                                                height: '6px',
                                                borderRadius: '50%',
                                                backgroundColor: 'var(--foreground)'
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
