import { DiscountRepository } from './discount.repository';
import { StoreSettingsService } from '@/feature/store-settings/store-settings.service';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { NotFoundException, BadRequestException, ConflictException } from '@/exceptions';
import type { TCreateDiscount, TUpdateDiscount, TApplyDiscount } from './discount.types';
import { OrderStatus, PaymentStatus } from '@prisma/client';

type DiscountServiceConstructor = {
    discountRepository?: DiscountRepository;
    storeSettingsService?: StoreSettingsService;
    activityLogService?: ActivityLogService;
};

export class DiscountService {
    private repository: DiscountRepository;
    private storeSettingsService: StoreSettingsService;
    private activityLogService: ActivityLogService;

    constructor(deps: DiscountServiceConstructor = {}) {
        this.repository = deps.discountRepository ?? new DiscountRepository();
        this.storeSettingsService = deps.storeSettingsService ?? new StoreSettingsService();
        this.activityLogService = deps.activityLogService ?? new ActivityLogService();
    }

    async createDiscount(data: TCreateDiscount, actorId: string) {
        const discount = await this.repository.createDiscount(data);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Discount',
            details: `Created discount configuration "${data.name}" (${data.type}: ${data.value}).`
        });

        return discount;
    }

    async getDiscountById(id: string) {
        const discount = await this.repository.findDiscountById(id);
        if (!discount) {
            throw new NotFoundException('Discount not found');
        }
        return discount;
    }

    async listDiscounts() {
        return this.repository.listDiscounts();
    }

    async updateDiscount(id: string, data: TUpdateDiscount, actorId: string) {
        await this.getDiscountById(id);
        const discount = await this.repository.updateDiscount(id, data);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Discount',
            details: `Updated discount configuration "${discount.name}".`
        });

        return discount;
    }

    async deleteDiscount(id: string, actorId: string) {
        const discount = await this.getDiscountById(id);
        await this.repository.deleteDiscount(id);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete Discount',
            details: `Deleted discount configuration "${discount.name}".`
        });

        return discount;
    }

    async applyDiscountToOrder(orderId: string, data: TApplyDiscount, actorId: string) {
        // 1. Verify order exists
        const order = await this.repository.findOrderById(orderId);
        if (!order) {
            throw new NotFoundException('Order not found');
        }

        // 2. Validate order status and payment state
        if (order.status !== OrderStatus.PENDING) {
            throw new BadRequestException('Discounts can only be applied to pending orders.');
        }

        const isPaid = order.payments.some((p) => p.paymentStatus === PaymentStatus.PAID);
        if (isPaid) {
            throw new ConflictException('Cannot apply discount to a paid order.');
        }

        // 3. Verify discount exists
        const discount = await this.repository.findDiscountById(data.discountId);
        if (!discount || !discount.isActive) {
            throw new NotFoundException('Discount not found or is disabled.');
        }

        let discountAmount: number;
        let taxAmount: number;
        let netTotal: number;
        const subtotal = order.subtotal;

        // 4. Enforce BIR Compliance for Senior Citizen / PWD
        const nameLower = discount.name.toLowerCase();
        const codeLower = (discount.code ?? '').toLowerCase();
        const isBIRDiscount =
            nameLower.includes('senior') ||
            nameLower.includes('sc') ||
            nameLower.includes('pwd') ||
            codeLower.includes('senior') ||
            codeLower.includes('sc') ||
            codeLower.includes('pwd');

        const settings = await this.storeSettingsService.getActiveSettings();
        const vatRate = settings?.vatRate ?? 12.0;

        if (isBIRDiscount) {
            if (!data.referenceId || !data.referenceName) {
                throw new BadRequestException('Card ID and cardholder name are required for Senior Citizen/PWD discounts.');
            }

            // BIR calculations for SC/PWD: VAT Exemption (VAT = 0) + 20% discount on VAT-exclusive subtotal
            const vatExclusiveSubtotal = subtotal / (1 + vatRate / 100);
            discountAmount = vatExclusiveSubtotal * 0.2;
            taxAmount = 0;
            netTotal = vatExclusiveSubtotal - discountAmount;
        } else {
            // Standard discount logic
            if (discount.type === 'PERCENTAGE') {
                discountAmount = subtotal * (discount.value / 100);
            } else {
                discountAmount = discount.value;
            }

            // Cap discount at subtotal
            if (discountAmount > subtotal) {
                discountAmount = subtotal;
            }

            const discountedSubtotal = subtotal - discountAmount;

            netTotal = discountedSubtotal;
            taxAmount = netTotal * (vatRate / (100 + vatRate));
        }

        // 5. Round to 2 decimal places
        discountAmount = Math.round(discountAmount * 100) / 100;
        taxAmount = Math.round(taxAmount * 100) / 100;
        netTotal = Math.round(netTotal * 100) / 100;

        // 6. Persist to DB
        const result = await this.repository.applyDiscountToOrder(
            orderId,
            data.discountId,
            discountAmount,
            taxAmount,
            netTotal,
            data.referenceId ?? null,
            data.referenceName ?? null,
            actorId
        );

        // 7. Activity logging
        let details = `Applied discount "${discount.name}" (PHP ${discountAmount.toFixed(2)} off) to order ${order.queueNumber ?? orderId}.`;
        if (isBIRDiscount) {
            details += ` Card ID: ${data.referenceId}, Holder: ${data.referenceName}.`;
        }

        await this.activityLogService.logActivity({
            actorId,
            title: 'Apply Discount',
            details
        });

        return result;
    }

    async removeDiscountFromOrder(orderId: string, actorId: string) {
        // 1. Verify order exists
        const order = await this.repository.findOrderById(orderId);
        if (!order) {
            throw new NotFoundException('Order not found');
        }

        // 2. Validate order status and payment state
        if (order.status !== OrderStatus.PENDING) {
            throw new BadRequestException('Discounts can only be removed from pending orders.');
        }

        const isPaid = order.payments.some((p) => p.paymentStatus === PaymentStatus.PAID);
        if (isPaid) {
            throw new ConflictException('Cannot modify discounts on a paid order.');
        }

        // 3. Recalculate original totals without discount
        const settings = await this.storeSettingsService.getActiveSettings();
        const vatRate = settings?.vatRate ?? 12.0;

        const subtotal = order.subtotal;
        let netTotal = subtotal;
        let taxAmount = netTotal * (vatRate / (100 + vatRate));

        taxAmount = Math.round(taxAmount * 100) / 100;
        netTotal = Math.round(netTotal * 100) / 100;

        // 4. Persist removal to DB
        await this.repository.removeDiscountFromOrder(orderId, taxAmount, netTotal, actorId);

        // 5. Activity logging
        await this.activityLogService.logActivity({
            actorId,
            title: 'Remove Discount',
            details: `Removed all discounts from order ${order.queueNumber ?? orderId}. Restored tax: PHP ${taxAmount.toFixed(2)}, net total: PHP ${netTotal.toFixed(2)}.`
        });
    }
}
