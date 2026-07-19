/*
  Warnings:

  - The values [BRANCH,STORE] on the enum `ModulePermission_accessScope` will be removed. If these variants are still used in the database, this will fail.
  - The values [MOBILE_APP,DELIVERY_PARTNER] on the enum `Order_orderSource` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `ModulePermission` MODIFY `accessScope` ENUM('ALL', 'OWN') NOT NULL DEFAULT 'ALL';

-- AlterTable
ALTER TABLE `Order` MODIFY `orderSource` ENUM('POS', 'WEBSITE') NOT NULL DEFAULT 'POS';
