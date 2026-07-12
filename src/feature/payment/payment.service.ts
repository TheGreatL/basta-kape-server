import { PaymentRepository } from './payment.repository';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { NotFoundException, BadRequestException, ConflictException } from '@/exceptions';
import type { TCreatePayment } from './payment.types';
import { PaymentStatus, OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type PaymentServiceConstructor = {
    paymentRepository?: PaymentRepository;
    activityLogService?: ActivityLogService;
};

export class PaymentService {
    private repository: PaymentRepository;
    private activityLogService: ActivityLogService;

    constructor(deps: PaymentServiceConstructor = {}) {
        this.repository = deps.paymentRepository ?? new PaymentRepository();
        this.activityLogService = deps.activityLogService ?? new ActivityLogService();
    }

    async getPaymentsByOrderId(orderId: string) {
        const order = await this.repository.findOrderById(orderId);
        if (!order) {
            throw new NotFoundException('Order not found');
        }
        return this.repository.findPaymentsByOrderId(orderId);
    }

    async processPayment(orderId: string, data: TCreatePayment, actorId: string) {
        // 1. Verify order exists
        const order = await this.repository.findOrderById(orderId);
        if (!order) {
            throw new NotFoundException('Order not found');
        }

        // 2. Prevent payment for CANCELLED or COMPLETED orders
        if (order.status === OrderStatus.CANCELLED) {
            throw new BadRequestException('Cannot process payment for a cancelled order.');
        }
        if (order.status === OrderStatus.COMPLETED) {
            throw new BadRequestException('Cannot process payment for a completed order.');
        }

        // 3. Prevent duplicate payment
        const existingPaidPayment = await this.repository.findPaidPaymentByOrderId(orderId);
        if (existingPaidPayment) {
            throw new ConflictException('Order has already been paid.');
        }

        let amountTendered: number | null = null;
        let amountChange: number | null = null;
        let paymentReferenceNumber: string | null = null;
        let paymentProofPhoto: string | null = null;

        // 5. Method-specific payment logic
        if (data.paymentMethod === 'CASH') {
            amountTendered = data.amountTendered;
            if (amountTendered < order.netTotal) {
                throw new BadRequestException(
                    `Amount tendered (PHP ${amountTendered.toFixed(2)}) must be greater than or equal to the net total (PHP ${order.netTotal.toFixed(2)}).`
                );
            }
            amountChange = Math.round((amountTendered - order.netTotal) * 100) / 100;
        } else {
            // GCASH, PAYMAYA, or CREDIT_CARD
            paymentReferenceNumber = data.paymentReferenceNumber;
            paymentProofPhoto = data.paymentProofPhoto ?? null;
        }

        // 6. Record payment in database
        let payment;
        try {
            payment = await this.repository.createPayment(
                orderId,
                {
                    paymentMethod: data.paymentMethod,
                    paymentStatus: PaymentStatus.PAID,
                    amount: order.netTotal,
                    amountTendered,
                    amountChange,
                    paymentReferenceNumber,
                    paymentProofPhoto
                },
                actorId
            );
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException('A payment with this reference number already exists for this payment method.');
            }
            throw error;
        }

        // 7. Log activity
        let logDetails = `Processed ${data.paymentMethod} payment of PHP ${order.netTotal.toFixed(2)} for order ${order.queueNumber ?? orderId}.`;
        if (data.paymentMethod === 'CASH' && amountTendered !== null && amountChange !== null) {
            logDetails += ` Tendered: PHP ${amountTendered.toFixed(2)}, Change: PHP ${amountChange.toFixed(2)}.`;
        } else if (paymentReferenceNumber) {
            logDetails += ` Reference: ${paymentReferenceNumber}.`;
        }

        await this.activityLogService.logActivity({
            actorId,
            title: 'Process Payment',
            details: logDetails
        });

        return payment;
    }

    async getPaymentList(params: {
        page: number;
        limit: number;
        search?: string;
        paymentMethod?: PaymentMethod;
        paymentStatus?: PaymentStatus;
        dateFrom?: string;
        dateTo?: string;
    }) {
        return this.repository.getPaymentList(params);
    }

    async updatePaymentReceipt(paymentId: string, data: { paymentProofPhoto?: string; paymentReferenceNumber?: string }, actorId: string) {
        const payment = await prisma.orderPayment.findUnique({
            where: { id: paymentId }
        });
        if (!payment) {
            throw new NotFoundException('Payment transaction not found');
        }

        if (payment.paymentMethod === 'CASH') {
            throw new BadRequestException('Cannot upload payment receipt for cash transactions.');
        }

        let updated;
        try {
            updated = await this.repository.updatePaymentReceipt(paymentId, data, actorId);
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException('A payment with this reference number already exists for this payment method.');
            }
            throw error;
        }

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Payment Receipt',
            details: `Uploaded receipt proof/ref for payment ${paymentId} of order ${updated.orderId}. Status updated to PAID.`
        });

        return updated;
    }
}
