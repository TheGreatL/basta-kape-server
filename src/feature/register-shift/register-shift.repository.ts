import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { BaseRepository } from '@/repository/base.repository';
import type { TOpenShift, TCloseShift, TGetRegisterShiftListQuery } from './register-shift.types';

export class RegisterShiftRepository extends BaseRepository {
    private cashierSelect = {
        select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
        }
    };

    async findActiveShift(cashierId: string) {
        return prisma.registerShift.findFirst({
            where: {
                cashierId,
                closedAt: null
            },
            include: {
                cashier: this.cashierSelect
            }
        });
    }

    async openShift(cashierId: string, data: TOpenShift) {
        return prisma.registerShift.create({
            data: {
                cashierId,
                startBalance: data.startBalance,
                notes: data.notes ?? null
            },
            include: {
                cashier: this.cashierSelect
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
            },
            include: {
                cashier: this.cashierSelect
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

    async listShifts(params?: TGetRegisterShiftListQuery, cashierId?: string) {
        const { skip, take, page } = this.normalizePagination(params);

        const where: Prisma.RegisterShiftWhereInput = {};

        if (cashierId) {
            where.cashierId = cashierId;
        }

        if (params?.search) {
            const searchLower = params.search.toLowerCase();
            if (cashierId) {
                // Cashier is already locked, so search filters notes directly
                where.notes = { contains: searchLower };
            } else {
                where.OR = [
                    { notes: { contains: searchLower } },
                    {
                        cashier: {
                            OR: [
                                { username: { contains: searchLower } },
                                { firstName: { contains: searchLower } },
                                { lastName: { contains: searchLower } }
                            ]
                        }
                    }
                ];
            }
        }

        const [data, totalRows] = await Promise.all([
            prisma.registerShift.findMany({
                where,
                skip,
                take,
                include: {
                    cashier: this.cashierSelect
                },
                orderBy: {
                    openedAt: 'desc'
                }
            }),
            prisma.registerShift.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }
}
