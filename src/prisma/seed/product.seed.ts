import { PrismaClient, InventoryStatus, ProductVariant } from '@prisma/client';

const SEED_DATE = new Date('2026-07-15T08:00:00.000Z');

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
    // 2. HELPERS FOR IDEMPOTENCY
    // ==========================================
    const getOrCreateCategory = async (name: string, description: string) => {
        const found = await prisma.productCategory.findFirst({ where: { name, deletedAt: null } });
        if (found) return found;
        return prisma.productCategory.create({
            data: { name, description, createdById: adminId, updatedById: adminId, createdAt: SEED_DATE, updatedAt: SEED_DATE }
        });
    };

    const getOrCreateType = async (name: string, description: string) => {
        const found = await prisma.productType.findFirst({ where: { name, deletedAt: null } });
        if (found) return found;
        return prisma.productType.create({
            data: { name, description, createdById: adminId, updatedById: adminId, createdAt: SEED_DATE, updatedAt: SEED_DATE }
        });
    };

    const getOrCreateAttribute = async (name: string, description: string) => {
        const found = await prisma.productAttribute.findFirst({ where: { name, deletedAt: null } });
        if (found) return found;
        return prisma.productAttribute.create({
            data: { name, description, createdById: adminId, updatedById: adminId, createdAt: SEED_DATE, updatedAt: SEED_DATE }
        });
    };

    const getOrCreateAttributeValue = async (attributeId: string, value: string) => {
        const found = await prisma.productAttributeValue.findFirst({
            where: { productAttributeId: attributeId, value, deletedAt: null }
        });
        if (found) return found;
        return prisma.productAttributeValue.create({
            data: { productAttributeId: attributeId, value, createdById: adminId, updatedById: adminId, createdAt: SEED_DATE, updatedAt: SEED_DATE }
        });
    };

    const getOrCreateSupplier = async (name: string, address: string, contactPerson: string, contactNumber: string) => {
        const found = await prisma.supplier.findFirst({ where: { name, deletedAt: null } });
        if (found) return found;
        return prisma.supplier.create({
            data: {
                name,
                address,
                contactPerson,
                contactNumber,
                createdById: adminId,
                updatedById: adminId,
                createdAt: SEED_DATE,
                updatedAt: SEED_DATE
            }
        });
    };

    const getOrCreateUnit = async (name: string, abbreviation: string, category: 'ALL' | 'INGREDIENT' | 'PACKAGING_MATERIAL' | 'SUPPLY' = 'ALL') => {
        const found = await prisma.ingredientUnit.findFirst({ where: { name, deletedAt: null } });
        if (found) {
            return prisma.ingredientUnit.update({
                where: { id: found.id },
                data: { category, abbreviation, updatedById: adminId, updatedAt: SEED_DATE }
            });
        }
        return prisma.ingredientUnit.create({
            data: { name, abbreviation, category, createdById: adminId, updatedById: adminId, createdAt: SEED_DATE, updatedAt: SEED_DATE }
        });
    };

    const getOrCreateIngredient = async (
        name: string,
        description: string,
        unitId: string,
        reorderPoint: number,
        initialStock: number,
        supplierId: string | null = null,
        type: 'INGREDIENT' | 'PACKAGING_MATERIAL' | 'SUPPLY' = 'INGREDIENT'
    ) => {
        let ingredient = await prisma.ingredient.findFirst({ where: { name, deletedAt: null } });
        if (!ingredient) {
            ingredient = await prisma.ingredient.create({
                data: {
                    name,
                    description,
                    type,
                    ingredientUnitId: unitId,
                    reorderPoint,
                    createdById: adminId,
                    updatedById: adminId,
                    createdAt: SEED_DATE,
                    updatedAt: SEED_DATE
                }
            });
        } else {
            ingredient = await prisma.ingredient.update({
                where: { id: ingredient.id },
                data: { reorderPoint, type, updatedById: adminId, updatedAt: SEED_DATE }
            });
        }

        // Ensure inventory exists
        const inventory = await prisma.ingredientInventory.findFirst({ where: { ingredientId: ingredient.id } });
        if (!inventory) {
            await prisma.ingredientInventory.create({
                data: {
                    ingredientId: ingredient.id,
                    currentQuantity: initialStock,
                    status: initialStock > reorderPoint ? InventoryStatus.SAFE : InventoryStatus.CRITICAL,
                    createdById: adminId,
                    updatedById: adminId,
                    createdAt: SEED_DATE,
                    updatedAt: SEED_DATE
                }
            });
        } else {
            await prisma.ingredientInventory.update({
                where: { id: inventory.id },
                data: {
                    currentQuantity: initialStock,
                    status: initialStock > reorderPoint ? InventoryStatus.SAFE : InventoryStatus.CRITICAL,
                    updatedById: adminId,
                    updatedAt: SEED_DATE
                }
            });
        }

        // Ensure batch and transaction exist
        const batch = await prisma.ingredientBatch.findFirst({ where: { ingredientId: ingredient.id, deletedAt: null } });
        if (!batch && initialStock > 0) {
            const newBatch = await prisma.ingredientBatch.create({
                data: {
                    ingredientId: ingredient.id,
                    supplierId,
                    quantityReceived: initialStock,
                    currentQuantity: initialStock,
                    unitCost: 1.0,
                    totalCost: initialStock * 1.0,
                    batchNumber: `BATCH-${ingredient.name.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase()}-001`,
                    createdById: adminId,
                    updatedById: adminId,
                    receivedAt: SEED_DATE,
                    createdAt: SEED_DATE,
                    updatedAt: SEED_DATE
                }
            });

            await prisma.stockTransaction.create({
                data: {
                    batchId: newBatch.id,
                    quantityChange: initialStock,
                    type: 'DELIVERY',
                    reason: 'Initial seed delivery',
                    createdById: adminId,
                    createdAt: SEED_DATE
                }
            });
        } else if (batch) {
            await prisma.ingredientBatch.update({
                where: { id: batch.id },
                data: {
                    quantityReceived: initialStock,
                    currentQuantity: initialStock,
                    totalCost: initialStock * batch.unitCost,
                    updatedById: adminId,
                    updatedAt: SEED_DATE
                }
            });
        }

        return ingredient;
    };

    const getOrCreateProduct = async (name: string, description: string, categoryId: string, typeId: string) => {
        const found = await prisma.product.findFirst({ where: { name, deletedAt: null } });
        if (found) return found;
        return prisma.product.create({
            data: {
                name,
                description,
                productCategoryId: categoryId,
                productTypeId: typeId,
                createdById: adminId,
                updatedById: adminId,
                createdAt: SEED_DATE,
                updatedAt: SEED_DATE
            }
        });
    };

    const getOrCreateVariant = async (productId: string, sku: string, price: number, attributeValueIds: string[]) => {
        let variant = await prisma.productVariant.findUnique({
            where: { sku }
        });
        if (!variant) {
            try {
                variant = await prisma.productVariant.create({
                    data: {
                        productId,
                        sku,
                        price,
                        createdById: adminId,
                        updatedById: adminId,
                        createdAt: SEED_DATE,
                        updatedAt: SEED_DATE
                    }
                });
            } catch (error: unknown) {
                if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
                    variant = await prisma.productVariant.findFirst({
                        where: { sku }
                    });
                    if (variant) {
                        variant = await prisma.productVariant.update({
                            where: { id: variant.id },
                            data: { price, deletedAt: null, updatedById: adminId, updatedAt: SEED_DATE }
                        });
                    }
                }
                if (!variant) throw error;
            }
        } else {
            if (variant.price !== price || variant.deletedAt !== null) {
                variant = await prisma.productVariant.update({
                    where: { id: variant.id },
                    data: { price, deletedAt: null, updatedById: adminId, updatedAt: SEED_DATE }
                });
            }
        }

        // Link variant attributes
        for (const valId of attributeValueIds) {
            const link = await prisma.productVariantAttribute.findFirst({
                where: { productVariantId: variant.id, productAttributeValueId: valId, deletedAt: null }
            });
            if (!link) {
                await prisma.productVariantAttribute.create({
                    data: {
                        productVariantId: variant.id,
                        productAttributeValueId: valId,
                        createdById: adminId,
                        updatedById: adminId,
                        createdAt: SEED_DATE,
                        updatedAt: SEED_DATE
                    }
                });
            }
        }
        return variant;
    };

    const getOrCreateVariantRecipe = async (variantId: string, name: string) => {
        const found = await prisma.recipe.findUnique({ where: { productVariantId: variantId } });
        if (found) return found;
        return prisma.recipe.create({
            data: {
                name,
                productVariantId: variantId,
                createdById: adminId,
                updatedById: adminId,
                createdAt: SEED_DATE,
                updatedAt: SEED_DATE
            }
        });
    };

    const getOrCreateModifierRecipe = async (modifierOptionId: string, name: string) => {
        const found = await prisma.recipe.findUnique({ where: { modifierOptionId } });
        if (found) return found;
        return prisma.recipe.create({
            data: {
                name,
                modifierOptionId,
                createdById: adminId,
                updatedById: adminId,
                createdAt: SEED_DATE,
                updatedAt: SEED_DATE
            }
        });
    };

    const getOrCreateRecipeIngredient = async (recipeId: string, ingredientId: string, quantity: number, unitId: string) => {
        const found = await prisma.recipeIngredient.findFirst({
            where: { recipeId, ingredientId, deletedAt: null }
        });
        if (found) {
            if (found.quantity !== quantity || found.ingredientUnitId !== unitId) {
                return prisma.recipeIngredient.update({
                    where: { id: found.id },
                    data: { quantity, ingredientUnitId: unitId, updatedById: adminId, updatedAt: SEED_DATE }
                });
            }
            return found;
        }
        return prisma.recipeIngredient.create({
            data: {
                recipeId,
                ingredientId,
                quantity,
                ingredientUnitId: unitId,
                createdById: adminId,
                updatedById: adminId,
                createdAt: SEED_DATE,
                updatedAt: SEED_DATE
            }
        });
    };

    // ==========================================
    // 3. SEED SUPPLIERS & INGREDIENT UNITS
    // ==========================================
    const supplier = await getOrCreateSupplier(
        'Basta Kape Central Supplier',
        '50 K-1st, Quezon City, Metro Manila',
        'Supplier Manager',
        '09123456789'
    );

    const unitG = await getOrCreateUnit('Grams', 'g', 'INGREDIENT');
    const unitMl = await getOrCreateUnit('Milliliters', 'ml', 'INGREDIENT');
    const unitPcs = await getOrCreateUnit('Pieces', 'pcs', 'ALL');
    const unitPack = await getOrCreateUnit('Pack', 'pack', 'PACKAGING_MATERIAL');
    const unitBox = await getOrCreateUnit('Box', 'box', 'PACKAGING_MATERIAL');
    const unitSleeve = await getOrCreateUnit('Sleeve', 'sleeve', 'PACKAGING_MATERIAL');

    // ==========================================
    // 4. SEED INGREDIENTS & PACKAGING MATERIALS (WITH INITIAL STOCK)
    // ==========================================
    // Raw Ingredients
    const ingBeans = await getOrCreateIngredient('Espresso Beans', 'Premium roasted coffee beans', unitG.id, 500, 2500, supplier.id, 'INGREDIENT');
    const ingFreshMilk = await getOrCreateIngredient('Fresh Milk', 'Whole cow milk', unitMl.id, 2000, 10000, supplier.id, 'INGREDIENT');
    const ingOatMilk = await getOrCreateIngredient('Oat Milk', 'Premium barista edition oat milk', unitMl.id, 600, 3000, supplier.id, 'INGREDIENT');
    const ingCondensedMilk = await getOrCreateIngredient(
        'Condensed Milk',
        'Sweetened condensed milk',
        unitMl.id,
        250,
        1000,
        supplier.id,
        'INGREDIENT'
    );
    const ingMatcha = await getOrCreateIngredient('Matcha Powder', 'Ceremonial grade green tea powder', unitG.id, 40, 180, supplier.id, 'INGREDIENT');
    const ingChocolate = await getOrCreateIngredient(
        'Chocolate Powder',
        'Rich dark chocolate cocoa blend',
        unitG.id,
        100,
        400,
        supplier.id,
        'INGREDIENT'
    );
    const ingThaiTea = await getOrCreateIngredient(
        'Thai Tea Leaves',
        'Traditional Thai red tea leaves blend',
        unitG.id,
        75,
        300,
        supplier.id,
        'INGREDIENT'
    );
    const ingStrawberry = await getOrCreateIngredient(
        'Strawberry Puree',
        'Sweetened strawberry fruit puree',
        unitMl.id,
        150,
        600,
        supplier.id,
        'INGREDIENT'
    );
    const ingLemonSyrup = await getOrCreateIngredient(
        'Lemon Fruit Syrup',
        'Concentrated lemon juice syrup',
        unitMl.id,
        100,
        400,
        supplier.id,
        'INGREDIENT'
    );
    const ingLycheeSyrup = await getOrCreateIngredient(
        'Lychee Fruit Syrup',
        'Sweet lychee fruit syrup',
        unitMl.id,
        100,
        400,
        supplier.id,
        'INGREDIENT'
    );
    const ingBiscoffSpread = await getOrCreateIngredient(
        'Biscoff Spread',
        'Smooth caramelized cookie butter',
        unitG.id,
        80,
        300,
        supplier.id,
        'INGREDIENT'
    );
    const ingBiscoffCrumbs = await getOrCreateIngredient(
        'Biscoff Crumbs',
        'Crushed Biscoff caramel biscuits',
        unitG.id,
        25,
        100,
        supplier.id,
        'INGREDIENT'
    );
    const ingCinnamon = await getOrCreateIngredient('Cinnamon Powder', 'Aromatic ground cinnamon spice', unitG.id, 15, 50, supplier.id, 'INGREDIENT');
    const ingWhippedCream = await getOrCreateIngredient(
        'Whipped Cream',
        'Aerosol/liquid whipping cream',
        unitMl.id,
        100,
        450,
        supplier.id,
        'INGREDIENT'
    );
    const ingSeasaltCream = await getOrCreateIngredient(
        'Seasalt Cream Foam',
        'Signature savory-sweet seasalt cream',
        unitMl.id,
        150,
        600,
        supplier.id,
        'INGREDIENT'
    );
    const ingWaterBottle = await getOrCreateIngredient(
        'Water Bottle 500ml',
        'Bottled purified drinking water',
        unitPcs.id,
        12,
        48,
        supplier.id,
        'INGREDIENT'
    );

    // Packaging Materials
    const matPaperCup12oz = await getOrCreateIngredient(
        '12oz Paper Cup',
        'Hot drink paper cup 12oz',
        unitSleeve.id,
        50,
        500,
        supplier.id,
        'PACKAGING_MATERIAL'
    );
    const matColdCup16oz = await getOrCreateIngredient(
        '16oz PET Plastic Cup',
        'Iced drink plastic cup 16oz',
        unitSleeve.id,
        50,
        500,
        supplier.id,
        'PACKAGING_MATERIAL'
    );
    const matColdCup22oz = await getOrCreateIngredient(
        '22oz PET Plastic Cup',
        'Iced drink plastic cup 22oz',
        unitSleeve.id,
        50,
        500,
        supplier.id,
        'PACKAGING_MATERIAL'
    );
    const matHotLid = await getOrCreateIngredient(
        '12oz Hot Drink Lid',
        'Plastic sip lid for 12oz hot cup',
        unitPack.id,
        50,
        500,
        supplier.id,
        'PACKAGING_MATERIAL'
    );
    const matDomeLid = await getOrCreateIngredient(
        'Plastic Dome Lid',
        'Dome lid for 16oz/22oz iced cup',
        unitPack.id,
        50,
        500,
        supplier.id,
        'PACKAGING_MATERIAL'
    );
    const matStraw = await getOrCreateIngredient(
        'Eco Drink Straw',
        'Individually wrapped drink straw',
        unitPack.id,
        100,
        1000,
        supplier.id,
        'PACKAGING_MATERIAL'
    );
    const matPaperSleeve = await getOrCreateIngredient(
        'Paper Cup Sleeve',
        'Corrugated cardboard hot sleeve',
        unitSleeve.id,
        50,
        500,
        supplier.id,
        'PACKAGING_MATERIAL'
    );
    const matCarrierBox = await getOrCreateIngredient(
        'Takeaway Carrier Box',
        'Corrugated 2-cup takeaway box',
        unitBox.id,
        20,
        200,
        supplier.id,
        'PACKAGING_MATERIAL'
    );
    const matTakeawayPack = await getOrCreateIngredient(
        'Takeaway Pack Bag',
        'Padded takeaway drink pack bag',
        unitPack.id,
        30,
        300,
        supplier.id,
        'PACKAGING_MATERIAL'
    );

    // ==========================================
    // 5. SEED CATEGORIES, TYPES, & ATTRIBUTES
    // ==========================================
    const catEspresso = await getOrCreateCategory('Espresso', 'Espresso-based coffee drinks');
    const catSignature = await getOrCreateCategory('Signature Drinks', 'Basta Kape signature specialty creations');
    const catNonCoffee = await getOrCreateCategory('Non-Coffee', 'Milk, Matcha, Chocolates, and Fruit Teas');

    const typeBeverage = await getOrCreateType('Beverage', 'Drink products served to customers');

    const tempAttr = await getOrCreateAttribute('Temperature', 'Beverage serving temperature (Hot/Iced)');
    const sizeAttr = await getOrCreateAttribute('Size', 'Beverage volume sizes (12oz, 16oz, 22oz)');

    const valHot = await getOrCreateAttributeValue(tempAttr.id, 'Hot');
    const valIced = await getOrCreateAttributeValue(tempAttr.id, 'Iced');

    const val12oz = await getOrCreateAttributeValue(sizeAttr.id, '12oz');
    const val16oz = await getOrCreateAttributeValue(sizeAttr.id, '16oz');
    const val22oz = await getOrCreateAttributeValue(sizeAttr.id, '22oz');

    // ==========================================
    // 6. SEED PRODUCTS & VARIANTS
    // ==========================================
    const generateSku = (prodName: string, temp: string, size: string) => {
        const cleanedName = prodName.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
        return `${cleanedName}-${temp.toUpperCase()}-${size.toUpperCase()}`;
    };

    const seedDrinkProduct = async (
        categoryId: string,
        name: string,
        description: string,
        hasHot: boolean,
        hotPrice: number | undefined,
        hasIced: boolean,
        icedPrice: number | undefined,
        has22oz: boolean,
        iced22ozPrice: number | undefined
    ) => {
        const product = await getOrCreateProduct(name, description, categoryId, typeBeverage.id);
        const createdVariants = [];

        // 1. Hot 12oz
        if (hasHot && hotPrice !== undefined) {
            const sku = generateSku(name, 'Hot', '12oz');
            const variant = await getOrCreateVariant(product.id, sku, hotPrice, [valHot.id, val12oz.id]);
            createdVariants.push({ variant, temp: 'Hot', size: '12oz' });
        }

        // 2. Iced 16oz
        if (hasIced && icedPrice !== undefined) {
            const sku = generateSku(name, 'Iced', '16oz');
            const variant = await getOrCreateVariant(product.id, sku, icedPrice, [valIced.id, val16oz.id]);
            createdVariants.push({ variant, temp: 'Iced', size: '16oz' });
        }

        // 3. Iced 22oz (Upsize)
        if (hasIced && has22oz && iced22ozPrice !== undefined) {
            const sku = generateSku(name, 'Iced', '22oz');
            const variant = await getOrCreateVariant(product.id, sku, iced22ozPrice, [valIced.id, val22oz.id]);
            createdVariants.push({ variant, temp: 'Iced', size: '22oz' });
        }

        return { product, variants: createdVariants };
    };

    // --- Espresso Category ---
    const espressoProducts = [
        { name: 'Americano', desc: 'Espresso with water', hot: 75, iced: 80, iced22: 90 },
        { name: 'Cappucino/Latte', desc: 'Espresso with steamed milk and foam', hot: 80, iced: 90, iced22: 100 },
        { name: 'Spanish Latte', desc: 'Espresso with sweetened condensed milk and fresh milk', hot: 95, iced: 105, iced22: 115 },
        { name: 'Hazelnut Latte', desc: 'Espresso with hazelnut syrup and milk', hot: 95, iced: 105, iced22: 115 },
        { name: 'Caramel Latte', desc: 'Espresso with caramel syrup and milk', hot: 105, iced: 115, iced22: 125 },
        { name: 'White Mocha Latte', desc: 'Espresso with white chocolate syrup and milk', hot: 100, iced: 110, iced22: 120 },
        { name: 'Dark Mocha Latte', desc: 'Espresso with dark chocolate syrup and milk', hot: 95, iced: 105, iced22: 115 },
        { name: 'Dirty Matcha', desc: 'Matcha latte with a shot of espresso', hot: 110, iced: 120, iced22: 130 }
    ];

    const seededEspressoProducts = [];
    for (const p of espressoProducts) {
        const seeded = await seedDrinkProduct(catEspresso.id, p.name, p.desc, true, p.hot, true, p.iced, true, p.iced22);
        seededEspressoProducts.push(seeded);
    }

    // --- Signature Drinks Category ---
    const signatureProducts = [
        { name: 'Biscoff Latte', desc: 'Espresso latte infused with cookie butter and topped with Biscoff crumbs', hot: 135, iced: 145, iced22: 155 },
        {
            name: 'Creamy Seasalt Latte',
            desc: 'Smooth iced coffee topped with our signature creamy seasalt foam',
            hot: undefined,
            iced: 140,
            iced22: 150
        },
        { name: 'Cinnamon Oat Latte', desc: 'Espresso with creamy oat milk and a sprinkle of cinnamon powder', hot: 130, iced: 140, iced22: 150 }
    ];

    const seededSignatureProducts = [];
    for (const p of signatureProducts) {
        const seeded = await seedDrinkProduct(catSignature.id, p.name, p.desc, p.hot !== undefined, p.hot, true, p.iced, true, p.iced22);
        seededSignatureProducts.push(seeded);
    }

    // --- Non-Coffee Category ---
    const nonCoffeeProducts = [
        { name: 'Matcha Latte', desc: 'Pure ceremonial matcha with creamy fresh milk', hot: 95, iced: 105, iced22: 115 },
        { name: 'Strawberry Milk', desc: 'Creamy milk with sweet strawberry puree', hot: undefined, iced: 95, iced22: 105 },
        { name: 'Strawberry Matcha', desc: 'Layers of strawberry puree, fresh milk, and ceremonial matcha', hot: undefined, iced: 120, iced22: 130 },
        { name: 'Dark Chocolate', desc: 'Rich dark chocolate cocoa with milk', hot: 70, iced: 80, iced22: 90 },
        { name: 'Thai Milktea', desc: 'Authentic Thai tea blend topped with milk', hot: undefined, iced: 90, iced22: 100 },
        { name: 'Lemon Fruit Tea', desc: 'Refreshing brewed tea infused with lemon fruit syrup', hot: undefined, iced: 80, iced22: 90 },
        { name: 'Lychee Fruit Tea', desc: 'Refreshing brewed tea infused with lychee fruit syrup', hot: undefined, iced: 80, iced22: 90 }
    ];

    const seededNonCoffeeProducts = [];
    for (const p of nonCoffeeProducts) {
        const seeded = await seedDrinkProduct(catNonCoffee.id, p.name, p.desc, p.hot !== undefined, p.hot, true, p.iced, true, p.iced22);
        seededNonCoffeeProducts.push(seeded);
    }

    // --- Standalone Water Product ---
    const waterProduct = await getOrCreateProduct('Bottled Water', 'Refreshingly clean bottled drinking water', catNonCoffee.id, typeBeverage.id);
    const waterVariant = await getOrCreateVariant(waterProduct.id, 'BOTTLED-WATER', 15, []);

    // ==========================================
    // 7. SEED RECIPES
    // ==========================================
    const attachPackagingMaterials = async (recipeId: string, temp: string, size: string) => {
        if (temp === 'Hot' && size === '12oz') {
            await getOrCreateRecipeIngredient(recipeId, matPaperCup12oz.id, 1, unitPcs.id);
            await getOrCreateRecipeIngredient(recipeId, matHotLid.id, 1, unitPcs.id);
            await getOrCreateRecipeIngredient(recipeId, matPaperSleeve.id, 1, unitSleeve.id);
        } else if (temp === 'Iced' && size === '16oz') {
            await getOrCreateRecipeIngredient(recipeId, matColdCup16oz.id, 1, unitPcs.id);
            await getOrCreateRecipeIngredient(recipeId, matDomeLid.id, 1, unitPcs.id);
            await getOrCreateRecipeIngredient(recipeId, matStraw.id, 1, unitPcs.id);
        } else if (temp === 'Iced' && size === '22oz') {
            await getOrCreateRecipeIngredient(recipeId, matColdCup22oz.id, 1, unitPcs.id);
            await getOrCreateRecipeIngredient(recipeId, matDomeLid.id, 1, unitPcs.id);
            await getOrCreateRecipeIngredient(recipeId, matStraw.id, 1, unitPcs.id);
        }
    };

    const seedRecipeWithPackaging = async (
        variantObj: { variant: ProductVariant; temp: string; size: string } | undefined,
        recipeName: string,
        rawIngredients: { ingredientId: string; quantity: number; unitId: string }[]
    ) => {
        if (!variantObj) return;
        const rec = await getOrCreateVariantRecipe(variantObj.variant.id, recipeName);
        for (const ing of rawIngredients) {
            await getOrCreateRecipeIngredient(rec.id, ing.ingredientId, ing.quantity, ing.unitId);
        }
        await attachPackagingMaterials(rec.id, variantObj.temp, variantObj.size);
        return rec;
    };

    // Loop all seeded drink products & variants to generate recipes with ingredients and packaging materials
    const allSeededDrinks = [...seededEspressoProducts, ...seededSignatureProducts, ...seededNonCoffeeProducts];

    for (const { product, variants } of allSeededDrinks) {
        for (const vObj of variants) {
            const recipeName = `${product.name} ${vObj.temp} ${vObj.size} Recipe`;
            const is22oz = vObj.size === '22oz';
            const mult = is22oz ? 1.5 : 1.0;

            const rawIngredients: { ingredientId: string; quantity: number; unitId: string }[] = [];

            switch (product.name) {
                case 'Americano':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: is22oz ? 27 : 18, unitId: unitG.id });
                    break;
                case 'Cappucino/Latte':
                case 'Hazelnut Latte':
                case 'Caramel Latte':
                case 'White Mocha Latte':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: is22oz ? 27 : 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: Math.round(150 * mult), unitId: unitMl.id });
                    break;
                case 'Spanish Latte':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: is22oz ? 27 : 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: Math.round(120 * mult), unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingCondensedMilk.id, quantity: Math.round(30 * mult), unitId: unitMl.id });
                    break;
                case 'Dark Mocha Latte':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: is22oz ? 27 : 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: Math.round(150 * mult), unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingChocolate.id, quantity: Math.round(15 * mult), unitId: unitG.id });
                    break;
                case 'Dirty Matcha':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: is22oz ? 27 : 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: Math.round(120 * mult), unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingMatcha.id, quantity: Math.round(6 * mult), unitId: unitG.id });
                    break;
                case 'Biscoff Latte':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: is22oz ? 27 : 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: Math.round(150 * mult), unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingBiscoffSpread.id, quantity: Math.round(20 * mult), unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingBiscoffCrumbs.id, quantity: Math.round(5 * mult), unitId: unitG.id });
                    break;
                case 'Creamy Seasalt Latte':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: is22oz ? 27 : 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: Math.round(120 * mult), unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingSeasaltCream.id, quantity: Math.round(30 * mult), unitId: unitMl.id });
                    break;
                case 'Cinnamon Oat Latte':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: is22oz ? 27 : 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingOatMilk.id, quantity: Math.round(150 * mult), unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingCinnamon.id, quantity: is22oz ? 2 : 1, unitId: unitG.id });
                    break;
                case 'Matcha Latte':
                    rawIngredients.push({ ingredientId: ingMatcha.id, quantity: Math.round(6 * mult), unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: Math.round(150 * mult), unitId: unitMl.id });
                    break;
                case 'Strawberry Milk':
                    rawIngredients.push({ ingredientId: ingStrawberry.id, quantity: Math.round(30 * mult), unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: Math.round(150 * mult), unitId: unitMl.id });
                    break;
                case 'Strawberry Matcha':
                    rawIngredients.push({ ingredientId: ingStrawberry.id, quantity: Math.round(20 * mult), unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: Math.round(120 * mult), unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingMatcha.id, quantity: Math.round(4 * mult), unitId: unitG.id });
                    break;
                case 'Dark Chocolate':
                    rawIngredients.push({ ingredientId: ingChocolate.id, quantity: Math.round(20 * mult), unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: Math.round(150 * mult), unitId: unitMl.id });
                    break;
                case 'Thai Milktea':
                    rawIngredients.push({ ingredientId: ingThaiTea.id, quantity: Math.round(15 * mult), unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingCondensedMilk.id, quantity: Math.round(30 * mult), unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: Math.round(120 * mult), unitId: unitMl.id });
                    break;
                case 'Lemon Fruit Tea':
                    rawIngredients.push({ ingredientId: ingLemonSyrup.id, quantity: Math.round(40 * mult), unitId: unitMl.id });
                    break;
                case 'Lychee Fruit Tea':
                    rawIngredients.push({ ingredientId: ingLycheeSyrup.id, quantity: Math.round(40 * mult), unitId: unitMl.id });
                    break;
            }

            await seedRecipeWithPackaging(vObj, recipeName, rawIngredients);
        }
    }

    // Bottled Water Recipe
    const recWater = await getOrCreateVariantRecipe(waterVariant.id, 'Bottled Water Recipe');
    await getOrCreateRecipeIngredient(recWater.id, ingWaterBottle.id, 1, unitPcs.id);

    // ==========================================
    // 8. SEED MODIFIER GROUPS & OPTIONS (Add-ons 1-to-1 per Product)
    // ==========================================
    const allBeverages = await prisma.product.findMany({
        where: {
            productTypeId: typeBeverage.id,
            deletedAt: null
        }
    });

    const addOnOptionsTemplate = [
        { name: 'Oat Milk', price: 55, ing: ingOatMilk, qty: 200, unit: unitMl },
        { name: 'Espresso Shot', price: 35, ing: ingBeans, qty: 9, unit: unitG },
        { name: 'Whipped Cream', price: 30, ing: ingWhippedCream, qty: 15, unit: unitMl },
        { name: 'Seasalt Cream', price: 25, ing: ingSeasaltCream, qty: 30, unit: unitMl },
        { name: 'Takeaway Carrier Box', price: 15, ing: matCarrierBox, qty: 1, unit: unitBox },
        { name: 'Takeaway Pack Bag', price: 10, ing: matTakeawayPack, qty: 1, unit: unitPack }
    ];

    for (const prod of allBeverages) {
        if (prod.name === 'Bottled Water') continue;

        // Find or create dedicated modifier group for this specific product
        let productGroup = await prisma.modifierGroup.findFirst({
            where: {
                name: 'Add-ons',
                deletedAt: null,
                products: {
                    some: { id: prod.id }
                }
            }
        });

        if (!productGroup) {
            productGroup = await prisma.modifierGroup.create({
                data: {
                    name: 'Add-ons',
                    isRequired: false,
                    minSelect: 0,
                    maxSelect: 5,
                    createdAt: SEED_DATE,
                    updatedAt: SEED_DATE,
                    products: {
                        connect: { id: prod.id }
                    }
                }
            });
        }

        for (const option of addOnOptionsTemplate) {
            let existingOption = await prisma.modifierOption.findFirst({
                where: { modifierGroupId: productGroup.id, name: option.name, deletedAt: null }
            });
            if (!existingOption) {
                existingOption = await prisma.modifierOption.create({
                    data: {
                        modifierGroupId: productGroup.id,
                        name: option.name,
                        price: option.price,
                        createdAt: SEED_DATE,
                        updatedAt: SEED_DATE
                    }
                });
            } else if (existingOption.price !== option.price) {
                existingOption = await prisma.modifierOption.update({
                    where: { id: existingOption.id },
                    data: { price: option.price, updatedAt: SEED_DATE }
                });
            }

            // Attach recipe to modifier option
            if (existingOption) {
                const modRecipe = await getOrCreateModifierRecipe(existingOption.id, `${prod.name} - ${option.name} Recipe`);
                await getOrCreateRecipeIngredient(modRecipe.id, option.ing.id, option.qty, option.unit.id);
            }
        }
    }

    console.log('Explicit Products, Recipes, Inventory, and Suppliers Seeded successfully!');
}
