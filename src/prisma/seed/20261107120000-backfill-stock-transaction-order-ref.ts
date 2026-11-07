import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { getOrderReference } from '../../feature/order/order.utils';

const prisma = new PrismaClient();

/**
 * Migration Script: 20261107120000-backfill-stock-transaction-order-ref.ts
 *
 * Safely backfills existing StockTransaction and PreparedItemTransaction records
 * that used the daily repeating queue number (e.g. "Order #001") to instead use
 * the unique Order Reference Number and Order UUID (e.g. "Order 261107-001 (<UUID>)").
 *
 * Features:
 *  - 100% Non-destructive: Modifies ONLY the text inside the `reason` column.
 *  - Dry-Run mode by default: Shows a before/after preview without modifying anything.
 *  - Automatic JSON Backup: Saves the original state of all affected rows before applying.
 *  - Atomic: Uses a Prisma transaction so all updates commit or rollback together.
 */
export async function backfillStockTransactionOrderRef(isDryRun = true) {
    console.log(`\n=== Backfilling Stock Transaction Order References (${isDryRun ? 'DRY RUN' : 'APPLYING UPDATES'}) ===\n`);

    // 1. Find all StockTransactions with reasons referencing "Order #"
    const stockTransactions = await prisma.stockTransaction.findMany({
        where: {
            reason: {
                contains: 'Order #'
            }
        },
        orderBy: { createdAt: 'asc' }
    });

    console.log(`Found ${stockTransactions.length} candidate StockTransaction records.`);

    const updates: Array<{
        id: string;
        oldReason: string;
        newReason: string;
        orderId: string;
        orderRef: string;
    }> = [];

    const skipped: Array<{ id: string; reason: string; cause: string }> = [];

    for (const tx of stockTransactions) {
        if (!tx.reason) continue;

        // Match "Order #123"
        const match = tx.reason.match(/Order\s+(#\d+)/i);
        if (!match) {
            skipped.push({ id: tx.id, reason: tx.reason, cause: 'Could not extract queue number' });
            continue;
        }

        const queueNumber = match[1];
        const txDate = new Date(tx.createdAt);
        let matchedOrder: { id: string; createdAt: Date; queueNumber: string | null } | null = null;

        // Strategy A: If it's a cancellation or un-cancellation, check OrderStatusHistory around txDate
        const isCancelled = /cancelled/i.test(tx.reason);
        if (isCancelled) {
            const statusHistories = await prisma.orderStatusHistory.findMany({
                where: {
                    status: 'CANCELLED',
                    createdAt: {
                        gte: new Date(txDate.getTime() - 10 * 60 * 1000),
                        lte: new Date(txDate.getTime() + 10 * 60 * 1000)
                    },
                    order: { queueNumber }
                },
                include: { order: true },
                orderBy: { createdAt: 'desc' }
            });

            if (statusHistories.length > 0) {
                matchedOrder = statusHistories[0].order;
            }
        }

        // Strategy B: Match order created simultaneously with txDate (within ±2 hours of tx.createdAt)
        if (!matchedOrder) {
            const tightOrders = await prisma.order.findMany({
                where: {
                    queueNumber,
                    createdAt: {
                        gte: new Date(txDate.getTime() - 2 * 60 * 60 * 1000),
                        lte: new Date(txDate.getTime() + 2 * 60 * 60 * 1000)
                    }
                },
                orderBy: { createdAt: 'asc' }
            });

            if (tightOrders.length > 0) {
                // Find order with minimal time difference
                matchedOrder = tightOrders.reduce((prev, curr) => {
                    const prevDiff = Math.abs(prev.createdAt.getTime() - txDate.getTime());
                    const currDiff = Math.abs(curr.createdAt.getTime() - txDate.getTime());
                    return currDiff < prevDiff ? curr : prev;
                });
            }
        }

        // Strategy C: Wider 24-hour window (closest prior order with that queue number)
        if (!matchedOrder) {
            const dayOrders = await prisma.order.findMany({
                where: {
                    queueNumber,
                    createdAt: {
                        gte: new Date(txDate.getTime() - 24 * 60 * 60 * 1000),
                        lte: new Date(txDate.getTime() + 24 * 60 * 60 * 1000)
                    }
                },
                orderBy: { createdAt: 'asc' }
            });

            if (dayOrders.length > 0) {
                matchedOrder = dayOrders.reduce((prev, curr) => {
                    const prevDiff = Math.abs(prev.createdAt.getTime() - txDate.getTime());
                    const currDiff = Math.abs(curr.createdAt.getTime() - txDate.getTime());
                    return currDiff < prevDiff ? curr : prev;
                });
            }
        }

        if (!matchedOrder) {
            skipped.push({ id: tx.id, reason: tx.reason, cause: `No matching order found for queue ${queueNumber} near ${txDate.toISOString()}` });
            continue;
        }

        const closestOrder = matchedOrder;

        const orderRef = getOrderReference(closestOrder.createdAt, closestOrder.queueNumber);
        const newReason = tx.reason.replace(/Order\s+#\d+/i, `Order ${orderRef}`);

        updates.push({
            id: tx.id,
            oldReason: tx.reason,
            newReason,
            orderId: closestOrder.id,
            orderRef
        });
    }

    // 2. Also check PreparedItemTransaction
    const preparedTxs = await prisma.preparedItemTransaction.findMany({
        where: {
            reason: {
                contains: 'Order #'
            }
        },
        include: { order: true }
    });

    const preparedUpdates: Array<{
        id: string;
        oldReason: string;
        newReason: string;
    }> = [];

    for (const pTx of preparedTxs) {
        if (!pTx.reason) continue;
        if (pTx.order) {
            const orderRef = getOrderReference(pTx.order.createdAt, pTx.order.queueNumber);
            const newReason = pTx.reason.replace(/Order\s+#\d+/i, `Order ${orderRef}`);
            preparedUpdates.push({
                id: pTx.id,
                oldReason: pTx.reason,
                newReason
            });
        }
    }

    console.log(`\nSummary:`);
    console.log(`- ${updates.length} StockTransaction records matched`);
    console.log(`- ${preparedUpdates.length} PreparedItemTransaction records matched`);
    if (skipped.length > 0) {
        console.log(`- ${skipped.length} records skipped (unmatched or unparseable)`);
    }

    if (updates.length > 0 || preparedUpdates.length > 0) {
        console.log('\nPreview of changes (first 5):');
        const allPreviews = [
            ...updates.map((u) => ({ type: 'StockTransaction', ...u })),
            ...preparedUpdates.map((pu) => ({ type: 'PreparedItemTransaction', ...pu }))
        ];
        allPreviews.slice(0, 5).forEach((item, idx) => {
            console.log(`  [${idx + 1}] (${item.type})`);
            console.log(`      From: "${item.oldReason}"`);
            console.log(`      To:   "${item.newReason}"`);
        });
    }

    if (isDryRun) {
        console.log('\n[DRY RUN ONLY] No records were modified.');
        console.log('To apply these changes safely, run with the --apply flag.\n');
        return;
    }

    // 3. Backup state to JSON file before modifying
    const backupDir = path.resolve(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupFilePath = path.join(backupDir, `stock-tx-reason-backup-${Date.now()}.json`);
    fs.writeFileSync(backupFilePath, JSON.stringify({ timestamp: new Date().toISOString(), updates, preparedUpdates, skipped }, null, 2));
    console.log(`\nSafety backup written to: ${backupFilePath}`);

    // 4. Execute updates atomically inside a transaction with extended timeout & chunking
    const CHUNK_SIZE = 50;
    await prisma.$transaction(
        async (tx) => {
            for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
                const chunk = updates.slice(i, i + CHUNK_SIZE);
                await Promise.all(
                    chunk.map((u) =>
                        tx.stockTransaction.update({
                            where: { id: u.id },
                            data: { reason: u.newReason }
                        })
                    )
                );
            }
            for (let i = 0; i < preparedUpdates.length; i += CHUNK_SIZE) {
                const chunk = preparedUpdates.slice(i, i + CHUNK_SIZE);
                await Promise.all(
                    chunk.map((pu) =>
                        tx.preparedItemTransaction.update({
                            where: { id: pu.id },
                            data: { reason: pu.newReason }
                        })
                    )
                );
            }
        },
        {
            maxWait: 15000,
            timeout: 60000
        }
    );

    console.log(`\nSuccessfully updated ${updates.length + preparedUpdates.length} records in database.\n`);
}

// Script CLI entry point
if (require.main === module) {
    const isApply = process.argv.includes('--apply');
    backfillStockTransactionOrderRef(!isApply)
        .catch((err) => {
            console.error('Migration failed:', err);
            process.exit(1);
        })
        .finally(() => prisma.$disconnect());
}
