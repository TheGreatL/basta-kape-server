/*
  Warnings:

  - You are about to drop the column `paymentStatus` on the `orderpayment` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `OrderPayment_paymentStatus_idx` ON `orderpayment`;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `paymentStatus` ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `totalPaid` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `orderpayment` DROP COLUMN `paymentStatus`;

-- CreateIndex
CREATE INDEX `Order_paymentStatus_idx` ON `Order`(`paymentStatus`);
