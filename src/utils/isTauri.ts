/**
 * Detect if running in Tauri native environment vs browser
 */
export const isTauri = (): boolean => {
    return '__TAURI_INTERNALS__' in window;
};
