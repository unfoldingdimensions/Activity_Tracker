import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteDataControl } from '../DeleteDataControl';

// The failure these pin is the one from L-22: a single stray click (or a synthetic one aimed at the neighbouring
// button) must never reach the delete. Everything below is about how many deliberate actions it takes to get there.
describe('DeleteDataControl', () => {
    it('does not delete on the first click — it asks for the phrase', async () => {
        const onConfirm = vi.fn();
        render(<DeleteDataControl onConfirm={onConfirm} />);

        await userEvent.click(screen.getByRole('button', { name: /delete everything/i }));

        expect(onConfirm).not.toHaveBeenCalled();
        expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    });

    it('keeps the final button disabled until the phrase matches exactly', async () => {
        const onConfirm = vi.fn();
        render(<DeleteDataControl onConfirm={onConfirm} />);
        await userEvent.click(screen.getByRole('button', { name: /delete everything/i }));

        const finalButton = screen.getByRole('button', { name: /delete all data/i });
        expect(finalButton).toBeDisabled();

        await userEvent.type(screen.getByLabelText(/type/i), 'delet');
        expect(finalButton).toBeDisabled();

        await userEvent.type(screen.getByLabelText(/type/i), 'e');
        expect(finalButton).toBeEnabled();

        await userEvent.click(finalButton);
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('accepts the phrase case-insensitively and ignores surrounding spaces', async () => {
        const onConfirm = vi.fn();
        render(<DeleteDataControl onConfirm={onConfirm} />);
        await userEvent.click(screen.getByRole('button', { name: /delete everything/i }));

        await userEvent.type(screen.getByLabelText(/type/i), ' DELETE ');
        await userEvent.click(screen.getByRole('button', { name: /delete all data/i }));

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('cancelling returns to the start and never deletes', async () => {
        const onConfirm = vi.fn();
        render(<DeleteDataControl onConfirm={onConfirm} />);
        await userEvent.click(screen.getByRole('button', { name: /delete everything/i }));
        await userEvent.type(screen.getByLabelText(/type/i), 'delete');
        await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

        expect(onConfirm).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: /delete everything/i })).toBeInTheDocument();
    });

    it('disarms itself after a delete, so the same slip twice cannot delete twice', async () => {
        const onConfirm = vi.fn();
        render(<DeleteDataControl onConfirm={onConfirm} />);
        await userEvent.click(screen.getByRole('button', { name: /delete everything/i }));
        await userEvent.type(screen.getByLabelText(/type/i), 'delete');
        await userEvent.click(screen.getByRole('button', { name: /delete all data/i }));

        expect(screen.getByRole('button', { name: /delete everything/i })).toBeInTheDocument();
        expect(screen.queryByLabelText(/type/i)).not.toBeInTheDocument();

        // The armed state is gone, so nothing else can fire the handler.
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('disarms on Escape', async () => {
        const onConfirm = vi.fn();
        render(<DeleteDataControl onConfirm={onConfirm} />);
        await userEvent.click(screen.getByRole('button', { name: /delete everything/i }));

        await userEvent.type(screen.getByLabelText(/type/i), 'delet{escape}');

        expect(screen.getByRole('button', { name: /delete everything/i })).toBeInTheDocument();
        expect(onConfirm).not.toHaveBeenCalled();
    });
});
