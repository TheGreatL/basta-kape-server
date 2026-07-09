/*
  Warnings:

  - You are about to drop the column `cashierSessionId` on the `order` table. All the data in the column will be lost.
  - You are about to drop the `registershift` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `Order_cashierSessionId_fkey`;

-- DropForeignKey
ALTER TABLE `registershift` DROP FOREIGN KEY `RegisterShift_cashierId_fkey`;

-- DropIndex
DROP INDEX `Order_cashierSessionId_idx` ON `order`;

-- AlterTable
ALTER TABLE `order` DROP COLUMN `cashierSessionId`;

-- DropTable
DROP TABLE `registershift`;
