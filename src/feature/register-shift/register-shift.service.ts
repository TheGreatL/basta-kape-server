import { RegisterShiftRepository } from './register-shift.repository';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { NotFoundException, ConflictException } from '@/exceptions';
import type { TOpenShift, TCloseShift, TGetRegisterShiftListQuery } from './register-shift.types';

type RegisterShiftServiceConstructor = {
    registerShiftRepository?: RegisterShiftRepository;
    activityLogService?: ActivityLogService;
};

export class RegisterShiftService {
    private repository: RegisterShiftRepository;
    private activityLogService: ActivityLogService;

    constructor(deps: RegisterShiftServiceConstructor = {}) {
        this.repository = deps.registerShiftRepository ?? new RegisterShiftRepository();
        this.activityLogService = deps.activityLogService ?? new ActivityLogService();
    }

    async getActiveShift(cashierId: string) {
        const activeShift = await this.repository.findActiveShift(cashierId);
        if (!activeShift) {
            throw new NotFoundException('No active register shift session found for this cashier.');
        }
        return activeShift;
    }

    async openShift(cashierId: string, data: TOpenShift, actorId: string) {
        const existing = await this.repository.findActiveShift(cashierId);
        if (existing) {
            throw new ConflictException('You already have an active register shift. Please close it before opening a new one.');
        }

        const shift = await this.repository.openShift(cashierId, data);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Open Register Shift',
            details: `Opened new register shift starting with balance of PHP ${data.startBalance.toFixed(2)}.`
        });

        return shift;
    }

    async closeShift(cashierId: string, data: TCloseShift, actorId: string) {
        const activeShift = await this.repository.findActiveShift(cashierId);
        if (!activeShift) {
            throw new NotFoundException('No active register shift session found to close.');
        }

        const cashSales = await this.repository.calculateShiftCashSales(activeShift.id);
        const endBalance = activeShift.startBalance + cashSales;

        const closedShift = await this.repository.closeShift(activeShift.id, data, endBalance);

        const difference = data.actualBalance - endBalance;
        const diffStr =
            difference === 0
                ? 'Balanced'
                : difference > 0
                  ? `Over by PHP ${difference.toFixed(2)}`
                  : `Short by PHP ${Math.abs(difference).toFixed(2)}`;

        await this.activityLogService.logActivity({
            actorId,
            title: 'Close Register Shift',
            details: `Closed register shift. Expected: PHP ${endBalance.toFixed(2)}, Actual: PHP ${data.actualBalance.toFixed(2)} (${diffStr}).`
        });

        return closedShift;
    }

    async getShifts(params?: TGetRegisterShiftListQuery, cashierId?: string) {
        return this.repository.listShifts(params, cashierId);
    }
}
