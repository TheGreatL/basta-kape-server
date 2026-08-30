import { PrismaClient, InventoryStatus, ProductVariant } from '@prisma/client';

const SEED_DATE = new Date('2026-07-15T08:00:00.000Z');

export async function seedProduct(prisma: PrismaClient) {
    console.log('Seeding explicitly: Products, Categories, Recipes, Inventory, and Suppliers...');

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
    const getOrCreateCategory = async (name: string, description: string, productTypeId?: string) => {
        const found = await prisma.productCategory.findFirst({ where: { name, deletedAt: null } });
        if (found) {
            return prisma.productCategory.update({
                where: { id: found.id },
                data: { description, productTypeId, updatedById: adminId, updatedAt: SEED_DATE }
            });
        }
        return prisma.productCategory.create({
            data: { name, description, productTypeId, createdById: adminId, updatedById: adminId, createdAt: SEED_DATE, updatedAt: SEED_DATE }
        });
    };

    const getOrCreateType = async (name: string, description: string) => {
        const found = await prisma.productType.findFirst({ where: { name, deletedAt: null } });
        if (found) {
            return prisma.productType.update({
                where: { id: found.id },
                data: { description, updatedById: adminId, updatedAt: SEED_DATE }
            });
        }
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

    const getOrCreateProduct = async (
        name: string,
        description: string,
        categoryId: string,
        typeId: string,
        isMustTry: boolean = false,
        isBestSeller: boolean = false,
        preparationType: 'MADE_TO_ORDER' | 'PREPARED_DISPLAY' = 'MADE_TO_ORDER',
        defaultShelfLife: number | null = null
    ) => {
        const found = await prisma.product.findFirst({ where: { name, deletedAt: null } });
        if (found) {
            return prisma.product.update({
                where: { id: found.id },
                data: {
                    description,
                    productCategoryId: categoryId,
                    productTypeId: typeId,
                    isMustTry,
                    isBestSeller,
                    preparationType,
                    defaultShelfLife,
                    updatedById: adminId,
                    updatedAt: SEED_DATE
                }
            });
        }
        return prisma.product.create({
            data: {
                name,
                description,
                productCategoryId: categoryId,
                productTypeId: typeId,
                isMustTry,
                isBestSeller,
                preparationType,
                defaultShelfLife,
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
    // 4. SEED INGREDIENTS & PACKAGING MATERIALS
    // ==========================================
    // Coffee & Dairy/Milks
    const ingBeans = await getOrCreateIngredient('Espresso Beans', 'Premium roasted coffee beans', unitG.id, 500, 3000, supplier.id, 'INGREDIENT');
    const ingFreshMilk = await getOrCreateIngredient('Fresh Milk', 'Whole cow milk', unitMl.id, 2000, 15000, supplier.id, 'INGREDIENT');
    const ingOatMilk = await getOrCreateIngredient('Oat Milk', 'Premium barista edition oat milk', unitMl.id, 600, 4000, supplier.id, 'INGREDIENT');
    const ingCondensedMilk = await getOrCreateIngredient(
        'Condensed Milk',
        'Sweetened condensed milk',
        unitMl.id,
        300,
        2000,
        supplier.id,
        'INGREDIENT'
    );
    const ingWhippedCream = await getOrCreateIngredient(
        'Whipped Cream',
        'Whipped dairy cream topping',
        unitMl.id,
        150,
        600,
        supplier.id,
        'INGREDIENT'
    );
    const ingSeasaltCream = await getOrCreateIngredient(
        'Seasalt Cream Foam',
        'Signature savory-sweet seasalt cream foam',
        unitMl.id,
        150,
        800,
        supplier.id,
        'INGREDIENT'
    );

    // Flavors, Syrups & Powders
    const ingMatcha = await getOrCreateIngredient('Matcha Powder', 'Ceremonial grade green tea powder', unitG.id, 50, 250, supplier.id, 'INGREDIENT');
    const ingChocolate = await getOrCreateIngredient(
        'Chocolate Powder',
        'Rich dark chocolate cocoa blend',
        unitG.id,
        100,
        500,
        supplier.id,
        'INGREDIENT'
    );
    const ingWhiteChocSauce = await getOrCreateIngredient(
        'White Chocolate Sauce',
        'Sweet white chocolate dessert sauce',
        unitMl.id,
        100,
        500,
        supplier.id,
        'INGREDIENT'
    );
    const ingCaramelSyrup = await getOrCreateIngredient('Caramel Syrup', 'Rich golden caramel syrup', unitMl.id, 100, 500, supplier.id, 'INGREDIENT');
    const ingHazelnutSyrup = await getOrCreateIngredient(
        'Hazelnut Syrup',
        'Roasted hazelnut flavored syrup',
        unitMl.id,
        100,
        500,
        supplier.id,
        'INGREDIENT'
    );
    const ingStrawberry = await getOrCreateIngredient(
        'Strawberry Puree',
        'Sweetened strawberry fruit puree',
        unitMl.id,
        150,
        800,
        supplier.id,
        'INGREDIENT'
    );
    const ingLemonSyrup = await getOrCreateIngredient(
        'Lemon Fruit Syrup',
        'Concentrated zesty lemon syrup',
        unitMl.id,
        100,
        500,
        supplier.id,
        'INGREDIENT'
    );
    const ingLycheeSyrup = await getOrCreateIngredient(
        'Lychee Fruit Syrup',
        'Sweet aromatic lychee fruit syrup',
        unitMl.id,
        100,
        500,
        supplier.id,
        'INGREDIENT'
    );
    const ingCinnamon = await getOrCreateIngredient(
        'Cinnamon Powder',
        'Aromatic ground cinnamon spice',
        unitG.id,
        20,
        100,
        supplier.id,
        'INGREDIENT'
    );
    const ingMapleSyrup = await getOrCreateIngredient(
        'Maple Syrup',
        'Sweet golden waffle pancake syrup',
        unitMl.id,
        100,
        500,
        supplier.id,
        'INGREDIENT'
    );
    const ingBiscoffSpread = await getOrCreateIngredient(
        'Biscoff Spread',
        'Smooth caramelized cookie butter spread',
        unitG.id,
        100,
        500,
        supplier.id,
        'INGREDIENT'
    );
    const ingBiscoffCrumbs = await getOrCreateIngredient(
        'Biscoff Biscuit Crumbs',
        'Crushed Lotus Biscoff caramel biscuits',
        unitG.id,
        50,
        300,
        supplier.id,
        'INGREDIENT'
    );
    const ingNutellaSpread = await getOrCreateIngredient('Nutella Spread', 'Hazelnut cocoa spread', unitG.id, 100, 500, supplier.id, 'INGREDIENT');
    const ingAlcaponeNuts = await getOrCreateIngredient(
        'Alcapone Sliced Almonds',
        'Toasted sliced almond flakes',
        unitG.id,
        30,
        200,
        supplier.id,
        'INGREDIENT'
    );
    const ingChocChips = await getOrCreateIngredient(
        'Chocolate Chips',
        'Semi-sweet mini chocolate chips',
        unitG.id,
        50,
        300,
        supplier.id,
        'INGREDIENT'
    );
    const ingOreoCrumbs = await getOrCreateIngredient(
        'Oreo Cookie Crumbs',
        'Crushed chocolate sandwich cookies',
        unitG.id,
        50,
        300,
        supplier.id,
        'INGREDIENT'
    );
    const ingCoffeeJelly = await getOrCreateIngredient(
        'Coffee Jelly Cubes',
        'Sweet chewy coffee jelly bites',
        unitG.id,
        100,
        600,
        supplier.id,
        'INGREDIENT'
    );
    const ingSodaWater = await getOrCreateIngredient('Soda Water', 'Carbonated sparkling club soda', unitMl.id, 500, 3000, supplier.id, 'INGREDIENT');
    const ingSecretSyrup = await getOrCreateIngredient(
        'Basta Special Syrup',
        'Secret blend house specialty syrup',
        unitMl.id,
        50,
        300,
        supplier.id,
        'INGREDIENT'
    );

    // Food Ingredients
    const ingWaffleMix = await getOrCreateIngredient(
        'Waffle Batter Mix',
        'Crispy Belgian waffle premix',
        unitG.id,
        300,
        1500,
        supplier.id,
        'INGREDIENT'
    );
    const ingPastaNoodles = await getOrCreateIngredient('Pasta Noodles', 'Al dente spaghetti pasta', unitG.id, 300, 2000, supplier.id, 'INGREDIENT');
    const ingSlicedBread = await getOrCreateIngredient(
        'Sliced Toast Bread',
        'Garlic butter toasted bread slice',
        unitPcs.id,
        20,
        100,
        supplier.id,
        'INGREDIENT'
    );
    const ingPestoSauce = await getOrCreateIngredient(
        'Pesto Basil Sauce',
        'Fresh basil, nut, and oil pesto sauce',
        unitG.id,
        100,
        600,
        supplier.id,
        'INGREDIENT'
    );
    const ingTunaFlakes = await getOrCreateIngredient(
        'Canned Tuna Flakes',
        'Premium tuna flakes in oil',
        unitG.id,
        150,
        800,
        supplier.id,
        'INGREDIENT'
    );
    const ingParmesan = await getOrCreateIngredient('Parmesan Cheese', 'Grated parmesan cheese', unitG.id, 50, 300, supplier.id, 'INGREDIENT');
    const ingWhiteSauce = await getOrCreateIngredient(
        'Carbonara White Sauce',
        'Rich mushroom carbonara cream sauce',
        unitMl.id,
        200,
        1200,
        supplier.id,
        'INGREDIENT'
    );
    const ingMushrooms = await getOrCreateIngredient(
        'Sliced Mushrooms',
        'Canned button mushroom slices',
        unitG.id,
        100,
        500,
        supplier.id,
        'INGREDIENT'
    );
    const ingBacon = await getOrCreateIngredient('Bacon Bits', 'Crispy cooked smoked bacon bits', unitG.id, 100, 500, supplier.id, 'INGREDIENT');
    const ingSpanishSardines = await getOrCreateIngredient(
        'Spanish Sardines',
        'Spicy Spanish sardines in oil',
        unitG.id,
        150,
        800,
        supplier.id,
        'INGREDIENT'
    );
    const ingNachoChips = await getOrCreateIngredient(
        'Crispy Nacho Chips',
        'Tortilla corn nacho chips',
        unitG.id,
        200,
        1000,
        supplier.id,
        'INGREDIENT'
    );
    const ingGratedCheese = await getOrCreateIngredient(
        'Grated Cheddar Cheese',
        'Shredded cheddar cheese',
        unitG.id,
        100,
        500,
        supplier.id,
        'INGREDIENT'
    );
    const ingCheeseSauce = await getOrCreateIngredient(
        'Warm Cheese Sauce',
        'Melted cheddar dip cheese sauce',
        unitMl.id,
        150,
        800,
        supplier.id,
        'INGREDIENT'
    );
    const ingGroundBeef = await getOrCreateIngredient(
        'Seasoned Ground Beef',
        'Cooked Mexican seasoned beef mince',
        unitG.id,
        150,
        800,
        supplier.id,
        'INGREDIENT'
    );
    const ingSalsaDip = await getOrCreateIngredient(
        'Salsa & Spinach Dip',
        'Zesty tomato salsa / creamy spinach dip',
        unitMl.id,
        100,
        600,
        supplier.id,
        'INGREDIENT'
    );
    const ingFries = await getOrCreateIngredient(
        'French Fries',
        'Crispy shoestring potato french fries',
        unitG.id,
        300,
        2000,
        supplier.id,
        'INGREDIENT'
    );
    const ingMarshmallows = await getOrCreateIngredient('Marshmallows', 'Fluffy sweet marshmallows', unitG.id, 50, 300, supplier.id, 'INGREDIENT');
    const ingCookieDough = await getOrCreateIngredient(
        'Fresh Baked Cookie',
        'Artisanal freshly baked signature cookie',
        unitPcs.id,
        10,
        50,
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
    const matFoodBowl = await getOrCreateIngredient(
        'Food Serving Box/Bowl',
        'Kraft takeaway bowl with lid for pasta and snacks',
        unitPack.id,
        30,
        300,
        supplier.id,
        'PACKAGING_MATERIAL'
    );
    const matWafflePlate = await getOrCreateIngredient(
        'Waffle Tray/Box',
        'Kraft food tray for waffles and snacks',
        unitPack.id,
        30,
        300,
        supplier.id,
        'PACKAGING_MATERIAL'
    );
    const matCookiePouch = await getOrCreateIngredient(
        'Cookie Glassine Pouch',
        'Sealed glassine cookie pouch',
        unitPack.id,
        50,
        500,
        supplier.id,
        'PACKAGING_MATERIAL'
    );
    const matForkSpoon = await getOrCreateIngredient(
        'Eco Fork & Spoon',
        'Individually wrapped cutlery set',
        unitPack.id,
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
    // 5. SEED PRODUCT TYPES, CATEGORIES, & ATTRIBUTES
    // ==========================================
    const typeBeverage = await getOrCreateType('Beverage', 'Drink products served to customers');
    const typeFood = await getOrCreateType('Food', 'Food, snacks, and pastry items served to customers');

    // Beverage Categories
    const catEspresso = await getOrCreateCategory('Espresso', 'Classic and flavored espresso-based coffee drinks', typeBeverage.id);
    const catCreamyCoffee = await getOrCreateCategory('Creamy Coffee', 'Rich, velvety specialty espresso beverages', typeBeverage.id);
    const catOatBased = await getOrCreateCategory('Oat Based', 'Specialty espresso drinks made with creamy oat milk', typeBeverage.id);
    const catMatcha = await getOrCreateCategory('Matcha Series', 'Premium whisked Japanese green tea matcha drinks', typeBeverage.id);
    const catNonCoffee = await getOrCreateCategory('Non-Coffee', 'Milk beverages, traditional tsokolate, and refreshing fizz sodas', typeBeverage.id);
    const catBlendedCoffee = await getOrCreateCategory('Blended Coffee Drinks', '22oz Ice-blended coffee frappés', typeBeverage.id);
    const catBlendedNonCoffee = await getOrCreateCategory(
        'Blended Non-Coffee Drinks',
        'Ice-blended smooth non-coffee cream frappés',
        typeBeverage.id
    );

    // Food Categories
    const catWaffles = await getOrCreateCategory('Waffles', 'Freshly baked golden waffle creations', typeFood.id);
    const catPasta = await getOrCreateCategory('Pasta', 'Savory pasta dishes served with sliced toasted bread', typeFood.id);
    const catSnacks = await getOrCreateCategory('Snacks', 'Finger foods and sharing snack platters', typeFood.id);
    const catCookies = await getOrCreateCategory('Cookies', 'Artisanal baked cookies and toasted marshmallow s’mores', typeFood.id);

    // Attributes & Values
    const tempAttr = await getOrCreateAttribute('Temperature', 'Beverage serving temperature (Hot/Iced)');
    const sizeAttr = await getOrCreateAttribute('Size', 'Serving sizes (12oz, 16oz, 22oz, 500ml, Regular)');

    const valHot = await getOrCreateAttributeValue(tempAttr.id, 'Hot');
    const valIced = await getOrCreateAttributeValue(tempAttr.id, 'Iced');

    const val12oz = await getOrCreateAttributeValue(sizeAttr.id, '12oz');
    const val16oz = await getOrCreateAttributeValue(sizeAttr.id, '16oz');
    const val22oz = await getOrCreateAttributeValue(sizeAttr.id, '22oz');
    const val500ml = await getOrCreateAttributeValue(sizeAttr.id, '500ml');
    const valRegular = await getOrCreateAttributeValue(sizeAttr.id, 'Regular');

    // ==========================================
    // 6. SEED PRODUCT HELPERS
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
        has22oz: boolean = false,
        iced22ozPrice: number | undefined = undefined,
        isMustTry: boolean = false,
        isBestSeller: boolean = false
    ) => {
        const product = await getOrCreateProduct(name, description, categoryId, typeBeverage.id, isMustTry, isBestSeller);
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

        // 3. Iced 22oz (Dedicated Blended Drinks or Upsize)
        if (has22oz && iced22ozPrice !== undefined) {
            const sku = generateSku(name, 'Iced', '22oz');
            const variant = await getOrCreateVariant(product.id, sku, iced22ozPrice, [valIced.id, val22oz.id]);
            createdVariants.push({ variant, temp: 'Iced', size: '22oz' });
        }

        return { product, variants: createdVariants };
    };

    const seedFoodProduct = async (
        categoryId: string,
        name: string,
        description: string,
        price: number,
        isMustTry: boolean = false,
        isBestSeller: boolean = false,
        preparationType: 'MADE_TO_ORDER' | 'PREPARED_DISPLAY' = 'MADE_TO_ORDER',
        defaultShelfLife: number | null = null
    ) => {
        const product = await getOrCreateProduct(
            name,
            description,
            categoryId,
            typeFood.id,
            isMustTry,
            isBestSeller,
            preparationType,
            defaultShelfLife
        );
        const cleanedName = name.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
        const sku = `${cleanedName}-REGULAR`;
        const variant = await getOrCreateVariant(product.id, sku, price, [valRegular.id]);
        return { product, variant };
    };

    // ==========================================
    // 7. SEED FOOD PRODUCTS
    // ==========================================
    // --- Waffles ---
    const waffleItems = [
        {
            name: 'Biscoff Waffle',
            desc: 'Waffle, Biscoff spread, crushed Biscoff biscuit, whipped cream',
            price: 150,
            bestSeller: true,
            mustTry: false
        },
        {
            name: 'Nutella Waffle',
            desc: 'Waffle, Nutella spread, Alcapone nuts, whipped cream, chocolate drizzle',
            price: 150,
            bestSeller: false,
            mustTry: true
        },
        { name: 'Classic Waffle', desc: 'Waffle, maple syrup, whipped cream, cinnamon powder', price: 140, bestSeller: false, mustTry: true }
    ];
    const seededWaffles = [];
    for (const w of waffleItems) {
        seededWaffles.push(await seedFoodProduct(catWaffles.id, w.name, w.desc, w.price, w.mustTry, w.bestSeller));
    }

    // --- Pasta ---
    const pastaItems = [
        { name: 'Tuna Pesto', desc: 'Pasta, basil, nuts, parmesan, tuna, sliced bread', price: 170, bestSeller: true, mustTry: false },
        {
            name: 'Creamy Bacon Mushroom',
            desc: 'Pasta, white sauce, mushroom, bacon, parmesan cheese, sliced bread',
            price: 180,
            bestSeller: false,
            mustTry: false
        },
        {
            name: 'Spicy Spanish Sardines',
            desc: 'Pasta, Spanish sardines, spices, parmesan cheese, sliced bread',
            price: 170,
            bestSeller: false,
            mustTry: true
        }
    ];
    const seededPastas = [];
    for (const p of pastaItems) {
        seededPastas.push(await seedFoodProduct(catPasta.id, p.name, p.desc, p.price, p.mustTry, p.bestSeller));
    }

    // --- Snacks ---
    const snackItems = [
        {
            name: 'Chips & Dips',
            desc: 'Nacho chips, grated cheese, cheese sauce, ground beef, dipping (salsa/creamy spinach) (Good for 3-4)',
            price: 200,
            bestSeller: false,
            mustTry: true
        },
        { name: 'Basta Fries', desc: 'Fries, cheese sauce, bacon bits (Good for 2-3)', price: 140, bestSeller: false, mustTry: false }
    ];
    const seededSnacks = [];
    for (const s of snackItems) {
        seededSnacks.push(await seedFoodProduct(catSnacks.id, s.name, s.desc, s.price, s.mustTry, s.bestSeller));
    }

    // --- Cookies (Display batch items with 24-hour shelf life) ---
    const cookieItems = [
        { name: "Biscoff Smore's", desc: "Biscoff flavored cookie with toasted marshmallow s'mores", price: 85, bestSeller: true, mustTry: false },
        { name: "Matcha Smore's", desc: "Matcha infused cookie with toasted marshmallow s'mores", price: 85, bestSeller: false, mustTry: false },
        { name: "Classic Smore's", desc: "Classic chocolate cookie with toasted marshmallow s'mores", price: 80, bestSeller: true, mustTry: false },
        { name: 'Chocolate Chip', desc: 'Classic golden baked cookie packed with chocolate chips', price: 70, bestSeller: false, mustTry: false },
        { name: 'White Alcapone', desc: 'White chocolate cookie topped with toasted almond slices', price: 70, bestSeller: false, mustTry: false },
        { name: 'Red Velvet', desc: 'Rich red velvet cookie with velvety cream cheese filling', price: 85, bestSeller: false, mustTry: true }
    ];
    const seededCookies = [];
    for (const c of cookieItems) {
        seededCookies.push(await seedFoodProduct(catCookies.id, c.name, c.desc, c.price, c.mustTry, c.bestSeller, 'PREPARED_DISPLAY', 1440));
    }

    // ==========================================
    // 8. SEED DRINK PRODUCTS
    // ==========================================
    // --- Espresso ---
    const espressoItems = [
        { name: 'Americano', desc: 'Classic rich espresso diluted with water', hot: 100, iced: 100, bestSeller: false, mustTry: false },
        { name: 'Latte', desc: 'Smooth espresso with silky steamed or cold fresh milk', hot: 120, iced: 120, bestSeller: false, mustTry: false },
        { name: 'Cappucino', desc: 'Balanced espresso with rich steamed milk and milk foam', hot: 120, iced: 120, bestSeller: false, mustTry: false },
        {
            name: 'Spanish Latte',
            desc: 'Espresso with sweetened condensed milk and fresh milk',
            hot: 130,
            iced: 140,
            bestSeller: true,
            mustTry: false
        },
        { name: 'Caramel Latte', desc: 'Espresso with golden caramel syrup and creamy milk', hot: 140, iced: 150, bestSeller: false, mustTry: true },
        { name: 'Hazelnut Latte', desc: 'Espresso with aromatic hazelnut syrup and milk', hot: 130, iced: 140, bestSeller: false, mustTry: true },
        { name: 'Dark Mocha Latte', desc: 'Espresso with rich dark chocolate cocoa and milk', hot: 130, iced: 140, bestSeller: false, mustTry: true },
        { name: 'Basta Surprise', desc: "Barista's signature secret espresso blend creation", hot: 170, iced: 170, bestSeller: false, mustTry: false }
    ];
    const seededEspresso = [];
    for (const e of espressoItems) {
        seededEspresso.push(
            await seedDrinkProduct(catEspresso.id, e.name, e.desc, true, e.hot, true, e.iced, false, undefined, e.mustTry, e.bestSeller)
        );
    }

    // --- Creamy Coffee ---
    const creamyCoffeeItems = [
        {
            name: 'Creamy Seasalt Latte',
            desc: 'Mixture of milk, espresso, sweetened milk, creamy seasalt',
            hot: undefined,
            iced: 140,
            bestSeller: false,
            mustTry: true
        },
        {
            name: 'Lotus Biscoff Cream',
            desc: 'Mixture of milk, espresso, Biscoff cream mixture, and Biscoff',
            hot: 160,
            iced: 170,
            bestSeller: true,
            mustTry: false
        },
        {
            name: 'White Mocha Cream',
            desc: 'Mixture of milk, espresso, white chocolate sauce, whipped cream',
            hot: 140,
            iced: 140,
            bestSeller: false,
            mustTry: false
        }
    ];
    const seededCreamyCoffee = [];
    for (const c of creamyCoffeeItems) {
        seededCreamyCoffee.push(
            await seedDrinkProduct(
                catCreamyCoffee.id,
                c.name,
                c.desc,
                c.hot !== undefined,
                c.hot,
                true,
                c.iced,
                false,
                undefined,
                c.mustTry,
                c.bestSeller
            )
        );
    }

    // --- Oat Based ---
    const oatBasedItems = [
        {
            name: 'Oaty Cinnamon Latte',
            desc: 'Mixture of sweet cinnamon, espresso, and oatmilk',
            hot: undefined,
            iced: 170,
            bestSeller: false,
            mustTry: true
        },
        {
            name: 'Oaty Spanish Latte',
            desc: 'Mixture of sweetened milk, and espresso, and oatmilk',
            hot: undefined,
            iced: 160,
            bestSeller: true,
            mustTry: false
        }
    ];
    const seededOatBased = [];
    for (const o of oatBasedItems) {
        seededOatBased.push(
            await seedDrinkProduct(catOatBased.id, o.name, o.desc, false, undefined, true, o.iced, false, undefined, o.mustTry, o.bestSeller)
        );
    }

    // --- Matcha Series ---
    const matchaItems = [
        {
            name: 'Oaty Sweet Matcha',
            desc: 'Mixture of whisked matcha, sweetened milk, and oatmilk',
            hot: 170,
            iced: 170,
            bestSeller: false,
            mustTry: false
        },
        {
            name: 'Seasalt Cream Matcha',
            desc: 'Mixture of whisked matcha, sweetened milk, and seasalt cream',
            hot: undefined,
            iced: 150,
            bestSeller: false,
            mustTry: false
        },
        {
            name: 'White Chocolate Matcha',
            desc: 'Mixture of whisked matcha, white chocolate, and full cream milk',
            hot: 140,
            iced: 140,
            bestSeller: false,
            mustTry: false
        },
        {
            name: 'Strawberry Matcha',
            desc: 'Mixture of whisked matcha, strawberry, and full cream milk',
            hot: undefined,
            iced: 160,
            bestSeller: false,
            mustTry: false
        },
        {
            name: 'Dirty Matcha',
            desc: 'Mixture of whisked matcha, espresso, sweetened milk, and full cream milk',
            hot: 150,
            iced: 150,
            bestSeller: false,
            mustTry: false
        },
        {
            name: 'Matcha Latte',
            desc: 'Mixture of whisked matcha, sweetened milk and full cream milk',
            hot: 130,
            iced: 130,
            bestSeller: false,
            mustTry: false
        }
    ];
    const seededMatcha = [];
    for (const m of matchaItems) {
        seededMatcha.push(
            await seedDrinkProduct(catMatcha.id, m.name, m.desc, m.hot !== undefined, m.hot, true, m.iced, false, undefined, m.mustTry, m.bestSeller)
        );
    }

    // --- Non-Coffee ---
    const nonCoffeeItems = [
        {
            name: 'Strawberry Milk',
            desc: 'Creamy fresh milk with sweet strawberry puree',
            hot: undefined,
            iced: 100,
            bestSeller: false,
            mustTry: true
        },
        { name: 'Tsokolate', desc: 'Traditional rich hot/iced Filipino chocolate drink', hot: 100, iced: 100, bestSeller: true, mustTry: false },
        {
            name: 'White Chocolate Milk',
            desc: 'Velvety smooth white chocolate infused with fresh milk',
            hot: 100,
            iced: 100,
            bestSeller: false,
            mustTry: false
        },
        {
            name: 'Lemon Fizz Soda',
            desc: 'Sparkling refreshing soda infused with zesty lemon syrup',
            hot: undefined,
            iced: 110,
            bestSeller: false,
            mustTry: true
        },
        {
            name: 'Lychee Fizz Soda',
            desc: 'Sparkling refreshing soda infused with sweet lychee syrup',
            hot: undefined,
            iced: 110,
            bestSeller: false,
            mustTry: false
        },
        {
            name: 'Strawberry Lychee Cooler',
            desc: 'Chilled refreshing blend of strawberry puree and sweet lychee',
            hot: undefined,
            iced: 120,
            bestSeller: false,
            mustTry: false
        }
    ];
    const seededNonCoffee = [];
    for (const n of nonCoffeeItems) {
        seededNonCoffee.push(
            await seedDrinkProduct(
                catNonCoffee.id,
                n.name,
                n.desc,
                n.hot !== undefined,
                n.hot,
                true,
                n.iced,
                false,
                undefined,
                n.mustTry,
                n.bestSeller
            )
        );
    }

    // Bottled Water
    const waterProduct = await getOrCreateProduct(
        'Bottled Water',
        'Refreshingly clean bottled drinking water',
        catNonCoffee.id,
        typeBeverage.id,
        false,
        false
    );
    const waterVariant = await getOrCreateVariant(waterProduct.id, 'BOTTLED-WATER-500ML', 15, [val500ml.id]);

    // --- Blended Coffee Drinks (22oz) ---
    const blendedCoffeeItems = [
        {
            name: 'Java Chip',
            desc: 'Blended coffee frappé with rich chocolate chips and chocolate drizzle',
            price: 160,
            bestSeller: true,
            mustTry: false
        },
        {
            name: 'Salted Caramel',
            desc: 'Blended coffee frappé infused with salted caramel syrup and whipped cream',
            price: 160,
            bestSeller: false,
            mustTry: false
        },
        {
            name: 'Coffee Jelly',
            desc: 'Blended coffee frappé loaded with chewy coffee jelly bites and cream',
            price: 160,
            bestSeller: false,
            mustTry: false
        }
    ];
    const seededBlendedCoffee = [];
    for (const b of blendedCoffeeItems) {
        seededBlendedCoffee.push(
            await seedDrinkProduct(catBlendedCoffee.id, b.name, b.desc, false, undefined, false, undefined, true, b.price, b.mustTry, b.bestSeller)
        );
    }

    // --- Blended Non-Coffee Drinks (Iced) ---
    const blendedNonCoffeeItems = [
        {
            name: 'Strawberry Cream',
            desc: 'Blended sweet strawberry cream frappé with whipped cream topping',
            price: 160,
            bestSeller: true,
            mustTry: false
        },
        {
            name: 'Cookie Crumble Cream',
            desc: 'Blended vanilla cream frappé loaded with crunchy cookie crumbles',
            price: 160,
            bestSeller: false,
            mustTry: true
        },
        { name: 'Matcha Cream', desc: 'Blended ceremonial matcha green tea cream frappé', price: 160, bestSeller: false, mustTry: true },
        {
            name: 'Cookies & Cream',
            desc: 'Blended vanilla cream frappé packed with crushed Oreo cookies',
            price: 160,
            bestSeller: false,
            mustTry: false
        }
    ];
    const seededBlendedNonCoffee = [];
    for (const bn of blendedNonCoffeeItems) {
        seededBlendedNonCoffee.push(
            await seedDrinkProduct(
                catBlendedNonCoffee.id,
                bn.name,
                bn.desc,
                false,
                undefined,
                true,
                bn.price,
                false,
                undefined,
                bn.mustTry,
                bn.bestSeller
            )
        );
    }

    // ==========================================
    // 9. SEED RECIPES (FOOD & DRINKS)
    // ==========================================
    const attachDrinkPackaging = async (recipeId: string, temp: string, size: string) => {
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

    const seedDrinkRecipe = async (
        variantObj: { variant: ProductVariant; temp: string; size: string } | undefined,
        recipeName: string,
        rawIngredients: { ingredientId: string; quantity: number; unitId: string }[]
    ) => {
        if (!variantObj) return;
        const rec = await getOrCreateVariantRecipe(variantObj.variant.id, recipeName);
        for (const ing of rawIngredients) {
            await getOrCreateRecipeIngredient(rec.id, ing.ingredientId, ing.quantity, ing.unitId);
        }
        await attachDrinkPackaging(rec.id, variantObj.temp, variantObj.size);
        return rec;
    };

    const seedFoodRecipe = async (
        variant: ProductVariant,
        recipeName: string,
        rawIngredients: { ingredientId: string; quantity: number; unitId: string }[],
        packagingId: string,
        includeFork: boolean = false
    ) => {
        const rec = await getOrCreateVariantRecipe(variant.id, recipeName);
        for (const ing of rawIngredients) {
            await getOrCreateRecipeIngredient(rec.id, ing.ingredientId, ing.quantity, ing.unitId);
        }
        await getOrCreateRecipeIngredient(rec.id, packagingId, 1, unitPcs.id);
        if (includeFork) {
            await getOrCreateRecipeIngredient(rec.id, matForkSpoon.id, 1, unitPcs.id);
        }
        return rec;
    };

    // --- 9.1 Seed Food Recipes ---
    // Waffles
    for (const { product, variant } of seededWaffles) {
        const ingList: { ingredientId: string; quantity: number; unitId: string }[] = [
            { ingredientId: ingWaffleMix.id, quantity: 120, unitId: unitG.id },
            { ingredientId: ingWhippedCream.id, quantity: 20, unitId: unitMl.id }
        ];
        if (product.name === 'Biscoff Waffle') {
            ingList.push({ ingredientId: ingBiscoffSpread.id, quantity: 25, unitId: unitG.id });
            ingList.push({ ingredientId: ingBiscoffCrumbs.id, quantity: 10, unitId: unitG.id });
        } else if (product.name === 'Nutella Waffle') {
            ingList.push({ ingredientId: ingNutellaSpread.id, quantity: 25, unitId: unitG.id });
            ingList.push({ ingredientId: ingAlcaponeNuts.id, quantity: 10, unitId: unitG.id });
        } else if (product.name === 'Classic Waffle') {
            ingList.push({ ingredientId: ingMapleSyrup.id, quantity: 30, unitId: unitMl.id });
            ingList.push({ ingredientId: ingCinnamon.id, quantity: 1, unitId: unitG.id });
        }
        await seedFoodRecipe(variant, `${product.name} Recipe`, ingList, matWafflePlate.id, true);
    }

    // Pasta
    for (const { product, variant } of seededPastas) {
        const ingList: { ingredientId: string; quantity: number; unitId: string }[] = [
            { ingredientId: ingPastaNoodles.id, quantity: 100, unitId: unitG.id },
            { ingredientId: ingSlicedBread.id, quantity: 1, unitId: unitPcs.id },
            { ingredientId: ingParmesan.id, quantity: 10, unitId: unitG.id }
        ];
        if (product.name === 'Tuna Pesto') {
            ingList.push({ ingredientId: ingPestoSauce.id, quantity: 40, unitId: unitG.id });
            ingList.push({ ingredientId: ingTunaFlakes.id, quantity: 50, unitId: unitG.id });
        } else if (product.name === 'Creamy Bacon Mushroom') {
            ingList.push({ ingredientId: ingWhiteSauce.id, quantity: 60, unitId: unitMl.id });
            ingList.push({ ingredientId: ingMushrooms.id, quantity: 30, unitId: unitG.id });
            ingList.push({ ingredientId: ingBacon.id, quantity: 25, unitId: unitG.id });
        } else if (product.name === 'Spicy Spanish Sardines') {
            ingList.push({ ingredientId: ingSpanishSardines.id, quantity: 60, unitId: unitG.id });
        }
        await seedFoodRecipe(variant, `${product.name} Recipe`, ingList, matFoodBowl.id, true);
    }

    // Snacks
    for (const { product, variant } of seededSnacks) {
        const ingList: { ingredientId: string; quantity: number; unitId: string }[] = [];
        if (product.name === 'Chips & Dips') {
            ingList.push({ ingredientId: ingNachoChips.id, quantity: 120, unitId: unitG.id });
            ingList.push({ ingredientId: ingGratedCheese.id, quantity: 20, unitId: unitG.id });
            ingList.push({ ingredientId: ingCheeseSauce.id, quantity: 40, unitId: unitMl.id });
            ingList.push({ ingredientId: ingGroundBeef.id, quantity: 40, unitId: unitG.id });
            ingList.push({ ingredientId: ingSalsaDip.id, quantity: 40, unitId: unitMl.id });
            await seedFoodRecipe(variant, `${product.name} Recipe`, ingList, matFoodBowl.id, false);
        } else if (product.name === 'Basta Fries') {
            ingList.push({ ingredientId: ingFries.id, quantity: 150, unitId: unitG.id });
            ingList.push({ ingredientId: ingCheeseSauce.id, quantity: 30, unitId: unitMl.id });
            ingList.push({ ingredientId: ingBacon.id, quantity: 15, unitId: unitG.id });
            await seedFoodRecipe(variant, `${product.name} Recipe`, ingList, matFoodBowl.id, true);
        }
    }

    // Cookies
    for (const { product, variant } of seededCookies) {
        const ingList: { ingredientId: string; quantity: number; unitId: string }[] = [
            { ingredientId: ingCookieDough.id, quantity: 1, unitId: unitPcs.id }
        ];
        if (product.name.includes("Smore's")) {
            ingList.push({ ingredientId: ingMarshmallows.id, quantity: 15, unitId: unitG.id });
        }
        await seedFoodRecipe(variant, `${product.name} Recipe`, ingList, matCookiePouch.id, false);
    }

    // --- 9.2 Seed Drink Recipes ---
    const allSeededDrinks = [
        ...seededEspresso,
        ...seededCreamyCoffee,
        ...seededOatBased,
        ...seededMatcha,
        ...seededNonCoffee,
        ...seededBlendedCoffee,
        ...seededBlendedNonCoffee
    ];

    for (const { product, variants } of allSeededDrinks) {
        for (const vObj of variants) {
            const recipeName = `${product.name} ${vObj.temp} ${vObj.size} Recipe`;
            const is22oz = vObj.size === '22oz';
            const mult = is22oz ? 1.4 : 1.0;

            const rawIngredients: { ingredientId: string; quantity: number; unitId: string }[] = [];

            switch (product.name) {
                // Espresso
                case 'Americano':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: 18, unitId: unitG.id });
                    break;
                case 'Latte':
                case 'Cappucino':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 150, unitId: unitMl.id });
                    break;
                case 'Spanish Latte':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 120, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingCondensedMilk.id, quantity: 30, unitId: unitMl.id });
                    break;
                case 'Caramel Latte':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 140, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingCaramelSyrup.id, quantity: 20, unitId: unitMl.id });
                    break;
                case 'Hazelnut Latte':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 140, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingHazelnutSyrup.id, quantity: 20, unitId: unitMl.id });
                    break;
                case 'Dark Mocha Latte':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 140, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingChocolate.id, quantity: 15, unitId: unitG.id });
                    break;
                case 'Basta Surprise':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 130, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingSecretSyrup.id, quantity: 25, unitId: unitMl.id });
                    break;

                // Creamy Coffee
                case 'Creamy Seasalt Latte':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 120, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingCondensedMilk.id, quantity: 20, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingSeasaltCream.id, quantity: 30, unitId: unitMl.id });
                    break;
                case 'Lotus Biscoff Cream':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 130, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingBiscoffSpread.id, quantity: 20, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingBiscoffCrumbs.id, quantity: 5, unitId: unitG.id });
                    break;
                case 'White Mocha Cream':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 130, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingWhiteChocSauce.id, quantity: 20, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingWhippedCream.id, quantity: 20, unitId: unitMl.id });
                    break;

                // Oat Based
                case 'Oaty Cinnamon Latte':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingOatMilk.id, quantity: 150, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingCinnamon.id, quantity: 1, unitId: unitG.id });
                    break;
                case 'Oaty Spanish Latte':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingOatMilk.id, quantity: 120, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingCondensedMilk.id, quantity: 30, unitId: unitMl.id });
                    break;

                // Matcha Series
                case 'Oaty Sweet Matcha':
                    rawIngredients.push({ ingredientId: ingMatcha.id, quantity: 6, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingOatMilk.id, quantity: 120, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingCondensedMilk.id, quantity: 25, unitId: unitMl.id });
                    break;
                case 'Seasalt Cream Matcha':
                    rawIngredients.push({ ingredientId: ingMatcha.id, quantity: 6, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 120, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingCondensedMilk.id, quantity: 20, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingSeasaltCream.id, quantity: 30, unitId: unitMl.id });
                    break;
                case 'White Chocolate Matcha':
                    rawIngredients.push({ ingredientId: ingMatcha.id, quantity: 6, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 130, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingWhiteChocSauce.id, quantity: 20, unitId: unitMl.id });
                    break;
                case 'Strawberry Matcha':
                    rawIngredients.push({ ingredientId: ingMatcha.id, quantity: 5, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingStrawberry.id, quantity: 30, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 120, unitId: unitMl.id });
                    break;
                case 'Dirty Matcha':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: 18, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingMatcha.id, quantity: 5, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 120, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingCondensedMilk.id, quantity: 20, unitId: unitMl.id });
                    break;
                case 'Matcha Latte':
                    rawIngredients.push({ ingredientId: ingMatcha.id, quantity: 6, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 130, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingCondensedMilk.id, quantity: 20, unitId: unitMl.id });
                    break;

                // Non-Coffee
                case 'Strawberry Milk':
                    rawIngredients.push({ ingredientId: ingStrawberry.id, quantity: 35, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 150, unitId: unitMl.id });
                    break;
                case 'Tsokolate':
                    rawIngredients.push({ ingredientId: ingChocolate.id, quantity: 25, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 140, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingCondensedMilk.id, quantity: 15, unitId: unitMl.id });
                    break;
                case 'White Chocolate Milk':
                    rawIngredients.push({ ingredientId: ingWhiteChocSauce.id, quantity: 30, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 150, unitId: unitMl.id });
                    break;
                case 'Lemon Fizz Soda':
                    rawIngredients.push({ ingredientId: ingLemonSyrup.id, quantity: 40, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingSodaWater.id, quantity: 160, unitId: unitMl.id });
                    break;
                case 'Lychee Fizz Soda':
                    rawIngredients.push({ ingredientId: ingLycheeSyrup.id, quantity: 40, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingSodaWater.id, quantity: 160, unitId: unitMl.id });
                    break;
                case 'Strawberry Lychee Cooler':
                    rawIngredients.push({ ingredientId: ingStrawberry.id, quantity: 25, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingLycheeSyrup.id, quantity: 25, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingSodaWater.id, quantity: 150, unitId: unitMl.id });
                    break;

                // Blended Coffee Drinks (22oz)
                case 'Java Chip':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: 27, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 160, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingChocolate.id, quantity: 20, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingChocChips.id, quantity: 15, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingWhippedCream.id, quantity: 25, unitId: unitMl.id });
                    break;
                case 'Salted Caramel':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: 27, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 160, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingCaramelSyrup.id, quantity: 30, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingWhippedCream.id, quantity: 25, unitId: unitMl.id });
                    break;
                case 'Coffee Jelly':
                    rawIngredients.push({ ingredientId: ingBeans.id, quantity: 27, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: 160, unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingCoffeeJelly.id, quantity: 35, unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingWhippedCream.id, quantity: 25, unitId: unitMl.id });
                    break;

                // Blended Non-Coffee Drinks
                case 'Strawberry Cream':
                    rawIngredients.push({ ingredientId: ingStrawberry.id, quantity: Math.round(40 * mult), unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: Math.round(150 * mult), unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingWhippedCream.id, quantity: 25, unitId: unitMl.id });
                    break;
                case 'Cookie Crumble Cream':
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: Math.round(150 * mult), unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingBiscoffCrumbs.id, quantity: Math.round(15 * mult), unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingOreoCrumbs.id, quantity: Math.round(15 * mult), unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingWhippedCream.id, quantity: 25, unitId: unitMl.id });
                    break;
                case 'Matcha Cream':
                    rawIngredients.push({ ingredientId: ingMatcha.id, quantity: Math.round(8 * mult), unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: Math.round(150 * mult), unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingCondensedMilk.id, quantity: Math.round(25 * mult), unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingWhippedCream.id, quantity: 25, unitId: unitMl.id });
                    break;
                case 'Cookies & Cream':
                    rawIngredients.push({ ingredientId: ingFreshMilk.id, quantity: Math.round(150 * mult), unitId: unitMl.id });
                    rawIngredients.push({ ingredientId: ingOreoCrumbs.id, quantity: Math.round(25 * mult), unitId: unitG.id });
                    rawIngredients.push({ ingredientId: ingWhippedCream.id, quantity: 25, unitId: unitMl.id });
                    break;
            }

            await seedDrinkRecipe(vObj, recipeName, rawIngredients);
        }
    }

    // Bottled Water Recipe
    const recWater = await getOrCreateVariantRecipe(waterVariant.id, 'Bottled Water Recipe');
    await getOrCreateRecipeIngredient(recWater.id, ingWaterBottle.id, 1, unitPcs.id);

    // ==========================================
    // 10. SEED MODIFIER GROUPS & OPTIONS (Add-ons for Beverages)
    // ==========================================
    const allBeverages = await prisma.product.findMany({
        where: {
            productTypeId: typeBeverage.id,
            deletedAt: null
        }
    });

    const addOnOptionsTemplate = [
        { name: 'Espresso Shot', price: 30, ing: ingBeans, qty: 9, unit: unitG },
        { name: 'Oat Milk', price: 60, ing: ingOatMilk, qty: 150, unit: unitMl },
        { name: 'Whipped Cream', price: 30, ing: ingWhippedCream, qty: 20, unit: unitMl },
        { name: 'Seasalt Cream', price: 30, ing: ingSeasaltCream, qty: 30, unit: unitMl },
        { name: 'Coffee Jelly', price: 25, ing: ingCoffeeJelly, qty: 30, unit: unitG },
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

    // --- 10. Seed Initial Morning Prepared Display Batches for Cookies ---
    const now = new Date();
    const expiry24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    for (const { product, variant } of seededCookies) {
        const existingBatch = await prisma.preparedItemBatch.findFirst({
            where: { productVariantId: variant.id, deletedAt: null }
        });

        if (!existingBatch) {
            const baseSku = (variant.sku || product.name.replace(/\s+/g, '-').toUpperCase()).slice(0, 12);
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
            const batchNumber = `PREP-${baseSku}-${dateStr}-INIT`;

            await prisma.preparedItemBatch.create({
                data: {
                    productVariantId: variant.id,
                    productId: product.id,
                    batchNumber,
                    quantityPrepared: 12,
                    currentQuantity: 12,
                    preparedAt: now,
                    shelfLifeMinutes: 1440,
                    expiresAt: expiry24h,
                    status: 'FRESH',
                    notes: 'Initial morning fresh bake for store display',
                    createdById: adminId,
                    updatedById: adminId,
                    createdAt: now,
                    updatedAt: now,
                    transactions: {
                        create: {
                            quantityChange: 12,
                            type: 'CORRECTION',
                            reason: 'Initial seed batch for store display',
                            createdById: adminId,
                            createdAt: now
                        }
                    }
                }
            });
        }
    }

    console.log('Explicit Menu Products, Food Items, Recipes, Inventory, and Suppliers Seeded successfully!');
}
