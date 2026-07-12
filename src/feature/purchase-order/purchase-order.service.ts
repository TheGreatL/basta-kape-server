import { PurchaseOrderRepository } from './purchase-order.repository';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { NotFoundException, BadRequestException } from '@/exceptions';
import { PurchaseOrderStatus } from '@prisma/client';
import { TCreatePurchaseOrder, TUpdatePurchaseOrder } from './purchase-order.types';
import { prisma } from '@/lib/prisma';

export class PurchaseOrderService {
    private repository: PurchaseOrderRepository;
    private activityLogService: ActivityLogService;

    constructor() {
        this.repository = new PurchaseOrderRepository();
        this.activityLogService = new ActivityLogService();
    }

    async createPurchaseOrder(data: TCreatePurchaseOrder, actorId: string) {
        // 1. Validate Supplier exists
        const supplier = await prisma.supplier.findFirst({
            where: { id: data.supplierId, deletedAt: null }
        });
        if (!supplier) {
            throw new NotFoundException('Supplier not found');
        }

        // 2. Validate all Ingredients exist
        const ingredientIds = Array.from(new Set(data.items.map((item) => item.ingredientId)));
        const ingredients = await prisma.ingredient.findMany({
            where: { id: { in: ingredientIds }, deletedAt: null }
        });
        const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

        for (const item of data.items) {
            if (!ingredientMap.has(item.ingredientId)) {
                throw new NotFoundException(`Ingredient with ID ${item.ingredientId} not found`);
            }
        }

        const po = await this.repository.createPurchaseOrder(data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Purchase Order',
            details: `Drafted Purchase Order ${po.poNumber} for supplier ${supplier.name} with total value PHP ${po.totalAmount.toFixed(2)}.`
        });

        return po;
    }

    async getPurchaseOrderById(id: string) {
        const po = await this.repository.getPurchaseOrderById(id);
        if (!po) {
            throw new NotFoundException('Purchase Order not found');
        }
        return po;
    }

    async getPurchaseOrderList(params: {
        page: number;
        limit: number;
        search?: string;
        status?: PurchaseOrderStatus;
        supplierId?: string;
        dateFrom?: string;
        dateTo?: string;
    }) {
        return this.repository.getPurchaseOrderList(params);
    }

    async updatePurchaseOrderStatus(id: string, status: PurchaseOrderStatus, actorId: string) {
        const po = await this.repository.getPurchaseOrderById(id);
        if (!po) {
            throw new NotFoundException('Purchase Order not found');
        }

        // Validate state transitions
        const current = po.status;

        if (current === PurchaseOrderStatus.RECEIVED || current === PurchaseOrderStatus.CANCELLED) {
            throw new BadRequestException(`Cannot change status of a completed/cancelled purchase order. Current status: ${current}`);
        }

        if (status === PurchaseOrderStatus.SENT && current !== PurchaseOrderStatus.DRAFT) {
            throw new BadRequestException('Can only send a purchase order that is in DRAFT state');
        }

        if (status === PurchaseOrderStatus.RECEIVED && current !== PurchaseOrderStatus.SENT) {
            throw new BadRequestException('Can only mark as RECEIVED a purchase order that is in SENT state');
        }

        const updatedPo = await this.repository.updatePurchaseOrderStatus(id, status, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Purchase Order Status',
            details: `Transitioned Purchase Order ${po.poNumber} status from ${current} to ${status}.`
        });

        return updatedPo;
    }

    async updatePurchaseOrder(id: string, data: TUpdatePurchaseOrder, actorId: string) {
        // 1. Get existing PO to check status and check if it exists
        const po = await this.repository.getPurchaseOrderById(id);
        if (!po) {
            throw new NotFoundException('Purchase Order not found');
        }

        if (po.status !== PurchaseOrderStatus.DRAFT) {
            throw new BadRequestException(`Cannot update a purchase order that is not in DRAFT status. Current status: ${po.status}`);
        }

        // 2. Validate Supplier if provided
        let supplierName = po.supplier.name;
        if (data.supplierId && data.supplierId !== po.supplierId) {
            const supplier = await prisma.supplier.findFirst({
                where: { id: data.supplierId, deletedAt: null }
            });
            if (!supplier) {
                throw new NotFoundException('Supplier not found');
            }
            supplierName = supplier.name;
        }

        // 3. Validate Ingredients if items are provided
        if (data.items) {
            const ingredientIds = Array.from(new Set(data.items.map((item) => item.ingredientId)));
            const ingredients = await prisma.ingredient.findMany({
                where: { id: { in: ingredientIds }, deletedAt: null }
            });
            const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

            for (const item of data.items) {
                if (!ingredientMap.has(item.ingredientId)) {
                    throw new NotFoundException(`Ingredient with ID ${item.ingredientId} not found`);
                }
            }
        }

        // 4. Update in repository
        const updatedPo = await this.repository.updatePurchaseOrder(id, data);

        // 5. Log activity
        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Purchase Order',
            details: `Updated Purchase Order ${po.poNumber} for supplier ${supplierName}. New total value: PHP ${updatedPo.totalAmount.toFixed(2)}.`
        });

        return updatedPo;
    }
}
