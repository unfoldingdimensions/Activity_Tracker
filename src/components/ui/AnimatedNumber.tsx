import { useRef, useEffect } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

interface AnimatedNumberProps {
    value: number;
    className?: string;
    duration?: number;
    delay?: number;
}

export function AnimatedNumber({ value, className, duration = 1, delay = 0.5 }: AnimatedNumberProps) {
    const ref = useRef<HTMLSpanElement>(null);
    const motionValue = useMotionValue(0);
    const springValue = useSpring(motionValue, {
        duration: duration * 1000,
        bounce: 0,
    });
    const isInView = useInView(ref, { once: true, margin: "-10px" });

    useEffect(() => {
        if (isInView) {
            // Add slight delay before starting
            const timer = setTimeout(() => {
                motionValue.set(value);
            }, delay * 1000);
            return () => clearTimeout(timer);
        }
    }, [isInView, value, motionValue, delay]);

    useEffect(() => {
        const unsubscribe = springValue.on("change", (latest) => {
            if (ref.current) {
                ref.current.textContent = Math.round(latest).toLocaleString();
            }
        });
        return () => unsubscribe();
    }, [springValue]);

    return <span ref={ref} className={className}>{0}</span>;
}
