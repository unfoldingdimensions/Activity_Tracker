import { useReadingMode } from '../../hooks/useReadingMode';
import { useVisualTheme } from '../../hooks/useVisualTheme';
import type { EditorialInsight } from '../../utils/editorialInsights';
import { cn } from '../../utils/cn';

interface EditorialIntroProps {
    /** Narrative summary sentence (serif, larger). */
    sentence: string;
    /** Optional supporting line in mono. */
    note?: string;
    /** Up to three data-backed findings, rendered as hairline-separated rows. */
    insights?: EditorialInsight[];
}

/**
 * Editorial-mode narrative intro: a serif lede under the page header,
 * plus a mono supporting line and up to three insight rows. Rendered
 * only in editorial reading mode.
 */
export function EditorialIntro({ sentence, note, insights = [] }: EditorialIntroProps) {
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
            {insights.length > 0 && (
                <ul className="mt-4 border-t border-[var(--border)]">
                    {insights.map((ins) => (
                        <li
                            key={ins.label}
                            className="flex items-baseline gap-4 py-2 border-b border-[var(--border)] last:border-b-0"
                        >
                            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)] w-28 shrink-0">
                                {ins.label}
                            </span>
                            <span className="text-[13px] leading-snug text-[var(--foreground)]">
                                {ins.text}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
