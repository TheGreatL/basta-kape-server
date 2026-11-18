-- AlterTable
ALTER TABLE `StoreSetting` ADD COLUMN `deliveryBaseDistanceKm` DOUBLE NOT NULL DEFAULT 2.0,
    ADD COLUMN `deliveryBaseFare` DOUBLE NOT NULL DEFAULT 49.0,
    ADD COLUMN `deliveryMaxDistanceKm` DOUBLE NOT NULL DEFAULT 10.0,
    ADD COLUMN `deliveryRatePerKm` DOUBLE NOT NULL DEFAULT 10.0,
    ADD COLUMN `storeLatitude` DOUBLE NOT NULL DEFAULT 14.6288,
    ADD COLUMN `storeLongitude` DOUBLE NOT NULL DEFAULT 121.0422;

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `deliveryAddress` TEXT NULL,
    ADD COLUMN `deliveryDistanceKm` DOUBLE NULL,
    ADD COLUMN `deliveryFee` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `deliveryLatitude` DOUBLE NULL,
    ADD COLUMN `deliveryLongitude` DOUBLE NULL;

-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `deliveryAddress` TEXT NULL;
