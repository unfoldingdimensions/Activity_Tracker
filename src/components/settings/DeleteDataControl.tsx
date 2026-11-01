import { useState } from 'react';
import { Button } from '../Button';

interface DeleteDataControlProps {
    /** Runs only after the phrase has been typed. Throwing is the caller's business — the control resets either way. */
    onConfirm: () => void | Promise<void>;
    busy?: boolean;
    /** What the user has to type. Lower-case on purpose: it is a word to reproduce, not a code to memorise. */
    phrase?: string;
    label?: string;
}

/**
 * A destructive action that cannot be reached by one click.
 *
 * The export button used to sit 80 px from "Delete everything" in the same control group, and a synthetic click aimed
 * at the export landed on the delete (L-22, D-047). A confirm() dialog is no safety net when the input is synthetic: it
 * accepts whatever a scripted Enter sends. This asks for the word instead, in the page, where a stray click cannot
 * produce it.
 *
 * The ritual resets after each attempt, so the same slip twice cannot delete twice.
 */
export function DeleteDataControl({
    onConfirm,
    busy = false,
    phrase = 'delete',
    label = 'Delete everything',
}: DeleteDataControlProps) {
    const [armed, setArmed] = useState(false);
    const [typed, setTyped] = useState('');

    const matches = typed.trim().toLowerCase() === phrase;

    const confirm = async () => {
        if (!matches || busy) return;
        await onConfirm();
        setArmed(false);
        setTyped('');
    };

    if (!armed) {
        return (
            <Button variant="destructive" size="sm" onClick={() => setArmed(true)} loading={busy}>
                {busy ? 'Deleting…' : label}
            </Button>
        );
    }

    return (
        <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
                <label className="text-[11.5px] text-[var(--muted-foreground)]" htmlFor="delete-data-phrase">
                    Type <span className="font-semibold text-[var(--foreground)]">{phrase}</span> to confirm
                </label>
                <input
                    id="delete-data-phrase"
                    autoFocus
                    value={typed}
                    disabled={busy}
                    onChange={(event) => setTyped(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') void confirm();
                        if (event.key === 'Escape') {
                            setArmed(false);
                            setTyped('');
                        }
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-32 px-2 py-1 bg-transparent border border-[var(--border)] text-[var(--foreground)] text-[12px] outline-none focus:border-[var(--accent-negative)]"
                />
            </div>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                    setArmed(false);
                    setTyped('');
                }}
                disabled={busy}
            >
                Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={() => void confirm()} disabled={!matches} loading={busy}>
                {busy ? 'Deleting…' : 'Delete all data'}
            </Button>
        </div>
    );
}
