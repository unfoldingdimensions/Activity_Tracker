
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatCard } from '../StatCard';
import { Activity } from 'lucide-react';

// Mock AnimatedNumber to avoid animation issues
vi.mock('../../ui/AnimatedNumber', () => ({
    AnimatedNumber: ({ value }: { value: number }) => <span data-testid="animated-number">{value}</span>,
}));

// Mock Skeleton
vi.mock('../../ui/Skeleton', () => ({
    Skeleton: () => <div data-testid="skeleton" />,
}));

describe('StatCard', () => {
    const defaultProps = {
        label: 'Test Label',
        value: '100',
        numericValue: 100,
        icon: Activity,
    };

    it('renders label and value', () => {
        render(<StatCard {...defaultProps} />);
        expect(screen.getByText('Test Label')).toBeInTheDocument();
        expect(screen.getByTestId('animated-number')).toHaveTextContent('100');
    });

    it('renders string value when useStringValue is true', () => {
        render(<StatCard {...defaultProps} useStringValue={true} value="2h 30m" />);
        expect(screen.getByText('2h 30m')).toBeInTheDocument();
        expect(screen.queryByTestId('animated-number')).not.toBeInTheDocument();
    });

    it('renders subtitle when provided', () => {
        render(<StatCard {...defaultProps} subtitle="+10% from yesterday" />);
        expect(screen.getByText('+10% from yesterday')).toBeInTheDocument();
    });

    it('renders loading state', () => {
        render(<StatCard {...defaultProps} isLoading={true} />);
        expect(screen.getByTestId('skeleton')).toBeInTheDocument();
        expect(screen.queryByTestId('animated-number')).not.toBeInTheDocument();
    });

    it('calls onClick when clickable and clicked', async () => {
        const handleClick = vi.fn();
        const user = userEvent.setup();

        render(<StatCard {...defaultProps} clickable={true} onClick={handleClick} />);

        // Find the card (GlassCard passes props to div)
        // We can find by text and get parent, or just click the text
        await user.click(screen.getByText('Test Label'));

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('displays suffix', () => {
        render(<StatCard {...defaultProps} suffix="%" />);
        expect(screen.getByText('%')).toBeInTheDocument();
    });
});
