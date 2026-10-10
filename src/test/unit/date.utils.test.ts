import { describe, it, expect } from 'vitest';
import { getLocalTodayString, formatLocalDate, parseLocalStartDate, parseLocalEndDate } from '@/utils/date.utils';

describe('date.utils in Asia/Manila (UTC+8)', () => {
    it('formatLocalDate correctly formats date into YYYY-MM-DD in Asia/Manila', () => {
        // 2026-10-09 16:09:00 UTC is 2026-10-10 00:09:00 in Asia/Manila
        const earlyMorningOct10 = new Date('2026-10-09T16:09:00.000Z');
        expect(formatLocalDate(earlyMorningOct10)).toBe('2026-10-10');

        // 2026-10-10 15:59:00 UTC is 2026-10-10 23:59:00 in Asia/Manila
        const lateNightOct10 = new Date('2026-10-10T15:59:00.000Z');
        expect(formatLocalDate(lateNightOct10)).toBe('2026-10-10');

        // 2026-10-10 16:01:00 UTC is 2026-10-11 00:01:00 in Asia/Manila
        const earlyMorningOct11 = new Date('2026-10-10T16:01:00.000Z');
        expect(formatLocalDate(earlyMorningOct11)).toBe('2026-10-11');
    });

    it('parseLocalStartDate parses YYYY-MM-DD into start of day (16:00:00Z prior day)', () => {
        const start = parseLocalStartDate('2026-10-10');
        // Manila midnight is Oct 9 16:00:00.000 UTC
        expect(start.toISOString()).toBe('2026-10-09T16:00:00.000Z');

        // Should include early morning transaction at 12:09 AM
        const transactionTime = new Date('2026-10-09T16:09:00.000Z');
        expect(transactionTime.getTime()).toBeGreaterThanOrEqual(start.getTime());
    });

    it('parseLocalEndDate parses YYYY-MM-DD into end of day (15:59:59.999Z target day)', () => {
        const end = parseLocalEndDate('2026-10-10');
        // Manila end of day is Oct 10 15:59:59.999 UTC
        expect(end.toISOString()).toBe('2026-10-10T15:59:59.999Z');

        // Should include late night transaction at 11:59 PM
        const transactionTime = new Date('2026-10-10T15:59:00.000Z');
        expect(transactionTime.getTime()).toBeLessThanOrEqual(end.getTime());
    });

    it('handles first day of the year properly', () => {
        const start = parseLocalStartDate('2026-01-01');
        expect(start.toISOString()).toBe('2025-12-31T16:00:00.000Z');

        const end = parseLocalEndDate('2026-01-01');
        expect(end.toISOString()).toBe('2026-01-01T15:59:59.999Z');
    });

    it('handles ISO string inputs with T delimiter', () => {
        const start = parseLocalStartDate('2026-10-10T00:00:00.000Z');
        expect(start.toISOString()).toBe('2026-10-09T16:00:00.000Z');

        const end = parseLocalEndDate('2026-10-10T23:59:59.999Z');
        expect(end.toISOString()).toBe('2026-10-10T15:59:59.999Z');
    });

    it('getLocalTodayString returns a valid YYYY-MM-DD string', () => {
        const todayStr = getLocalTodayString();
        expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
