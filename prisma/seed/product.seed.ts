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

    await prisma.productCategory.upsert({
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

    // ==========================================
    // 5. SEED INGREDIENTS & CURRENT INVENTORIES
    // ==========================================
    // Ingredient 1: Espresso Beans (SAFE status)
    const ingredientBeans = await prisma.ingredient.upsert({
        where: { id: 'ing-espresso-beans' },
        update: {},
        create: {
            id: 'ing-espresso-beans',
            name: 'Espresso Blend Beans',
            description: 'Premium arabica-robusta house blend',
            ingredientUnitId: unitGrams.id,
            reorderPoint: 2000, // 2kg
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.ingredientInventory.upsert({
        where: { id: 'inv-beans' },
        update: {},
        create: {
            id: 'inv-beans',
            ingredientId: ingredientBeans.id,
            currentQuantity: 8500, // 8.5kg
            lastPhysicalCount: new Date(),
            status: InventoryStatus.SAFE,
            createdById: adminId,
            updatedById: adminId
        }
    });

    // Ingredient 2: Whole Milk (SAFE status)
    const ingredientWholeMilk = await prisma.ingredient.upsert({
        where: { id: 'ing-whole-milk' },
        update: {},
        create: {
            id: 'ing-whole-milk',
            name: 'Barista Whole Milk',
            description: 'High-foaming dairy milk',
            ingredientUnitId: unitMilliliters.id,
            reorderPoint: 5000, // 5 Liters
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.ingredientInventory.upsert({
        where: { id: 'inv-whole-milk' },
        update: {},
        create: {
            id: 'inv-whole-milk',
            ingredientId: ingredientWholeMilk.id,
            currentQuantity: 15000, // 15 Liters
            lastPhysicalCount: new Date(),
            status: InventoryStatus.SAFE,
            createdById: adminId,
            updatedById: adminId
        }
    });

    // Ingredient 3: Oat Milk (CRITICAL status)
    const ingredientOatMilk = await prisma.ingredient.upsert({
        where: { id: 'ing-oat-milk' },
        update: {},
        create: {
            id: 'ing-oat-milk',
            name: 'Barista Oat Milk',
            description: 'Premium plant-based milk alternative',
            ingredientUnitId: unitMilliliters.id,
            reorderPoint: 4000, // 4 Liters
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.ingredientInventory.upsert({
        where: { id: 'inv-oat-milk' },
        update: {},
        create: {
            id: 'inv-oat-milk',
            ingredientId: ingredientOatMilk.id,
            currentQuantity: 2000, // 2 Liters (Below reorder point of 4L)
            lastPhysicalCount: new Date(),
            status: InventoryStatus.CRITICAL,
            createdById: adminId,
            updatedById: adminId
        }
    });

    // Ingredient 4: Croissant Dough (OUT_OF_STOCK status)
    const ingredientCroissant = await prisma.ingredient.upsert({
        where: { id: 'ing-croissant-dough' },
        update: {},
        create: {
            id: 'ing-croissant-dough',
            name: 'Frozen Croissant Dough',
            description: 'Pre-portioned uncooked butter croissants',
            ingredientUnitId: unitPieces.id,
            reorderPoint: 15,
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.ingredientInventory.upsert({
        where: { id: 'inv-croissant' },
        update: {},
        create: {
            id: 'inv-croissant',
            ingredientId: ingredientCroissant.id,
            currentQuantity: 0, // 0 pcs left
            lastPhysicalCount: new Date(),
            status: InventoryStatus.OUT_OF_STOCK,
            createdById: adminId,
            updatedById: adminId
        }
    });

    // ==========================================
    // 6. SEED INGREDIENT DELIVERIES & BATCHES
    // ==========================================
    await prisma.ingredientDelivery.upsert({
        where: { id: 'del-beans-1' },
        update: {},
        create: {
            id: 'del-beans-1',
            ingredientId: ingredientBeans.id,
            supplierId: supplierRoastery.id,
            quantityReceived: 10000, // 10kg
            unitCost: 0.65, // PHP 0.65 per gram
            totalCost: 6500.0,
            batchNumber: 'BATCH-BEANS-099',
            expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // Expiration in 180 days
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.ingredientDelivery.upsert({
        where: { id: 'del-milk-1' },
        update: {},
        create: {
            id: 'del-milk-1',
            ingredientId: ingredientWholeMilk.id,
            supplierId: supplierDairy.id,
            quantityReceived: 24000, // 24 Liters
            unitCost: 0.085, // PHP 0.085 per ml
            totalCost: 2040.0,
            batchNumber: 'BATCH-MILK-774',
            expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Expiration in 14 days
            createdById: adminId,
            updatedById: adminId
        }
    });

    // ==========================================
    // 7. SEED INVENTORY ADJUSTMENTS (Waste & Spoilage logs)
    // ==========================================
    await prisma.inventoryAdjustment.upsert({
        where: { id: 'adj-beans-spill' },
        update: {},
        create: {
            id: 'adj-beans-spill',
            ingredientId: ingredientBeans.id,
            quantity: -250, // Spilled 250g beans
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
            ingredientId: ingredientWholeMilk.id,
            quantity: -1000, // 1 Liter milk spoiled
            type: AdjustmentType.SPOILED,
            reason: 'Left outside refrigerator overnight',
            createdById: adminId,
            updatedById: adminId
        }
    });

    // ==========================================
    // 8. SEED PRODUCTS
    // ==========================================
    const productSpanishLatte = await prisma.product.upsert({
        where: { id: 'prod-spanish-latte' },
        update: {},
        create: {
            id: 'prod-spanish-latte',
            name: 'Spanish Latte',
            description: 'Sweet, creamy, espresso-forward latte with condensed milk',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeIced.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const productEspresso = await prisma.product.upsert({
        where: { id: 'prod-espresso' },
        update: {},
        create: {
            id: 'prod-espresso',
            name: 'Classic Espresso',
            description: 'Intense and rich concentrated shot of our signature house roast',
            productCategoryId: categoryCoffee.id,
            productTypeId: typeHot.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    const productCroissant = await prisma.product.upsert({
        where: { id: 'prod-croissant' },
        update: {},
        create: {
            id: 'prod-croissant',
            name: 'Classic Butter Croissant',
            description: 'Flaky, buttery, oven-fresh laminated pastry',
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

    // Attribute Values (Size)
    await prisma.productAttributeValue.upsert({
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

    const valShotDouble = await prisma.productAttributeValue.upsert({
        where: { id: 'val-shot-double' },
        update: {},
        create: {
            id: 'val-shot-double',
            productAttributeId: attrSize.id,
            value: 'Double Shot',
            createdById: adminId,
            updatedById: adminId
        }
    });

    // Attribute Values (Milk)
    const valMilkWhole = await prisma.productAttributeValue.upsert({
        where: { id: 'val-milk-whole' },
        update: {},
        create: {
            id: 'val-milk-whole',
            productAttributeId: attrMilk.id,
            value: 'Barista Whole Milk',
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

    // ==========================================
    // 10. SEED PRODUCT VARIANTS & ATTRIBUTE MAPS
    // ==========================================
    // Variant 1: Spanish Latte 16oz Whole Milk
    const varSpanishWhole = await prisma.productVariant.upsert({
        where: { id: 'var-spanish-16-whole' },
        update: {},
        create: {
            id: 'var-spanish-16-whole',
            productId: productSpanishLatte.id,
            sku: 'BK-SL-16-WM',
            price: 155.0,
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.productVariantAttribute.upsert({
        where: { id: 'map-sl-16-wm-size' },
        update: {},
        create: {
            id: 'map-sl-16-wm-size',
            productVariantId: varSpanishWhole.id,
            productAttributeValueId: valSize16.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.productVariantAttribute.upsert({
        where: { id: 'map-sl-16-wm-milk' },
        update: {},
        create: {
            id: 'map-sl-16-wm-milk',
            productVariantId: varSpanishWhole.id,
            productAttributeValueId: valMilkWhole.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    // Variant 2: Spanish Latte 16oz Oat Milk (Premium Charge)
    const varSpanishOat = await prisma.productVariant.upsert({
        where: { id: 'var-spanish-16-oat' },
        update: {},
        create: {
            id: 'var-spanish-16-oat',
            productId: productSpanishLatte.id,
            sku: 'BK-SL-16-OM',
            price: 185.0, // PHP 30 upcharge
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.productVariantAttribute.upsert({
        where: { id: 'map-sl-16-om-size' },
        update: {},
        create: {
            id: 'map-sl-16-om-size',
            productVariantId: varSpanishOat.id,
            productAttributeValueId: valSize16.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.productVariantAttribute.upsert({
        where: { id: 'map-sl-16-om-milk' },
        update: {},
        create: {
            id: 'map-sl-16-om-milk',
            productVariantId: varSpanishOat.id,
            productAttributeValueId: valMilkOat.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    // Variant 3: Double Espresso (No Milk attribute)
    const varEspressoDouble = await prisma.productVariant.upsert({
        where: { id: 'var-espresso-double' },
        update: {},
        create: {
            id: 'var-espresso-double',
            productId: productEspresso.id,
            sku: 'BK-ESP-DBL',
            price: 95.0,
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.productVariantAttribute.upsert({
        where: { id: 'map-esp-dbl-size' },
        update: {},
        create: {
            id: 'map-esp-dbl-size',
            productVariantId: varEspressoDouble.id,
            productAttributeValueId: valShotDouble.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    // Variant 4: Croissant (No size/milk attribute options)
    const varCroissant = await prisma.productVariant.upsert({
        where: { id: 'var-croissant-standard' },
        update: {},
        create: {
            id: 'var-croissant-standard',
            productId: productCroissant.id,
            sku: 'BK-CR-STD',
            price: 110.0,
            createdById: adminId,
            updatedById: adminId
        }
    });

    // ==========================================
    // 11. SEED RECIPES & RECIPE INGREDIENTS
    // ==========================================

    // Recipe 1: Spanish Latte 16oz Whole Milk Recipe
    const recSpanishWhole = await prisma.recipe.upsert({
        where: { productVariantId: varSpanishWhole.id },
        update: {},
        create: {
            name: '16oz Hot Spanish Latte Recipe (Dairy)',
            description: 'Double espresso with 250ml steamed whole milk and 30ml condensed milk base',
            productVariantId: varSpanishWhole.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.recipeIngredient.upsert({
        where: { id: 'rec-ing-sl-wm-beans' },
        update: {},
        create: {
            id: 'rec-ing-sl-wm-beans',
            recipeId: recSpanishWhole.id,
            ingredientId: ingredientBeans.id,
            quantity: 18.0, // 18 grams espresso
            ingredientUnitId: unitGrams.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.recipeIngredient.upsert({
        where: { id: 'rec-ing-sl-wm-milk' },
        update: {},
        create: {
            id: 'rec-ing-sl-wm-milk',
            recipeId: recSpanishWhole.id,
            ingredientId: ingredientWholeMilk.id,
            quantity: 250.0, // 250 milliliters whole milk
            ingredientUnitId: unitMilliliters.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    // Recipe 2: Spanish Latte 16oz Oat Milk Recipe
    const recSpanishOat = await prisma.recipe.upsert({
        where: { productVariantId: varSpanishOat.id },
        update: {},
        create: {
            name: '16oz Hot Spanish Latte Recipe (Oat)',
            description: 'Double espresso with 250ml steamed oat milk and 30ml condensed milk base',
            productVariantId: varSpanishOat.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.recipeIngredient.upsert({
        where: { id: 'rec-ing-sl-om-beans' },
        update: {},
        create: {
            id: 'rec-ing-sl-om-beans',
            recipeId: recSpanishOat.id,
            ingredientId: ingredientBeans.id,
            quantity: 18.0,
            ingredientUnitId: unitGrams.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.recipeIngredient.upsert({
        where: { id: 'rec-ing-sl-om-milk' },
        update: {},
        create: {
            id: 'rec-ing-sl-om-milk',
            recipeId: recSpanishOat.id,
            ingredientId: ingredientOatMilk.id,
            quantity: 250.0, // 250 milliliters oat milk
            ingredientUnitId: unitMilliliters.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    // Recipe 3: Double Espresso Recipe
    const recEspressoDouble = await prisma.recipe.upsert({
        where: { productVariantId: varEspressoDouble.id },
        update: {},
        create: {
            name: 'Classic Double Shot Espresso Recipe',
            description: 'Double shot pull of arabica-robusta house blend',
            productVariantId: varEspressoDouble.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.recipeIngredient.upsert({
        where: { id: 'rec-ing-esp-beans' },
        update: {},
        create: {
            id: 'rec-ing-esp-beans',
            recipeId: recEspressoDouble.id,
            ingredientId: ingredientBeans.id,
            quantity: 18.0,
            ingredientUnitId: unitGrams.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    // Recipe 4: Classic Butter Croissant Recipe
    const recCroissant = await prisma.recipe.upsert({
        where: { productVariantId: varCroissant.id },
        update: {},
        create: {
            name: 'Classic Baked Butter Croissant Recipe',
            description: 'Single uncooked frozen pastry baked to order',
            productVariantId: varCroissant.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    await prisma.recipeIngredient.upsert({
        where: { id: 'rec-ing-croissant-pcs' },
        update: {},
        create: {
            id: 'rec-ing-croissant-pcs',
            recipeId: recCroissant.id,
            ingredientId: ingredientCroissant.id,
            quantity: 1.0, // 1 piece frozen croissant dough
            ingredientUnitId: unitPieces.id,
            createdById: adminId,
            updatedById: adminId
        }
    });

    console.log('Explicit Products, Recipes, Inventory, and Suppliers Seeded successfully!');
}
