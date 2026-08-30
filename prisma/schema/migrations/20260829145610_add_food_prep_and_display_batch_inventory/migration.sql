-- AlterTable
ALTER TABLE `product` ADD COLUMN `defaultShelfLife` INTEGER NULL,
    ADD COLUMN `preparationType` ENUM('MADE_TO_ORDER', 'PREPARED_DISPLAY') NOT NULL DEFAULT 'MADE_TO_ORDER';

-- CreateTable
CREATE TABLE `PreparedItemBatch` (
    `id` VARCHAR(191) NOT NULL,
    `productVariantId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `batchNumber` VARCHAR(191) NOT NULL,
    `quantityPrepared` DOUBLE NOT NULL DEFAULT 0,
    `currentQuantity` DOUBLE NOT NULL DEFAULT 0,
    `preparedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `shelfLifeMinutes` INTEGER NOT NULL DEFAULT 1440,
    `expiresAt` DATETIME(3) NOT NULL,
    `status` ENUM('FRESH', 'NEAR_EXPIRY', 'EXPIRED', 'DEPLETED', 'DISPOSED') NOT NULL DEFAULT 'FRESH',
    `notes` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PreparedItemBatch_batchNumber_key`(`batchNumber`),
    INDEX `PreparedItemBatch_productVariantId_idx`(`productVariantId`),
    INDEX `PreparedItemBatch_productId_idx`(`productId`),
    INDEX `PreparedItemBatch_expiresAt_idx`(`expiresAt`),
    INDEX `PreparedItemBatch_status_idx`(`status`),
    INDEX `PreparedItemBatch_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PreparedItemTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `quantityChange` DOUBLE NOT NULL,
    `type` ENUM('SALE', 'EXPIRED', 'SPOILED', 'WASTE', 'SAMPLING', 'DISPOSED', 'CORRECTION') NOT NULL,
    `reason` VARCHAR(191) NULL,
    `orderId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PreparedItemTransaction_batchId_idx`(`batchId`),
    INDEX `PreparedItemTransaction_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Product_preparationType_idx` ON `Product`(`preparationType`);

-- AddForeignKey
ALTER TABLE `PreparedItemBatch` ADD CONSTRAINT `PreparedItemBatch_productVariantId_fkey` FOREIGN KEY (`productVariantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreparedItemBatch` ADD CONSTRAINT `PreparedItemBatch_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreparedItemBatch` ADD CONSTRAINT `PreparedItemBatch_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreparedItemBatch` ADD CONSTRAINT `PreparedItemBatch_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreparedItemTransaction` ADD CONSTRAINT `PreparedItemTransaction_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `PreparedItemBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreparedItemTransaction` ADD CONSTRAINT `PreparedItemTransaction_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreparedItemTransaction` ADD CONSTRAINT `PreparedItemTransaction_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
