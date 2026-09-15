-- AlterTable
ALTER TABLE `Product` ADD COLUMN `isBestSeller` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isMustTry` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `Product_isMustTry_idx` ON `Product`(`isMustTry`);

-- CreateIndex
CREATE INDEX `Product_isBestSeller_idx` ON `Product`(`isBestSeller`);
