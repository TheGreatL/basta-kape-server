import { OrderRepository } from './order.repository';
import { StoreSettingsService } from '@/feature/store-settings/store-settings.service';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { prisma } from '@/lib/prisma';
import { NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@/exceptions';
import type { TCreateOrder, TGetOrderListQuery, TUpdateOrderCourier } from './order.types';
import { OrderStatus, StoreSetting, Prisma } from '@prisma/client';
import { generateHtmlReceipt, generateTextReceipt, generatePdfReceipt } from './receipt.template';

type OrderServiceConstructor = {
    orderRepository?: OrderRepository;
    storeSettingsService?: StoreSettingsService;
    activityLogService?: ActivityLogService;
};

export class OrderService {
    private repository: OrderRepository;
    private storeSettingsService: StoreSettingsService;
    private activityLogService: ActivityLogService;

    constructor(deps: OrderServiceConstructor = {}) {
        this.repository = deps.orderRepository ?? new OrderRepository();
        this.storeSettingsService = deps.storeSettingsService ?? new StoreSettingsService();
        this.activityLogService = deps.activityLogService ?? new ActivityLogService();
    }

    async getOrderList(params: TGetOrderListQuery) {
        return this.repository.getOrderList(params);
    }

    async getOrderQueueCount() {
        return this.repository.getOrderQueueCount();
    }

    async getOrderById(id: string) {
        const order = await this.repository.getOrderById(id);
        if (!order) {
            throw new NotFoundException('Order not found');
        }
        return order;
    }

    async createOrder(data: TCreateOrder, actorId: string) {
        // Fetch active settings to get VAT rate
        const settings = await this.storeSettingsService.getActiveSettings();
        const vatRate = settings?.vatRate ?? 12.0;

        // Resolve and calculate pricing for each item
        const itemDetails: {
            productVariantId: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
            notes?: string | null;
            modifiers?: {
                modifierOptionId: string;
                price: number;
            }[];
        }[] = [];

        let calculatedSubtotal = 0;

        const variantIds = [...new Set(data.items.map((item) => item.productVariantId))];
        const variants = await prisma.productVariant.findMany({
            where: { id: { in: variantIds }, deletedAt: null },
            include: {
                product: {
                    include: {
                        modifierGroups: {
                            where: { deletedAt: null },
                            include: {
                                options: {
                                    where: { deletedAt: null }
                                }
                            }
                        }
                    }
                }
            }
        });

        const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
        const modifierOptionIds = Array.from(new Set(data.items.flatMap((item) => item.modifierOptionIds ?? [])));

        const selectedOptions = modifierOptionIds.length
            ? await prisma.modifierOption.findMany({
                  where: {
                      id: { in: modifierOptionIds },
                      deletedAt: null
                  }
              })
            : [];

        const modifierOptionMap = new Map(selectedOptions.map((option) => [option.id, option]));

        for (const item of data.items) {
            const variant = variantMap.get(item.productVariantId);

            if (!variant) {
                throw new NotFoundException(`Product variant with ID "${item.productVariantId}" not found or disabled.`);
            }

            const product = variant.product;
            if (!product || product.deletedAt !== null) {
                throw new NotFoundException(`Product not found for variant.`);
            }

            const itemModifierOptionIds = item.modifierOptionIds ?? [];
            const selectedOptionsForItem = itemModifierOptionIds.map((id) => {
                const option = modifierOptionMap.get(id);
                if (!option) {
                    throw new NotFoundException(`Modifier option with ID "${id}" does not exist or is disabled.`);
                }
                return option;
            });

            for (const opt of selectedOptionsForItem) {
                const belongsToGroup = product.modifierGroups.some((g) => g.id === opt.modifierGroupId);
                if (!belongsToGroup) {
                    throw new BadRequestException(`Modifier option "${opt.name}" is not applicable to product "${product.name}".`);
                }
            }

            for (const group of product.modifierGroups) {
                const selections = selectedOptionsForItem.filter((o) => o.modifierGroupId === group.id);
                const count = selections.length;

                if (group.isRequired && count === 0) {
                    throw new BadRequestException(`Modifier group "${group.name}" is required.`);
                }
                if (count < group.minSelect) {
                    throw new BadRequestException(`Modifier group "${group.name}" requires at least ${group.minSelect} selections.`);
                }
                if (count > group.maxSelect) {
                    throw new BadRequestException(`Modifier group "${group.name}" allows at most ${group.maxSelect} selections.`);
                }
            }

            const optionsPrice = selectedOptionsForItem.reduce((sum, opt) => sum + opt.price, 0);
            const unitPrice = variant.price + optionsPrice;
            const totalPrice = unitPrice * item.quantity;
            calculatedSubtotal += totalPrice;

            itemDetails.push({
                productVariantId: item.productVariantId,
                quantity: item.quantity,
                unitPrice,
                totalPrice,
                notes: item.notes,
                modifiers: selectedOptionsForItem.map((o) => ({
                    modifierOptionId: o.id,
                    price: o.price
                }))
            });
        }

        // Apply calculations
        const netTotal = calculatedSubtotal;
        const taxAmount = Math.round(netTotal * (vatRate / (100 + vatRate)) * 100) / 100;

        // Generate Daily Queue Number
        const countToday = await this.repository.getOrdersCountToday();
        const queueNumber = `#${String(countToday + 1).padStart(3, '0')}`;

        // Check if GCASH reference number already exists
        if (data.paymentMethod === 'GCASH' && data.paymentReferenceNumber) {
            const existingPayment = await prisma.orderPayment.findFirst({
                where: {
                    paymentMethod: 'GCASH',
                    paymentReferenceNumber: data.paymentReferenceNumber.trim()
                }
            });
            if (existingPayment) {
                throw new ConflictException(
                    'GCash reference number already exists. A payment with this reference number already exists for this payment method.'
                );
            }
        }

        // Create the order in DB
        let paymentDetails = data.paymentMethod
            ? {
                  paymentMethod: data.paymentMethod,
                  paymentReferenceNumber: data.paymentReferenceNumber ? data.paymentReferenceNumber.trim() : null,
                  paymentProofPhoto: data.paymentProofPhoto
              }
            : null;
        if (data.paymentMethod === 'CASH') {
            paymentDetails = null;
        }
        let order;
        try {
            order = await this.repository.createOrder({
                queueNumber,
                buzzerId: data.buzzerId,
                orderType: data.orderType,
                orderSource: data.orderSource,
                notes: data.notes,
                subtotal: calculatedSubtotal,
                taxAmount,
                netTotal,
                customerId: data.customerId,
                customerName: data.customerName,
                riderName: data.riderName?.trim() || null,
                riderPlate: data.riderPlate?.trim() || null,
                riderVehicle: data.riderVehicle || null,
                trackingLink: data.trackingLink?.trim() || null,
                actorId,
                items: itemDetails,
                paymentDetails
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException(
                    'GCash reference number already exists. A payment with this reference number already exists for this payment method.'
                );
            }
            throw error;
        }

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Order',
            details: `Created new order ${queueNumber} via ${data.orderSource}. Subtotal: PHP ${calculatedSubtotal.toFixed(2)}, Net Total: PHP ${netTotal.toFixed(2)}.`
        });

        return order;
    }

    async updateOrderStatus(orderId: string, status: OrderStatus, notes: string | null, actorId: string) {
        const order = await this.getOrderById(orderId);

        if (status === OrderStatus.DISPATCHED) {
            if (order.orderType !== 'DELIVERY') {
                throw new BadRequestException('Only delivery orders can be marked as Dispatched.');
            }
            if (!order.riderName || !order.riderPlate || !order.riderVehicle || !order.trackingLink) {
                throw new BadRequestException('Cannot dispatch delivery order until courier details are submitted by the customer.');
            }
        }

        // RBAC Workflow Validation:
        // Barista (Order Queue: update) is responsible for: PREPARING, READY, DISPATCHED
        // Cashier (Sales Management: create / Orders Management: update) is responsible for: COMPLETED, APPROVED, CANCELLED, DISPATCHED
        if (actorId) {
            const actor = await prisma.user.findFirst({
                where: { id: actorId, deletedAt: null },
                include: {
                    role: {
                        include: {
                            rolePermissions: {
                                where: { deletedAt: null },
                                include: {
                                    modulePermission: {
                                        include: {
                                            module: true,
                                            permission: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (actor?.role) {
                const roleName = actor.role.name;
                const permissions = actor.role.rolePermissions.map((rp) => ({
                    module: rp.modulePermission.module.name,
                    permission: rp.modulePermission.permission.name
                }));

                const hasPerm = (moduleName: string, permName: string) =>
                    permissions.some(
                        (p) => p.module.toLowerCase() === moduleName.toLowerCase() && p.permission.toLowerCase() === permName.toLowerCase()
                    );

                const isSuperOrAdmin = roleName === 'Owner' || roleName === 'Administrator' || actor.role.isSystem;

                if (!isSuperOrAdmin) {
                    if (status === OrderStatus.PREPARING || status === OrderStatus.READY) {
                        const canUpdateQueue = hasPerm('Order Queue', 'update');
                        if (!canUpdateQueue) {
                            throw new ForbiddenException(
                                'Only kitchen/barista staff with Order Queue update permission can update orders to Preparing or Ready.'
                            );
                        }
                    } else if (status === OrderStatus.DISPATCHED) {
                        const canDispatch =
                            hasPerm('Order Queue', 'update') || hasPerm('Orders Management', 'update') || hasPerm('Sales Management', 'create');
                        if (!canDispatch) {
                            throw new ForbiddenException('You do not have permission to mark delivery orders as Dispatched.');
                        }
                    } else if (status === OrderStatus.COMPLETED) {
                        const canComplete = hasPerm('Sales Management', 'create') || hasPerm('Orders Management', 'update');
                        if (!canComplete) {
                            throw new ForbiddenException('Only cashier staff with Sales Management permission can mark orders as Completed.');
                        }
                    }
                }
            }
        }

        const updated = await this.repository.updateOrderStatus(orderId, status, notes, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Order Status',
            details: `Updated order status for ${order.queueNumber ?? orderId}: ${order.status} -> ${status}.`
        });

        return updated;
    }

    async updateOrderCourier(orderId: string, data: TUpdateOrderCourier, actorId: string) {
        const order = await this.getOrderById(orderId);

        if (order.orderType !== 'DELIVERY') {
            throw new BadRequestException('Courier details can only be submitted for delivery orders.');
        }

        const customer = await prisma.customer.findFirst({
            where: { userId: actorId, deletedAt: null }
        });

        if (!customer || (order.customerId && order.customerId !== customer.id)) {
            throw new ForbiddenException('Only the customer who placed this order can submit courier details.');
        }

        if (order.status !== OrderStatus.READY) {
            throw new BadRequestException('Courier details can only be submitted when the order is Ready for Pickup.');
        }

        const updated = await this.repository.updateOrderCourier(orderId, {
            riderName: data.riderName.trim(),
            riderPlate: data.riderPlate.trim(),
            riderVehicle: data.riderVehicle,
            trackingLink: data.trackingLink.trim()
        });

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Delivery Courier Details',
            details: `Customer submitted courier details for ${order.queueNumber ?? orderId} (Rider: ${data.riderName.trim()}, Plate: ${data.riderPlate.trim()}, Vehicle: ${data.riderVehicle}).`
        });

        return updated;
    }

    async completeDeliveryOrderByCustomer(orderId: string, actorId: string) {
        const order = await this.getOrderById(orderId);

        if (order.orderType !== 'DELIVERY') {
            throw new BadRequestException('Only delivery orders can be marked as completed by the customer.');
        }

        const customer = await prisma.customer.findFirst({
            where: { userId: actorId, deletedAt: null }
        });

        if (!customer || (order.customerId && order.customerId !== customer.id)) {
            throw new ForbiddenException('Only the customer who placed this order can mark it as completed.');
        }

        if (order.status !== OrderStatus.DISPATCHED) {
            throw new BadRequestException('Order can only be marked as completed once it has been dispatched.');
        }

        await this.repository.updateOrderStatus(orderId, OrderStatus.COMPLETED, 'Order received and marked as completed by customer', actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Customer Completed Delivery Order',
            details: `Customer confirmed receipt and completed delivery order ${order.queueNumber ?? orderId}.`
        });

        return this.getOrderById(orderId);
    }

    async autoCompleteDispatchedOrders(now: Date = new Date()) {
        const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
        const cutoffDate = new Date(now.getTime() - twoDaysInMs);

        const staleOrders = await this.repository.findStaleDispatchedOrders(cutoffDate);
        const completedOrderIds: string[] = [];

        for (const staleOrder of staleOrders) {
            await this.repository.autoCompleteDispatchedOrder(staleOrder.id, 'Automatically completed after 2 days in Dispatched status');

            await this.activityLogService.logActivity({
                actorId: null,
                title: 'Auto-Complete Dispatched Order',
                details: `System automatically marked dispatched delivery order ${staleOrder.queueNumber ?? staleOrder.id} as COMPLETED after 2 days.`
            });

            completedOrderIds.push(staleOrder.id);
        }

        return {
            count: completedOrderIds.length,
            orderIds: completedOrderIds
        };
    }

    async generateOrderReceipt(orderId: string, format: 'html' | 'text' | 'pdf' | 'json') {
        const order = await this.getOrderById(orderId);
        const storeSetting = await this.storeSettingsService.getActiveSettings();

        const typedOrder = order as unknown as Parameters<typeof generateHtmlReceipt>[0];
        const typedStoreSetting = storeSetting as unknown as StoreSetting;

        if (format === 'json') {
            return { order, storeSetting };
        } else if (format === 'text') {
            return generateTextReceipt(typedOrder, typedStoreSetting);
        } else if (format === 'pdf') {
            return generatePdfReceipt(typedOrder, typedStoreSetting);
        } else {
            return generateHtmlReceipt(typedOrder, typedStoreSetting);
        }
    }
}
