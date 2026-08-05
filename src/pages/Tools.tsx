import { PageHeader } from '../components/shared/PageHeader';
import { useVisualTheme } from '../hooks/useVisualTheme';
import { cn } from '../utils/cn';

/**
 * Tools - the four things you DO here, not the things you read.
 * Full implementation lands in the revamp P5; this is the routed shell.
 */
export function Tools() {
    const theme = useVisualTheme();
    const isFlat = theme === 'flat';

    return (
        <div className="flex flex-col min-h-full">
            <PageHeader title="Tools" meta="THE FOUR THINGS YOU DO HERE, NOT THE THINGS YOU READ" />
            <div className={cn(isFlat ? 'px-8 py-6' : 'p-8 pt-6')}>
                <p className="text-sm text-[var(--muted-foreground)]">
                    Pomodoro timer, daily targets, wellbeing and breathing move here in the redesign.
                </p>
            </div>
        </div>
    );
}
