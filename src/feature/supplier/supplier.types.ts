import { z } from 'zod';

// Pagination and List Queries for Suppliers
export const GetSupplierListQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    search: z.string().optional(),
    status: z.enum(['active', 'archive']).default('active').optional()
});

export type TGetSupplierListQuery = z.infer<typeof GetSupplierListQuerySchema>;

// Supplier CRUD Validation Schemas
export const CreateSupplierSchema = z.object({
    name: z.string().min(2).max(100),
    address: z.string().max(500).optional().nullable(),
    contactPerson: z.string().max(100).optional().nullable(),
    contactNumber: z.string().max(50).optional().nullable(),
    notes: z.string().max(1000).optional().nullable()
});

export type TCreateSupplier = z.infer<typeof CreateSupplierSchema>;

export const UpdateSupplierSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    address: z.string().max(500).optional().nullable(),
    contactPerson: z.string().max(100).optional().nullable(),
    contactNumber: z.string().max(50).optional().nullable(),
    notes: z.string().max(1000).optional().nullable()
});

export type TUpdateSupplier = z.infer<typeof UpdateSupplierSchema>;

// Supplier API Response Schemas
export const SupplierResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    address: z.string().nullable(),
    contactPerson: z.string().nullable(),
    contactNumber: z.string().nullable(),
    notes: z.string().nullable(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export const PaginatedSupplierResponseSchema = z.object({
    data: z.array(SupplierResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});
