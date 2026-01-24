export function ChartGradients() {
    return (
        <svg style={{ height: 0 }}>
            <defs>
                {/* Emerald Gradient (Focus/Active) */}
                <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                </linearGradient>

                {/* Amber Gradient (Distraction/Idle) */}
                <linearGradient id="amberGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a16207" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#a16207" stopOpacity={0} />
                </linearGradient>

                {/* Violet Gradient (High Impact/CPU) */}
                <linearGradient id="violetGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>

                {/* Rose Gradient (Alert/High Usage) */}
                <linearGradient id="roseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#be185d" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#be185d" stopOpacity={0} />
                </linearGradient>
            </defs>
        </svg>
    );
}
