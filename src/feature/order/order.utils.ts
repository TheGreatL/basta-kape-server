export function getOrderReference(createdAt: Date | string | null | undefined, queueNumber: string | null | undefined): string {
    if (!createdAt || !queueNumber) return 'N/A';
    const date = new Date(createdAt);
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value || '00';
    const month = parts.find((p) => p.type === 'month')?.value || '00';
    const day = parts.find((p) => p.type === 'day')?.value || '00';
    const yymmdd = `${year.slice(-2)}${month}${day}`;
    const cleanQueue = queueNumber.replace('#', '');
    return `${yymmdd}-${cleanQueue}`;
}

export function formatOrderWithReference<T extends { createdAt: Date; queueNumber: string | null }>(order: T) {
    if (!order) return order;
    return {
        ...order,
        referenceNumber: getOrderReference(order.createdAt, order.queueNumber)
    };
}

export function formatOrdersWithReference<T extends { createdAt: Date; queueNumber: string | null }>(orders: T[]) {
    return orders.map(formatOrderWithReference);
}
