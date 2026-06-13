import { PurchaseOrderRepository } from './purchase-order.repository';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { NotFoundException, BadRequestException } from '@/exceptions';
import { PurchaseOrderStatus } from '@prisma/client';
import { TCreatePurchaseOrder } from './purchase-order.types';
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
        for (const item of data.items) {
            const ingredient = await prisma.ingredient.findFirst({
                where: { id: item.ingredientId, deletedAt: null }
            });
            if (!ingredient) {
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
}
