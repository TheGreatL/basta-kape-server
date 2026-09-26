-- AlterTable
ALTER TABLE `IngredientBatch` ADD COLUMN `inputQuantity` DOUBLE NULL,
    ADD COLUMN `inputUnitId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `InventoryAdjustment` ADD COLUMN `inputQuantity` DOUBLE NULL,
    ADD COLUMN `inputUnitId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `PurchaseOrderItem` ADD COLUMN `inputQuantity` DOUBLE NULL,
    ADD COLUMN `inputUnitId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `IngredientBatch` ADD CONSTRAINT `IngredientBatch_inputUnitId_fkey` FOREIGN KEY (`inputUnitId`) REFERENCES `IngredientUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryAdjustment` ADD CONSTRAINT `InventoryAdjustment_inputUnitId_fkey` FOREIGN KEY (`inputUnitId`) REFERENCES `IngredientUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_inputUnitId_fkey` FOREIGN KEY (`inputUnitId`) REFERENCES `IngredientUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
