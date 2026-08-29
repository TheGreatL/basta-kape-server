-- AlterTable
ALTER TABLE `productcategory` ADD COLUMN `productTypeId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `ProductCategory_productTypeId_idx` ON `ProductCategory`(`productTypeId`);

-- AddForeignKey
ALTER TABLE `ProductCategory` ADD CONSTRAINT `ProductCategory_productTypeId_fkey` FOREIGN KEY (`productTypeId`) REFERENCES `ProductType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
