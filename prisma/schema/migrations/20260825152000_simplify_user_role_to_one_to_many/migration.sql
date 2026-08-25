-- AlterTable: Add roleId column to User as nullable first
ALTER TABLE `User` ADD COLUMN `roleId` VARCHAR(191) NULL;

-- Backfill roleId from UserRole join table
UPDATE `User` u
INNER JOIN `UserRole` ur ON u.id = ur.userId
SET u.roleId = ur.roleId;

-- In case any user has no UserRole, default to Customer role
UPDATE `User`
SET `roleId` = (SELECT `id` FROM `Role` WHERE `name` = 'Customer' LIMIT 1)
WHERE `roleId` IS NULL;

-- AlterTable: Make roleId NOT NULL
ALTER TABLE `User` MODIFY COLUMN `roleId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `User_roleId_idx` ON `User`(`roleId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE `UserRole` DROP FOREIGN KEY `UserRole_roleId_fkey`;
ALTER TABLE `UserRole` DROP FOREIGN KEY `UserRole_userId_fkey`;

-- DropTable
DROP TABLE `UserRole`;

