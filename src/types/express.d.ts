import type { IJwtPayload } from '@/feature/auth/auth.types';

declare global {
    namespace Express {
        interface Request {
            user?: IJwtPayload;
            rbacScope?: string;
        }
    }
}
