import { PrismaClient, InventoryStatus } from '@prisma/client';

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
            data: { name, description, createdById: adminId, updatedById: adminId }
        });
    };

    const getOrCreateType = async (name: string, description: string) => {
        const found = await prisma.productType.findFirst({ where: { name, deletedAt: null } });
        if (found) return found;
        return prisma.productType.create({
            data: { name, description, createdById: adminId, updatedById: adminId }
        });
    };

    const getOrCreateAttribute = async (name: string, description: string) => {
        const found = await prisma.productAttribute.findFirst({ where: { name, deletedAt: null } });
        if (found) return found;
        return prisma.productAttribute.create({
            data: { name, description, createdById: adminId, updatedById: adminId }
        });
    };

    const getOrCreateAttributeValue = async (attributeId: string, value: string) => {
        const found = await prisma.productAttributeValue.findFirst({
            where: { productAttributeId: attributeId, value, deletedAt: null }
        });
        if (found) return found;
        return prisma.productAttributeValue.create({
            data: { productAttributeId: attributeId, value, createdById: adminId, updatedById: adminId }
        });
    };

    const getOrCreateSupplier = async (name: string, address: string, contactPerson: string, contactNumber: string) => {
        const found = await prisma.supplier.findFirst({ where: { name, deletedAt: null } });
        if (found) return found;
        return prisma.supplier.create({
            data: { name, address, contactPerson, contactNumber, createdById: adminId, updatedById: adminId }
        });
    };

    const getOrCreateUnit = async (name: string, abbreviation: string) => {
        const found = await prisma.ingredientUnit.findFirst({ where: { name, deletedAt: null } });
        if (found) return found;
        return prisma.ingredientUnit.create({
            data: { name, abbreviation, createdById: adminId, updatedById: adminId }
        });
    };

    const getOrCreateIngredient = async (
        name: string,
        description: string,
        unitId: string,
        reorderPoint: number,
        initialStock: number,
        supplierId: string | null = null
    ) => {
        let ingredient = await prisma.ingredient.findFirst({ where: { name, deletedAt: null } });
        if (!ingredient) {
            ingredient = await prisma.ingredient.create({
                data: { name, description, ingredientUnitId: unitId, reorderPoint, createdById: adminId, updatedById: adminId }
            });
        } else {
            ingredient = await prisma.ingredient.update({
                where: { id: ingredient.id },
                data: { reorderPoint, updatedById: adminId }
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
                    updatedById: adminId
                }
            });
        } else {
            await prisma.ingredientInventory.update({
                where: { id: inventory.id },
                data: {
                    currentQuantity: initialStock,
                    status: initialStock > reorderPoint ? InventoryStatus.SAFE : InventoryStatus.CRITICAL,
                    updatedById: adminId
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
                    updatedById: adminId
                }
            });

            await prisma.stockTransaction.create({
                data: {
                    batchId: newBatch.id,
                    quantityChange: initialStock,
                    type: 'DELIVERY',
                    reason: 'Initial seed delivery',
                    createdById: adminId
                }
            });
        } else if (batch) {
            await prisma.ingredientBatch.update({
                where: { id: batch.id },
                data: {
                    quantityReceived: initialStock,
                    currentQuantity: initialStock,
                    totalCost: initialStock * batch.unitCost,
                    updatedById: adminId
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
                updatedById: adminId
            }
        });
    };

    const getOrCreateVariant = async (productId: string, sku: string, price: number, attributeValueIds: string[]) => {
        let variant = await prisma.productVariant.findFirst({
            where: { sku }
        });
        if (!variant) {
            variant = await prisma.productVariant.create({
                data: {
                    productId,
                    sku,
                    price,
                    createdById: adminId,
                    updatedById: adminId
                }
            });
        } else {
            if (variant.price !== price || variant.deletedAt !== null) {
                variant = await prisma.productVariant.update({
                    where: { id: variant.id },
                    data: { price, deletedAt: null, updatedById: adminId }
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
                        updatedById: adminId
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
                updatedById: adminId
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
                updatedById: adminId
            }
        });
    };

    const getOrCreateRecipeIngredient = async (recipeId: string, ingredientId: string, quantity: number, unitId: string) => {
        const found = await prisma.recipeIngredient.findFirst({
            where: { recipeId, ingredientId, deletedAt: null }
        });
        if (found) return found;
        return prisma.recipeIngredient.create({
            data: {
                recipeId,
                ingredientId,
                quantity,
                ingredientUnitId: unitId,
                createdById: adminId,
                updatedById: adminId
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

    const unitG = await getOrCreateUnit('Grams', 'g');
    const unitMl = await getOrCreateUnit('Milliliters', 'ml');
    const unitPcs = await getOrCreateUnit('Pieces', 'pcs');

    // ==========================================
    // 4. SEED INGREDIENTS & INITIAL STOCK (TYPICAL 1-DAY CAFE CONSUMPTION)
    // ==========================================
    const ingBeans = await getOrCreateIngredient('Espresso Beans', 'Premium roasted coffee beans', unitG.id, 500, 2500, supplier.id);
    const ingFreshMilk = await getOrCreateIngredient('Fresh Milk', 'Whole cow milk', unitMl.id, 2000, 10000, supplier.id);
    const ingOatMilk = await getOrCreateIngredient('Oat Milk', 'Premium barista edition oat milk', unitMl.id, 600, 3000, supplier.id);
    const ingCondensedMilk = await getOrCreateIngredient('Condensed Milk', 'Sweetened condensed milk', unitMl.id, 250, 1000, supplier.id);
    const ingMatcha = await getOrCreateIngredient('Matcha Powder', 'Ceremonial grade green tea powder', unitG.id, 40, 180, supplier.id);
    const ingChocolate = await getOrCreateIngredient('Chocolate Powder', 'Rich dark chocolate cocoa blend', unitG.id, 100, 400, supplier.id);
    const ingThaiTea = await getOrCreateIngredient('Thai Tea Leaves', 'Traditional Thai red tea leaves blend', unitG.id, 75, 300, supplier.id);
    const ingStrawberry = await getOrCreateIngredient('Strawberry Puree', 'Sweetened strawberry fruit puree', unitMl.id, 150, 600, supplier.id);
    const ingLemonSyrup = await getOrCreateIngredient('Lemon Fruit Syrup', 'Concentrated lemon juice syrup', unitMl.id, 100, 400, supplier.id);
    const ingLycheeSyrup = await getOrCreateIngredient('Lychee Fruit Syrup', 'Sweet lychee fruit syrup', unitMl.id, 100, 400, supplier.id);
    const ingBiscoffSpread = await getOrCreateIngredient('Biscoff Spread', 'Smooth caramelized cookie butter', unitG.id, 80, 300, supplier.id);
    const ingBiscoffCrumbs = await getOrCreateIngredient('Biscoff Crumbs', 'Crushed Biscoff caramel biscuits', unitG.id, 25, 100, supplier.id);
    const ingCinnamon = await getOrCreateIngredient('Cinnamon Powder', 'Aromatic ground cinnamon spice', unitG.id, 15, 50, supplier.id);
    const ingWhippedCream = await getOrCreateIngredient('Whipped Cream', 'Aerosol/liquid whipping cream', unitMl.id, 100, 450, supplier.id);
    const ingSeasaltCream = await getOrCreateIngredient(
        'Seasalt Cream Foam',
        'Signature savory-sweet seasalt cream',
        unitMl.id,
        150,
        600,
        supplier.id
    );
    const ingWaterBottle = await getOrCreateIngredient('Water Bottle 500ml', 'Bottled purified drinking water', unitPcs.id, 12, 48, supplier.id);

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
    // Seed sample recipes for inventory management validation:
    // Americano (12oz, 16oz, 22oz)
    const amHot12 = seededEspressoProducts.find((p) => p.product.name === 'Americano')?.variants.find((v) => v.size === '12oz');
    const amIced16 = seededEspressoProducts.find((p) => p.product.name === 'Americano')?.variants.find((v) => v.size === '16oz');
    const amIced22 = seededEspressoProducts.find((p) => p.product.name === 'Americano')?.variants.find((v) => v.size === '22oz');

    if (amHot12) {
        const rec = await getOrCreateVariantRecipe(amHot12.variant.id, 'Americano Hot 12oz Recipe');
        await getOrCreateRecipeIngredient(rec.id, ingBeans.id, 18, unitG.id);
    }
    if (amIced16) {
        const rec = await getOrCreateVariantRecipe(amIced16.variant.id, 'Americano Iced 16oz Recipe');
        await getOrCreateRecipeIngredient(rec.id, ingBeans.id, 18, unitG.id);
    }
    if (amIced22) {
        const rec = await getOrCreateVariantRecipe(amIced22.variant.id, 'Americano Iced 22oz Recipe');
        await getOrCreateRecipeIngredient(rec.id, ingBeans.id, 27, unitG.id);
    }

    // Biscoff Latte Hot 12oz Recipe
    const bisHot12 = seededSignatureProducts.find((p) => p.product.name === 'Biscoff Latte')?.variants.find((v) => v.size === '12oz');
    if (bisHot12) {
        const rec = await getOrCreateVariantRecipe(bisHot12.variant.id, 'Biscoff Latte Hot 12oz Recipe');
        await getOrCreateRecipeIngredient(rec.id, ingBeans.id, 18, unitG.id);
        await getOrCreateRecipeIngredient(rec.id, ingFreshMilk.id, 150, unitMl.id);
        await getOrCreateRecipeIngredient(rec.id, ingBiscoffSpread.id, 20, unitG.id);
        await getOrCreateRecipeIngredient(rec.id, ingBiscoffCrumbs.id, 5, unitG.id);
    }

    // Cinnamon Oat Latte Recipe
    const cinHot12 = seededSignatureProducts.find((p) => p.product.name === 'Cinnamon Oat Latte')?.variants.find((v) => v.size === '12oz');
    if (cinHot12) {
        const rec = await getOrCreateVariantRecipe(cinHot12.variant.id, 'Cinnamon Oat Latte Hot 12oz Recipe');
        await getOrCreateRecipeIngredient(rec.id, ingBeans.id, 18, unitG.id);
        await getOrCreateRecipeIngredient(rec.id, ingOatMilk.id, 150, unitMl.id);
        await getOrCreateRecipeIngredient(rec.id, ingCinnamon.id, 1, unitG.id);
    }

    // Matcha Latte Recipe
    const matHot12 = seededNonCoffeeProducts.find((p) => p.product.name === 'Matcha Latte')?.variants.find((v) => v.size === '12oz');
    if (matHot12) {
        const rec = await getOrCreateVariantRecipe(matHot12.variant.id, 'Matcha Latte Hot 12oz Recipe');
        await getOrCreateRecipeIngredient(rec.id, ingMatcha.id, 6, unitG.id);
        await getOrCreateRecipeIngredient(rec.id, ingFreshMilk.id, 150, unitMl.id);
    }

    // Strawberry Milk Recipe
    const strIced16 = seededNonCoffeeProducts.find((p) => p.product.name === 'Strawberry Milk')?.variants.find((v) => v.size === '16oz');
    if (strIced16) {
        const rec = await getOrCreateVariantRecipe(strIced16.variant.id, 'Strawberry Milk Iced 16oz Recipe');
        await getOrCreateRecipeIngredient(rec.id, ingStrawberry.id, 30, unitMl.id);
        await getOrCreateRecipeIngredient(rec.id, ingFreshMilk.id, 150, unitMl.id);
    }

    // Strawberry Matcha Recipe
    const strMatIced16 = seededNonCoffeeProducts.find((p) => p.product.name === 'Strawberry Matcha')?.variants.find((v) => v.size === '16oz');
    if (strMatIced16) {
        const rec = await getOrCreateVariantRecipe(strMatIced16.variant.id, 'Strawberry Matcha Iced 16oz Recipe');
        await getOrCreateRecipeIngredient(rec.id, ingStrawberry.id, 20, unitMl.id);
        await getOrCreateRecipeIngredient(rec.id, ingFreshMilk.id, 120, unitMl.id);
        await getOrCreateRecipeIngredient(rec.id, ingMatcha.id, 4, unitG.id);
    }

    // Dark Chocolate Recipe
    const chocHot12 = seededNonCoffeeProducts.find((p) => p.product.name === 'Dark Chocolate')?.variants.find((v) => v.size === '12oz');
    if (chocHot12) {
        const rec = await getOrCreateVariantRecipe(chocHot12.variant.id, 'Dark Chocolate Hot 12oz Recipe');
        await getOrCreateRecipeIngredient(rec.id, ingChocolate.id, 20, unitG.id);
        await getOrCreateRecipeIngredient(rec.id, ingFreshMilk.id, 150, unitMl.id);
    }

    // Thai Milktea Recipe
    const thaiIced16 = seededNonCoffeeProducts.find((p) => p.product.name === 'Thai Milktea')?.variants.find((v) => v.size === '16oz');
    if (thaiIced16) {
        const rec = await getOrCreateVariantRecipe(thaiIced16.variant.id, 'Thai Milktea Iced 16oz Recipe');
        await getOrCreateRecipeIngredient(rec.id, ingThaiTea.id, 15, unitG.id);
        await getOrCreateRecipeIngredient(rec.id, ingCondensedMilk.id, 30, unitMl.id);
        await getOrCreateRecipeIngredient(rec.id, ingFreshMilk.id, 120, unitMl.id);
    }

    // Lemon Fruit Tea Recipe
    const lemIced16 = seededNonCoffeeProducts.find((p) => p.product.name === 'Lemon Fruit Tea')?.variants.find((v) => v.size === '16oz');
    if (lemIced16) {
        const rec = await getOrCreateVariantRecipe(lemIced16.variant.id, 'Lemon Fruit Tea Iced 16oz Recipe');
        await getOrCreateRecipeIngredient(rec.id, ingLemonSyrup.id, 40, unitMl.id);
    }

    // Lychee Fruit Tea Recipe
    const lycIced16 = seededNonCoffeeProducts.find((p) => p.product.name === 'Lychee Fruit Tea')?.variants.find((v) => v.size === '16oz');
    if (lycIced16) {
        const rec = await getOrCreateVariantRecipe(lycIced16.variant.id, 'Lychee Fruit Tea Iced 16oz Recipe');
        await getOrCreateRecipeIngredient(rec.id, ingLycheeSyrup.id, 40, unitMl.id);
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
        { name: 'Seasalt Cream', price: 25, ing: ingSeasaltCream, qty: 30, unit: unitMl }
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
                        price: option.price
                    }
                });
            } else if (existingOption.price !== option.price) {
                existingOption = await prisma.modifierOption.update({
                    where: { id: existingOption.id },
                    data: { price: option.price }
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
