import { z } from 'zod';

export const CreateModifierOptionSchema = z.object({
    name: z.string().min(1).max(100),
    price: z.coerce.number().min(0).default(0)
});

export type TCreateModifierOption = z.infer<typeof CreateModifierOptionSchema>;

export const UpdateModifierOptionSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    price: z.coerce.number().min(0).optional()
});

export type TUpdateModifierOption = z.infer<typeof UpdateModifierOptionSchema>;

export const CreateModifierGroupSchema = z.object({
    name: z.string().min(1).max(100),
    isRequired: z.boolean().default(false),
    minSelect: z.coerce.number().int().min(0).default(0),
    maxSelect: z.coerce.number().int().min(1).default(1),
    productIds: z.array(z.string().uuid()).optional()
});

export type TCreateModifierGroup = z.infer<typeof CreateModifierGroupSchema>;

export const UpdateModifierGroupSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    isRequired: z.boolean().optional(),
    minSelect: z.coerce.number().int().min(0).optional(),
    maxSelect: z.coerce.number().int().min(1).optional(),
    productIds: z.array(z.string().uuid()).optional()
});

export type TUpdateModifierGroup = z.infer<typeof UpdateModifierGroupSchema>;

export const GetModifierGroupListQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    search: z.string().optional(),
    productId: z.string().uuid().optional()
});

export type TGetModifierGroupListQuery = z.infer<typeof GetModifierGroupListQuerySchema>;

export const ModifierOptionResponseSchema = z.object({
    id: z.string(),
    modifierGroupId: z.string(),
    name: z.string(),
    price: z.number(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export const ModifierGroupResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    isRequired: z.boolean(),
    minSelect: z.number(),
    maxSelect: z.number(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable()),
    options: z.array(ModifierOptionResponseSchema).optional(),
    products: z.array(z.object({ id: z.string(), name: z.string() })).optional()
});

export type TModifierGroupResponse = z.infer<typeof ModifierGroupResponseSchema>;
