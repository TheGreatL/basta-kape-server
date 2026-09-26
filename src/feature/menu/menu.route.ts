import { Router, Request, Response, NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { MenuService } from './menu.service';
import {
    GetMenuQuerySchema,
    MenuCategoryResponseSchema,
    MenuTypeResponseSchema,
    MenuProductResponseSchema,
    PaginatedMenuResponseSchema,
    GetMenuCategoryQuerySchema,
    GetBestSellersQuerySchema,
    BestSellerProductResponseSchema
} from './menu.types';
import { z } from 'zod';

const router = Router();
const service = new MenuService();

// ============================================================================
// MENU ENDPOINTS
// ============================================================================

// GET /menu
registry.registerPath({
    method: 'get',
    path: '/menu',
    tags: ['Menu'],
    summary: 'Get paginated catalog list of active products for customer menu',
    request: {
        query: GetMenuQuerySchema
    },
    responses: {
        200: {
            description: 'Menu catalog list retrieved successfully',
            content: { 'application/json': { schema: PaginatedMenuResponseSchema } }
        }
    }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = GetMenuQuerySchema.parse(req.query);
        const result = await service.getMenuList(query);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /menu/categories
registry.registerPath({
    method: 'get',
    path: '/menu/categories',
    tags: ['Menu'],
    summary: 'Get unpaginated list of active product categories',
    request: {
        query: GetMenuCategoryQuerySchema
    },
    responses: {
        200: {
            description: 'Menu categories retrieved successfully',
            content: { 'application/json': { schema: z.array(MenuCategoryResponseSchema) } }
        }
    }
});

router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = GetMenuCategoryQuerySchema.parse(req.query);
        const result = await service.getCategoryList(query.productTypeId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /menu/types
registry.registerPath({
    method: 'get',
    path: '/menu/types',
    tags: ['Menu'],
    summary: 'Get unpaginated list of active product types',
    responses: {
        200: {
            description: 'Menu product types retrieved successfully',
            content: { 'application/json': { schema: z.array(MenuTypeResponseSchema) } }
        }
    }
});

router.get('/types', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await service.getTypeList();
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /menu/best-sellers
registry.registerPath({
    method: 'get',
    path: '/menu/best-sellers',
    tags: ['Menu'],
    summary: 'Get top best selling products based on orders',
    description: 'Public endpoint returning the top best-selling products ranked by order volume and sales',
    request: {
        query: GetBestSellersQuerySchema
    },
    responses: {
        200: {
            description: 'Top best selling products retrieved successfully',
            content: { 'application/json': { schema: z.array(BestSellerProductResponseSchema) } }
        }
    }
});

router.get('/best-sellers', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = GetBestSellersQuerySchema.parse(req.query);
        const result = await service.getBestSellers(query);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /menu/:id
registry.registerPath({
    method: 'get',
    path: '/menu/{id}',
    tags: ['Menu'],
    summary: 'Get menu product details by Product ID',
    responses: {
        200: {
            description: 'Menu product details retrieved successfully',
            content: { 'application/json': { schema: MenuProductResponseSchema } }
        }
    }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await service.getMenuProductById(req.params.id as string);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
