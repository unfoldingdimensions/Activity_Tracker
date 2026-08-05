export function ChartGradients() {
    return (
        <svg style={{ height: 0 }}>
            <defs>
                {/* Teal Gradient (Focus/Active) — token-bound so both themes resolve */}
                <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" style={{ stopColor: 'var(--chart-3)' }} stopOpacity={0.4} />
                    <stop offset="95%" style={{ stopColor: 'var(--chart-3)' }} stopOpacity={0} />
                </linearGradient>

                {/* Amber Gradient (Distraction/Idle) */}
                <linearGradient id="amberGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" style={{ stopColor: 'var(--chart-2)' }} stopOpacity={0.4} />
                    <stop offset="95%" style={{ stopColor: 'var(--chart-2)' }} stopOpacity={0} />
                </linearGradient>

                {/* Violet Gradient (High Impact/CPU) */}
                <linearGradient id="violetGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" style={{ stopColor: 'var(--chart-4)' }} stopOpacity={0.4} />
                    <stop offset="95%" style={{ stopColor: 'var(--chart-4)' }} stopOpacity={0} />
                </linearGradient>

                {/* Rose Gradient (Alert/High Usage) */}
                <linearGradient id="roseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" style={{ stopColor: 'var(--chart-5)' }} stopOpacity={0.4} />
                    <stop offset="95%" style={{ stopColor: 'var(--chart-5)' }} stopOpacity={0} />
                </linearGradient>
                {/* Gray Gradient (Idle) */}
                <linearGradient id="grayGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" style={{ stopColor: 'var(--chart-6)' }} stopOpacity={0.2} />
                    <stop offset="95%" style={{ stopColor: 'var(--chart-6)' }} stopOpacity={0} />
                </linearGradient>
            </defs>
        </svg>
    );
}
