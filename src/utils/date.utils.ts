const MANILA_TZ = 'Asia/Manila';

/**
 * Returns a string formatted as YYYY-MM-DD in Asia/Manila time.
 */
export function getLocalTodayString(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: MANILA_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(new Date());
}

/**
 * Formats any Date into YYYY-MM-DD using Asia/Manila time.
 */
export function formatLocalDate(date: Date): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: MANILA_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(date);
}

/**
 * Parses a YYYY-MM-DD string into a start-of-day Date (00:00:00.000) in Asia/Manila (UTC+8),
 * which corresponds to 16:00:00.000 UTC of the prior calendar day.
 */
export function parseLocalStartDate(dateStr?: string): Date {
    const rawStr = dateStr?.trim() || getLocalTodayString();
    const targetStr = rawStr.split('T')[0];
    const parts = targetStr.split('-');
    if (parts.length === 3) {
        const [year, month, day] = parts.map(Number);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            // Manila is UTC+8. Local 00:00:00 is (day - 1) at 16:00:00 UTC.
            return new Date(Date.UTC(year, month - 1, day - 1, 16, 0, 0, 0));
        }
    }
    const fallback = new Date(rawStr);
    fallback.setHours(0, 0, 0, 0);
    return fallback;
}

/**
 * Parses a YYYY-MM-DD string into an end-of-day Date (23:59:59.999) in Asia/Manila (UTC+8),
 * which corresponds to 15:59:59.999 UTC of the target calendar day.
 */
export function parseLocalEndDate(dateStr?: string): Date {
    const rawStr = dateStr?.trim() || getLocalTodayString();
    const targetStr = rawStr.split('T')[0];
    const parts = targetStr.split('-');
    if (parts.length === 3) {
        const [year, month, day] = parts.map(Number);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            // Manila is UTC+8. Local 23:59:59.999 is day at 15:59:59.999 UTC.
            return new Date(Date.UTC(year, month - 1, day, 15, 59, 59, 999));
        }
    }
    const fallback = new Date(rawStr);
    fallback.setHours(23, 59, 59, 999);
    return fallback;
}
