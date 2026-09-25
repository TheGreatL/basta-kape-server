/*
  Warnings:

  - The values [PAYMAYA,CREDIT_CARD] on the enum `OrderPayment_paymentMethod` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `isBestSeller` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `isMustTry` on the `Product` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `Product_isBestSeller_idx` ON `Product`;

-- DropIndex
DROP INDEX `Product_isMustTry_idx` ON `Product`;

-- AlterTable
ALTER TABLE `OrderPayment` MODIFY `paymentMethod` ENUM('CASH', 'GCASH') NOT NULL DEFAULT 'CASH';

-- AlterTable
ALTER TABLE `Product` DROP COLUMN `isBestSeller`,
    DROP COLUMN `isMustTry`;
