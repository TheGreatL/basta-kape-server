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
 * It accepts either a single module/permission combo or an array of alternative combos (acting as an OR check).
 * If granted, it attaches the `accessScope` (e.g., 'Global', 'Owned') to `req.rbacScope`.
 */
export function requireAccess(
    requiredModule: TAppModule | { module: TAppModule; permission: TAppPermission }[],
    requiredPermission?: TAppPermission
) {
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

            // Normalize requirements to an array of { module, permission }
            const requirements = Array.isArray(requiredModule) ? requiredModule : [{ module: requiredModule, permission: requiredPermission! }];

            for (const ur of user.userRoles) {
                for (const rp of ur.role.rolePermissions) {
                    const matchesRequirement = requirements.some(
                        (reqPerm) =>
                            rp.modulePermission.module.name.toLowerCase() === reqPerm.module.toLowerCase() &&
                            rp.modulePermission.permission.name.toLowerCase() === reqPerm.permission.toLowerCase()
                    );
                    if (matchesRequirement) {
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
                const reqDetails = requirements.map((r) => `${r.permission} on ${r.module}`).join(' or ');
                throw new ForbiddenException(`You do not have permission to perform this action. Required: ${reqDetails}`);
            }

            req.rbacScope = grantedScope as string;
            next();
        } catch (error) {
            next(error);
        }
    };
}
