import { PaymentRepository } from './payment.repository';
import { RegisterShiftService } from '@/feature/register-shift/register-shift.service';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { NotFoundException, BadRequestException, ConflictException } from '@/exceptions';
import type { TCreatePayment } from './payment.types';
import { PaymentStatus, OrderStatus } from '@prisma/client';

type PaymentServiceConstructor = {
    paymentRepository?: PaymentRepository;
    registerShiftService?: RegisterShiftService;
    activityLogService?: ActivityLogService;
};

export class PaymentService {
    private repository: PaymentRepository;
    private registerShiftService: RegisterShiftService;
    private activityLogService: ActivityLogService;

    constructor(deps: PaymentServiceConstructor = {}) {
        this.repository = deps.paymentRepository ?? new PaymentRepository();
        this.registerShiftService = deps.registerShiftService ?? new RegisterShiftService();
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

        // 4. POS orders require an active cashier shift
        if (order.orderSource === 'POS') {
            try {
                await this.registerShiftService.getActiveShift(actorId);
            } catch {
                throw new BadRequestException('An active register shift is required to process POS payments. Please open a shift first.');
            }
        }

        let amountTendered: number | null = null;
        let amountChange: number | null = null;
        let gcashReferenceNumber: string | null = null;
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
            gcashReferenceNumber = data.gcashReferenceNumber;
            paymentProofPhoto = data.paymentProofPhoto ?? null;
        }

        // 6. Record payment in database
        const payment = await this.repository.createPayment(
            orderId,
            {
                paymentMethod: data.paymentMethod,
                paymentStatus: PaymentStatus.PAID,
                amount: order.netTotal,
                amountTendered,
                amountChange,
                gcashReferenceNumber,
                paymentProofPhoto
            },
            actorId
        );

        // 7. Log activity
        let logDetails = `Processed ${data.paymentMethod} payment of PHP ${order.netTotal.toFixed(2)} for order ${order.queueNumber ?? orderId}.`;
        if (data.paymentMethod === 'CASH' && amountTendered !== null && amountChange !== null) {
            logDetails += ` Tendered: PHP ${amountTendered.toFixed(2)}, Change: PHP ${amountChange.toFixed(2)}.`;
        } else if (gcashReferenceNumber) {
            logDetails += ` Reference: ${gcashReferenceNumber}.`;
        }

        await this.activityLogService.logActivity({
            actorId,
            title: 'Process Payment',
            details: logDetails
        });

        return payment;
    }
}
