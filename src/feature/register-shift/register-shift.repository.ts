import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import type { TOpenShift, TCloseShift } from './register-shift.types';

export class RegisterShiftRepository extends BaseRepository {
    async findActiveShift(cashierId: string) {
        return prisma.registerShift.findFirst({
            where: {
                cashierId,
                closedAt: null
            }
        });
    }

    async openShift(cashierId: string, data: TOpenShift) {
        return prisma.registerShift.create({
            data: {
                cashierId,
                startBalance: data.startBalance,
                notes: data.notes ?? null
            }
        });
    }

    async closeShift(shiftId: string, data: TCloseShift, endBalance: number) {
        return prisma.registerShift.update({
            where: { id: shiftId },
            data: {
                closedAt: new Date(),
                endBalance,
                actualBalance: data.actualBalance,
                notes: data.notes ?? null
            }
        });
    }

    async calculateShiftCashSales(shiftId: string): Promise<number> {
        const payments = await prisma.orderPayment.findMany({
            where: {
                paymentMethod: 'CASH',
                paymentStatus: 'PAID',
                order: {
                    cashierSessionId: shiftId
                }
            },
            select: {
                amount: true
            }
        });
        return payments.reduce((sum, p) => sum + p.amount, 0);
    }
}
