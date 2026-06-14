/*
  Warnings:

  - A unique constraint covering the columns `[modifierOptionId]` on the table `Recipe` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `Recipe` DROP FOREIGN KEY `Recipe_productVariantId_fkey`;

-- AlterTable
ALTER TABLE `Recipe` ADD COLUMN `modifierOptionId` VARCHAR(191) NULL,
    MODIFY `productVariantId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Recipe_modifierOptionId_key` ON `Recipe`(`modifierOptionId`);

-- AddForeignKey
ALTER TABLE `Recipe` ADD CONSTRAINT `Recipe_productVariantId_fkey` FOREIGN KEY (`productVariantId`) REFERENCES `ProductVariant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Recipe` ADD CONSTRAINT `Recipe_modifierOptionId_fkey` FOREIGN KEY (`modifierOptionId`) REFERENCES `ModifierOption`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
