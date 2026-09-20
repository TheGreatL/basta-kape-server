-- CreateTable
CREATE TABLE `UnitConversion` (
    `id` VARCHAR(191) NOT NULL,
    `fromUnitId` VARCHAR(191) NOT NULL,
    `toUnitId` VARCHAR(191) NOT NULL,
    `factor` DOUBLE NOT NULL,
    `ingredientId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `UnitConversion_fromUnitId_idx`(`fromUnitId`),
    INDEX `UnitConversion_toUnitId_idx`(`toUnitId`),
    INDEX `UnitConversion_ingredientId_idx`(`ingredientId`),
    INDEX `UnitConversion_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UnitConversion` ADD CONSTRAINT `UnitConversion_fromUnitId_fkey` FOREIGN KEY (`fromUnitId`) REFERENCES `IngredientUnit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UnitConversion` ADD CONSTRAINT `UnitConversion_toUnitId_fkey` FOREIGN KEY (`toUnitId`) REFERENCES `IngredientUnit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UnitConversion` ADD CONSTRAINT `UnitConversion_ingredientId_fkey` FOREIGN KEY (`ingredientId`) REFERENCES `Ingredient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UnitConversion` ADD CONSTRAINT `UnitConversion_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UnitConversion` ADD CONSTRAINT `UnitConversion_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
