import { OrderRepository } from './order.repository';
import { StoreSettingsService } from '@/feature/store-settings/store-settings.service';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { prisma } from '@/lib/prisma';
import { NotFoundException, BadRequestException, ConflictException } from '@/exceptions';
import type { TCreateOrder, TGetOrderListQuery } from './order.types';
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

        // Create the order in DB
        let paymentDetails = data.paymentMethod
            ? {
                  paymentMethod: data.paymentMethod,
                  paymentReferenceNumber: data.paymentReferenceNumber,
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
                actorId,
                items: itemDetails,
                paymentDetails
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException('A payment with this reference number already exists for this payment method.');
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

        const updated = await this.repository.updateOrderStatus(orderId, status, notes, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Order Status',
            details: `Updated order status for ${order.queueNumber ?? orderId}: ${order.status} -> ${status}.`
        });

        return updated;
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
