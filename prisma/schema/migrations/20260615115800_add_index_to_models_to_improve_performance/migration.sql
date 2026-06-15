-- CreateIndex
CREATE INDEX `ActivityLog_createdAt_idx` ON `ActivityLog`(`createdAt`);

-- CreateIndex
CREATE INDEX `Order_status_idx` ON `Order`(`status`);

-- CreateIndex
CREATE INDEX `Order_orderType_idx` ON `Order`(`orderType`);

-- CreateIndex
CREATE INDEX `Order_orderSource_idx` ON `Order`(`orderSource`);

-- CreateIndex
CREATE INDEX `Order_createdAt_idx` ON `Order`(`createdAt`);

-- CreateIndex
CREATE INDEX `Order_deletedAt_idx` ON `Order`(`deletedAt`);

-- CreateIndex
CREATE INDEX `OrderItem_deletedAt_idx` ON `OrderItem`(`deletedAt`);

-- CreateIndex
CREATE INDEX `OrderPayment_paymentStatus_idx` ON `OrderPayment`(`paymentStatus`);

-- CreateIndex
CREATE INDEX `OrderPayment_createdAt_idx` ON `OrderPayment`(`createdAt`);

-- CreateIndex
CREATE INDEX `OrderStatusHistory_createdAt_idx` ON `OrderStatusHistory`(`createdAt`);

-- CreateIndex
CREATE INDEX `OrderVoidLog_createdAt_idx` ON `OrderVoidLog`(`createdAt`);

-- CreateIndex
CREATE INDEX `Product_deletedAt_idx` ON `Product`(`deletedAt`);

-- CreateIndex
CREATE INDEX `ProductAttribute_deletedAt_idx` ON `ProductAttribute`(`deletedAt`);

-- CreateIndex
CREATE INDEX `ProductAttributeValue_deletedAt_idx` ON `ProductAttributeValue`(`deletedAt`);

-- CreateIndex
CREATE INDEX `ProductCategory_deletedAt_idx` ON `ProductCategory`(`deletedAt`);

-- CreateIndex
CREATE INDEX `ProductType_deletedAt_idx` ON `ProductType`(`deletedAt`);

-- CreateIndex
CREATE INDEX `ProductVariant_deletedAt_idx` ON `ProductVariant`(`deletedAt`);

-- CreateIndex
CREATE INDEX `ProductVariantAttribute_deletedAt_idx` ON `ProductVariantAttribute`(`deletedAt`);

-- CreateIndex
CREATE INDEX `Recipe_deletedAt_idx` ON `Recipe`(`deletedAt`);

-- CreateIndex
CREATE INDEX `RecipeIngredient_deletedAt_idx` ON `RecipeIngredient`(`deletedAt`);

-- CreateIndex
CREATE INDEX `User_deletedAt_idx` ON `User`(`deletedAt`);

-- CreateIndex
CREATE INDEX `UserRole_deletedAt_idx` ON `UserRole`(`deletedAt`);

-- RenameIndex
ALTER TABLE `ActivityLog` RENAME INDEX `ActivityLog_actorId_fkey` TO `ActivityLog_actorId_idx`;

-- RenameIndex
ALTER TABLE `Order` RENAME INDEX `Order_cashierSessionId_fkey` TO `Order_cashierSessionId_idx`;

-- RenameIndex
ALTER TABLE `Order` RENAME INDEX `Order_customerId_fkey` TO `Order_customerId_idx`;

-- RenameIndex
ALTER TABLE `OrderDiscount` RENAME INDEX `OrderDiscount_discountId_fkey` TO `OrderDiscount_discountId_idx`;

-- RenameIndex
ALTER TABLE `OrderDiscount` RENAME INDEX `OrderDiscount_orderId_fkey` TO `OrderDiscount_orderId_idx`;

-- RenameIndex
ALTER TABLE `OrderItem` RENAME INDEX `OrderItem_orderId_fkey` TO `OrderItem_orderId_idx`;

-- RenameIndex
ALTER TABLE `OrderItem` RENAME INDEX `OrderItem_productVariantId_fkey` TO `OrderItem_productVariantId_idx`;

-- RenameIndex
ALTER TABLE `OrderItemModifier` RENAME INDEX `OrderItemModifier_modifierOptionId_fkey` TO `OrderItemModifier_modifierOptionId_idx`;

-- RenameIndex
ALTER TABLE `OrderItemModifier` RENAME INDEX `OrderItemModifier_orderItemId_fkey` TO `OrderItemModifier_orderItemId_idx`;

-- RenameIndex
ALTER TABLE `OrderPayment` RENAME INDEX `OrderPayment_orderId_fkey` TO `OrderPayment_orderId_idx`;

-- RenameIndex
ALTER TABLE `OrderStatusHistory` RENAME INDEX `OrderStatusHistory_changedById_fkey` TO `OrderStatusHistory_changedById_idx`;

-- RenameIndex
ALTER TABLE `OrderStatusHistory` RENAME INDEX `OrderStatusHistory_orderId_fkey` TO `OrderStatusHistory_orderId_idx`;

-- RenameIndex
ALTER TABLE `OrderVoidLog` RENAME INDEX `OrderVoidLog_orderId_fkey` TO `OrderVoidLog_orderId_idx`;

-- RenameIndex
ALTER TABLE `OrderVoidLog` RENAME INDEX `OrderVoidLog_voidedById_fkey` TO `OrderVoidLog_voidedById_idx`;

-- RenameIndex
ALTER TABLE `Product` RENAME INDEX `Product_productCategoryId_fkey` TO `Product_productCategoryId_idx`;

-- RenameIndex
ALTER TABLE `Product` RENAME INDEX `Product_productTypeId_fkey` TO `Product_productTypeId_idx`;

-- RenameIndex
ALTER TABLE `ProductAttributeValue` RENAME INDEX `ProductAttributeValue_productAttributeId_fkey` TO `ProductAttributeValue_productAttributeId_idx`;

-- RenameIndex
ALTER TABLE `ProductVariant` RENAME INDEX `ProductVariant_productId_fkey` TO `ProductVariant_productId_idx`;

-- RenameIndex
ALTER TABLE `ProductVariantAttribute` RENAME INDEX `ProductVariantAttribute_productAttributeValueId_fkey` TO `ProductVariantAttribute_productAttributeValueId_idx`;

-- RenameIndex
ALTER TABLE `ProductVariantAttribute` RENAME INDEX `ProductVariantAttribute_productVariantId_fkey` TO `ProductVariantAttribute_productVariantId_idx`;

-- RenameIndex
ALTER TABLE `RecipeIngredient` RENAME INDEX `RecipeIngredient_ingredientId_fkey` TO `RecipeIngredient_ingredientId_idx`;

-- RenameIndex
ALTER TABLE `RecipeIngredient` RENAME INDEX `RecipeIngredient_recipeId_fkey` TO `RecipeIngredient_recipeId_idx`;

-- RenameIndex
ALTER TABLE `RegisterShift` RENAME INDEX `RegisterShift_cashierId_fkey` TO `RegisterShift_cashierId_idx`;

-- RenameIndex
ALTER TABLE `UserRole` RENAME INDEX `UserRole_roleId_fkey` TO `UserRole_roleId_idx`;

-- RenameIndex
ALTER TABLE `UserRole` RENAME INDEX `UserRole_userId_fkey` TO `UserRole_userId_idx`;
