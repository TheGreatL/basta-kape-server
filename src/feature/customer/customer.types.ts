import { z } from 'zod';
import { dataStatus } from '@/constant';
import { OrderStatusEnum } from '@/feature/order/order.types';

// ==========================================
// CUSTOMER TYPES
// ==========================================

export const CreateCustomerSchema = z.object({
    email: z.string().email(),
    username: z.string().min(3).max(50),
    password: z
        .string()
        .min(8)
        .regex(/^(?=.*[A-Z])(?=.*\d).+$/, 'Password must contain at least one uppercase letter and one number')
        .optional(),
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    middleName: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional()
});

export type TCreateCustomer = z.infer<typeof CreateCustomerSchema>;

export const UpdateCustomerSchema = z.object({
    email: z.string().email().optional(),
    username: z.string().min(3).max(50).optional(),
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    middleName: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional()
});

export type TUpdateCustomer = z.infer<typeof UpdateCustomerSchema>;

export const GetCustomerListQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    search: z.string().optional(),
    status: z.enum([dataStatus.ACTIVE, dataStatus.ARCHIVE]).optional()
});

export type TGetCustomerListQuery = z.infer<typeof GetCustomerListQuerySchema>;

export const CustomerUserSchema = z.object({
    id: z.string(),
    email: z.string(),
    username: z.string(),
    firstName: z.string(),
    middleName: z.string().nullable(),
    lastName: z.string(),
    phoneNumber: z.string().nullable(),
    profilePhoto: z.string().nullable(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export const CustomerResponseSchema = z.object({
    id: z.string(),
    userId: z.string(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable()),
    user: CustomerUserSchema
});

export type TCustomerResponse = z.infer<typeof CustomerResponseSchema>;

export const PaginatedCustomerResponseSchema = z.object({
    data: z.array(CustomerResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});

export type TPaginatedCustomerResponse = z.infer<typeof PaginatedCustomerResponseSchema>;

// ==========================================
// CUSTOMER CART TYPES
// ==========================================

export const AddCartItemSchema = z.object({
    productVariantId: z.string(),
    quantity: z.number().int().min(1),
    modifierOptionIds: z.array(z.string().uuid()).optional()
});

export type TAddCartItem = z.infer<typeof AddCartItemSchema>;

export const UpdateCartItemSchema = z.object({
    quantity: z.number().int().min(1)
});

export type TUpdateCartItem = z.infer<typeof UpdateCartItemSchema>;

// Product and attribute association models schemas
export const ProductCategoryInfoSchema = z.object({
    id: z.string(),
    name: z.string()
});

export const ProductTypeInfoSchema = z.object({
    id: z.string(),
    name: z.string()
});

export const ProductInfoSchema = z.object({
    id: z.string(),
    name: z.string(),
    photo: z.string().nullable(),
    description: z.string().nullable(),
    category: ProductCategoryInfoSchema.nullable().optional(),
    type: ProductTypeInfoSchema.nullable().optional()
});

export const AttributeInfoSchema = z.object({
    id: z.string(),
    name: z.string()
});

export const AttributeValueInfoSchema = z.object({
    id: z.string(),
    value: z.string(),
    attribute: AttributeInfoSchema
});

export const ProductVariantAttributeInfoSchema = z.object({
    id: z.string(),
    attributeValue: AttributeValueInfoSchema
});

export const ProductVariantInfoSchema = z.object({
    id: z.string(),
    sku: z.string().nullable(),
    price: z.number(),
    product: ProductInfoSchema,
    attributes: z.array(ProductVariantAttributeInfoSchema)
});

export const CartModifierResponseSchema = z.object({
    id: z.string(),
    customerCartId: z.string(),
    modifierOptionId: z.string(),
    modifierOption: z.object({
        id: z.string(),
        modifierGroupId: z.string(),
        name: z.string(),
        price: z.number(),
        createdAt: z.date().or(z.string()),
        updatedAt: z.date().or(z.string()),
        deletedAt: z.date().nullable().or(z.string().nullable())
    })
});

export const CartItemResponseSchema = z.object({
    id: z.string(),
    customerId: z.string(),
    quantity: z.number().int(),
    unitPrice: z.number(),
    productVariantId: z.string(),
    productVariant: ProductVariantInfoSchema,
    cartModifiers: z.array(CartModifierResponseSchema).optional().default([]),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export type TCartItemResponse = z.infer<typeof CartItemResponseSchema>;

export const CartResponseSchema = z.object({
    items: z.array(CartItemResponseSchema),
    totalAmount: z.number()
});

export type TCartResponse = z.infer<typeof CartResponseSchema>;

export const ClearCartSchema = z.object({
    cartItemIds: z.array(z.string()).optional()
});

export type TClearCart = z.infer<typeof ClearCartSchema>;

export const GetCustomerOrdersQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    search: z.string().optional(),
    status: OrderStatusEnum.optional()
});

export type TGetCustomerOrdersQuery = z.infer<typeof GetCustomerOrdersQuerySchema>;
