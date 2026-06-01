import { ModuleRepository } from './module.repository';
import type { IModuleFilterParams } from './module.types';
import type { IPaginatedResult } from '@/types/base.types';
import type { Module } from '@prisma/client';

type ModuleServiceConstructor = {
    moduleRepository?: ModuleRepository;
};

export class ModuleService {
    private moduleRepository: ModuleRepository;

    constructor(params?: ModuleServiceConstructor) {
        this.moduleRepository = params?.moduleRepository || new ModuleRepository();
    }

    async getList(params: IModuleFilterParams): Promise<IPaginatedResult<Module>> {
        return this.moduleRepository.getList(params);
    }
}
