/*
  Warnings:

  - You are about to drop the column `accessScope` on the `modulepermission` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[moduleId,permissionId]` on the table `ModulePermission` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `modulepermission` DROP COLUMN `accessScope`;

-- CreateIndex
CREATE UNIQUE INDEX `ModulePermission_moduleId_permissionId_key` ON `ModulePermission`(`moduleId`, `permissionId`);

