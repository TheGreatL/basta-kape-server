/*
  Warnings:

  - You are about to drop the column `gcashReferenceNumber` on the `orderpayment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[paymentReferenceNumber,paymentMethod]` on the table `OrderPayment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `orderpayment` DROP COLUMN `gcashReferenceNumber`,
    ADD COLUMN `paymentReferenceNumber` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `OrderPayment_paymentReferenceNumber_paymentMethod_key` ON `OrderPayment`(`paymentReferenceNumber`, `paymentMethod`);
