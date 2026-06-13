import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { IPaginatedResult } from '@/types/base.types';
import type { TCreateCustomer, TUpdateCustomer, TGetCustomerListQuery, TGetCustomerOrdersQuery } from './customer.types';

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
     * Finds a single customer by ID.
     */
    async findCustomerById(id: string) {
        return prisma.customer.findFirst({
            where: { id, deletedAt: null },
            include: {
                user: true
            }
        });
    }

    /**
     * Finds a single customer by ID, including soft-deleted ones.
     */
    async findCustomerByIdIncludingDeleted(id: string) {
        return prisma.customer.findFirst({
            where: { id },
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
                orderBy: { createdAt: 'desc' },
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
     * Adds an item to the customer's cart. Upserts quantity if already exists.
     */
    async addCartItem(customerId: string, productVariantId: string, quantity: number, unitPrice: number, modifierOptionIds: string[] = []) {
        const existing = await prisma.customerCart.findUnique({
            where: {
                customerId_productVariantId: { customerId, productVariantId }
            }
        });

        let cartItem: { id: string };
        if (existing) {
            if (existing.deletedAt !== null) {
                // If soft-deleted previously, reset deletedAt and set quantity directly
                cartItem = await prisma.customerCart.update({
                    where: { id: existing.id },
                    data: {
                        deletedAt: null,
                        quantity,
                        unitPrice
                    }
                });
            } else {
                // Increment quantity
                cartItem = await prisma.customerCart.update({
                    where: { id: existing.id },
                    data: {
                        quantity: existing.quantity + quantity,
                        unitPrice
                    }
                });
            }
        } else {
            // Create fresh
            cartItem = await prisma.customerCart.create({
                data: {
                    customerId,
                    productVariantId,
                    quantity,
                    unitPrice
                }
            });
        }

        // Clean up previous cart modifiers if any
        await prisma.customerCartModifier.deleteMany({
            where: { customerCartId: cartItem.id }
        });

        // Create new ones
        if (modifierOptionIds.length > 0) {
            await prisma.customerCartModifier.createMany({
                data: modifierOptionIds.map((optId) => ({
                    customerCartId: cartItem.id,
                    modifierOptionId: optId
                }))
            });
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
     * Updates the quantity of a specific cart item.
     */
    async updateCartItem(customerId: string, cartItemId: string, quantity: number) {
        return prisma.customerCart.update({
            where: {
                id: cartItemId,
                customerId,
                deletedAt: null
            },
            data: { quantity },
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
            const searchLower = params.search.toLowerCase();
            where.OR = [{ queueNumber: { contains: searchLower } }, { notes: { contains: searchLower } }];
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

        return this.formatPaginatedResult(data, totalRows, page, take);
    }
}
