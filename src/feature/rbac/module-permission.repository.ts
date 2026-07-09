import { prisma } from '@/lib/prisma';

export interface ISelectionTreeResponse {
    moduleId: string;
    moduleName: string;
    permissions: {
        permissionId: string;
        permissionName: string;
        modulePermissionId: string;
    }[];
}

export class ModulePermissionRepository {
    /**
     * Returns a dynamic cross-product of all available Modules and Permissions
     * with their associated ModulePermission IDs for the UI checkbox/select tree.
     * It ensures all possible combinations exist in the database before returning.
     */
    async getSelectionTree(): Promise<ISelectionTreeResponse[]> {
        const [modules, permissions] = await prisma.$transaction([
            prisma.module.findMany({ orderBy: { name: 'asc' } }),
            prisma.permission.findMany({ orderBy: { name: 'asc' } })
        ]);

        // Fetch all existing module permissions
        const existingMPs = await prisma.modulePermission.findMany();
        const mpMap = new Map(existingMPs.map((mp) => [`${mp.moduleId}_${mp.permissionId}`, mp]));

        // We will build the tree and simultaneously collect any missing records
        const missingMPsToCreate: { moduleId: string; permissionId: string }[] = [];

        // Identify missing combinations
        for (const module of modules) {
            for (const permission of permissions) {
                const key = `${module.id}_${permission.id}`;
                if (!mpMap.has(key)) {
                    missingMPsToCreate.push({
                        moduleId: module.id,
                        permissionId: permission.id
                    });
                }
            }
        }

        // If any are missing, insert them and re-fetch (to get their UUIDs)
        if (missingMPsToCreate.length > 0) {
            await prisma.modulePermission.createMany({
                data: missingMPsToCreate
            });
            const newlyCreated = await prisma.modulePermission.findMany({
                where: {
                    OR: missingMPsToCreate.map((m) => ({
                        moduleId: m.moduleId,
                        permissionId: m.permissionId
                    }))
                }
            });
            for (const mp of newlyCreated) {
                mpMap.set(`${mp.moduleId}_${mp.permissionId}`, mp);
            }
        }

        // Build final tree
        return modules.map((module) => ({
            moduleId: module.id,
            moduleName: module.name,
            permissions: permissions.map((permission) => {
                const mp = mpMap.get(`${module.id}_${permission.id}`);
                return {
                    permissionId: permission.id,
                    permissionName: permission.name,
                    modulePermissionId: mp!.id
                };
            })
        }));
    }
}
