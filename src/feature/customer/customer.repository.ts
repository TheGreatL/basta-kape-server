import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { IPaginatedResult } from '@/types/base.types';
import type { TCreateCustomer, TUpdateCustomer, TGetCustomerListQuery, TGetCustomerOrdersQuery } from './customer.types';
import { formatOrdersWithReference } from '../order/order.utils';

const SALT_ROUNDS = 12;

const productVariantInclude = {
    product: {
        include: {
            category: { select: { id: true, name: true } },
            type: { select: { id: true, name: true } }
        }
    },
    attributes: {
        where: { deletedAt: null },
        include: {
            attributeValue: {
                include: {
                    attribute: {
                        select: { id: true, name: true }
                    }
                }
            }
        }
    }
};

export class CustomerRepository extends BaseRepository {
    /**
     * Checks if email or username is already taken.
     */
    async findConflict(email: string, username: string) {
        return prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }],
                deletedAt: null
            },
            select: { email: true, username: true }
        });
    }

    /**
     * Creates a new User with the Customer role, and a corresponding Customer record.
     */
    async createCustomer(data: TCreateCustomer) {
        const passwordToHash = data.password || 'WelcomeCustomer123!';
        const hashedPassword = await bcrypt.hash(passwordToHash, SALT_ROUNDS);

        const customerRole = await prisma.role.findFirst({
            where: { name: 'Customer', deletedAt: null }
        });

        return prisma.$transaction(async (tx) => {
            const userData: Prisma.UserCreateInput = {
                email: data.email,
                username: data.username,
                password: hashedPassword,
                firstName: data.firstName,
                lastName: data.lastName,
                middleName: data.middleName || null,
                phoneNumber: data.phoneNumber || null
            };

            if (customerRole) {
                userData.userRoles = {
                    create: {
                        roleId: customerRole.id
                    }
                };
            }

            const user = await tx.user.create({
                data: userData
            });

            const customer = await tx.customer.create({
                data: {
                    userId: user.id
                },
                include: {
                    user: true
                }
            });

            return customer;
        });
    }

    /**
     * Updates customer's user fields.
     */
    async updateCustomer(id: string, data: TUpdateCustomer) {
        const customer = await prisma.customer.findUniqueOrThrow({
            where: { id }
        });

        const userUpdateData: Prisma.UserUpdateInput = {};
        if (data.email !== undefined) userUpdateData.email = data.email;
        if (data.username !== undefined) userUpdateData.username = data.username;
        if (data.firstName !== undefined) userUpdateData.firstName = data.firstName;
        if (data.lastName !== undefined) userUpdateData.lastName = data.lastName;
        if (data.middleName !== undefined) userUpdateData.middleName = data.middleName;
        if (data.phoneNumber !== undefined) userUpdateData.phoneNumber = data.phoneNumber;

        return prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: customer.userId },
                data: userUpdateData
            });

            const updatedCustomer = await tx.customer.findUniqueOrThrow({
                where: { id },
                include: {
                    user: true
                }
            });

            return updatedCustomer;
        });
    }

    /**
     * Soft-deletes a Customer and the associated User.
     */
    async softDeleteCustomer(id: string) {
        const customer = await prisma.customer.findUniqueOrThrow({
            where: { id }
        });

        return prisma.$transaction(async (tx) => {
            const now = new Date();

            await tx.customer.update({
                where: { id },
                data: { deletedAt: now }
            });

            await tx.user.update({
                where: { id: customer.userId },
                data: { deletedAt: now }
            });
        });
    }

    /**
     * Restores a soft-deleted Customer and their associated User.
     */
    async restoreCustomer(id: string) {
        const customer = await prisma.customer.findUniqueOrThrow({
            where: { id }
        });

        return prisma.$transaction(async (tx) => {
            await tx.customer.update({
                where: { id },
                data: { deletedAt: null }
            });

            await tx.user.update({
                where: { id: customer.userId },
                data: { deletedAt: null }
            });
        });
    }

    /**
     * Finds a single customer by ID (customer ID, user ID, or username).
     */
    async findCustomerById(id: string) {
        return prisma.customer.findFirst({
            where: {
                OR: [{ id }, { userId: id }, { user: { username: id } }],
                deletedAt: null
            },
            include: {
                user: true
            }
        });
    }

    /**
     * Finds a single customer by ID (customer ID, user ID, or username), including soft-deleted ones.
     */
    async findCustomerByIdIncludingDeleted(id: string) {
        return prisma.customer.findFirst({
            where: {
                OR: [{ id }, { userId: id }, { user: { username: id } }]
            },
            include: {
                user: true
            }
        });
    }

    /**
     * Retrieves a paginated list of customers.
     */
    async getCustomerList(params: TGetCustomerListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);

        const where: Prisma.CustomerWhereInput = {};

        if (params.status === 'active') {
            where.deletedAt = null;
        } else if (params.status === 'archive') {
            where.deletedAt = { not: null };
        } else {
            where.deletedAt = null;
        }

        if (params.search) {
            const searchLower = params.search.toLowerCase();
            where.user = {
                OR: [
                    { email: { contains: searchLower } },
                    { username: { contains: searchLower } },
                    { firstName: { contains: searchLower } },
                    { lastName: { contains: searchLower } },
                    { phoneNumber: { contains: searchLower } }
                ]
            };
        }

        const [data, totalRows] = await Promise.all([
            prisma.customer.findMany({
                where,
                skip,
                take,
                orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
                include: {
                    user: true
                }
            }),
            prisma.customer.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    // ==========================================
    // CART OPERATIONS
    // ==========================================

    /**
     * Fetches all active cart items for a customer.
     */
    async getCart(customerId: string) {
        return prisma.customerCart.findMany({
            where: {
                customerId,
                deletedAt: null,
                productVariant: {
                    deletedAt: null
                }
            },
            include: {
                productVariant: {
                    include: productVariantInclude
                },
                cartModifiers: {
                    include: {
                        modifierOption: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Adds an item to the customer's cart. Increments quantity if an active item with exact same variant & modifiers exists; otherwise creates a separate cart item.
     */
    async addCartItem(customerId: string, productVariantId: string, quantity: number, unitPrice: number, modifierOptionIds: string[] = []) {
        const activeItems = await prisma.customerCart.findMany({
            where: {
                customerId,
                productVariantId,
                deletedAt: null
            },
            include: {
                cartModifiers: true
            }
        });

        const sortedIncoming = [...modifierOptionIds].sort();

        const matchingItem = activeItems.find((item) => {
            const existingModifierIds = item.cartModifiers.map((cm) => cm.modifierOptionId).sort();
            if (existingModifierIds.length !== sortedIncoming.length) return false;
            return existingModifierIds.every((id, idx) => id === sortedIncoming[idx]);
        });

        let cartItem: { id: string };

        if (matchingItem) {
            cartItem = await prisma.customerCart.update({
                where: { id: matchingItem.id },
                data: {
                    quantity: matchingItem.quantity + quantity,
                    unitPrice
                }
            });
        } else {
            cartItem = await prisma.customerCart.create({
                data: {
                    customerId,
                    productVariantId,
                    quantity,
                    unitPrice
                }
            });

            if (modifierOptionIds.length > 0) {
                await prisma.customerCartModifier.createMany({
                    data: modifierOptionIds.map((optId) => ({
                        customerCartId: cartItem.id,
                        modifierOptionId: optId
                    }))
                });
            }
        }

        // Fetch the final record with all includes
        return prisma.customerCart.findUnique({
            where: { id: cartItem.id },
            include: {
                productVariant: {
                    include: productVariantInclude
                },
                cartModifiers: {
                    include: {
                        modifierOption: true
                    }
                }
            }
        });
    }

    /**
     * Updates the quantity and/or modifiers of a specific cart item, merging duplicates if modifier changes match an existing active cart item.
     */
    async updateCartItem(customerId: string, cartItemId: string, data: { quantity?: number; modifierOptionIds?: string[] }) {
        return prisma.$transaction(async (tx) => {
            const targetItem = await tx.customerCart.findUniqueOrThrow({
                where: {
                    id: cartItemId,
                    customerId,
                    deletedAt: null
                }
            });

            if (data.quantity !== undefined) {
                await tx.customerCart.update({
                    where: { id: cartItemId },
                    data: { quantity: data.quantity }
                });
            }

            if (data.modifierOptionIds !== undefined) {
                await tx.customerCartModifier.deleteMany({
                    where: { customerCartId: cartItemId }
                });

                if (data.modifierOptionIds.length > 0) {
                    await tx.customerCartModifier.createMany({
                        data: data.modifierOptionIds.map((optId) => ({
                            customerCartId: cartItemId,
                            modifierOptionId: optId
                        }))
                    });
                }
            }

            // Check if another active cart item for this customer has exact same variant and modifier selection
            const allActiveForVariant = await tx.customerCart.findMany({
                where: {
                    customerId,
                    productVariantId: targetItem.productVariantId,
                    deletedAt: null
                },
                include: {
                    cartModifiers: true
                }
            });

            const currentModifiers = await tx.customerCartModifier.findMany({
                where: { customerCartId: cartItemId },
                select: { modifierOptionId: true }
            });
            const currentSortedMods = currentModifiers.map((cm) => cm.modifierOptionId).sort();

            const matchingOtherItems = allActiveForVariant.filter((item) => {
                if (item.id === cartItemId) return false;
                const otherSortedMods = item.cartModifiers.map((cm) => cm.modifierOptionId).sort();
                if (otherSortedMods.length !== currentSortedMods.length) return false;
                return otherSortedMods.every((id, idx) => id === currentSortedMods[idx]);
            });

            if (matchingOtherItems.length > 0) {
                const extraQuantity = matchingOtherItems.reduce((sum, item) => sum + item.quantity, 0);
                const otherItemIds = matchingOtherItems.map((item) => item.id);

                await tx.customerCart.update({
                    where: { id: cartItemId },
                    data: { quantity: { increment: extraQuantity } }
                });

                await tx.customerCart.updateMany({
                    where: { id: { in: otherItemIds } },
                    data: { deletedAt: new Date() }
                });
            }

            return tx.customerCart.findUniqueOrThrow({
                where: { id: cartItemId },
                include: {
                    productVariant: {
                        include: productVariantInclude
                    },
                    cartModifiers: {
                        include: {
                            modifierOption: true
                        }
                    }
                }
            });
        });
    }

    /**
     * Soft-deletes a specific cart item.
     */
    async removeCartItem(customerId: string, cartItemId: string) {
        return prisma.customerCart.update({
            where: {
                id: cartItemId,
                customerId,
                deletedAt: null
            },
            data: { deletedAt: new Date() }
        });
    }

    /**
     * Soft-deletes specific or all cart items for a customer.
     */
    async clearCart(customerId: string, cartItemIds?: string[]) {
        const where: Prisma.CustomerCartUpdateManyArgs['where'] = {
            customerId,
            deletedAt: null
        };

        if (cartItemIds && cartItemIds.length > 0) {
            where.id = { in: cartItemIds };
        }

        return prisma.customerCart.updateMany({
            where,
            data: { deletedAt: new Date() }
        });
    }

    /**
     * Finds a single active cart item by ID.
     */
    async findCartItemById(customerId: string, cartItemId: string) {
        return prisma.customerCart.findFirst({
            where: {
                id: cartItemId,
                customerId,
                deletedAt: null
            }
        });
    }

    /**
     * Retrieves a paginated list of orders for a specific customer.
     */
    async getCustomerOrders(customerId: string, params: TGetCustomerOrdersQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.OrderWhereInput = {
            customerId
        };

        if (params.status) {
            where.status = params.status;
        }

        if (params.search) {
            const searchTrimmed = params.search.trim();
            const refMatch = searchTrimmed.match(/^(\d{6}|\d{8})-(\d+)$/);
            if (refMatch) {
                const datePart = refMatch[1];
                const queuePart = refMatch[2];

                const yearStr = datePart.length === 6 ? datePart.slice(0, 2) : datePart.slice(0, 4);
                const monthStr = datePart.length === 6 ? datePart.slice(2, 4) : datePart.slice(4, 6);
                const dayStr = datePart.length === 6 ? datePart.slice(4, 6) : datePart.slice(6, 8);

                const yearNum = parseInt(datePart.length === 6 ? '20' + yearStr : yearStr, 10);
                const monthNum = parseInt(monthStr, 10) - 1;
                const dayNum = parseInt(dayStr, 10);

                const startOfDay = new Date(yearNum, monthNum, dayNum, 0, 0, 0, 0);
                const endOfDay = new Date(yearNum, monthNum, dayNum, 23, 59, 59, 999);

                where.createdAt = {
                    gte: startOfDay,
                    lte: endOfDay
                };
                where.queueNumber = `#${queuePart.padStart(3, '0')}`;
            } else {
                const searchLower = searchTrimmed.toLowerCase();
                where.OR = [
                    { id: { startsWith: searchLower } },
                    { queueNumber: { contains: searchTrimmed } },
                    { notes: { contains: searchLower } },
                    {
                        items: {
                            some: {
                                variant: {
                                    product: {
                                        name: { contains: searchLower }
                                    }
                                }
                            }
                        }
                    }
                ];
            }
        }

        const [data, totalRows] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    items: {
                        include: {
                            variant: {
                                include: {
                                    product: true
                                }
                            },
                            modifiers: {
                                include: {
                                    modifierOption: {
                                        select: {
                                            name: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    statusHistory: {
                        include: {
                            changedBy: {
                                select: {
                                    username: true,
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        },
                        orderBy: { createdAt: 'asc' }
                    },
                    payments: true
                }
            }),
            prisma.order.count({ where })
        ]);

        return this.formatPaginatedResult(formatOrdersWithReference(data), totalRows, page, take);
    }
}
