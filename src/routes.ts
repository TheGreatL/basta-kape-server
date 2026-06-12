import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { generateOpenAPI, registry } from './docs/swagger';
import { z } from 'zod';

import moduleRouter from './feature/rbac/module/module.route';
import permissionRouter from './feature/rbac/permission/permission.route';
import roleRouter from './feature/rbac/role/role.route';
import authRouter from './feature/auth/auth.route';
import activityLogRouter from './feature/activity-log/activity-log.route';
import uploadRouter from './feature/upload/upload.route';
import userRouter from './feature/user/user.route';
import productSettingsRouter from './feature/product-settings/product-settings.route';
import inventoryRouter from './feature/inventory/inventory.route';
import productRouter from './feature/product/product.route';
import supplierRouter from './feature/supplier/supplier.route';
import menuRouter from './feature/menu/menu.route';
import customerRouter from './feature/customer/customer.route';
import recipeRouter from './feature/recipe/recipe.route';
import reportRouter from './feature/report/report.route';
import storeSettingsRouter from './feature/store-settings/store-settings.route';
import registerShiftRouter from './feature/register-shift/register-shift.route';
import orderRouter from './feature/order/order.route';
import modifierRouter from './feature/modifier/modifier.route';
import paymentRouter from './feature/payment/payment.route';
import { discountConfigRouter, orderDiscountRouter } from './feature/discount/discount.route';

const router = Router();

registry.registerPath({
    method: 'get',
    path: '/health',
    summary: 'Health check',
    description: 'Returns the health status of the server',
    responses: {
        200: {
            description: 'Server is healthy',
            content: {
                'text/plain': {
                    schema: z.string()
                }
            }
        }
    }
});
router.get('/health', (req: Request, res: Response) => {
    res.send('Server is healthy');
});

router.use('/auth', authRouter);
router.use('/rbac/modules', moduleRouter);
router.use('/rbac/permissions', permissionRouter);
router.use('/rbac/roles', roleRouter);
router.use('/activity-logs', activityLogRouter);
router.use('/upload', uploadRouter);
router.use('/users', userRouter);
router.use('/product-settings', productSettingsRouter);
router.use('/inventory', inventoryRouter);
router.use('/products/variants', recipeRouter);
router.use('/products', productRouter);
router.use('/suppliers', supplierRouter);
router.use('/menu', menuRouter);
router.use('/customers', customerRouter);
router.use('/reports', reportRouter);
router.use('/store-settings', storeSettingsRouter);
router.use('/register-shifts', registerShiftRouter);
router.use('/orders', orderRouter);
router.use('/orders', paymentRouter);
router.use('/orders', orderDiscountRouter);
router.use('/discounts', discountConfigRouter);
router.use('/modifiers', modifierRouter);

registry.registerPath({
    method: 'get',
    path: '/',
    summary: 'Root endpoint',
    description: 'Returns a basic running message',
    responses: {
        200: {
            description: 'Server is running',
            content: {
                'text/plain': {
                    schema: z.string()
                }
            }
        }
    }
});
router.get('/', (req: Request, res: Response) => {
    res.send('Express + TypeScript Server is running');
});

// API Documentation (Swagger)
// MUST be generated AFTER all routes are imported and registered above!
const swaggerDocument = generateOpenAPI();
router.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

export default router;
