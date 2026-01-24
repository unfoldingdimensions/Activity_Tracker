import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary: `
    bg-[var(--primary)] text-[var(--primary-foreground)]
    hover:opacity-90
    shadow-[var(--shadow-base)]
    hover:shadow-[var(--shadow-md)]
  `,
    secondary: `
    bg-[var(--secondary)] text-[var(--secondary-foreground)]
    hover:bg-[var(--muted)]
    border border-[var(--border)]
  `,
    ghost: `
    bg-transparent text-[var(--foreground)]
    hover:bg-[var(--secondary)]
  `,
    destructive: `
    bg-[var(--destructive)] text-[var(--destructive-foreground)]
    hover:opacity-90
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-sm rounded-md',
    md: 'px-4 py-2 text-sm rounded-lg',
    lg: 'px-6 py-3 text-base rounded-lg',
};

export function Button({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    className = '',
    ...props
}: ButtonProps) {
    return (
        <button
            disabled={disabled || loading}
            className={`
        inline-flex items-center justify-center gap-2
        font-medium
        transition-all duration-[var(--duration-fast)]
        btn-press
        focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2
        disabled:opacity-50 disabled:pointer-events-none
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
            {...props}
        >
            {loading && (
                <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            )}
            {children}
        </button>
    );
}
