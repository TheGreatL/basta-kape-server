import { MenuRepository } from './menu.repository';
import { NotFoundException } from '@/exceptions';
import type { TGetMenuQuery } from './menu.types';

export class MenuService {
    private repository: MenuRepository;

    constructor() {
        this.repository = new MenuRepository();
    }

    async getMenuList(params: TGetMenuQuery) {
        return this.repository.getMenuList(params);
    }

    async getMenuProductById(id: string) {
        const product = await this.repository.getMenuProductById(id);
        if (!product) {
            throw new NotFoundException('Product not found in the menu');
        }
        return product;
    }

    async getCategoryList() {
        return this.repository.getCategoryList();
    }

    async getTypeList() {
        return this.repository.getTypeList();
    }
}
