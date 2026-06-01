import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/feature/auth/auth.service';
import { UserRepository } from '@/feature/user/user.repository';
import { UnauthorizedException, ForbiddenException } from '@/exceptions';
import { TAppModule, TAppPermission } from '@/constant';

const authService = new AuthService();
const userRepository = new UserRepository();

/**
 * Validates the JWT access token and attaches the decoded payload to req.user.
 * Use this for routes that only require a user to be logged in.
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new UnauthorizedException('Authorization header is missing or malformed.'));
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix
    try {
        const payload = authService.verifyAccessToken(token);
        req.user = payload;
        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Middleware factory that enforces Role-Based Access Control (RBAC).
 * It runs `authenticate` internally, then queries the database to verify
 * if the user holds a role that grants the requested `module` and `permission`.
 *
 * If granted, it attaches the `accessScope` (e.g., 'Global', 'Owned') to `req.rbacScope`.
 */
export function requireAccess(requiredModule: TAppModule, requiredPermission: TAppPermission) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            // 1. Authenticate first (we run the logic manually here to avoid nested callbacks,
            // but we could also chain middleware. Manual is cleaner for error handling here).
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new UnauthorizedException('Authorization header is missing or malformed.');
            }

            const token = authHeader.slice(7);
            const payload = authService.verifyAccessToken(token);
            req.user = payload;

            // 2. Authorize
            const user = await userRepository.findUserByIdentifier(payload.sub);
            if (!user) {
                throw new UnauthorizedException('User no longer exists.');
            }

            let hasPermission = false;
            let grantedScope = null;

            for (const ur of user.userRoles) {
                for (const rp of ur.role.rolePermissions) {
                    if (
                        rp.modulePermission.module.name.toLowerCase() === requiredModule.toLowerCase() &&
                        rp.modulePermission.permission.name.toLowerCase() === requiredPermission.toLowerCase()
                    ) {
                        hasPermission = true;
                        grantedScope = rp.modulePermission.accessScope;
                        break;
                    }
                }
                if (hasPermission) break;
            }

            // System roles (like Super Admin) might bypass this depending on your business rules.
            // For now, strict DB check is enforced.

            if (!hasPermission) {
                throw new ForbiddenException(`You do not have permission to ${requiredPermission} on ${requiredModule}.`);
            }

            req.rbacScope = grantedScope as string;
            next();
        } catch (error) {
            next(error);
        }
    };
}
