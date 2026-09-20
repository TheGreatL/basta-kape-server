import { prisma } from '@/lib/prisma';
import { UnitConversionRepository } from './unit-conversion.repository';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { NotFoundException, ConflictException, BadRequestException } from '@/exceptions';
import type {
    TCreateUnitConversion,
    TUpdateUnitConversion,
    TGetUnitConversionListQuery,
    TConvertQuantityQuery,
    TConvertQuantityResponse
} from './unit-conversion.types';

export type TUnitConverter = (fromUnitId: string, toUnitId: string, quantity: number, ingredientId?: string | null) => number;

export class UnitConversionService {
    private repository: UnitConversionRepository;
    private activityLogService: ActivityLogService;

    constructor() {
        this.repository = new UnitConversionRepository();
        this.activityLogService = new ActivityLogService();
    }

    static createConverter(
        activeConversions: Array<{
            fromUnitId: string;
            toUnitId: string;
            factor: number;
            ingredientId?: string | null;
        }>
    ): TUnitConverter {
        const map = new Map<string, number>();

        for (const conv of activeConversions) {
            const scope = conv.ingredientId ? conv.ingredientId : 'global';
            // Forward conversion
            map.set(`${scope}:${conv.fromUnitId}->${conv.toUnitId}`, conv.factor);
            // Reverse conversion
            map.set(`${scope}:${conv.toUnitId}->${conv.fromUnitId}`, 1 / conv.factor);
        }

        return (fromUnitId: string, toUnitId: string, quantity: number, ingredientId?: string | null): number => {
            if (fromUnitId === toUnitId) return quantity;

            // Check ingredient-specific conversion first
            if (ingredientId) {
                const specificFactor = map.get(`${ingredientId}:${fromUnitId}->${toUnitId}`);
                if (specificFactor !== undefined) {
                    return quantity * specificFactor;
                }
            }

            // Fallback to global conversion
            const globalFactor = map.get(`global:${fromUnitId}->${toUnitId}`);
            if (globalFactor !== undefined) {
                return quantity * globalFactor;
            }

            throw new BadRequestException(
                `No unit conversion found from unit ID "${fromUnitId}" to unit ID "${toUnitId}"${
                    ingredientId ? ` for ingredient ID "${ingredientId}"` : ''
                }. Please configure this unit conversion in Inventory Settings.`
            );
        };
    }

    async getConverter(): Promise<TUnitConverter> {
        const conversions = await this.repository.findAllActiveConversions();
        return UnitConversionService.createConverter(conversions);
    }

    async getConversionList(params: TGetUnitConversionListQuery) {
        return this.repository.getUnitConversionList(params);
    }

    async getConversionById(id: string) {
        const conversion = await this.repository.findConversionById(id);
        if (!conversion) {
            throw new NotFoundException('Unit conversion not found');
        }
        return conversion;
    }

    async createConversion(data: TCreateUnitConversion, actorId: string) {
        const [fromUnit, toUnit] = await Promise.all([
            prisma.ingredientUnit.findFirst({ where: { id: data.fromUnitId, deletedAt: null } }),
            prisma.ingredientUnit.findFirst({ where: { id: data.toUnitId, deletedAt: null } })
        ]);

        if (!fromUnit) {
            throw new NotFoundException(`From unit with ID "${data.fromUnitId}" not found`);
        }
        if (!toUnit) {
            throw new NotFoundException(`To unit with ID "${data.toUnitId}" not found`);
        }

        let ingredientName: string | undefined;
        if (data.ingredientId) {
            const ingredient = await prisma.ingredient.findFirst({
                where: { id: data.ingredientId, deletedAt: null }
            });
            if (!ingredient) {
                throw new NotFoundException(`Ingredient with ID "${data.ingredientId}" not found`);
            }
            ingredientName = ingredient.name;
        }

        const existing = await this.repository.findExistingConversion(data.fromUnitId, data.toUnitId, data.ingredientId);
        if (existing) {
            throw new ConflictException(
                `A conversion between "${fromUnit.name}" and "${toUnit.name}" already exists${
                    ingredientName ? ` for ingredient "${ingredientName}"` : ' globally'
                }`
            );
        }

        const conversion = await this.repository.createConversion(data, actorId);

        const scopeLabel = ingredientName ? ` for ingredient "${ingredientName}"` : ' globally';
        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Unit Conversion',
            details: `Created unit conversion 1 ${fromUnit.name} = ${data.factor} ${toUnit.name}${scopeLabel}.`
        });

        return conversion;
    }

    async updateConversion(id: string, data: TUpdateUnitConversion, actorId: string) {
        const conversion = await this.getConversionById(id);

        const updated = await this.repository.updateConversion(id, data, actorId);

        const scopeLabel = conversion.ingredient ? ` for ingredient "${conversion.ingredient.name}"` : ' globally';
        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Unit Conversion',
            details: `Updated unit conversion 1 ${conversion.fromUnit.name} = ${data.factor} ${conversion.toUnit.name}${scopeLabel} (was ${conversion.factor}).`
        });

        return updated;
    }

    async deleteConversion(id: string, actorId: string) {
        const conversion = await this.getConversionById(id);

        await this.repository.softDeleteConversion(id, actorId);

        const scopeLabel = conversion.ingredient ? ` for ingredient "${conversion.ingredient.name}"` : ' globally';
        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete Unit Conversion',
            details: `Deleted unit conversion between ${conversion.fromUnit.name} and ${conversion.toUnit.name}${scopeLabel}.`
        });

        return { message: 'Unit conversion deleted successfully' };
    }

    async convertQuantity(params: TConvertQuantityQuery): Promise<TConvertQuantityResponse> {
        const [fromUnit, toUnit] = await Promise.all([
            prisma.ingredientUnit.findFirst({ where: { id: params.fromUnitId, deletedAt: null } }),
            prisma.ingredientUnit.findFirst({ where: { id: params.toUnitId, deletedAt: null } })
        ]);

        if (!fromUnit) {
            throw new NotFoundException(`From unit with ID "${params.fromUnitId}" not found`);
        }
        if (!toUnit) {
            throw new NotFoundException(`To unit with ID "${params.toUnitId}" not found`);
        }

        let ingredientName: string | undefined;
        if (params.ingredientId) {
            const ingredient = await prisma.ingredient.findFirst({
                where: { id: params.ingredientId, deletedAt: null }
            });
            if (ingredient) {
                ingredientName = ingredient.name;
            }
        }

        if (params.fromUnitId === params.toUnitId) {
            return {
                fromUnitId: fromUnit.id,
                fromUnitName: fromUnit.name,
                toUnitId: toUnit.id,
                toUnitName: toUnit.name,
                originalQuantity: params.quantity,
                convertedQuantity: params.quantity,
                factor: 1,
                ingredientId: params.ingredientId || null,
                ingredientName: ingredientName || null
            };
        }

        const converter = await this.getConverter();
        const convertedQuantity = converter(params.fromUnitId, params.toUnitId, params.quantity, params.ingredientId);
        const effectiveFactor = convertedQuantity / params.quantity;

        return {
            fromUnitId: fromUnit.id,
            fromUnitName: fromUnit.name,
            toUnitId: toUnit.id,
            toUnitName: toUnit.name,
            originalQuantity: params.quantity,
            convertedQuantity,
            factor: effectiveFactor,
            ingredientId: params.ingredientId || null,
            ingredientName: ingredientName || null
        };
    }
}
