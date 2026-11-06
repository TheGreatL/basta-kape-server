import { describe, it, expect } from 'vitest';
import { CreateOrderSchema, UpdateOrderCourierSchema, OrderStatusEnum, RiderVehicleEnum } from '@/feature/order/order.types';

describe('Order Delivery Schema & Enum Unit Tests', () => {
    const validItem = {
        productVariantId: '11111111-1111-4111-8111-111111111111',
        quantity: 1,
        modifierOptionIds: []
    };

    it('includes DISPATCHED in OrderStatusEnum', () => {
        expect(OrderStatusEnum.options).toContain('DISPATCHED');
        expect(OrderStatusEnum.safeParse('DISPATCHED').success).toBe(true);
    });

    it('validates RiderVehicleEnum options', () => {
        expect(RiderVehicleEnum.options).toEqual(['Bike', 'Motorcycle', 'Car', 'Other Transportation Service']);
        expect(RiderVehicleEnum.safeParse('Motorcycle').success).toBe(true);
        expect(RiderVehicleEnum.safeParse('Scooter').success).toBe(false);
    });

    it('rejects DELIVERY when orderSource is POS', () => {
        const result = CreateOrderSchema.safeParse({
            orderType: 'DELIVERY',
            orderSource: 'POS',
            paymentMethod: 'GCASH',
            paymentReferenceNumber: '1234567890123',
            items: [validItem]
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.message.includes('Delivery order type is only available for customer orders'))).toBe(true);
        }
    });

    it('rejects DELIVERY when paymentMethod is CASH', () => {
        const result = CreateOrderSchema.safeParse({
            orderType: 'DELIVERY',
            orderSource: 'WEBSITE',
            paymentMethod: 'CASH',
            items: [validItem]
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.message.includes('Only GCash payment is available for delivery orders'))).toBe(true);
        }
    });

    it('accepts DELIVERY when orderSource is WEBSITE and paymentMethod is GCASH with 13-digit ref and proof photo', () => {
        const result = CreateOrderSchema.safeParse({
            orderType: 'DELIVERY',
            orderSource: 'WEBSITE',
            paymentMethod: 'GCASH',
            paymentReferenceNumber: '1234567890123',
            paymentProofPhoto: 'https://example.com/receipt.png',
            items: [validItem]
        });

        expect(result.success).toBe(true);
    });

    it('validates UpdateOrderCourierSchema required fields and URL format', () => {
        const validCourier = UpdateOrderCourierSchema.safeParse({
            riderName: 'Juan Dela Cruz',
            riderPlate: 'ABC 1234',
            riderVehicle: 'Car',
            trackingLink: 'https://lalamove.com/track/12345'
        });
        expect(validCourier.success).toBe(true);

        const invalidUrl = UpdateOrderCourierSchema.safeParse({
            riderName: 'Juan Dela Cruz',
            riderPlate: 'ABC 1234',
            riderVehicle: 'Car',
            trackingLink: 'not-a-url'
        });
        expect(invalidUrl.success).toBe(false);
    });
});
