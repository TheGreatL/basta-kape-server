import { PermissionRepository } from './permission.repository';
import type { IPermissionFilterParams } from './permission.types';
import type { IPaginatedResult } from '@/types/base.types';
import type { Permission } from '@prisma/client';

type PermissionServiceConstructor = {
    permissionRepository?: PermissionRepository;
};

export class PermissionService {
    private permissionRepository: PermissionRepository;

    constructor(params?: PermissionServiceConstructor) {
        this.permissionRepository = params?.permissionRepository || new PermissionRepository();
    }

    async getList(params: IPermissionFilterParams): Promise<IPaginatedResult<Permission>> {
        return this.permissionRepository.getList(params);
    }
}
