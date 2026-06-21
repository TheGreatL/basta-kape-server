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

    const typeHot = await prisma.productType.upsert({
        where: { id: '22222222-2222-4222-a222-222222222222' },
        update: {},
        create: {
            id: '22222222-2222-4222-a222-222222222222',
            name: 'Hot Drinks',
            description: 'Warm beverages brewed to perfection',
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
    // Helper to create ingredient and initialize inventory status
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
    // 8. SEED PRODUCTS
    // ==========================================
    const prodAmericano = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888881' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888881',
            name: 'Café Americano',
            description: 'Rich, full-bodied signature espresso shot combined with filtered hot/iced water',
            photo: '/uploads/images/coffee-test.jpg',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodLatte = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888882' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888882',
            name: 'Café Latte',
            description: 'Velvety espresso combined with perfectly steamed milk and a thin microfoam layer',
            photo: '/uploads/images/coffee-test.jpg',
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
            photo: '/uploads/images/coffee-test.jpg',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodCaramelMacchiato = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888884' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888884',
            name: 'Caramel Macchiato',
            description: 'Vanilla-flavored syrup marked with espresso, milk, and topped with buttery caramel drizzle',
            photo: '/uploads/images/coffee-test.jpg',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodMatchaLatte = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888885' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888885',
            name: 'Uji Matcha Latte',
            description: 'Premium Japanese stone-ground matcha tea whisked and sweetened over creamy milk',
            photo: '/uploads/images/coffee-test.jpg',
            productCategoryId: categoryNonCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodChocolate = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888886' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888886',
            name: 'Signature Hot Chocolate',
            description: 'Decadent dark cocoa melted into steamed whole milk for the ultimate comfort drink',
            photo: '/uploads/images/coffee-test.jpg',
            productCategoryId: categoryNonCoffee.id,
            productTypeId: typeHot.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodCroissant = await prisma.product.upsert({
        where: { id: '88888888-8888-4888-a888-888888888887' },
        update: {},
        create: {
            id: '88888888-8888-4888-a888-888888888887',
            name: 'Classic Butter Croissant',
            description: 'Flaky, buttery, oven-fresh laminated pastry baked fresh daily',
            photo: '/uploads/images/coffee-test.jpg',
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
            photo: '/uploads/images/coffee-test.jpg',
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
            photo: '/uploads/images/coffee-test.jpg',
            productCategoryId: categoryPastries.id,
            productTypeId: typeBaked.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    // ==========================================
    // 9. SEED PRODUCT ATTRIBUTES & VALUES
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

    // ==========================================
    // 10. SEED PRODUCT VARIANTS, RECIPES, AND CASING
    // ==========================================

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
        // Create Variant
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

        // Map Attributes
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

        // Create Recipe
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

        // Seed Recipe Ingredients
        // First clean up previous recipe ingredients for this recipe to keep it clean and synced
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

    // A. CAFÉ AMERICANO
    // Variant: 12oz
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb1',
        prodAmericano.id,
        'BK-AME-12',
        110.0,
        [valSize12.id],
        '12oz Café Americano Recipe',
        'Double shot pull (18g beans) with 200ml hot/cold water base',
        [{ ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id }]
    );
    // Variant: 16oz
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb2',
        prodAmericano.id,
        'BK-AME-16',
        125.0,
        [valSize16.id],
        '16oz Café Americano Recipe',
        'Double shot pull (18g beans) with 300ml hot/cold water base',
        [{ ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id }]
    );

    // B. CAFÉ LATTE
    // Variant: 12oz Whole Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb3',
        prodLatte.id,
        'BK-LAT-12-WM',
        135.0,
        [valSize12.id, valMilkWhole.id],
        '12oz Café Latte (Whole Milk)',
        'Double shot pull (18g beans) with 220ml steamed whole milk and light foam',
        [
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id },
            { ingredientId: ingWholeMilk.id, qty: 220.0, unitId: unitMilliliters.id }
        ]
    );
    // Variant: 16oz Whole Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb4',
        prodLatte.id,
        'BK-LAT-16-WM',
        150.0,
        [valSize16.id, valMilkWhole.id],
        '16oz Café Latte (Whole Milk)',
        'Double shot pull (18g beans) with 280ml steamed whole milk and light foam',
        [
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id },
            { ingredientId: ingWholeMilk.id, qty: 280.0, unitId: unitMilliliters.id }
        ]
    );
    // Variant: 12oz Oat Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb5',
        prodLatte.id,
        'BK-LAT-12-OM',
        165.0,
        [valSize12.id, valMilkOat.id],
        '12oz Café Latte (Oat Milk)',
        'Double shot pull (18g beans) with 220ml steamed plant oat milk',
        [
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id },
            { ingredientId: ingOatMilk.id, qty: 220.0, unitId: unitMilliliters.id }
        ]
    );
    // Variant: 16oz Oat Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb6',
        prodLatte.id,
        'BK-LAT-16-OM',
        180.0,
        [valSize16.id, valMilkOat.id],
        '16oz Café Latte (Oat Milk)',
        'Double shot pull (18g beans) with 280ml steamed plant oat milk',
        [
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id },
            { ingredientId: ingOatMilk.id, qty: 280.0, unitId: unitMilliliters.id }
        ]
    );
    // Variant: 12oz Almond Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb7',
        prodLatte.id,
        'BK-LAT-12-AM',
        165.0,
        [valSize12.id, valMilkAlmond.id],
        '12oz Café Latte (Almond Milk)',
        'Double shot pull (18g beans) with 220ml steamed plant almond milk',
        [
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id },
            { ingredientId: ingAlmondMilk.id, qty: 220.0, unitId: unitMilliliters.id }
        ]
    );
    // Variant: 16oz Almond Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb8',
        prodLatte.id,
        'BK-LAT-16-AM',
        180.0,
        [valSize16.id, valMilkAlmond.id],
        '16oz Café Latte (Almond Milk)',
        'Double shot pull (18g beans) with 280ml steamed plant almond milk',
        [
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id },
            { ingredientId: ingAlmondMilk.id, qty: 280.0, unitId: unitMilliliters.id }
        ]
    );

    // C. SPANISH LATTE
    // Variant: 12oz Whole Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb9',
        prodSpanishLatte.id,
        'BK-SL-12-WM',
        145.0,
        [valSize12.id, valMilkWhole.id],
        '12oz Spanish Latte (Whole Milk)',
        'Steamed whole milk sweetened with 25g condensed milk, marked with double espresso',
        [
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id },
            { ingredientId: ingWholeMilk.id, qty: 200.0, unitId: unitMilliliters.id },
            { ingredientId: ingCondensed.id, qty: 25.0, unitId: unitGrams.id }
        ]
    );
    // Variant: 16oz Whole Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb10',
        prodSpanishLatte.id,
        'BK-SL-16-WM',
        160.0,
        [valSize16.id, valMilkWhole.id],
        '16oz Spanish Latte (Whole Milk)',
        'Steamed whole milk sweetened with 35g condensed milk, marked with double espresso',
        [
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id },
            { ingredientId: ingWholeMilk.id, qty: 250.0, unitId: unitMilliliters.id },
            { ingredientId: ingCondensed.id, qty: 35.0, unitId: unitGrams.id }
        ]
    );
    // Variant: 16oz Oat Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb11',
        prodSpanishLatte.id,
        'BK-SL-16-OM',
        190.0,
        [valSize16.id, valMilkOat.id],
        '16oz Spanish Latte (Oat Milk)',
        'Steamed oat milk sweetened with 35g condensed milk, marked with double espresso',
        [
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id },
            { ingredientId: ingOatMilk.id, qty: 250.0, unitId: unitMilliliters.id },
            { ingredientId: ingCondensed.id, qty: 35.0, unitId: unitGrams.id }
        ]
    );

    // D. CARAMEL MACCHIATO
    // Variant: 12oz Whole Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb12',
        prodCaramelMacchiato.id,
        'BK-CM-12-WM',
        155.0,
        [valSize12.id, valMilkWhole.id],
        '12oz Caramel Macchiato (Whole Milk)',
        'Double shot pull, 220ml whole milk, 15ml vanilla syrup, topped with 10ml caramel drizzle',
        [
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id },
            { ingredientId: ingWholeMilk.id, qty: 220.0, unitId: unitMilliliters.id },
            { ingredientId: ingVanilla.id, qty: 15.0, unitId: unitMilliliters.id },
            { ingredientId: ingCaramel.id, qty: 10.0, unitId: unitMilliliters.id }
        ]
    );
    // Variant: 16oz Whole Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb13',
        prodCaramelMacchiato.id,
        'BK-CM-16-WM',
        170.0,
        [valSize16.id, valMilkWhole.id],
        '16oz Caramel Macchiato (Whole Milk)',
        'Double shot pull, 280ml whole milk, 20ml vanilla syrup, topped with 15ml caramel drizzle',
        [
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id },
            { ingredientId: ingWholeMilk.id, qty: 280.0, unitId: unitMilliliters.id },
            { ingredientId: ingVanilla.id, qty: 20.0, unitId: unitMilliliters.id },
            { ingredientId: ingCaramel.id, qty: 15.0, unitId: unitMilliliters.id }
        ]
    );
    // Variant: 16oz Oat Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb14',
        prodCaramelMacchiato.id,
        'BK-CM-16-OM',
        200.0,
        [valSize16.id, valMilkOat.id],
        '16oz Caramel Macchiato (Oat Milk)',
        'Double shot pull, 280ml oat milk, 20ml vanilla syrup, topped with 15ml caramel drizzle',
        [
            { ingredientId: ingBeans.id, qty: 18.0, unitId: unitGrams.id },
            { ingredientId: ingOatMilk.id, qty: 280.0, unitId: unitMilliliters.id },
            { ingredientId: ingVanilla.id, qty: 20.0, unitId: unitMilliliters.id },
            { ingredientId: ingCaramel.id, qty: 15.0, unitId: unitMilliliters.id }
        ]
    );

    // E. UJI MATCHA LATTE
    // Variant: 12oz Whole Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb15',
        prodMatchaLatte.id,
        'BK-MAT-12-WM',
        150.0,
        [valSize12.id, valMilkWhole.id],
        '12oz Uji Matcha Latte (Whole Milk)',
        '6g premium green tea powder blended with 15ml vanilla syrup and 220ml whole milk',
        [
            { ingredientId: ingMatcha.id, qty: 6.0, unitId: unitGrams.id },
            { ingredientId: ingWholeMilk.id, qty: 220.0, unitId: unitMilliliters.id },
            { ingredientId: ingVanilla.id, qty: 15.0, unitId: unitMilliliters.id }
        ]
    );
    // Variant: 16oz Whole Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb16',
        prodMatchaLatte.id,
        'BK-MAT-16-WM',
        165.0,
        [valSize16.id, valMilkWhole.id],
        '16oz Uji Matcha Latte (Whole Milk)',
        '8g premium green tea powder blended with 20ml vanilla syrup and 280ml whole milk',
        [
            { ingredientId: ingMatcha.id, qty: 8.0, unitId: unitGrams.id },
            { ingredientId: ingWholeMilk.id, qty: 280.0, unitId: unitMilliliters.id },
            { ingredientId: ingVanilla.id, qty: 20.0, unitId: unitMilliliters.id }
        ]
    );
    // Variant: 16oz Oat Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb17',
        prodMatchaLatte.id,
        'BK-MAT-16-OM',
        195.0,
        [valSize16.id, valMilkOat.id],
        '16oz Uji Matcha Latte (Oat Milk)',
        '8g premium green tea powder blended with 20ml vanilla syrup and 280ml plant oat milk',
        [
            { ingredientId: ingMatcha.id, qty: 8.0, unitId: unitGrams.id },
            { ingredientId: ingOatMilk.id, qty: 280.0, unitId: unitMilliliters.id },
            { ingredientId: ingVanilla.id, qty: 20.0, unitId: unitMilliliters.id }
        ]
    );

    // F. SIGNATURE HOT CHOCOLATE
    // Variant: 12oz Whole Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb18',
        prodChocolate.id,
        'BK-CHO-12-WM',
        140.0,
        [valSize12.id, valMilkWhole.id],
        '12oz Signature Hot Chocolate',
        '30g rich dark chocolate sauce combined with 220ml steamed whole milk',
        [
            { ingredientId: ingChocolate.id, qty: 30.0, unitId: unitGrams.id },
            { ingredientId: ingWholeMilk.id, qty: 220.0, unitId: unitMilliliters.id }
        ]
    );
    // Variant: 16oz Whole Milk
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb19',
        prodChocolate.id,
        'BK-CHO-16-WM',
        155.0,
        [valSize16.id, valMilkWhole.id],
        '16oz Signature Hot Chocolate',
        '40g rich dark chocolate sauce combined with 280ml steamed whole milk',
        [
            { ingredientId: ingChocolate.id, qty: 40.0, unitId: unitGrams.id },
            { ingredientId: ingWholeMilk.id, qty: 280.0, unitId: unitMilliliters.id }
        ]
    );

    // G. CLASSIC BUTTER CROISSANT
    // Variant: Standard
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb20',
        prodCroissant.id,
        'BK-CR-STD',
        110.0,
        [],
        'Classic Butter Croissant Recipe',
        '1 piece frozen butter croissant dough baked in oven',
        [{ ingredientId: ingCroissant.id, qty: 1.0, unitId: unitPieces.id }]
    );

    // H. PAIN AU CHOCOLAT (CHOCOLATE CROISSANT)
    // Variant: Standard
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb21',
        prodChocCroissant.id,
        'BK-PAC-STD',
        125.0,
        [],
        'Pain au Chocolat Recipe',
        '1 piece frozen chocolate croissant dough baked in oven',
        [{ ingredientId: ingChocCroissant.id, qty: 1.0, unitId: unitPieces.id }]
    );

    // I. CHOCOLATE CHIP COOKIE
    // Variant: Standard
    await seedVariantWithRecipe(
        'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbb22',
        prodCookie.id,
        'BK-CK-STD',
        85.0,
        [],
        'Chocolate Chip Cookie Recipe',
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
                    { id: prodCaramelMacchiato.id },
                    { id: prodMatchaLatte.id },
                    { id: prodChocolate.id }
                ]
            }
        }
    });

    const modgSyrups = await prisma.modifierGroup.upsert({
        where: { id: 'cccccccc-cccc-4ccc-accc-cccccccccccd' },
        update: {},
        create: {
            id: 'cccccccc-cccc-4ccc-accc-cccccccccccd',
            name: 'Add-on Syrups',
            isRequired: false,
            minSelect: 0,
            maxSelect: 3,
            products: {
                connect: [{ id: prodAmericano.id }, { id: prodLatte.id }, { id: prodSpanishLatte.id }, { id: prodCaramelMacchiato.id }]
            }
        }
    });

    // Modifier options
    const modoOatMilk = await prisma.modifierOption.upsert({
        where: { id: 'dddddddd-dddd-4ddd-addd-dddddddddddd' },
        update: {},
        create: {
            id: 'dddddddd-dddd-4ddd-addd-dddddddddddd',
            modifierGroupId: modgMilk.id,
            name: 'Oat Milk Add-on',
            price: 30.0
        }
    });

    const modoAlmondMilk = await prisma.modifierOption.upsert({
        where: { id: 'dddddddd-dddd-4ddd-addd-ddddddddddde' },
        update: {},
        create: {
            id: 'dddddddd-dddd-4ddd-addd-ddddddddddde',
            modifierGroupId: modgMilk.id,
            name: 'Almond Milk Add-on',
            price: 30.0
        }
    });

    const modoVanilla = await prisma.modifierOption.upsert({
        where: { id: 'dddddddd-dddd-4ddd-addd-dddddddddddf' },
        update: {},
        create: {
            id: 'dddddddd-dddd-4ddd-addd-dddddddddddf',
            modifierGroupId: modgSyrups.id,
            name: 'Vanilla Syrup Shot',
            price: 20.0
        }
    });

    const modoCaramel = await prisma.modifierOption.upsert({
        where: { id: 'dddddddd-dddd-4ddd-addd-dddddddddd01' },
        update: {},
        create: {
            id: 'dddddddd-dddd-4ddd-addd-dddddddddd01',
            modifierGroupId: modgSyrups.id,
            name: 'Extra Caramel Drizzle',
            price: 20.0
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
