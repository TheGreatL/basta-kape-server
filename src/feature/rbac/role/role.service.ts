import { RoleRepository, type TRoleWithPermissions } from './role.repository';
import { ModulePermissionRepository } from '../module-permission.repository';
import type { IRoleFilterParams } from './role.types';
import type { IPaginatedResult } from '@/types/base.types';
import { NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@/exceptions';

type RoleServiceConstructor = {
    roleRepository?: RoleRepository;
    modulePermissionRepository?: ModulePermissionRepository;
};

export class RoleService {
    private roleRepository: RoleRepository;
    private modulePermissionRepository: ModulePermissionRepository;

    constructor(params?: RoleServiceConstructor) {
        this.roleRepository = params?.roleRepository || new RoleRepository();
        this.modulePermissionRepository = params?.modulePermissionRepository || new ModulePermissionRepository();
    }

    /**
     * Checks if a role is the Customer role. If it is, throws a 403 Forbidden.
     */
    private async ensureNotCustomerRole(id: string) {
        const role = await this.roleRepository.getRoleById(id);
        if (!role) {
            throw new NotFoundException('Role not found');
        }
        if (role.name === 'Customer') {
            throw new ForbiddenException(
                'The Customer role has a dedicated UI and cannot be modified. Changes to this role require system maintenance.'
            );
        }
    }

    /**
     * Validates that all provided modulePermissionIds actually exist in the database.
     */
    private async validatePermissions(modulePermissionIds: string[]) {
        if (modulePermissionIds.length === 0) return;

        const invalidIds = await this.roleRepository.validateModulePermissionIds(modulePermissionIds);
        if (invalidIds.length > 0) {
            throw new BadRequestException(`The following modulePermissionIds do not exist: ${invalidIds.join(', ')}`);
        }
    }

    async getSelectionTree() {
        return this.modulePermissionRepository.getSelectionTree();
    }

    async getList(params: IRoleFilterParams): Promise<IPaginatedResult<TRoleWithPermissions>> {
        return this.roleRepository.getList(params);
    }

    async getRoleByName(name: string) {
        const role = await this.roleRepository.getRoleByName(name);
        if (!role) {
            throw new NotFoundException('Role not found');
        }
        return role;
    }

    async createRole(data: { name: string; description?: string; permissions: { modulePermissionId: string }[] }) {
        // 1. Check for duplicate name
        const existing = await this.roleRepository.findByName(data.name);
        if (existing) {
            throw new ConflictException(`A role with the name "${data.name}" already exists.`);
        }

        // 2. Validate all provided modulePermissionIds exist
        const modulePermissionIds = data.permissions.map((p) => p.modulePermissionId);
        await this.validatePermissions(modulePermissionIds);

        return this.roleRepository.createRole(data, modulePermissionIds);
    }

    async updateRole(id: string, data: { name?: string; description?: string; permissions?: { modulePermissionId: string }[] }) {
        // 1. Ensure role exists and is not the Customer role
        await this.ensureNotCustomerRole(id);

        // 2. If renaming, check the new name doesn't conflict with another role
        if (data.name) {
            const conflict = await this.roleRepository.findByName(data.name);
            if (conflict && conflict.id !== id) {
                throw new ConflictException(`A role with the name "${data.name}" already exists.`);
            }
        }

        // 3. Validate all provided modulePermissionIds exist
        let modulePermissionIds: string[] | undefined = undefined;
        if (data.permissions) {
            modulePermissionIds = data.permissions.map((p) => p.modulePermissionId);
            await this.validatePermissions(modulePermissionIds);
        }

        return this.roleRepository.updateRole(id, data, modulePermissionIds);
    }

    async deleteRole(id: string) {
        await this.ensureNotCustomerRole(id);
        return this.roleRepository.deleteRole(id);
    }

    async restoreRole(id: string) {
        const role = await this.roleRepository.findRoleByIdIncludingDeleted(id);
        if (!role) {
            throw new NotFoundException('Role not found');
        }
        if (role.name === 'Customer') {
            throw new ForbiddenException('The Customer role cannot be modified.');
        }
        return this.roleRepository.restoreRole(id);
    }
}
