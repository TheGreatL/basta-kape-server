import { PrismaClient, InventoryStatus, AdjustmentType } from '@prisma/client';

export async function seedProduct(prisma: PrismaClient) {
    console.log('Seeding explicitly: Products, Recipes, Inventory, and Suppliers...');

    // ==========================================
    // 1. FETCH AUDIT USER (Admin)
    // ==========================================
    const adminUser = await prisma.user.findUnique({
        where: { email: 'admin@bastakape.com' }
    });
    const adminId = adminUser ? adminUser.id : null;

    if (!adminId) {
        throw new Error('Admin user (admin@bastakape.com) not found. Run seedUsers first!');
    }

    // ==========================================
    // 2. SEED PRODUCT CATEGORIES & TYPES
    // ==========================================
    const categoryCoffee = await prisma.productCategory.upsert({
        where: { id: '11111111-1111-4111-a111-111111111111' },
        update: {},
        create: {
            id: '11111111-1111-4111-a111-111111111111',
            name: 'Coffee',
            description: 'Espresso-based hot and cold beverage creations',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const categoryNonCoffee = await prisma.productCategory.upsert({
        where: { id: '11111111-1111-4111-a111-111111111112' },
        update: {},
        create: {
            id: '11111111-1111-4111-a111-111111111112',
            name: 'Non-Coffee',
            description: 'Delicious hot and cold non-caffeinated drinks',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const categoryPastries = await prisma.productCategory.upsert({
        where: { id: '11111111-1111-4111-a111-111111111113' },
        update: {},
        create: {
            id: '11111111-1111-4111-a111-111111111113',
            name: 'Pastries',
            description: 'Freshly baked croissants, cookies, and cakes',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const categorySignature = await prisma.productCategory.upsert({
        where: { id: '11111111-1111-4111-a111-111111111114' },
        update: {},
        create: {
            id: '11111111-1111-4111-a111-111111111114',
            name: 'Signature Drinks',
            description: 'Basta Kape signature drinks and specialty lattes',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const typeIced = await prisma.productType.upsert({
        where: { id: '22222222-2222-4222-a222-222222222221' },
        update: {},
        create: {
            id: '22222222-2222-4222-a222-222222222221',
            name: 'Iced Drinks',
            description: 'Chilled beverages served over ice',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const typeBaked = await prisma.productType.upsert({
        where: { id: '22222222-2222-4222-a222-222222222223' },
        update: {},
        create: {
            id: '22222222-2222-4222-a222-222222222223',
            name: 'Baked Goods',
            description: 'Oven-fresh pastries and bread',
            createdById: adminId,
            updatedById: adminId
        }
    });

    // ==========================================
    // 3. SEED INGREDIENT UNITS
    // ==========================================
    const unitGrams = await prisma.ingredientUnit.upsert({
        where: { id: '33333333-3333-4333-a333-333333333331' },
        update: {},
        create: {
            id: '33333333-3333-4333-a333-333333333331',
            name: 'Grams',
            abbreviation: 'g',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const unitMilliliters = await prisma.ingredientUnit.upsert({
        where: { id: '33333333-3333-4333-a333-333333333332' },
        update: {},
        create: {
            id: '33333333-3333-4333-a333-333333333332',
            name: 'Milliliters',
            abbreviation: 'ml',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const unitPieces = await prisma.ingredientUnit.upsert({
        where: { id: '33333333-3333-4333-a333-333333333333' },
        update: {},
        create: {
            id: '33333333-3333-4333-a333-333333333333',
            name: 'Pieces',
            abbreviation: 'pcs',
            createdById: adminId,
            updatedById: adminId
        }
    });

    // ==========================================
    // 4. SEED SUPPLIERS
    // ==========================================
    const supplierRoastery = await prisma.supplier.upsert({
        where: { id: '44444444-4444-4444-a444-444444444441' },
        update: {},
        create: {
            id: '44444444-4444-4444-a444-444444444441',
            name: 'Basta Kape Roastery',
            address: '50 K-1st, Quezon City, Metro Manila',
            notes: 'Primary supplier of direct-trade premium coffee beans',
            contactPerson: 'John Zymulgna L. Sencio',
            contactNumber: '+63 917 123 4567',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const supplierDairy = await prisma.supplier.upsert({
        where: { id: '44444444-4444-4444-a444-444444444442' },
        update: {},
        create: {
            id: '44444444-4444-4444-a444-444444444442',
            name: 'Manila Dairy Distributors',
            address: 'Balintawak, Quezon City',
            notes: 'Delivers fresh dairy milk and alternative oat/almond milks daily',
            contactPerson: 'Maria Clara',
            contactNumber: '+63 918 987 6543',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const supplierGrocery = await prisma.supplier.upsert({
        where: { id: '44444444-4444-4444-a444-444444444443' },
        update: {},
        create: {
            id: '44444444-4444-4444-a444-444444444443',
            name: 'Global Pantry Supplies',
            address: 'Pasig City, Metro Manila',
            notes: 'Supplier of syrups, chocolate sauces, and premium matcha powders',
            contactPerson: 'Pedro Penduko',
            contactNumber: '+63 919 456 7890',
            createdById: adminId,
            updatedById: adminId
        }
    });

    // ==========================================
    // 5. SEED INGREDIENTS & CURRENT INVENTORIES
    // ==========================================
    async function createIngredientWithInventory(
        id: string,
        name: string,
        description: string,
        unitId: string,
        qty: number,
        reorder: number,
        status: InventoryStatus
    ) {
        const ing = await prisma.ingredient.upsert({
            where: { id },
            update: {},
            create: {
                id,
                name,
                description,
                ingredientUnitId: unitId,
                reorderPoint: reorder,
                createdById: adminId,
                updatedById: adminId
            }
        });

        const invId = id.replace(/^5/, 'f');
        await prisma.ingredientInventory.upsert({
            where: { id: invId },
            update: {},
            create: {
                id: invId,
                ingredientId: ing.id,
                currentQuantity: qty,
                lastPhysicalCount: new Date(),
                status,
                createdById: adminId,
                updatedById: adminId
            }
        });

        return ing;
    }

    const ingBeans = await createIngredientWithInventory(
        '55555555-5555-4555-a555-555555555551',
        'Espresso Blend Beans',
        'Premium arabica-robusta house blend',
        unitGrams.id,
        8500,
        2000,
        InventoryStatus.SAFE
    );
    const ingWholeMilk = await createIngredientWithInventory(
        '55555555-5555-4555-a555-555555555552',
        'Barista Whole Milk',
        'High-foaming dairy milk',
        unitMilliliters.id,
        15000,
        5000,
        InventoryStatus.SAFE
    );
    const ingOatMilk = await createIngredientWithInventory(
        '55555555-5555-4555-a555-555555555553',
        'Barista Oat Milk',
        'Premium plant-based milk alternative',
        unitMilliliters.id,
        2000,
        4000,
        InventoryStatus.CRITICAL
    );
    const ingAlmondMilk = await createIngredientWithInventory(
        '55555555-5555-4555-a555-555555555554',
        'Barista Almond Milk',
        'Unsweetened plant-based milk alternative',
        unitMilliliters.id,
        6000,
        3000,
        InventoryStatus.SAFE
    );
    const ingCondensed = await createIngredientWithInventory(
        '55555555-5555-4555-a555-555555555555',
        'Sweet Condensed Milk',
        'Thick sweetened milk for Spanish Latte',
        unitGrams.id,
        4500,
        1000,
        InventoryStatus.SAFE
    );
    const ingMatcha = await createIngredientWithInventory(
        '55555555-5555-4555-a555-555555555556',
        'Premium Uji Matcha Powder',
        'Authentic Japanese stone-ground green tea',
        unitGrams.id,
        800,
        250,
        InventoryStatus.SAFE
    );
    const ingChocolate = await createIngredientWithInventory(
        '55555555-5555-4555-a555-555555555557',
        'Gourmet Chocolate Sauce',
        'Rich dark cocoa sauce for mochas and chocolates',
        unitGrams.id,
        2500,
        800,
        InventoryStatus.SAFE
    );
    const ingVanilla = await createIngredientWithInventory(
        '55555555-5555-4555-a555-555555555558',
        'Sweet Vanilla Syrup',
        'Classic vanilla flavoring syrup',
        unitMilliliters.id,
        1800,
        500,
        InventoryStatus.SAFE
    );
    const ingCaramel = await createIngredientWithInventory(
        '55555555-5555-4555-a555-555555555559',
        'Caramel Drizzle Sauce',
        'Buttery caramel sauce for topping macchiatos',
        unitMilliliters.id,
        1200,
        400,
        InventoryStatus.SAFE
    );
    const ingCroissant = await createIngredientWithInventory(
        '55555555-5555-4555-a555-555555555510',
        'Frozen Croissant Dough',
        'Pre-portioned uncooked butter croissants',
        unitPieces.id,
        0,
        15,
        InventoryStatus.OUT_OF_STOCK
    );
    const ingChocCroissant = await createIngredientWithInventory(
        '55555555-5555-4555-a555-555555555511',
        'Frozen Chocolate Croissant Dough',
        'Pre-portioned uncooked pain au chocolat',
        unitPieces.id,
        25,
        10,
        InventoryStatus.SAFE
    );
    const ingCookie = await createIngredientWithInventory(
        '55555555-5555-4555-a555-555555555512',
        'Chocolate Chip Cookie Dough',
        'Pre-portioned soft cookie dough chunks',
        unitPieces.id,
        40,
        15,
        InventoryStatus.SAFE
    );

    // ==========================================
    // 6. SEED INGREDIENT DELIVERIES & BATCHES
    // ==========================================
    await prisma.ingredientBatch.upsert({
        where: { id: '66666666-6666-4666-a666-666666666661' },
        update: {},
        create: {
            id: '66666666-6666-4666-a666-666666666661',
            ingredientId: ingBeans.id,
            supplierId: supplierRoastery.id,
            quantityReceived: 10000,
            currentQuantity: 8500,
            unitCost: 0.65,
            totalCost: 6500.0,
            batchNumber: 'BATCH-BEANS-099',
            expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.stockTransaction.create({
        data: {
            batchId: '66666666-6666-4666-a666-666666666661',
            quantityChange: 10000,
            type: 'DELIVERY',
            reason: 'Seed delivery',
            createdById: adminId
        }
    });

    await prisma.stockTransaction.create({
        data: {
            batchId: '66666666-6666-4666-a666-666666666661',
            quantityChange: -1500,
            type: 'PHYSICAL_COUNT_CORRECTION',
            reason: 'Deducted to match current inventory quantity',
            createdById: adminId
        }
    });

    await prisma.ingredientBatch.upsert({
        where: { id: '66666666-6666-4666-a666-666666666662' },
        update: {},
        create: {
            id: '66666666-6666-4666-a666-666666666662',
            ingredientId: ingWholeMilk.id,
            supplierId: supplierDairy.id,
            quantityReceived: 24000,
            currentQuantity: 15000,
            unitCost: 0.085,
            totalCost: 2040.0,
            batchNumber: 'BATCH-MILK-774',
            expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.stockTransaction.create({
        data: {
            batchId: '66666666-6666-4666-a666-666666666662',
            quantityChange: 24000,
            type: 'DELIVERY',
            reason: 'Seed delivery',
            createdById: adminId
        }
    });

    await prisma.stockTransaction.create({
        data: {
            batchId: '66666666-6666-4666-a666-666666666662',
            quantityChange: -9000,
            type: 'PHYSICAL_COUNT_CORRECTION',
            reason: 'Deducted to match current inventory quantity',
            createdById: adminId
        }
    });

    await prisma.ingredientBatch.upsert({
        where: { id: '66666666-6666-4666-a666-666666666663' },
        update: {},
        create: {
            id: '66666666-6666-4666-a666-666666666663',
            ingredientId: ingMatcha.id,
            supplierId: supplierGrocery.id,
            quantityReceived: 1000,
            currentQuantity: 800,
            unitCost: 2.2,
            totalCost: 2200.0,
            batchNumber: 'BATCH-MATCHA-003',
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.stockTransaction.create({
        data: {
            batchId: '66666666-6666-4666-a666-666666666663',
            quantityChange: 1000,
            type: 'DELIVERY',
            reason: 'Seed delivery',
            createdById: adminId
        }
    });

    await prisma.stockTransaction.create({
        data: {
            batchId: '66666666-6666-4666-a666-666666666663',
            quantityChange: -200,
            type: 'PHYSICAL_COUNT_CORRECTION',
            reason: 'Deducted to match current inventory quantity',
            createdById: adminId
        }
    });

    // ==========================================
    // 7. SEED INVENTORY ADJUSTMENTS (Waste logs)
    // ==========================================
    await prisma.inventoryAdjustment.upsert({
        where: { id: '77777777-7777-4777-a777-777777777771' },
        update: {},
        create: {
            id: '77777777-7777-4777-a777-777777777771',
            ingredientId: ingBeans.id,
            quantity: -250,
            type: AdjustmentType.WASTE,
            reason: 'Accidental spill during grinder cleaning',
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.inventoryAdjustment.upsert({
        where: { id: '77777777-7777-4777-a777-777777777772' },
        update: {},
        create: {
            id: '77777777-7777-4777-a777-777777777772',
            ingredientId: ingWholeMilk.id,
            quantity: -1000,
            type: AdjustmentType.SPOILED,
            reason: 'Left outside refrigerator overnight',
            createdById: adminId,
            updatedById: adminId
        }
    });

    // ==========================================
    // 8. SEED PRODUCT ATTRIBUTES & VALUES
    // ==========================================
    const attrSize = await prisma.productAttribute.upsert({
        where: { id: '99999999-9999-4999-a999-999999999991' },
        update: {},
        create: {
            id: '99999999-9999-4999-a999-999999999991',
            name: 'Size',
            description: 'Beverage serving size option',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const attrMilk = await prisma.productAttribute.upsert({
        where: { id: '99999999-9999-4999-a999-999999999992' },
        update: {},
        create: {
            id: '99999999-9999-4999-a999-999999999992',
            name: 'Milk Type',
            description: 'Dairy or dairy-free alternative milk choices',
            createdById: adminId,
            updatedById: adminId
        }
    });

    // Attribute Values (Sizes)
    const valSize12 = await prisma.productAttributeValue.upsert({
        where: { id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa1' },
        update: {},
        create: {
            id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa1',
            productAttributeId: attrSize.id,
            value: '12oz (Regular)',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const valSize16 = await prisma.productAttributeValue.upsert({
        where: { id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa2' },
        update: {},
        create: {
            id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa2',
            productAttributeId: attrSize.id,
            value: '16oz (Large)',
            createdById: adminId,
            updatedById: adminId
        }
    });

    // Attribute Values (Milk Options)
    const valMilkWhole = await prisma.productAttributeValue.upsert({
        where: { id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa3' },
        update: {},
        create: {
            id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa3',
            productAttributeId: attrMilk.id,
            value: 'Whole Milk',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const valMilkOat = await prisma.productAttributeValue.upsert({
        where: { id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa4' },
        update: {},
        create: {
            id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa4',
            productAttributeId: attrMilk.id,
            value: 'Oat Milk Alternative',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const valMilkAlmond = await prisma.productAttributeValue.upsert({
        where: { id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa5' },
        update: {},
        create: {
            id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa5',
            productAttributeId: attrMilk.id,
            value: 'Almond Milk Alternative',
            createdById: adminId,
            updatedById: adminId
        }
    });

    // Helper to seed a variant, map its size/milk attributes, and create its recipe
    async function seedVariantWithRecipe(
        id: string,
        productId: string,
        sku: string,
        price: number,
        attributeIds: string[],
        recipeName: string,
        recipeDesc: string,
        ingredients: { ingredientId: string; qty: number; unitId: string }[]
    ) {
        const variant = await prisma.productVariant.upsert({
            where: { id },
            update: { price },
            create: {
                id,
                productId,
                sku,
                price,
                createdById: adminId,
                updatedById: adminId
            }
        });

        await prisma.productVariantAttribute.deleteMany({
            where: { productVariantId: variant.id }
        });

        for (let i = 0; i < attributeIds.length; i++) {
            const valId = attributeIds[i];
            await prisma.productVariantAttribute.create({
                data: {
                    productVariantId: variant.id,
                    productAttributeValueId: valId,
                    createdById: adminId,
                    updatedById: adminId
                }
            });
        }

        const recipe = await prisma.recipe.upsert({
            where: { productVariantId: variant.id },
            update: { name: recipeName, description: recipeDesc },
            create: {
                name: recipeName,
                description: recipeDesc,
                productVariantId: variant.id,
                createdById: adminId,
                updatedById: adminId
            }
        });

        await prisma.recipeIngredient.deleteMany({
            where: { recipeId: recipe.id }
        });

        for (let j = 0; j < ingredients.length; j++) {
            const ing = ingredients[j];
            await prisma.recipeIngredient.create({
                data: {
                    recipeId: recipe.id,
                    ingredientId: ing.ingredientId,
                    quantity: ing.qty,
                    ingredientUnitId: ing.unitId,
                    createdById: adminId,
                    updatedById: adminId
                }
            });
        }
    }

    // ==========================================
    // 9. SEED PRODUCTS
    // ==========================================

    // ESPRESSO (Coffee category)
    const prodAmericano = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888881' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888881',
            name: 'Café Americano',
            description: 'Rich, full-bodied signature espresso shot combined with filtered hot/iced water',
            photo: '/uploads/images/americano.jpg',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodLatte = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888882' },
        update: { name: 'Cappuccino/Latte' },
        create: {
            id: '88888888-8888-4888-a888-888888888882',
            name: 'Cappuccino/Latte',
            description: 'Velvety espresso combined with perfectly steamed milk and a thin microfoam layer',
            photo: '/uploads/images/cafe-lattle.jpg',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodSpanishLatte = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888883' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888883',
            name: 'Spanish Latte',
            description: 'Sweet, creamy, espresso-forward latte sweetened with rich condensed milk',
            photo: '/uploads/images/spanish-lattle.jpg',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodCaramelLatte = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888884' },
        update: { name: 'Caramel Latte' },
        create: {
            id: '88888888-8888-4888-a888-888888888884',
            name: 'Caramel Latte',
            description: 'Espresso combined with milk and buttery caramel syrup',
            photo: '/uploads/images/caramel-macchiato.jpg',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodHazelnutLatte = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888890' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888890',
            name: 'Hazelnut Latte',
            description: 'Espresso combined with milk and sweet hazelnut syrup',
            photo: '/uploads/images/hazelnut-latte.jpg',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodWhiteMochaLatte = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888891' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888891',
            name: 'White Mocha Latte',
            description: 'Espresso combined with milk and sweet white chocolate sauce',
            photo: '/uploads/images/white-mocha.jpg',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodDarkMochaLatte = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888892' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888892',
            name: 'Dark Mocha Latte',
            description: 'Espresso combined with milk and rich dark chocolate sauce',
            photo: '/uploads/images/dark-mocha.jpg',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodDirtyMatcha = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888893' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888893',
            name: 'Dirty Matcha',
            description: 'Authentic matcha latte marked with a double shot of espresso',
            photo: '/uploads/images/dirty-matcha.jpg',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    // NON-COFFEE
    const prodMatchaLatte = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888885' },
        update: { name: 'Matcha Latte' },
        create: {
            id: '88888888-8888-4888-a888-888888888885',
            name: 'Matcha Latte',
            description: 'Premium Japanese stone-ground matcha tea whisked over creamy milk',
            photo: '/uploads/images/uji-macha-lattle.png',
            productCategoryId: categoryNonCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodStrawberryMilk = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888894' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888894',
            name: 'Strawberry Milk',
            description: 'Creamy milk blended with sweet, real strawberry purée',
            photo: '/uploads/images/strawberry-milk.jpg',
            productCategoryId: categoryNonCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodStrawberryMatcha = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888895' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888895',
            name: 'Strawberry Matcha',
            description: 'Layered drink with strawberry purée, milk, and premium matcha green tea',
            photo: '/uploads/images/strawberry-matcha.jpg',
            productCategoryId: categoryNonCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodDarkChocolate = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888886' },
        update: { name: 'Dark Chocolate' },
        create: {
            id: '88888888-8888-4888-a888-888888888886',
            name: 'Dark Chocolate',
            description: 'Decadent dark cocoa combined with rich milk',
            photo: '/uploads/images/signature-hot-chocolate.jpg',
            productCategoryId: categoryNonCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodThaiMilktea = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888896' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888896',
            name: 'Thai Milktea',
            description: 'Sweet, creamy Thai milk tea served over ice',
            photo: '/uploads/images/thai-milktea.jpg',
            productCategoryId: categoryNonCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodLemonFruitTea = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888897' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888897',
            name: 'Lemon Fruit Tea',
            description: 'Refreshing fruit tea infused with fresh lemon flavor',
            photo: '/uploads/images/lemon-tea.jpg',
            productCategoryId: categoryNonCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodLycheeFruitTea = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888898' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888898',
            name: 'Lychee Fruit Tea',
            description: 'Sweet and crisp fruit tea infused with lychee flavor',
            photo: '/uploads/images/lychee-tea.jpg',
            productCategoryId: categoryNonCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodBottledWater = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888899' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888899',
            name: 'Bottled Water',
            description: 'Fresh, clean bottled drinking water',
            photo: '/uploads/images/bottled-water.jpg',
            productCategoryId: categoryNonCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    // SIGNATURE DRINKS
    const prodBiscoffLatte = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888900' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888900',
            name: 'Biscoff Latte',
            description: 'Espresso and milk infused with caramelized Biscoff cookie spread',
            photo: '/uploads/images/biscoff-latte.jpg',
            productCategoryId: categorySignature.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodCreamySeasaltLatte = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888901' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888901',
            name: 'Creamy Seasalt Latte',
            description: 'Iced latte topped with our signature creamy seasalt cold foam',
            photo: '/uploads/images/seasalt-latte.jpg',
            productCategoryId: categorySignature.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodCinnamonOatLatte = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888902' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888902',
            name: 'Cinnamon Oat Latte',
            description: 'Espresso combined with creamy oat milk and a dash of sweet cinnamon',
            photo: '/uploads/images/cinnamon-oat-latte.jpg',
            productCategoryId: categorySignature.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    // PASTRIES
    const prodCroissant = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888887' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888887',
            name: 'Classic Butter Croissant',
            description: 'Flaky, buttery, oven-fresh laminated pastry baked fresh daily',
            photo: '/uploads/images/classic-butter-croissant.jpg',
            productCategoryId: categoryPastries.id,
            productTypeId: typeBaked.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodChocCroissant = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888888' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888888',
            name: 'Pain au Chocolat',
            description: 'Rich dark chocolate baton wrapped in buttery, flaky golden layers',
            photo: '/uploads/images/plain-au-chocolat.jpg',
            productCategoryId: categoryPastries.id,
            productTypeId: typeBaked.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodCookie = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888889' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888889',
            name: 'Chocolate Chip Cookie',
            description: 'Soft-baked, chewy cookie loaded with premium milk and dark chocolate chunks',
            photo: '/uploads/images/chocolate-chip-cookie.jpg',
            productCategoryId: categoryPastries.id,
            productTypeId: typeBaked.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    // ==========================================
    // 10. SEED PRODUCT VARIANTS & RECIPES
    // ==========================================

    // A. CAFÉ AMERICANO
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb1',
        prodAmericano.id,
        'BK-AME-12',
        75.0,
        [valSize12.id],
        '12oz Café Americano',
        'Double shot pull (18g beans) with 200ml hot water base',
        [{ ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id }]
    );
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb2',
        prodAmericano.id,
        'BK-AME-16',
        80.0,
        [valSize16.id],
        '16oz Café Americano',
        'Double shot pull (18g beans) with 300ml iced water base',
        [{ ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id }]
    );

    // Helper to generate milk-combination variants for Latte-based drinks
    async function seedLatteVariants(params: {
        productId: string;
        skuPrefix: string;
        baseHotPrice: number;
        baseIcedPrice: number;
        namePrefix: string;
        beansQty: number;
        condensedQty?: number;
        ids: {
            hotWM: string;
            icedWM: string;
            hotOM: string;
            icedOM: string;
            hotAM: string;
            icedAM: string;
        };
    }) {
        const { productId, skuPrefix, baseHotPrice, baseIcedPrice, namePrefix, beansQty, condensedQty = 0, ids } = params;

        const sizes = [
            { id: valSize12.id, label: '12oz Hot', price: baseHotPrice, sku: '12' },
            { id: valSize16.id, label: '16oz Iced', price: baseIcedPrice, sku: '16' }
        ];

        const milks = [
            { id: valMilkWhole.id, label: 'Whole Milk', sku: 'WM', extra: 0, ing: ingWholeMilk.id, ids: { '12': ids.hotWM, '16': ids.icedWM } },
            { id: valMilkOat.id, label: 'Oat Milk', sku: 'OM', extra: 55, ing: ingOatMilk.id, ids: { '12': ids.hotOM, '16': ids.icedOM } },
            { id: valMilkAlmond.id, label: 'Almond Milk', sku: 'AM', extra: 55, ing: ingAlmondMilk.id, ids: { '12': ids.hotAM, '16': ids.icedAM } }
        ];

        for (const size of sizes) {
            for (const milk of milks) {
                const variantId = size.sku === '12' ? milk.ids['12'] : milk.ids['16'];
                const ingredients = [
                    { ingredientId: ingBeans.id, qty: beansQty, unitId: unitGrams.id },
                    { ingredientId: milk.ing, qty: size.sku === '12' ? 220 : 280, unitId: unitMilliliters.id }
                ];
                if (condensedQty > 0) {
                    ingredients.push({
                        ingredientId: ingCondensed.id,
                        qty: size.sku === '12' ? condensedQty : condensedQty + 10,
                        unitId: unitGrams.id
                    });
                }

                await seedVariantWithRecipe(
                    variantId,
                    productId,
                    `BK-${skuPrefix}-${size.sku}-${milk.sku}`,
                    size.price + milk.extra,
                    [size.id, milk.id],
                    `${size.label} ${namePrefix} (${milk.label})`,
                    `Double shot pull (${beansQty}g beans) with ${size.sku === '12' ? 220 : 280}ml steamed/chilled ${milk.label.toLowerCase()}`,
                    ingredients
                );
            }
        }
    }

    // B. CAPPUCCINO/LATTE
    await seedLatteVariants({
        productId: prodLatte.id,
        skuPrefix: 'LAT',
        baseHotPrice: 80.0,
        baseIcedPrice: 90.0,
        namePrefix: 'Cappuccino/Latte',
        beansQty: 18.0,
        ids: {
            hotWM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb3',
            icedWM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb4',
            hotOM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb5',
            icedOM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb6',
            hotAM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb7',
            icedAM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb8'
        }
    });

    // C. SPANISH LATTE
    await seedLatteVariants({
        productId: prodSpanishLatte.id,
        skuPrefix: 'SL',
        baseHotPrice: 95.0,
        baseIcedPrice: 105.0,
        namePrefix: 'Spanish Latte',
        beansQty: 18.0,
        condensedQty: 25.0,
        ids: {
            hotWM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb9',
            icedWM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb10',
            hotOM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb61', // New IDs
            icedOM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb11', // Original ID
            hotAM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb62',
            icedAM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb63'
        }
    });

    // D. CARAMEL LATTE
    await seedLatteVariants({
        productId: prodCaramelLatte.id,
        skuPrefix: 'CL',
        baseHotPrice: 105.0,
        baseIcedPrice: 115.0,
        namePrefix: 'Caramel Latte',
        beansQty: 18.0,
        ids: {
            hotWM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb12', // Original
            icedWM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb13', // Original
            hotOM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb64',
            icedOM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb14', // Original
            hotAM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb65',
            icedAM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb66'
        }
    });

    // E. HAZELNUT LATTE
    await seedLatteVariants({
        productId: prodHazelnutLatte.id,
        skuPrefix: 'HL',
        baseHotPrice: 95.0,
        baseIcedPrice: 105.0,
        namePrefix: 'Hazelnut Latte',
        beansQty: 18.0,
        ids: {
            hotWM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb23',
            icedWM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb24',
            hotOM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb25',
            icedOM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb26',
            hotAM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb27',
            icedAM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb28'
        }
    });

    // F. WHITE MOCHA LATTE
    await seedLatteVariants({
        productId: prodWhiteMochaLatte.id,
        skuPrefix: 'WML',
        baseHotPrice: 100.0,
        baseIcedPrice: 110.0,
        namePrefix: 'White Mocha Latte',
        beansQty: 18.0,
        ids: {
            hotWM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb29',
            icedWM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb30',
            hotOM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb31',
            icedOM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb32',
            hotAM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb33',
            icedAM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb34'
        }
    });

    // G. DARK MOCHA LATTE
    await seedLatteVariants({
        productId: prodDarkMochaLatte.id,
        skuPrefix: 'DML',
        baseHotPrice: 95.0,
        baseIcedPrice: 105.0,
        namePrefix: 'Dark Mocha Latte',
        beansQty: 18.0,
        ids: {
            hotWM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb35',
            icedWM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb36',
            hotOM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb37',
            icedOM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb38',
            hotAM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb39',
            icedAM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb40'
        }
    });

    // H. DIRTY MATCHA
    await seedLatteVariants({
        productId: prodDirtyMatcha.id,
        skuPrefix: 'DIR-MAT',
        baseHotPrice: 110.0,
        baseIcedPrice: 120.0,
        namePrefix: 'Dirty Matcha',
        beansQty: 18.0,
        ids: {
            hotWM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb41',
            icedWM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb42',
            hotOM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb43',
            icedOM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb44',
            hotAM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb45',
            icedAM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb46'
        }
    });

    // NON-COFFEE: MATCHA LATTE
    await seedLatteVariants({
        productId: prodMatchaLatte.id,
        skuPrefix: 'MAT',
        baseHotPrice: 95.0,
        baseIcedPrice: 105.0,
        namePrefix: 'Matcha Latte',
        beansQty: 0,
        ids: {
            hotWM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb15',
            icedWM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb16',
            hotOM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb67',
            icedOM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb17',
            hotAM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb68',
            icedAM: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb69'
        }
    });

    // NON-COFFEE: STRAWBERRY MILK
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb47',
        prodStrawberryMilk.id,
        'BK-SWM-16-WM',
        95.0,
        [valSize16.id, valMilkWhole.id],
        '16oz Iced Strawberry Milk',
        'Real strawberry purée topped with chilled whole milk',
        [{ ingredientId: ingWholeMilk.id, qty: 280.0, unitId: unitMilliliters.id }]
    );

    // NON-COFFEE: STRAWBERRY MATCHA
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb48',
        prodStrawberryMatcha.id,
        'BK-SWM-MAT-16-WM',
        120.0,
        [valSize16.id, valMilkWhole.id],
        '16oz Iced Strawberry Matcha',
        'Strawberry purée base, whole milk, and premium matcha green tea layer',
        [
            { ingredientId: ingWholeMilk.id, qty: 250.0, unitId: unitMilliliters.id },
            { ingredientId: ingMatcha.id, qty: 6.0, unitId: unitGrams.id }
        ]
    );

    // NON-COFFEE: DARK CHOCOLATE
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb18',
        prodDarkChocolate.id,
        'BK-DCH-12-WM',
        70.0,
        [valSize12.id, valMilkWhole.id],
        '12oz Hot Dark Chocolate',
        'Steamed whole milk blended with premium dark chocolate sauce',
        [
            { ingredientId: ingWholeMilk.id, qty: 220.0, unitId: unitMilliliters.id },
            { ingredientId: ingChocolate.id, qty: 30.0, unitId: unitGrams.id }
        ]
    );
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb19',
        prodDarkChocolate.id,
        'BK-DCH-16-WM',
        80.0,
        [valSize16.id, valMilkWhole.id],
        '16oz Iced Dark Chocolate',
        'Chilled whole milk blended with premium dark chocolate sauce and served over ice',
        [
            { ingredientId: ingWholeMilk.id, qty: 280.0, unitId: unitMilliliters.id },
            { ingredientId: ingChocolate.id, qty: 40.0, unitId: unitGrams.id }
        ]
    );

    // NON-COFFEE: THAI MILKTEA
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb49',
        prodThaiMilktea.id,
        'BK-TMT-16-WM',
        90.0,
        [valSize16.id, valMilkWhole.id],
        '16oz Iced Thai Milktea',
        'Brewed sweet Thai tea leaves sweetened with condensed milk and whole milk',
        [{ ingredientId: ingWholeMilk.id, qty: 280.0, unitId: unitMilliliters.id }]
    );

    // NON-COFFEE: LEMON FRUIT TEA
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb50',
        prodLemonFruitTea.id,
        'BK-LFT-16',
        80.0,
        [valSize16.id],
        '16oz Iced Lemon Fruit Tea',
        'Refreshing iced black tea infused with lemon syrup',
        []
    );

    // NON-COFFEE: LYCHEE FRUIT TEA
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb51',
        prodLycheeFruitTea.id,
        'BK-LYFT-16',
        80.0,
        [valSize16.id],
        '16oz Iced Lychee Fruit Tea',
        'Refreshing iced black tea infused with lychee syrup',
        []
    );

    // NON-COFFEE: BOTTLED WATER
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb52',
        prodBottledWater.id,
        'BK-WTR-STD',
        15.0,
        [],
        'Bottled Water',
        '500ml purified bottled drinking water',
        []
    );

    // SIGNATURE DRINKS: BISCOFF LATTE
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb53',
        prodBiscoffLatte.id,
        'BK-BIS-12-WM',
        135.0,
        [valSize12.id, valMilkWhole.id],
        '12oz Hot Biscoff Latte',
        'Caramelized Lotus Biscoff spread melted into steamed whole milk and double espresso',
        [
            { ingredientId: ingWholeMilk.id, qty: 220.0, unitId: unitMilliliters.id },
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id }
        ]
    );
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb54',
        prodBiscoffLatte.id,
        'BK-BIS-16-WM',
        145.0,
        [valSize16.id, valMilkWhole.id],
        '16oz Iced Biscoff Latte',
        'Caramelized Lotus Biscoff spread melted into chilled whole milk and double espresso',
        [
            { ingredientId: ingWholeMilk.id, qty: 280.0, unitId: unitMilliliters.id },
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id }
        ]
    );
    // Oat milk variants for Biscoff Latte
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb55',
        prodBiscoffLatte.id,
        'BK-BIS-12-OM',
        190.0,
        [valSize12.id, valMilkOat.id],
        '12oz Hot Biscoff Latte (Oat Milk)',
        'Caramelized Lotus Biscoff spread melted into steamed plant oat milk and double espresso',
        [
            { ingredientId: ingOatMilk.id, qty: 220.0, unitId: unitMilliliters.id },
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id }
        ]
    );
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb56',
        prodBiscoffLatte.id,
        'BK-BIS-16-OM',
        200.0,
        [valSize16.id, valMilkOat.id],
        '16oz Iced Biscoff Latte (Oat Milk)',
        'Caramelized Lotus Biscoff spread melted into chilled plant oat milk and double espresso',
        [
            { ingredientId: ingOatMilk.id, qty: 280.0, unitId: unitMilliliters.id },
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id }
        ]
    );

    // SIGNATURE DRINKS: CREAMY SEASALT LATTE
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb57',
        prodCreamySeasaltLatte.id,
        'BK-CSSL-16-WM',
        140.0,
        [valSize16.id, valMilkWhole.id],
        '16oz Iced Creamy Seasalt Latte',
        'Chilled whole milk and double espresso topped with signature seasalt cold foam',
        [
            { ingredientId: ingWholeMilk.id, qty: 250.0, unitId: unitMilliliters.id },
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id }
        ]
    );
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb58',
        prodCreamySeasaltLatte.id,
        'BK-CSSL-16-OM',
        195.0,
        [valSize16.id, valMilkOat.id],
        '16oz Iced Creamy Seasalt Latte (Oat Milk)',
        'Chilled plant oat milk and double espresso topped with signature seasalt cold foam',
        [
            { ingredientId: ingOatMilk.id, qty: 250.0, unitId: unitMilliliters.id },
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id }
        ]
    );

    // SIGNATURE DRINKS: CINNAMON OAT LATTE
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb59',
        prodCinnamonOatLatte.id,
        'BK-COL-12-OM',
        130.0,
        [valSize12.id, valMilkOat.id],
        '12oz Hot Cinnamon Oat Latte',
        'Steamed plant oat milk combined with a shot of cinnamon and double espresso',
        [
            { ingredientId: ingOatMilk.id, qty: 220.0, unitId: unitMilliliters.id },
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id }
        ]
    );
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb60',
        prodCinnamonOatLatte.id,
        'BK-COL-16-OM',
        140.0,
        [valSize16.id, valMilkOat.id],
        '16oz Iced Cinnamon Oat Latte',
        'Chilled plant oat milk combined with a shot of cinnamon and double espresso served over ice',
        [
            { ingredientId: ingOatMilk.id, qty: 280.0, unitId: unitMilliliters.id },
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id }
        ]
    );

    // PASTRIES
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb20',
        prodCroissant.id,
        'BK-CR-STD',
        110.0,
        [],
        'Classic Butter Croissant',
        '1 piece frozen butter croissant dough baked in oven',
        [{ ingredientId: ingCroissant.id, qty: 1.0, unitId: unitPieces.id }]
    );
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb21',
        prodChocCroissant.id,
        'BK-PAC-STD',
        125.0,
        [],
        'Pain au Chocolat',
        '1 piece frozen chocolate croissant dough baked in oven',
        [{ ingredientId: ingChocCroissant.id, qty: 1.0, unitId: unitPieces.id }]
    );
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb22',
        prodCookie.id,
        'BK-CK-STD',
        85.0,
        [],
        'Chocolate Chip Cookie',
        '1 piece frozen cookie dough baked soft in oven',
        [{ ingredientId: ingCookie.id, qty: 1.0, unitId: unitPieces.id }]
    );

    // ==========================================
    // 11. SEED MODIFIERS AND MODIFIER RECIPES
    // ==========================================
    console.log('Seeding Modifiers and Modifier Recipes...');

    const modgMilk = await prisma.modifierGroup.upsert({
        where: { id: 'cccccccc-cccc-4ccc-accc-cccccccccccc' },
        update: {},
        create: {
            id: 'cccccccc-cccc-4ccc-accc-cccccccccccc',
            name: 'Milk Alternatives',
            isRequired: false,
            minSelect: 0,
            maxSelect: 1,
            products: {
                connect: [
                    { id: prodLatte.id },
                    { id: prodSpanishLatte.id },
                    { id: prodCaramelLatte.id },
                    { id: prodHazelnutLatte.id },
                    { id: prodWhiteMochaLatte.id },
                    { id: prodDarkMochaLatte.id },
                    { id: prodDirtyMatcha.id },
                    { id: prodMatchaLatte.id },
                    { id: prodBiscoffLatte.id },
                    { id: prodCreamySeasaltLatte.id }
                ]
            }
        }
    });

    const modgAddons = await prisma.modifierGroup.upsert({
        where: { id: 'cccccccc-cccc-4ccc-accc-cccccccccccd' },
        update: { name: 'Add-ons' },
        create: {
            id: 'cccccccc-cccc-4ccc-accc-cccccccccccd',
            name: 'Add-ons',
            isRequired: false,
            minSelect: 0,
            maxSelect: 4,
            products: {
                connect: [
                    { id: prodAmericano.id },
                    { id: prodLatte.id },
                    { id: prodSpanishLatte.id },
                    { id: prodCaramelLatte.id },
                    { id: prodHazelnutLatte.id },
                    { id: prodWhiteMochaLatte.id },
                    { id: prodDarkMochaLatte.id },
                    { id: prodDirtyMatcha.id },
                    { id: prodMatchaLatte.id },
                    { id: prodStrawberryMilk.id },
                    { id: prodStrawberryMatcha.id },
                    { id: prodDarkChocolate.id },
                    { id: prodThaiMilktea.id },
                    { id: prodLemonFruitTea.id },
                    { id: prodLycheeFruitTea.id },
                    { id: prodBiscoffLatte.id },
                    { id: prodCreamySeasaltLatte.id },
                    { id: prodCinnamonOatLatte.id }
                ]
            }
        }
    });

    // Modifier options
    const modoOatMilk = await prisma.modifierOption.upsert({
        where: { id: 'dddddddd-dddd-4ddd-addd-dddddddddddd' },
        update: { price: 55.0 },
        create: {
            id: 'dddddddd-dddd-4ddd-addd-dddddddddddd',
            modifierGroupId: modgMilk.id,
            name: 'Oat Milk Add-on',
            price: 55.0
        }
    });

    const modoAlmondMilk = await prisma.modifierOption.upsert({
        where: { id: 'dddddddd-dddd-4ddd-addd-ddddddddddde' },
        update: { price: 55.0 },
        create: {
            id: 'dddddddd-dddd-4ddd-addd-ddddddddddde',
            modifierGroupId: modgMilk.id,
            name: 'Almond Milk Add-on',
            price: 55.0
        }
    });

    const modoVanilla = await prisma.modifierOption.upsert({
        where: { id: 'dddddddd-dddd-4ddd-addd-dddddddddddf' },
        update: {},
        create: {
            id: 'dddddddd-dddd-4ddd-addd-dddddddddddf',
            modifierGroupId: modgAddons.id,
            name: 'Vanilla Syrup Shot',
            price: 20.0
        }
    });

    const modoCaramel = await prisma.modifierOption.upsert({
        where: { id: 'dddddddd-dddd-4ddd-addd-dddddddddd01' },
        update: {},
        create: {
            id: 'dddddddd-dddd-4ddd-addd-dddddddddd01',
            modifierGroupId: modgAddons.id,
            name: 'Extra Caramel Drizzle',
            price: 20.0
        }
    });

    const modoEspressoShot = await prisma.modifierOption.upsert({
        where: { id: 'dddddddd-dddd-4ddd-addd-dddddddddd02' },
        update: {},
        create: {
            id: 'dddddddd-dddd-4ddd-addd-dddddddddd02',
            modifierGroupId: modgAddons.id,
            name: 'Espresso Shot',
            price: 35.0
        }
    });

    const modoWhippedCream = await prisma.modifierOption.upsert({
        where: { id: 'dddddddd-dddd-4ddd-addd-dddddddddd03' },
        update: {},
        create: {
            id: 'dddddddd-dddd-4ddd-addd-dddddddddd03',
            modifierGroupId: modgAddons.id,
            name: 'Whipped Cream',
            price: 30.0
        }
    });

    const modoSeasaltCream = await prisma.modifierOption.upsert({
        where: { id: 'dddddddd-dddd-4ddd-addd-dddddddddd04' },
        update: {},
        create: {
            id: 'dddddddd-dddd-4ddd-addd-dddddddddd04',
            modifierGroupId: modgAddons.id,
            name: 'Seasalt Cream',
            price: 25.0
        }
    });

    // Recipes for modifier options
    async function seedModifierRecipe(
        id: string,
        optionId: string,
        recipeName: string,
        recipeDesc: string,
        ingredients: { ingredientId: string; qty: number; unitId: string }[]
    ) {
        const recipe = await prisma.recipe.upsert({
            where: { modifierOptionId: optionId },
            update: { name: recipeName, description: recipeDesc },
            create: {
                id,
                name: recipeName,
                description: recipeDesc,
                modifierOptionId: optionId,
                createdById: adminId,
                updatedById: adminId
            }
        });

        await prisma.recipeIngredient.deleteMany({
            where: { recipeId: recipe.id }
        });

        for (let j = 0; j < ingredients.length; j++) {
            const ing = ingredients[j];
            await prisma.recipeIngredient.create({
                data: {
                    recipeId: recipe.id,
                    ingredientId: ing.ingredientId,
                    quantity: ing.qty,
                    ingredientUnitId: ing.unitId,
                    createdById: adminId,
                    updatedById: adminId
                }
            });
        }
    }

    await seedModifierRecipe(
        'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee',
        modoOatMilk.id,
        'Oat Milk Modifier Recipe',
        '220ml of oat milk for customization',
        [{ ingredientId: ingOatMilk.id, qty: 220.0, unitId: unitMilliliters.id }]
    );

    await seedModifierRecipe(
        'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeea',
        modoAlmondMilk.id,
        'Almond Milk Modifier Recipe',
        '220ml of almond milk for customization',
        [{ ingredientId: ingAlmondMilk.id, qty: 220.0, unitId: unitMilliliters.id }]
    );

    await seedModifierRecipe('eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeeb', modoVanilla.id, 'Vanilla Syrup Modifier Recipe', '15ml of vanilla syrup shot', [
        { ingredientId: ingVanilla.id, qty: 15.0, unitId: unitMilliliters.id }
    ]);

    await seedModifierRecipe('eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeec', modoCaramel.id, 'Caramel Drizzle Modifier Recipe', '15ml of caramel drizzle', [
        { ingredientId: ingCaramel.id, qty: 15.0, unitId: unitMilliliters.id }
    ]);

    await seedModifierRecipe('eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeed', modoEspressoShot.id, 'Espresso Shot Modifier Recipe', '9g of espresso beans', [
        { ingredientId: ingBeans.id, qty: 9.0, unitId: unitGrams.id }
    ]);

    await seedModifierRecipe('eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee2', modoWhippedCream.id, 'Whipped Cream Modifier Recipe', '30g whipped cream', []);
    await seedModifierRecipe('eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee3', modoSeasaltCream.id, 'Seasalt Cream Modifier Recipe', '25g seasalt cream', []);

    // ==========================================
    // SEED PURCHASE ORDERS
    // ==========================================
    console.log('Seeding Purchase Orders...');

    // Draft Purchase Order
    await prisma.purchaseOrder.upsert({
        where: { poNumber: 'PO-20260613-0001' },
        update: {},
        create: {
            poNumber: 'PO-20260613-0001',
            status: 'DRAFT',
            notes: 'Stocking up on Espresso Beans for the summer rush',
            totalAmount: 2000.0,
            supplierId: supplierRoastery.id,
            createdById: adminId,
            items: {
                create: [
                    {
                        ingredientId: ingBeans.id,
                        quantity: 5000,
                        unitCost: 0.4,
                        totalCost: 2000.0
                    }
                ]
            }
        }
    });

    // Sent Purchase Order
    await prisma.purchaseOrder.upsert({
        where: { poNumber: 'PO-20260613-0002' },
        update: {},
        create: {
            poNumber: 'PO-20260613-0002',
            status: 'SENT',
            notes: 'Regular weekly dairy restocking',
            totalAmount: 3960.0,
            supplierId: supplierDairy.id,
            createdById: adminId,
            orderedAt: new Date(),
            items: {
                create: [
                    {
                        ingredientId: ingWholeMilk.id,
                        quantity: 24000,
                        unitCost: 0.09,
                        totalCost: 2160.0
                    },
                    {
                        ingredientId: ingOatMilk.id,
                        quantity: 12000,
                        unitCost: 0.15,
                        totalCost: 1800.0
                    }
                ]
            }
        }
    });

    // Received Purchase Order
    await prisma.purchaseOrder.upsert({
        where: { poNumber: 'PO-20260612-0003' },
        update: {},
        create: {
            poNumber: 'PO-20260612-0003',
            status: 'RECEIVED',
            notes: 'Syrups and matchas order',
            totalAmount: 1800.0,
            supplierId: supplierGrocery.id,
            createdById: adminId,
            orderedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            receivedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
            items: {
                create: [
                    {
                        ingredientId: ingMatcha.id,
                        quantity: 1000,
                        unitCost: 1.2,
                        totalCost: 1200.0
                    },
                    {
                        ingredientId: ingVanilla.id,
                        quantity: 6000,
                        unitCost: 0.1,
                        totalCost: 600.0
                    }
                ]
            }
        }
    });

    // Cancelled Purchase Order
    await prisma.purchaseOrder.upsert({
        where: { poNumber: 'PO-20260610-0004' },
        update: {},
        create: {
            poNumber: 'PO-20260610-0004',
            status: 'CANCELLED',
            notes: 'Duplicate request, cancelling',
            totalAmount: 1750.0,
            supplierId: supplierGrocery.id,
            createdById: adminId,
            items: {
                create: [
                    {
                        ingredientId: ingChocolate.id,
                        quantity: 5000,
                        unitCost: 0.35,
                        totalCost: 1750.0
                    }
                ]
            }
        }
    });

    console.log('Explicit Products, Recipes, Inventory, and Suppliers Seeded successfully!');
}
