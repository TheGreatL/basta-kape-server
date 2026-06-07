-- CreateTable
CREATE TABLE `CustomerCart` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `unitPrice` DOUBLE NOT NULL DEFAULT 0,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `productVariantId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `CustomerCart_productVariantId_idx`(`productVariantId`),
    INDEX `CustomerCart_customerId_idx`(`customerId`),
    UNIQUE INDEX `CustomerCart_customerId_productVariantId_key`(`customerId`, `productVariantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CustomerCart` ADD CONSTRAINT `CustomerCart_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerCart` ADD CONSTRAINT `CustomerCart_productVariantId_fkey` FOREIGN KEY (`productVariantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
