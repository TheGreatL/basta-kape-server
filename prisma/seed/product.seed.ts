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
        where: { id: 'cat-coffee' },
        update: {},
        create: {
            id: 'cat-coffee',
            name: 'Coffee',
            description: 'Espresso-based hot and cold beverage creations',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const categoryNonCoffee = await prisma.productCategory.upsert({
        where: { id: 'cat-non-coffee' },
        update: {},
        create: {
            id: 'cat-non-coffee',
            name: 'Non-Coffee',
            description: 'Delicious hot and cold non-caffeinated drinks',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const categoryPastries = await prisma.productCategory.upsert({
        where: { id: 'cat-pastries' },
        update: {},
        create: {
            id: 'cat-pastries',
            name: 'Pastries',
            description: 'Freshly baked croissants, cookies, and cakes',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const typeIced = await prisma.productType.upsert({
        where: { id: 'type-iced' },
        update: {},
        create: {
            id: 'type-iced',
            name: 'Iced Drinks',
            description: 'Chilled beverages served over ice',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const typeHot = await prisma.productType.upsert({
        where: { id: 'type-hot' },
        update: {},
        create: {
            id: 'type-hot',
            name: 'Hot Drinks',
            description: 'Warm beverages brewed to perfection',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const typeBaked = await prisma.productType.upsert({
        where: { id: 'type-baked' },
        update: {},
        create: {
            id: 'type-baked',
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
        where: { id: 'unit-grams' },
        update: {},
        create: {
            id: 'unit-grams',
            name: 'Grams',
            abbreviation: 'g',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const unitMilliliters = await prisma.ingredientUnit.upsert({
        where: { id: 'unit-milliliters' },
        update: {},
        create: {
            id: 'unit-milliliters',
            name: 'Milliliters',
            abbreviation: 'ml',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const unitPieces = await prisma.ingredientUnit.upsert({
        where: { id: 'unit-pieces' },
        update: {},
        create: {
            id: 'unit-pieces',
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
        where: { id: 'sup-roastery' },
        update: {},
        create: {
            id: 'sup-roastery',
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
        where: { id: 'sup-dairy' },
        update: {},
        create: {
            id: 'sup-dairy',
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
        where: { id: 'sup-grocery' },
        update: {},
        create: {
            id: 'sup-grocery',
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

        await prisma.ingredientInventory.upsert({
            where: { id: `inv-${id}` },
            update: {},
            create: {
                id: `inv-${id}`,
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
        'ing-beans',
        'Espresso Blend Beans',
        'Premium arabica-robusta house blend',
        unitGrams.id,
        8500,
        2000,
        InventoryStatus.SAFE
    );
    const ingWholeMilk = await createIngredientWithInventory(
        'ing-whole-milk',
        'Barista Whole Milk',
        'High-foaming dairy milk',
        unitMilliliters.id,
        15000,
        5000,
        InventoryStatus.SAFE
    );
    const ingOatMilk = await createIngredientWithInventory(
        'ing-oat-milk',
        'Barista Oat Milk',
        'Premium plant-based milk alternative',
        unitMilliliters.id,
        2000,
        4000,
        InventoryStatus.CRITICAL
    );
    const ingAlmondMilk = await createIngredientWithInventory(
        'ing-almond-milk',
        'Barista Almond Milk',
        'Unsweetened plant-based milk alternative',
        unitMilliliters.id,
        6000,
        3000,
        InventoryStatus.SAFE
    );
    const ingCondensed = await createIngredientWithInventory(
        'ing-condensed-milk',
        'Sweet Condensed Milk',
        'Thick sweetened milk for Spanish Latte',
        unitGrams.id,
        4500,
        1000,
        InventoryStatus.SAFE
    );
    const ingMatcha = await createIngredientWithInventory(
        'ing-matcha-powder',
        'Premium Uji Matcha Powder',
        'Authentic Japanese stone-ground green tea',
        unitGrams.id,
        800,
        250,
        InventoryStatus.SAFE
    );
    const ingChocolate = await createIngredientWithInventory(
        'ing-chocolate-sauce',
        'Gourmet Chocolate Sauce',
        'Rich dark cocoa sauce for mochas and chocolates',
        unitGrams.id,
        2500,
        800,
        InventoryStatus.SAFE
    );
    const ingVanilla = await createIngredientWithInventory(
        'ing-vanilla-syrup',
        'Sweet Vanilla Syrup',
        'Classic vanilla flavoring syrup',
        unitMilliliters.id,
        1800,
        500,
        InventoryStatus.SAFE
    );
    const ingCaramel = await createIngredientWithInventory(
        'ing-caramel-drizzle',
        'Caramel Drizzle Sauce',
        'Buttery caramel sauce for topping macchiatos',
        unitMilliliters.id,
        1200,
        400,
        InventoryStatus.SAFE
    );
    const ingCroissant = await createIngredientWithInventory(
        'ing-croissant-dough',
        'Frozen Croissant Dough',
        'Pre-portioned uncooked butter croissants',
        unitPieces.id,
        0,
        15,
        InventoryStatus.OUT_OF_STOCK
    );
    const ingChocCroissant = await createIngredientWithInventory(
        'ing-choc-croissant-dough',
        'Frozen Chocolate Croissant Dough',
        'Pre-portioned uncooked pain au chocolat',
        unitPieces.id,
        25,
        10,
        InventoryStatus.SAFE
    );
    const ingCookie = await createIngredientWithInventory(
        'ing-cookie-dough',
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
    await prisma.ingredientDelivery.upsert({
        where: { id: 'del-beans-1' },
        update: {},
        create: {
            id: 'del-beans-1',
            ingredientId: ingBeans.id,
            supplierId: supplierRoastery.id,
            quantityReceived: 10000,
            unitCost: 0.65,
            totalCost: 6500.0,
            batchNumber: 'BATCH-BEANS-099',
            expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.ingredientDelivery.upsert({
        where: { id: 'del-milk-1' },
        update: {},
        create: {
            id: 'del-milk-1',
            ingredientId: ingWholeMilk.id,
            supplierId: supplierDairy.id,
            quantityReceived: 24000,
            unitCost: 0.085,
            totalCost: 2040.0,
            batchNumber: 'BATCH-MILK-774',
            expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.ingredientDelivery.upsert({
        where: { id: 'del-matcha-1' },
        update: {},
        create: {
            id: 'del-matcha-1',
            ingredientId: ingMatcha.id,
            supplierId: supplierGrocery.id,
            quantityReceived: 1000,
            unitCost: 2.2,
            totalCost: 2200.0,
            batchNumber: 'BATCH-MATCHA-003',
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            createdById: adminId,
            updatedById: adminId
        }
    });

    // ==========================================
    // 7. SEED INVENTORY ADJUSTMENTS (Waste logs)
    // ==========================================
    await prisma.inventoryAdjustment.upsert({
        where: { id: 'adj-beans-spill' },
        update: {},
        create: {
            id: 'adj-beans-spill',
            ingredientId: ingBeans.id,
            quantity: -250,
            type: AdjustmentType.WASTE,
            reason: 'Accidental spill during grinder cleaning',
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.inventoryAdjustment.upsert({
        where: { id: 'adj-milk-expired' },
        update: {},
        create: {
            id: 'adj-milk-expired',
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
        where: { id: 'prod-americano' },
        update: {},
        create: {
            id: 'prod-americano',
            name: 'Café Americano',
            photo: 'https://images.unsplash.com/photo-1551046710-7e57f48521c5',
            description: 'Rich, full-bodied signature espresso shot combined with filtered hot/iced water',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodLatte = await prisma.product.upsert({
        where: { id: 'prod-latte' },
        update: {},
        create: {
            id: 'prod-latte',
            name: 'Café Latte',
            photo: 'https://images.unsplash.com/photo-1541167760496-1628856ab772',
            description: 'Velvety espresso combined with perfectly steamed milk and a thin microfoam layer',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodSpanishLatte = await prisma.product.upsert({
        where: { id: 'prod-spanish-latte' },
        update: {},
        create: {
            id: 'prod-spanish-latte',
            name: 'Spanish Latte',
            photo: 'https://images.unsplash.com/photo-1594911774802-8822a707c9f5',
            description: 'Sweet, creamy, espresso-forward latte sweetened with rich condensed milk',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodCaramelMacchiato = await prisma.product.upsert({
        where: { id: 'prod-caramel-macchiato' },
        update: {},
        create: {
            id: 'prod-caramel-macchiato',
            name: 'Caramel Macchiato',
            photo: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2',
            description: 'Vanilla-flavored syrup marked with espresso, milk, and topped with buttery caramel drizzle',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodMatchaLatte = await prisma.product.upsert({
        where: { id: 'prod-matcha-latte' },
        update: {},
        create: {
            id: 'prod-matcha-latte',
            name: 'Uji Matcha Latte',
            photo: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a',
            description: 'Premium Japanese stone-ground matcha tea whisked and sweetened over creamy milk',
            productCategoryId: categoryNonCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodChocolate = await prisma.product.upsert({
        where: { id: 'prod-chocolate' },
        update: {},
        create: {
            id: 'prod-chocolate',
            name: 'Signature Hot Chocolate',
            photo: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574',
            description: 'Decadent dark cocoa melted into steamed whole milk for the ultimate comfort drink',
            productCategoryId: categoryNonCoffee.id,
            productTypeId: typeHot.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodCroissant = await prisma.product.upsert({
        where: { id: 'prod-croissant' },
        update: {},
        create: {
            id: 'prod-croissant',
            name: 'Classic Butter Croissant',
            photo: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a',
            description: 'Flaky, buttery, oven-fresh laminated pastry baked fresh daily',
            productCategoryId: categoryPastries.id,
            productTypeId: typeBaked.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodChocCroissant = await prisma.product.upsert({
        where: { id: 'prod-choc-croissant' },
        update: {},
        create: {
            id: 'prod-choc-croissant',
            name: 'Pain au Chocolat',
            photo: 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca',
            description: 'Rich dark chocolate baton wrapped in buttery, flaky golden layers',
            productCategoryId: categoryPastries.id,
            productTypeId: typeBaked.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const prodCookie = await prisma.product.upsert({
        where: { id: 'prod-cookie' },
        update: {},
        create: {
            id: 'prod-cookie',
            name: 'Chocolate Chip Cookie',
            photo: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e',
            description: 'Soft-baked, chewy cookie loaded with premium milk and dark chocolate chunks',
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
        where: { id: 'attr-size' },
        update: {},
        create: {
            id: 'attr-size',
            name: 'Size',
            description: 'Beverage serving size option',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const attrMilk = await prisma.productAttribute.upsert({
        where: { id: 'attr-milk' },
        update: {},
        create: {
            id: 'attr-milk',
            name: 'Milk Type',
            description: 'Dairy or dairy-free alternative milk choices',
            createdById: adminId,
            updatedById: adminId
        }
    });

    // Attribute Values (Sizes)
    const valSize12 = await prisma.productAttributeValue.upsert({
        where: { id: 'val-size-12oz' },
        update: {},
        create: {
            id: 'val-size-12oz',
            productAttributeId: attrSize.id,
            value: '12oz (Regular)',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const valSize16 = await prisma.productAttributeValue.upsert({
        where: { id: 'val-size-16oz' },
        update: {},
        create: {
            id: 'val-size-16oz',
            productAttributeId: attrSize.id,
            value: '16oz (Large)',
            createdById: adminId,
            updatedById: adminId
        }
    });

    // Attribute Values (Milk Options)
    const valMilkWhole = await prisma.productAttributeValue.upsert({
        where: { id: 'val-milk-whole' },
        update: {},
        create: {
            id: 'val-milk-whole',
            productAttributeId: attrMilk.id,
            value: 'Whole Milk',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const valMilkOat = await prisma.productAttributeValue.upsert({
        where: { id: 'val-milk-oat' },
        update: {},
        create: {
            id: 'val-milk-oat',
            productAttributeId: attrMilk.id,
            value: 'Oat Milk Alternative',
            createdById: adminId,
            updatedById: adminId
        }
    });

    const valMilkAlmond = await prisma.productAttributeValue.upsert({
        where: { id: 'val-milk-almond' },
        update: {},
        create: {
            id: 'val-milk-almond',
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
        for (let i = 0; i < attributeIds.length; i++) {
            const valId = attributeIds[i];
            await prisma.productVariantAttribute.upsert({
                where: { id: `map-${id}-${i}` },
                update: {},
                create: {
                    id: `map-${id}-${i}`,
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
                    id: `recing-${id}-${j}`,
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
        'var-americano-12',
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
        'var-americano-16',
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
        'var-latte-12-whole',
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
        'var-latte-16-whole',
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
        'var-latte-12-oat',
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
        'var-latte-16-oat',
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
        'var-latte-12-almond',
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
        'var-latte-16-almond',
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
        'var-spanish-12-whole',
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
        'var-spanish-16-whole',
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
        'var-spanish-16-oat',
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
        'var-macchiato-12-whole',
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
        'var-macchiato-16-whole',
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
        'var-macchiato-16-oat',
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
        'var-matcha-12-whole',
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
        'var-matcha-16-whole',
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
        'var-matcha-16-oat',
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
        'var-chocolate-12-whole',
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
        'var-chocolate-16-whole',
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
        'var-croissant-standard',
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
        'var-choc-croissant-standard',
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
        'var-cookie-standard',
        prodCookie.id,
        'BK-CK-STD',
        85.0,
        [],
        'Chocolate Chip Cookie Recipe',
        '1 piece frozen cookie dough baked soft in oven',
        [{ ingredientId: ingCookie.id, qty: 1.0, unitId: unitPieces.id }]
    );

    console.log('Explicit Products, Recipes, Inventory, and Suppliers Seeded successfully!');
}
