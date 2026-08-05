import { useSettings } from './useSettings';

/**
 * Editorial reading mode: a narrative, serif-accented presentation of the
 * same data. Controlled by settings.readingMode + writeSummarySentence.
 */
export function useReadingMode() {
    const { settings } = useSettings();
    return {
        editorial: settings.readingMode === 'editorial',
        writeSummarySentence: settings.writeSummarySentence,
    };
}
