/*
  Warnings:

  - You are about to drop the `ingredientdelivery` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `ingredientdelivery` DROP FOREIGN KEY `IngredientDelivery_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `ingredientdelivery` DROP FOREIGN KEY `IngredientDelivery_ingredientId_fkey`;

-- DropForeignKey
ALTER TABLE `ingredientdelivery` DROP FOREIGN KEY `IngredientDelivery_purchaseOrderId_fkey`;

-- DropForeignKey
ALTER TABLE `ingredientdelivery` DROP FOREIGN KEY `IngredientDelivery_supplierId_fkey`;

-- DropForeignKey
ALTER TABLE `ingredientdelivery` DROP FOREIGN KEY `IngredientDelivery_updatedById_fkey`;

-- DropTable
DROP TABLE `ingredientdelivery`;

-- CreateTable
CREATE TABLE `IngredientBatch` (
    `id` VARCHAR(191) NOT NULL,
    `ingredientId` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiryDate` DATETIME(3) NULL,
    `quantityReceived` DOUBLE NOT NULL DEFAULT 0,
    `currentQuantity` DOUBLE NOT NULL DEFAULT 0,
    `unitCost` DOUBLE NOT NULL DEFAULT 0,
    `totalCost` DOUBLE NOT NULL DEFAULT 0,
    `batchNumber` VARCHAR(191) NULL,
    `purchaseOrderId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `IngredientBatch_deletedAt_idx`(`deletedAt`),
    INDEX `IngredientBatch_ingredientId_idx`(`ingredientId`),
    INDEX `IngredientBatch_expiryDate_idx`(`expiryDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `quantityChange` DOUBLE NOT NULL,
    `type` ENUM('DELIVERY', 'SALE', 'WASTE', 'SPOILED', 'EXPIRED', 'THEFT', 'PROMOTIONAL_USE', 'PHYSICAL_COUNT_CORRECTION') NOT NULL,
    `reason` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockTransaction_batchId_idx`(`batchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `IngredientBatch` ADD CONSTRAINT `IngredientBatch_ingredientId_fkey` FOREIGN KEY (`ingredientId`) REFERENCES `Ingredient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IngredientBatch` ADD CONSTRAINT `IngredientBatch_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IngredientBatch` ADD CONSTRAINT `IngredientBatch_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IngredientBatch` ADD CONSTRAINT `IngredientBatch_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IngredientBatch` ADD CONSTRAINT `IngredientBatch_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransaction` ADD CONSTRAINT `StockTransaction_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `IngredientBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransaction` ADD CONSTRAINT `StockTransaction_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
