import { VoidRepository } from './void.repository';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@/exceptions';
import { OrderStatus } from '@prisma/client';

type VoidServiceConstructor = {
    voidRepository?: VoidRepository;
    activityLogService?: ActivityLogService;
};

export class VoidService {
    private repository: VoidRepository;
    private activityLogService: ActivityLogService;

    constructor(deps: VoidServiceConstructor = {}) {
        this.repository = deps.voidRepository ?? new VoidRepository();
        this.activityLogService = deps.activityLogService ?? new ActivityLogService();
    }

    async voidOrder(orderId: string, reason: string, actorId: string) {
        // 1. Verify order exists
        const order = await this.repository.findOrderById(orderId);
        if (!order) {
            throw new NotFoundException('Order not found');
        }

        // 2. Block voiding if order status is already CANCELLED or COMPLETED
        if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.COMPLETED) {
            throw new BadRequestException('Cannot void an order that is already completed or cancelled.');
        }

        // 3. Verify authorizing user (actorId) has role 'Manager', 'Supervisor', 'Administrator', or 'Owner'
        const user = await this.repository.findUserWithRoles(actorId);
        if (!user) {
            throw new ForbiddenException('User not found.');
        }

        const roleNames = user.userRoles.map((ur) => ur.role.name);
        const hasRequiredRole = roleNames.some((roleName) => ['manager', 'supervisor', 'administrator', 'owner'].includes(roleName.toLowerCase()));

        if (!hasRequiredRole) {
            throw new ForbiddenException('Insufficient permissions. Managers, supervisors, or administrators override required.');
        }

        // 4. Run the transaction via repository to void the order and record logs
        const voidLog = await this.repository.createVoidLog(orderId, reason, actorId);

        // 5. Log activity
        await this.activityLogService.logActivity({
            actorId,
            title: 'Void Order',
            details: `Voided order ${order.queueNumber ?? orderId}. Reason: ${reason}`
        });

        return voidLog;
    }

    async getVoidLogs() {
        return this.repository.listVoidLogs();
    }
}
