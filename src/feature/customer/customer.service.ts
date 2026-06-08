import { prisma } from '@/lib/prisma';
import { CustomerRepository } from './customer.repository';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { NotFoundException, ConflictException } from '@/exceptions';
import type { TCreateCustomer, TUpdateCustomer, TGetCustomerListQuery, TAddCartItem, TUpdateCartItem } from './customer.types';

type CustomerServiceConstructor = {
    customerRepository?: CustomerRepository;
    activityLogService?: ActivityLogService;
};

export class CustomerService {
    private customerRepository: CustomerRepository;
    private activityLogService: ActivityLogService;

    constructor(params?: CustomerServiceConstructor) {
        this.customerRepository = params?.customerRepository || new CustomerRepository();
        this.activityLogService = params?.activityLogService || new ActivityLogService();
    }

    async getCustomerList(params: TGetCustomerListQuery) {
        return this.customerRepository.getCustomerList(params);
    }

    async getCustomerById(id: string) {
        const customer = await this.customerRepository.findCustomerById(id);
        if (!customer) {
            throw new NotFoundException('Customer not found');
        }
        return customer;
    }

    async createCustomer(data: TCreateCustomer, actorId: string) {
        // Check for conflict
        const conflict = await this.customerRepository.findConflict(data.email, data.username);
        if (conflict) {
            if (conflict.email === data.email) {
                throw new ConflictException('An account with this email already exists.');
            }
            throw new ConflictException('An account with this username already exists.');
        }

        const customer = await this.customerRepository.createCustomer(data);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Customer',
            details: `Successfully created customer account for ${customer.user.username} (${customer.user.email}).`
        });

        return customer;
    }

    async updateCustomer(id: string, data: TUpdateCustomer, actorId: string) {
        const customer = await this.getCustomerById(id);

        // Check conflicts for email/username updates
        if (data.email || data.username) {
            const conflict = await this.customerRepository.findConflict(data.email || '', data.username || '');

            if (conflict) {
                if (conflict.email === data.email && conflict.email !== customer.user.email) {
                    throw new ConflictException('An account with this email already exists.');
                }
                if (conflict.username === data.username && conflict.username !== customer.user.username) {
                    throw new ConflictException('An account with this username already exists.');
                }
            }
        }

        const updatedCustomer = await this.customerRepository.updateCustomer(id, data);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Customer',
            details: `Successfully updated customer details for ${customer.user.username} (${customer.user.email}).`
        });

        return updatedCustomer;
    }

    async deleteCustomer(id: string, actorId: string) {
        const customer = await this.getCustomerById(id);

        await this.customerRepository.softDeleteCustomer(id);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete Customer',
            details: `Successfully soft-deleted customer account: ${customer.user.username} (${customer.user.email}).`
        });
    }

    // ==========================================
    // CART OPERATIONS
    // ==========================================

    async getCart(customerId: string) {
        // Ensure customer exists
        await this.getCustomerById(customerId);

        const items = await this.customerRepository.getCart(customerId);

        // Compute total cart amount dynamically
        const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

        return {
            items,
            totalAmount
        };
    }

    async addCartItem(customerId: string, data: TAddCartItem, actorId: string) {
        // Ensure customer exists
        const customer = await this.getCustomerById(customerId);

        // Fetch product variant details
        const variant = await prisma.productVariant.findFirst({
            where: { id: data.productVariantId, deletedAt: null }
        });

        if (!variant) {
            throw new NotFoundException('Product variant not found');
        }

        const cartItem = await this.customerRepository.addCartItem(customerId, data.productVariantId, data.quantity, variant.price);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Add Cart Item',
            details: `Added ${data.quantity} unit(s) of a product variant to customer ${customer.user.username}'s cart.`
        });

        return cartItem;
    }

    async updateCartItem(customerId: string, cartItemId: string, data: TUpdateCartItem, actorId: string) {
        // Ensure customer exists
        const customer = await this.getCustomerById(customerId);

        // Ensure cart item exists
        const existingItem = await this.customerRepository.findCartItemById(customerId, cartItemId);
        if (!existingItem) {
            throw new NotFoundException('Cart item not found in customer cart');
        }

        const updatedItem = await this.customerRepository.updateCartItem(customerId, cartItemId, data.quantity);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Cart Item',
            details: `Updated cart item quantity to ${data.quantity} for customer ${customer.user.username}.`
        });

        return updatedItem;
    }

    async removeCartItem(customerId: string, cartItemId: string, actorId: string) {
        // Ensure customer exists
        const customer = await this.getCustomerById(customerId);

        // Ensure cart item exists
        const existingItem = await this.customerRepository.findCartItemById(customerId, cartItemId);
        if (!existingItem) {
            throw new NotFoundException('Cart item not found in customer cart');
        }

        await this.customerRepository.removeCartItem(customerId, cartItemId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Remove Cart Item',
            details: `Removed a cart item from customer ${customer.user.username}'s cart.`
        });
    }

    async clearCart(customerId: string, actorId: string) {
        // Ensure customer exists
        const customer = await this.getCustomerById(customerId);

        await this.customerRepository.clearCart(customerId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Clear Cart',
            details: `Cleared all cart items for customer ${customer.user.username}.`
        });
    }
}
