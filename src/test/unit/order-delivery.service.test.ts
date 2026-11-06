import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { OrderService } from '@/feature/order/order.service';
import type { OrderRepository } from '@/feature/order/order.repository';
import type { StoreSettingsService } from '@/feature/store-settings/store-settings.service';
import type { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { prisma } from '@/lib/prisma';
import { generateTextReceipt, generateHtmlReceipt, generatePdfReceipt } from '@/feature/order/receipt.template';

vi.mock('@/lib/prisma', () => ({
    prisma: {
        customer: {
            findFirst: vi.fn()
        },
        user: {
            findFirst: vi.fn()
        }
    }
}));

describe('OrderService Delivery Workflow & Courier Unit Tests', () => {
    let service: OrderService;
    let mockRepo: {
        getOrderById: ReturnType<typeof vi.fn>;
        updateOrderStatus: ReturnType<typeof vi.fn>;
        updateOrderCourier: ReturnType<typeof vi.fn>;
        findStaleDispatchedOrders: ReturnType<typeof vi.fn>;
        autoCompleteDispatchedOrder: ReturnType<typeof vi.fn>;
    };
    let mockActivityLog: {
        logActivity: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockRepo = {
            getOrderById: vi.fn(),
            updateOrderStatus: vi.fn(),
            updateOrderCourier: vi.fn(),
            findStaleDispatchedOrders: vi.fn(),
            autoCompleteDispatchedOrder: vi.fn()
        };
        mockActivityLog = {
            logActivity: vi.fn().mockResolvedValue(true)
        };
        service = new OrderService({
            orderRepository: mockRepo as unknown as OrderRepository,
            storeSettingsService: {} as unknown as StoreSettingsService,
            activityLogService: mockActivityLog as unknown as ActivityLogService
        });
    });

    it('throws BadRequestException when trying to mark a non-DELIVERY order as DISPATCHED', async () => {
        mockRepo.getOrderById.mockResolvedValue({
            id: 'order-1',
            queueNumber: '#001',
            orderType: 'DINE_IN',
            status: 'READY'
        });

        await expect(service.updateOrderStatus('order-1', OrderStatus.DISPATCHED, 'Dispatching', 'staff-1')).rejects.toThrow(
            'Only delivery orders can be marked as Dispatched.'
        );
    });

    it('throws BadRequestException when trying to mark a DELIVERY order as DISPATCHED without courier details', async () => {
        mockRepo.getOrderById.mockResolvedValue({
            id: 'order-deliv-1',
            queueNumber: '#002',
            orderType: 'DELIVERY',
            status: 'READY',
            riderName: null,
            riderPlate: null,
            riderVehicle: null,
            trackingLink: null
        });

        await expect(service.updateOrderStatus('order-deliv-1', OrderStatus.DISPATCHED, 'Handed to rider', 'staff-1')).rejects.toThrow(
            'Cannot dispatch delivery order until courier details are submitted by the customer.'
        );
    });

    it('allows marking a DELIVERY order as DISPATCHED when courier details are present', async () => {
        mockRepo.getOrderById.mockResolvedValue({
            id: 'order-deliv-1',
            queueNumber: '#002',
            orderType: 'DELIVERY',
            status: 'READY',
            riderName: 'Juan Dela Cruz',
            riderPlate: 'ABC 1234',
            riderVehicle: 'Motorcycle',
            trackingLink: 'https://track.example.com/1'
        });
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: 'staff-1',
            role: {
                name: 'Administrator',
                isSystem: true,
                rolePermissions: []
            }
        } as unknown as Awaited<ReturnType<typeof prisma.user.findFirst>>);
        mockRepo.updateOrderStatus.mockResolvedValue({
            id: 'order-deliv-1',
            queueNumber: '#002',
            orderType: 'DELIVERY',
            status: 'DISPATCHED'
        });

        const updated = await service.updateOrderStatus('order-deliv-1', OrderStatus.DISPATCHED, 'Handed to rider', 'staff-1');
        expect(updated.status).toBe('DISPATCHED');
        expect(mockRepo.updateOrderStatus).toHaveBeenCalledWith('order-deliv-1', OrderStatus.DISPATCHED, 'Handed to rider', 'staff-1');
    });

    it('rejects updateOrderCourier for non-DELIVERY orders', async () => {
        mockRepo.getOrderById.mockResolvedValue({
            id: 'order-1',
            orderType: 'TAKE_OUT',
            status: 'READY',
            customerId: 'cust-1'
        });

        await expect(
            service.updateOrderCourier(
                'order-1',
                {
                    riderName: 'Juan Dela Cruz',
                    riderPlate: 'ABC 1234',
                    riderVehicle: 'Motorcycle',
                    trackingLink: 'https://track.example.com/1'
                },
                'user-1'
            )
        ).rejects.toThrow('Courier details can only be submitted for delivery orders.');
    });

    it('rejects updateOrderCourier when actor is not the customer who placed the order (e.g. staff)', async () => {
        mockRepo.getOrderById.mockResolvedValue({
            id: 'order-deliv-1',
            orderType: 'DELIVERY',
            status: 'READY',
            customerId: 'cust-1'
        });
        vi.mocked(prisma.customer.findFirst).mockResolvedValue(null);

        await expect(
            service.updateOrderCourier(
                'order-deliv-1',
                {
                    riderName: 'Juan Dela Cruz',
                    riderPlate: 'ABC 1234',
                    riderVehicle: 'Motorcycle',
                    trackingLink: 'https://track.example.com/1'
                },
                'staff-user-id'
            )
        ).rejects.toThrow('Only the customer who placed this order can submit courier details.');
    });

    it('rejects updateOrderCourier when order status is not READY (Ready for Pickup)', async () => {
        mockRepo.getOrderById.mockResolvedValue({
            id: 'order-deliv-1',
            orderType: 'DELIVERY',
            status: 'PREPARING',
            customerId: 'cust-1'
        });
        vi.mocked(prisma.customer.findFirst).mockResolvedValue({
            id: 'cust-1',
            userId: 'user-1'
        } as unknown as Awaited<ReturnType<typeof prisma.customer.findFirst>>);

        await expect(
            service.updateOrderCourier(
                'order-deliv-1',
                {
                    riderName: 'Juan Dela Cruz',
                    riderPlate: 'ABC 1234',
                    riderVehicle: 'Motorcycle',
                    trackingLink: 'https://track.example.com/1'
                },
                'user-1'
            )
        ).rejects.toThrow('Courier details can only be submitted when the order is Ready for Pickup.');
    });

    it('saves courier details when customer submits them while order is READY', async () => {
        mockRepo.getOrderById.mockResolvedValue({
            id: 'order-deliv-1',
            queueNumber: '#005',
            orderType: 'DELIVERY',
            status: 'READY',
            customerId: 'cust-1'
        });
        vi.mocked(prisma.customer.findFirst).mockResolvedValue({
            id: 'cust-1',
            userId: 'user-1'
        } as unknown as Awaited<ReturnType<typeof prisma.customer.findFirst>>);
        mockRepo.updateOrderCourier.mockResolvedValue({
            id: 'order-deliv-1',
            queueNumber: '#005',
            orderType: 'DELIVERY',
            status: 'READY',
            customerId: 'cust-1',
            riderName: 'Juan Dela Cruz',
            riderPlate: 'ABC 1234',
            riderVehicle: 'Motorcycle',
            trackingLink: 'https://track.example.com/1'
        });

        const res = await service.updateOrderCourier(
            'order-deliv-1',
            {
                riderName: 'Juan Dela Cruz',
                riderPlate: 'ABC 1234',
                riderVehicle: 'Motorcycle',
                trackingLink: 'https://track.example.com/1'
            },
            'user-1'
        );

        expect(mockRepo.updateOrderCourier).toHaveBeenCalledWith('order-deliv-1', {
            riderName: 'Juan Dela Cruz',
            riderPlate: 'ABC 1234',
            riderVehicle: 'Motorcycle',
            trackingLink: 'https://track.example.com/1'
        });
        expect(res?.riderName).toBe('Juan Dela Cruz');
    });

    it('includes courier details in text and HTML receipts for DELIVERY orders', () => {
        const mockOrder = {
            id: '12345678-1234-1234-1234-123456789012',
            queueNumber: '#010',
            orderType: 'DELIVERY',
            orderSource: 'WEBSITE',
            status: 'DISPATCHED',
            subtotal: 150,
            taxAmount: 16.07,
            discountAmount: 0,
            netTotal: 150,
            paymentStatus: 'PAID',
            totalPaid: 150,
            riderName: 'Juan Dela Cruz',
            riderPlate: 'ABC 1234',
            riderVehicle: 'Motorcycle',
            trackingLink: 'https://track.example.com/1',
            createdAt: new Date('2026-11-07T04:00:00Z'),
            items: [],
            payments: [],
            discounts: []
        } as unknown as Parameters<typeof generateTextReceipt>[0];

        const mockStoreSetting = {
            storeName: 'Basta Kape',
            address: 'Manila',
            contactNumber: '09171234567'
        } as unknown as Parameters<typeof generateTextReceipt>[1];

        const textReceipt = generateTextReceipt(mockOrder, mockStoreSetting);
        expect(textReceipt).toContain('Juan Dela Cruz');
        expect(textReceipt).toContain('ABC 1234');
        expect(textReceipt).toContain('Motorcycle');

        const htmlReceipt = generateHtmlReceipt(mockOrder, mockStoreSetting);
        expect(htmlReceipt).toContain('Juan Dela Cruz');
        expect(htmlReceipt).toContain('ABC 1234');
        expect(htmlReceipt).toContain('Motorcycle');
        expect(htmlReceipt).not.toContain('Payment Not Confirmed');
    });

    it('displays "Payment Not Confirmed" and hides payment details in receipts when payment is not confirmed yet', async () => {
        const unpaidOrder = {
            id: '12345678-1234-1234-1234-123456789012',
            queueNumber: '#011',
            orderType: 'DELIVERY',
            orderSource: 'WEBSITE',
            status: 'PENDING',
            subtotal: 150,
            taxAmount: 16.07,
            discountAmount: 0,
            netTotal: 150,
            paymentStatus: 'UNPAID',
            totalPaid: 0,
            createdAt: new Date('2026-11-07T04:00:00Z'),
            items: [],
            payments: [
                {
                    id: 'pay-1',
                    paymentMethod: 'GCASH',
                    amount: 150,
                    paymentReferenceNumber: '1234567890123'
                }
            ],
            discounts: []
        } as unknown as Parameters<typeof generateTextReceipt>[0];

        const mockStoreSetting = {
            storeName: 'Basta Kape',
            address: 'Manila',
            contactNumber: '09171234567'
        } as unknown as Parameters<typeof generateTextReceipt>[1];

        const textReceipt = generateTextReceipt(unpaidOrder, mockStoreSetting);
        expect(textReceipt).toContain('Payment Not Confirmed');
        expect(textReceipt).not.toContain('1234567890123');

        const htmlReceipt = generateHtmlReceipt(unpaidOrder, mockStoreSetting);
        expect(htmlReceipt).toContain('Payment Not Confirmed');
        expect(htmlReceipt).not.toContain('1234567890123');

        const pdfBuffer = await generatePdfReceipt(unpaidOrder, mockStoreSetting);
        expect(pdfBuffer.length).toBeGreaterThan(0);

        const paidOrder = {
            ...unpaidOrder,
            paymentStatus: PaymentStatus.PAID,
            totalPaid: 150
        };
        const paidTextReceipt = generateTextReceipt(paidOrder, mockStoreSetting);
        expect(paidTextReceipt).not.toContain('Payment Not Confirmed');
        expect(paidTextReceipt).toContain('1234567890123');

        const paidHtmlReceipt = generateHtmlReceipt(paidOrder, mockStoreSetting);
        expect(paidHtmlReceipt).not.toContain('Payment Not Confirmed');
        expect(paidHtmlReceipt).toContain('1234567890123');
    });

    it('allows the customer who placed the order to mark a DISPATCHED delivery order as COMPLETED', async () => {
        mockRepo.getOrderById
            .mockResolvedValueOnce({
                id: 'order-deliv-1',
                queueNumber: '#005',
                orderType: 'DELIVERY',
                status: 'DISPATCHED',
                customerId: 'cust-1'
            })
            .mockResolvedValueOnce({
                id: 'order-deliv-1',
                queueNumber: '#005',
                orderType: 'DELIVERY',
                status: 'COMPLETED',
                customerId: 'cust-1'
            });
        vi.mocked(prisma.customer.findFirst).mockResolvedValue({
            id: 'cust-1',
            userId: 'user-1'
        } as unknown as Awaited<ReturnType<typeof prisma.customer.findFirst>>);
        mockRepo.updateOrderStatus.mockResolvedValue({
            id: 'order-deliv-1',
            status: 'COMPLETED'
        });

        const res = await service.completeDeliveryOrderByCustomer('order-deliv-1', 'user-1');

        expect(mockRepo.updateOrderStatus).toHaveBeenCalledWith(
            'order-deliv-1',
            OrderStatus.COMPLETED,
            'Order received and marked as completed by customer',
            'user-1'
        );
        expect(res.status).toBe('COMPLETED');
    });

    it('rejects completeDeliveryOrderByCustomer when order is not in DISPATCHED status', async () => {
        mockRepo.getOrderById.mockResolvedValue({
            id: 'order-deliv-1',
            queueNumber: '#005',
            orderType: 'DELIVERY',
            status: 'READY',
            customerId: 'cust-1'
        });
        vi.mocked(prisma.customer.findFirst).mockResolvedValue({
            id: 'cust-1',
            userId: 'user-1'
        } as unknown as Awaited<ReturnType<typeof prisma.customer.findFirst>>);

        await expect(service.completeDeliveryOrderByCustomer('order-deliv-1', 'user-1')).rejects.toThrow(
            'Order can only be marked as completed once it has been dispatched.'
        );
    });

    it('auto-completes dispatched delivery orders older than 2 days via autoCompleteDispatchedOrders', async () => {
        const now = new Date('2026-11-07T06:00:00Z');
        const expectedCutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

        mockRepo.findStaleDispatchedOrders.mockResolvedValue([
            { id: 'stale-order-1', queueNumber: '#012' },
            { id: 'stale-order-2', queueNumber: '#013' }
        ]);
        mockRepo.autoCompleteDispatchedOrder.mockResolvedValue({});

        const result = await service.autoCompleteDispatchedOrders(now);

        expect(mockRepo.findStaleDispatchedOrders).toHaveBeenCalledWith(expectedCutoff);
        expect(mockRepo.autoCompleteDispatchedOrder).toHaveBeenCalledTimes(2);
        expect(mockRepo.autoCompleteDispatchedOrder).toHaveBeenCalledWith(
            'stale-order-1',
            'Automatically completed after 2 days in Dispatched status'
        );
        expect(mockRepo.autoCompleteDispatchedOrder).toHaveBeenCalledWith(
            'stale-order-2',
            'Automatically completed after 2 days in Dispatched status'
        );
        expect(result).toEqual({
            count: 2,
            orderIds: ['stale-order-1', 'stale-order-2']
        });
    });
});
