import { OrderPayment, PaymentMethod, PaymentStatus, Prisma, StoreSetting } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { getOrderReference } from './order.utils';

/**
 * Generates a plain text thermal layout for the receipt (40-column width)
 */
export function generateTextReceipt(
    order: Prisma.OrderGetPayload<{
        include: {
            items: {
                include: {
                    variant: {
                        include: {
                            product: true;
                        };
                    };
                    modifiers: {
                        include: {
                            modifierOption: true;
                        };
                    };
                };
            };
            payments: true;
            discounts: {
                include: {
                    discount: true;
                };
            };
            cashierSession: {
                include: {
                    cashier: true;
                };
            };
        };
    }>,
    storeSetting: StoreSetting
): string {
    const width = 40;
    const divider = '-'.repeat(width);

    const center = (text: string) => {
        const spaces = Math.max(0, Math.floor((width - text.length) / 2));
        return ' '.repeat(spaces) + text;
    };

    const leftRight = (left: string, right: string) => {
        const spaces = Math.max(1, width - left.length - right.length);
        return left + ' '.repeat(spaces) + right;
    };

    const lines: string[] = [];

    // Header
    lines.push(center(storeSetting.storeName.toUpperCase()));
    lines.push(center(storeSetting.address));
    if (storeSetting.contactNumber) {
        lines.push(center(`Tel: ${storeSetting.contactNumber}`));
    }
    lines.push(divider);

    // Meta details
    const refNo = getOrderReference(order.createdAt, order.queueNumber);
    lines.push(leftRight(`Ref No: ${refNo}`, new Date(order.createdAt).toLocaleDateString()));
    lines.push(
        leftRight(`Queue No: ${order.queueNumber || 'N/A'}`, new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    );
    lines.push(leftRight(`Receipt ID: ${order.id.slice(0, 8).toUpperCase()}`, `Type: ${order.orderType}`));
    lines.push(leftRight(`Src: ${order.orderSource}`, ''));
    if (order.cashierSession?.cashier) {
        const cashierName =
            `${order.cashierSession.cashier.firstName || ''} ${order.cashierSession.cashier.lastName || ''}`.trim() ||
            order.cashierSession.cashier.username;
        lines.push(leftRight(`Server: ${cashierName}`, ''));
    }
    lines.push(divider);

    // Items list
    lines.push(leftRight('Item Description', 'Qty    Price'));
    lines.push(divider);

    for (const item of order.items) {
        const name = item.variant?.product?.name || 'Item';
        const variantLabel = item.variant?.sku ? ` (${item.variant.sku})` : '';
        const itemLine = `${name}${variantLabel}`;
        const priceLabel = `PHP ${item.totalPrice.toFixed(2)}`;

        lines.push(leftRight(itemLine.slice(0, 24), `${item.quantity.toString().padStart(3)}  ${priceLabel}`));

        if (item.modifiers && item.modifiers.length > 0) {
            for (const mod of item.modifiers) {
                const modName = `  + ${mod.modifierOption?.name || 'Option'}`;
                const modPrice = `PHP ${mod.price.toFixed(2)}`;
                lines.push(leftRight(modName.slice(0, 24), `     ${modPrice}`));
            }
        }
    }
    lines.push(divider);

    // Totals
    lines.push(leftRight('Subtotal:', `PHP ${order.subtotal.toFixed(2)}`));
    lines.push(leftRight(`VAT (${storeSetting.vatRate}% Incl.):`, `PHP ${order.taxAmount.toFixed(2)}`));

    for (const od of order.discounts) {
        lines.push(leftRight(`Discount (${od.discount.name}):`, `-PHP ${od.amount.toFixed(2)}`));
        if (od.referenceId) {
            lines.push(`  Card ID: ${od.referenceId}`);
            lines.push(`  Holder: ${od.referenceName}`);
        }
    }

    lines.push(divider);
    lines.push(leftRight('NET TOTAL:', `PHP ${order.netTotal.toFixed(2)}`));
    lines.push(divider);

    // Payments
    const paidPayments = order.payments.filter((p: OrderPayment) => p.paymentStatus === PaymentStatus.PAID);
    if (paidPayments.length > 0) {
        lines.push('PAYMENTS:');
        for (const payment of paidPayments) {
            lines.push(leftRight(`  ${payment.paymentMethod}:`, `PHP ${payment.amount.toFixed(2)}`));
            if (payment.paymentMethod === 'CASH') {
                if (payment.amountTendered) {
                    lines.push(leftRight('    Tendered:', `PHP ${payment.amountTendered.toFixed(2)}`));
                }
                if (payment.amountChange) {
                    lines.push(leftRight('    Change:', `PHP ${payment.amountChange.toFixed(2)}`));
                }
            } else if (payment.gcashReferenceNumber) {
                lines.push(`    Ref No: ${payment.gcashReferenceNumber}`);
            }
        }
        lines.push(divider);
    }

    lines.push(center('THANK YOU, COME AGAIN!'));
    lines.push(center('||||| | |||| ||| || ||| ||||'));
    lines.push(center(order.id.slice(0, 8).toUpperCase()));

    return lines.join('\n');
}

/**
 * Generates HTML receipt with a clean thermal printer visual layout
 */
export function generateHtmlReceipt(
    order: Prisma.OrderGetPayload<{
        include: {
            items: {
                include: {
                    variant: {
                        include: {
                            product: true;
                        };
                    };
                    modifiers: {
                        include: {
                            modifierOption: true;
                        };
                    };
                };
            };
            payments: true;
            discounts: {
                include: {
                    discount: true;
                };
            };
            cashierSession: {
                include: {
                    cashier: true;
                };
            };
        };
    }>,
    storeSetting: StoreSetting
): string {
    const cashierName = order.cashierSession?.cashier
        ? `${order.cashierSession.cashier.firstName || ''} ${order.cashierSession.cashier.lastName || ''}`.trim() ||
          order.cashierSession.cashier.username
        : 'System';

    const dateStr = new Date(order.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const timeStr = new Date(order.createdAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    const itemsHtml = order.items
        .map(
            (
                item: Prisma.OrderItemGetPayload<{
                    include: {
                        variant: {
                            include: {
                                product: true;
                            };
                        };
                        modifiers: {
                            include: {
                                modifierOption: true;
                            };
                        };
                    };
                }>
            ) => {
                const name = item.variant?.product?.name || 'Item';
                const variantLabel = item.variant?.sku ? ` (${item.variant.sku})` : '';
                const itemName = `${name}${variantLabel}`;

                let modHtml = '';
                if (item.modifiers && item.modifiers.length > 0) {
                    modHtml = item.modifiers
                        .map(
                            (
                                mod: Prisma.OrderItemModifierGetPayload<{
                                    include: {
                                        modifierOption: true;
                                    };
                                }>
                            ) => `
                <div class="receipt-item-modifier">
                    <span>&nbsp;&nbsp;+ ${mod.modifierOption?.name || 'Option'}</span>
                    <span>PHP ${mod.price.toFixed(2)}</span>
                </div>
            `
                        )
                        .join('');
                }

                return `
            <div class="receipt-item-row">
                <span class="item-name">${itemName}</span>
                <span class="item-qty">${item.quantity}</span>
                <span class="item-price">PHP ${item.totalPrice.toFixed(2)}</span>
            </div>
            ${modHtml}
        `;
            }
        )
        .join('');

    const discountRowsHtml = order.discounts
        .map(
            (
                od: Prisma.OrderDiscountGetPayload<{
                    include: {
                        discount: true;
                    };
                }>
            ) => `
        <div class="receipt-total-row text-muted">
            <span>Discount (${od.discount.name})</span>
            <span>-PHP ${od.amount.toFixed(2)}</span>
        </div>
        ${
            od.referenceId
                ? `
        <div class="receipt-compliance-row">
            <span>&nbsp;&nbsp;Card ID: ${od.referenceId}</span>
        </div>
        <div class="receipt-compliance-row">
            <span>&nbsp;&nbsp;Holder: ${od.referenceName}</span>
        </div>
        `
                : ''
        }
    `
        )
        .join('');

    const paymentsHtml = order.payments
        .filter((p: OrderPayment) => p.paymentStatus === PaymentStatus.PAID)
        .map((payment: OrderPayment) => {
            let details = '';
            if (payment.paymentMethod === PaymentMethod.CASH) {
                if (payment.amountTendered) {
                    details += `<div class="receipt-total-row detail"><span>&nbsp;&nbsp;Tendered:</span><span>PHP ${payment.amountTendered.toFixed(2)}</span></div>`;
                }
                if (payment.amountChange) {
                    details += `<div class="receipt-total-row detail"><span>&nbsp;&nbsp;Change:</span><span>PHP ${payment.amountChange.toFixed(2)}</span></div>`;
                }
            } else if (payment.gcashReferenceNumber) {
                details += `<div class="receipt-compliance-row"><span>&nbsp;&nbsp;Ref No: ${payment.gcashReferenceNumber}</span></div>`;
            }

            return `
            <div class="receipt-total-row">
                <span>Payment (${payment.paymentMethod})</span>
                <span>PHP ${payment.amount.toFixed(2)}</span>
            </div>
            ${details}
        `;
        })
        .join('');

    const contactHtml = storeSetting.contactNumber ? `<div>Tel: ${storeSetting.contactNumber}</div>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt - ${order.queueNumber || order.id.slice(0, 8)}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
        
        body {
            background-color: #f3f4f6;
            font-family: 'Courier Prime', Courier, monospace;
            color: #1f2937;
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }

        .receipt-container {
            background: #ffffff;
            width: 320px;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
            box-sizing: border-box;
            position: relative;
        }

        .receipt-container::before, .receipt-container::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            height: 10px;
            background-size: 16px 16px;
            background-repeat: repeat-x;
        }
        .receipt-container::before {
            top: -5px;
            background-image: radial-gradient(circle, transparent 70%, #ffffff 70%);
        }
        .receipt-container::after {
            bottom: -5px;
            background-image: radial-gradient(circle, transparent 70%, #ffffff 70%);
        }

        .receipt-header {
            text-align: center;
            margin-bottom: 16px;
        }

        .receipt-store-name {
            font-size: 20px;
            font-weight: 700;
            margin: 0 0 6px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .receipt-store-address {
            font-size: 11px;
            color: #6b7280;
            line-height: 1.4;
        }

        .divider {
            border-top: 1px dashed #d1d5db;
            margin: 12px 0;
        }

        .receipt-meta-grid {
            font-size: 11px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            row-gap: 4px;
            margin-bottom: 12px;
        }

        .receipt-meta-grid div:nth-child(even) {
            text-align: right;
        }

        .receipt-items-table {
            margin-bottom: 12px;
        }

        .receipt-item-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 4px;
            font-weight: 700;
        }

        .item-name {
            flex-grow: 1;
            max-width: 170px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .item-qty {
            width: 30px;
            text-align: center;
        }

        .item-price {
            width: 90px;
            text-align: right;
        }

        .receipt-item-modifier {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #4b5563;
            margin-bottom: 3px;
        }

        .receipt-total-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 6px;
        }

        .receipt-total-row.net-total {
            font-size: 14px;
            font-weight: 700;
            margin-top: 8px;
        }

        .receipt-total-row.detail {
            color: #4b5563;
            font-size: 11px;
        }

        .receipt-compliance-row {
            font-size: 11px;
            color: #4b5563;
            margin-bottom: 4px;
        }

        .receipt-footer {
            text-align: center;
            margin-top: 20px;
        }

        .receipt-thanks {
            font-weight: 700;
            font-size: 12px;
            margin-bottom: 12px;
            text-transform: uppercase;
        }

        .barcode-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: 8px;
        }

        .barcode-bars {
            height: 32px;
            width: 160px;
            background: repeating-linear-gradient(
                90deg,
                #1f2937,
                #1f2937 2px,
                #ffffff 2px,
                #ffffff 4px,
                #1f2937 4px,
                #1f2937 7px,
                #ffffff 7px,
                #ffffff 9px
            );
        }

        .barcode-label {
            font-size: 10px;
            margin-top: 4px;
            color: #4b5563;
            letter-spacing: 2px;
        }

        .text-muted {
            color: #4b5563;
        }
    </style>
</head>
<body>
    <div class="receipt-container">
        <div class="receipt-header">
            <div class="receipt-store-name">${storeSetting.storeName.toUpperCase()}</div>
            <div class="receipt-store-address">
                <div>${storeSetting.address}</div>
                ${contactHtml}
            </div>
        </div>

        <div class="divider"></div>

        <div class="receipt-meta-grid">
            <div>Receipt ID:</div>
            <div>${order.id.slice(0, 8).toUpperCase()}</div>
            <div>Reference No:</div>
            <div><strong>${getOrderReference(order.createdAt, order.queueNumber)}</strong></div>
            <div>Queue No:</div>
            <div><strong>${order.queueNumber || 'N/A'}</strong></div>
            <div>Date:</div>
            <div>${dateStr} ${timeStr}</div>
            <div>Dining:</div>
            <div>${order.orderType}</div>
            <div>Server:</div>
            <div>${cashierName}</div>
        </div>

        <div class="divider"></div>

        <div class="receipt-items-table">
            ${itemsHtml}
        </div>

        <div class="divider"></div>

        <div class="receipt-totals-table">
            <div class="receipt-total-row">
                <span>Subtotal</span>
                <span>PHP ${order.subtotal.toFixed(2)}</span>
            </div>
            <div class="receipt-total-row text-muted">
                <span>VAT (${storeSetting.vatRate}% Incl.)</span>
                <span>PHP ${order.taxAmount.toFixed(2)}</span>
            </div>
            ${discountRowsHtml}
            
            <div class="divider"></div>
            
            <div class="receipt-total-row net-total">
                <span>NET TOTAL</span>
                <span>PHP ${order.netTotal.toFixed(2)}</span>
            </div>
        </div>

        ${
            order.payments.length > 0
                ? `
            <div class="divider"></div>
            <div class="receipt-payments-table">
                ${paymentsHtml}
            </div>
        `
                : ''
        }

        <div class="divider"></div>

        <div class="receipt-footer">
            <div class="receipt-thanks">Thank you, come again!</div>
            <div class="barcode-container">
                <div class="barcode-bars"></div>
                <div class="barcode-label">${order.id.slice(0, 8).toUpperCase()}</div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generates custom-sized thermal style PDF receipt using pdfkit
 */
export async function generatePdfReceipt(
    order: Prisma.OrderGetPayload<{
        include: {
            items: {
                include: {
                    variant: {
                        include: {
                            product: true;
                        };
                    };
                    modifiers: {
                        include: {
                            modifierOption: true;
                        };
                    };
                };
            };
            payments: true;
            discounts: {
                include: {
                    discount: true;
                };
            };
            cashierSession: {
                include: {
                    cashier: true;
                };
            };
        };
    }>,
    storeSetting: StoreSetting
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const itemsCount = order.items.length;
        const modifiersCount = order.items.reduce(
            (
                acc: number,
                item: Prisma.OrderItemGetPayload<{
                    include: {
                        variant: {
                            include: {
                                product: true;
                            };
                        };
                        modifiers: {
                            include: {
                                modifierOption: true;
                            };
                        };
                    };
                }>
            ) => acc + (item.modifiers?.length || 0),
            0
        );
        const paymentsCount = order.payments.filter((p: OrderPayment) => p.paymentStatus === PaymentStatus.PAID).length;
        const discountsCount = order.discounts.length;

        // Custom point height computation for continuous thermal paper size mapping
        const headerHeight = 90;
        const metaHeight = 81;
        const itemsHeight = 20 + itemsCount * 22 + modifiersCount * 14;
        const totalsHeight = 70 + discountsCount * 14;
        const paymentsHeight = paymentsCount > 0 ? 20 + paymentsCount * 25 : 0;
        const footerHeight = 85;
        const totalHeight = headerHeight + metaHeight + itemsHeight + totalsHeight + paymentsHeight + footerHeight + 40;

        // 80mm width standard thermal paper maps to ~226 PDF points (1 pt = 1/72 inch)
        const doc = new PDFDocument({
            size: [226, Math.max(350, totalHeight)],
            margins: { top: 15, bottom: 15, left: 15, right: 15 }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const width = 196; // 226 - 30 margins
        let y = 15;

        // Header
        doc.font('Helvetica-Bold').fontSize(14).fillColor('#1f2937').text(storeSetting.storeName.toUpperCase(), 15, y, { align: 'center', width });
        y += 18;
        doc.font('Helvetica').fontSize(8).fillColor('#4b5563').text(storeSetting.address, 15, y, { align: 'center', width });
        y += 22;
        if (storeSetting.contactNumber) {
            doc.text(`Tel: ${storeSetting.contactNumber}`, 15, y, { align: 'center', width });
            y += 12;
        }

        // Dashed lines helper
        const drawDashedLine = (currentY: number) => {
            doc.strokeColor('#d1d5db').lineWidth(0.8).dash(3, { space: 2 }).moveTo(15, currentY).lineTo(211, currentY).stroke();
            doc.undash();
        };

        drawDashedLine(y);
        y += 8;

        // Metadata
        const dateStr = new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const timeStr = new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        doc.font('Helvetica').fontSize(8).fillColor('#1f2937');
        doc.text('Receipt ID:', 15, y);
        doc.font('Helvetica-Bold').text(order.id.slice(0, 8).toUpperCase(), 75, y, { align: 'right', width: 136 });
        y += 11;

        const refNo = getOrderReference(order.createdAt, order.queueNumber);
        doc.font('Helvetica').text('Reference No:', 15, y);
        doc.font('Helvetica-Bold').text(refNo, 75, y, { align: 'right', width: 136 });
        y += 11;

        doc.font('Helvetica').text('Queue No:', 15, y);
        doc.font('Helvetica-Bold').text(order.queueNumber || 'N/A', 75, y, { align: 'right', width: 136 });
        y += 11;

        doc.font('Helvetica').text('Date/Time:', 15, y);
        doc.text(`${dateStr} ${timeStr}`, 75, y, { align: 'right', width: 136 });
        y += 11;

        doc.text('Dining Type:', 15, y);
        doc.text(`${order.orderType} (${order.orderSource})`, 75, y, { align: 'right', width: 136 });
        y += 11;

        if (order.cashierSession?.cashier) {
            const cashierName =
                `${order.cashierSession.cashier.firstName || ''} ${order.cashierSession.cashier.lastName || ''}`.trim() ||
                order.cashierSession.cashier.username;
            doc.text('Server:', 15, y);
            doc.text(cashierName, 75, y, { align: 'right', width: 136 });
            y += 11;
        }

        y += 4;
        drawDashedLine(y);
        y += 8;

        // Table headers
        doc.font('Helvetica-Bold').fontSize(8).text('Item Description', 15, y);
        doc.text('Qty', 135, y, { align: 'center', width: 25 });
        doc.text('Price', 160, y, { align: 'right', width: 51 });
        y += 12;

        drawDashedLine(y);
        y += 6;

        // Items iteration
        for (const item of order.items) {
            const name = item.variant?.product?.name || 'Item';
            const variantLabel = item.variant?.sku ? ` (${item.variant.sku})` : '';
            const itemName = `${name}${variantLabel}`;

            doc.font('Helvetica-Bold').fontSize(8).text(itemName, 15, y, { width: 115, lineBreak: false });
            doc.font('Helvetica').text(item.quantity.toString(), 135, y, { align: 'center', width: 25 });
            doc.text(`PHP ${item.totalPrice.toFixed(2)}`, 160, y, { align: 'right', width: 51 });
            y += 12;

            if (item.modifiers && item.modifiers.length > 0) {
                for (const mod of item.modifiers) {
                    doc.font('Helvetica').fontSize(7.5).fillColor('#4b5563');
                    doc.text(`  + ${mod.modifierOption?.name || 'Option'}`, 15, y, { width: 130, lineBreak: false });
                    doc.text(`PHP ${mod.price.toFixed(2)}`, 160, y, { align: 'right', width: 51 });
                    y += 11;
                }
            }
            y += 2;
        }

        doc.fillColor('#1f2937');
        y += 4;
        drawDashedLine(y);
        y += 8;

        // Totals billing
        doc.font('Helvetica').fontSize(8).text('Subtotal:', 15, y);
        doc.text(`PHP ${order.subtotal.toFixed(2)}`, 100, y, { align: 'right', width: 111 });
        y += 11;

        doc.fillColor('#4b5563');
        doc.text(`VAT (${storeSetting.vatRate}% Incl.):`, 15, y);
        doc.text(`PHP ${order.taxAmount.toFixed(2)}`, 100, y, { align: 'right', width: 111 });
        y += 11;

        for (const od of order.discounts) {
            doc.text(`Discount (${od.discount.name}):`, 15, y);
            doc.text(`-PHP ${od.amount.toFixed(2)}`, 100, y, { align: 'right', width: 111 });
            y += 11;
            if (od.referenceId) {
                doc.text(`  Card ID: ${od.referenceId}`, 15, y);
                y += 10;
                doc.text(`  Holder: ${od.referenceName}`, 15, y);
                y += 10;
            }
        }

        doc.fillColor('#1f2937');
        y += 4;
        drawDashedLine(y);
        y += 8;

        doc.font('Helvetica-Bold').fontSize(10).text('NET TOTAL:', 15, y);
        doc.text(`PHP ${order.netTotal.toFixed(2)}`, 100, y, { align: 'right', width: 111 });
        y += 14;
        const paidPayments = order.payments.filter((p: OrderPayment) => p.paymentStatus === PaymentStatus.PAID);
        // Payments auditing
        if (paidPayments.length > 0) {
            y += 4;
            drawDashedLine(y);
            y += 8;

            doc.font('Helvetica-Bold').fontSize(8).text('PAYMENTS:', 15, y);
            y += 12;

            for (const payment of paidPayments) {
                doc.font('Helvetica').fontSize(8).text(`Payment (${payment.paymentMethod}):`, 15, y);
                doc.text(`PHP ${payment.amount.toFixed(2)}`, 100, y, { align: 'right', width: 111 });
                y += 11;

                if (payment.paymentMethod === 'CASH') {
                    if (payment.amountTendered) {
                        doc.fillColor('#4b5563').text('  Tendered:', 15, y);
                        doc.text(`PHP ${payment.amountTendered.toFixed(2)}`, 100, y, { align: 'right', width: 111 });
                        y += 11;
                    }
                    if (payment.amountChange) {
                        doc.text('  Change:', 15, y);
                        doc.text(`PHP ${payment.amountChange.toFixed(2)}`, 100, y, { align: 'right', width: 111 });
                        y += 11;
                    }
                    doc.fillColor('#1f2937');
                } else if (payment.gcashReferenceNumber) {
                    doc.fillColor('#4b5563').text(`  Ref No: ${payment.gcashReferenceNumber}`, 15, y);
                    y += 11;
                    doc.fillColor('#1f2937');
                }
            }
        }

        y += 4;
        drawDashedLine(y);
        y += 12;

        // Footer block
        doc.font('Helvetica-Bold').fontSize(9).text('THANK YOU, COME AGAIN!', 15, y, { align: 'center', width });
        y += 16;

        // Barcode block draw
        const barcodeWidth = 120;
        const barcodeX = 15 + (width - barcodeWidth) / 2;
        doc.rect(barcodeX, y, barcodeWidth, 24).fill('#1f2937');
        doc.fillColor('#ffffff');
        const spaces = [6, 12, 18, 30, 36, 48, 54, 66, 72, 84, 90, 96, 108];
        spaces.forEach((sx) => {
            doc.rect(barcodeX + sx, y, 3, 24).fill();
        });

        y += 28;
        doc.font('Helvetica').fontSize(8).fillColor('#4b5563').text(order.id.slice(0, 8).toUpperCase(), 15, y, { align: 'center', width });

        doc.end();
    });
}
