import { OrderService } from './order.service';
import { logger } from '@/utils/logger';

const DEFAULT_CRON_INTERVAL_MS = 60 * 60 * 1000; // Run every hour

export async function runAutoCompleteDispatchedOrdersJob(now: Date = new Date()) {
    const orderService = new OrderService();
    try {
        const result = await orderService.autoCompleteDispatchedOrders(now);
        if (result.count > 0) {
            logger.info(
                { count: result.count, orderIds: result.orderIds },
                `Cron: Automatically completed ${result.count} dispatched delivery order(s) older than 2 days.`
            );
        }
        return result;
    } catch (error) {
        logger.error({ err: error }, 'Cron: Failed to auto-complete stale dispatched delivery orders.');
        throw error;
    }
}

export function startOrderAutoCompleteCron(intervalMs: number = DEFAULT_CRON_INTERVAL_MS): NodeJS.Timeout {
    // Run initial check shortly after startup
    void runAutoCompleteDispatchedOrdersJob().catch(() => {
        // Error already logged in runAutoCompleteDispatchedOrdersJob
    });

    const timer = setInterval(() => {
        void runAutoCompleteDispatchedOrdersJob().catch(() => {
            // Error already logged in runAutoCompleteDispatchedOrdersJob
        });
    }, intervalMs);

    if (typeof timer.unref === 'function') {
        timer.unref();
    }

    return timer;
}
