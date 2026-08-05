import { useReadingMode } from '../../hooks/useReadingMode';
import { useVisualTheme } from '../../hooks/useVisualTheme';
import { cn } from '../../utils/cn';

interface EditorialIntroProps {
    /** Narrative summary sentence (serif, larger). */
    sentence: string;
    /** Optional supporting line in mono. */
    note?: string;
}

/**
 * Editorial-mode narrative intro: a serif lede under the page header,
 * plus a mono supporting line. Rendered only in editorial reading mode.
 */
export function EditorialIntro({ sentence, note }: EditorialIntroProps) {
    const { editorial, writeSummarySentence } = useReadingMode();
    const theme = useVisualTheme();

    if (!editorial || !writeSummarySentence) return null;

    return (
        <div
            className={cn(
                'border-b border-[var(--border)]',
                theme === 'flat' ? 'px-8 py-6' : 'px-8 py-5'
            )}
        >
            <p
                className="max-w-[760px] font-serif italic leading-[1.45] text-[var(--foreground)]"
                style={{ fontSize: theme === 'flat' ? 22 : 20 }}
            >
                {sentence}
            </p>
            {note && (
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)] mt-3">
                    {note}
                </p>
            )}
        </div>
    );
}
