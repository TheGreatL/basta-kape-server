# Basta Kape Server - Orders Feature Checklist

## 1. Cashier Shift Management (`RegisterShift`)

- [x] Define schemas & Zod validation types (`register-shift.types.ts`)
- [x] Create repository queries (`register-shift.repository.ts`)
- [x] Create shift service business logic (`register-shift.service.ts`)
- [x] Declare API endpoints (`GET /active`, `POST /open`, `POST /close`) & Swagger docs (`register-shift.route.ts`)
- [x] Write integration and validation tests (`register-shift.test.ts`)

---

## 2. Order Management & Queue Lifecycle (`Order`, `OrderItem`, `OrderStatusHistory`)

- [x] Define schemas & Zod validation types (`order.types.ts`)
- [x] Create repository queries (`order.repository.ts`)
- [x] Implement ordering and status management business logic (`order.service.ts`)
- [x] Declare API routes (`GET /`, `GET /:id`, `POST /`, `PATCH /:id/status`) & Swagger docs (`order.route.ts`)
- [x] Write ordering flow integration tests (`order.test.ts`)

---

- [x] Create an endpoint in customer to get their orders (order history)

## 3. Product Modifiers & Customizations (`ModifierGroup`, `ModifierOption`, `OrderItemModifier`)

- [ ] Define schemas & Zod validation types (`modifier.types.ts`)
- [ ] Implement group/option configuration database logic (`modifier.repository.ts`)
- [ ] Implement customizations service validation (`modifier.service.ts`)
- [ ] Declare configuration API routes & Swagger docs (`modifier.route.ts`)
- [ ] Write modifier configuration integration tests (`modifier.test.ts`)

---

## 4. Digital & Cash Payments (`OrderPayment`)

- [ ] Define validation schemas for Cash/GCash details (`payment.types.ts`)
- [ ] Build payment processing database queries (`payment.repository.ts`)
- [ ] Implement cash change and payment proof verification service logic (`payment.service.ts`)
- [ ] Declare payment routes & Swagger docs (`payment.route.ts`)
- [ ] Write payment verification integration tests (`payment.test.ts`)

---

## 5. Discounts & Philippine BIR Compliance (`Discount`, `OrderDiscount`)

- [ ] Define discount types and BIR metadata schemas (`discount.types.ts`)
- [ ] Build discount configuration queries (`discount.repository.ts`)
- [ ] Implement BIR discount deductions calculations (`discount.service.ts`)
- [ ] Declare discount configuration & application endpoints (`discount.route.ts`)
- [ ] Write BIR-compliant calculation tests (`discount.test.ts`)

---

## 6. Order Void Logs & Audits (`OrderVoidLog`)

- [ ] Define schemas for void overrides (`void.types.ts`)
- [ ] Build supervisor auditing database logic (`void.repository.ts`)
- [ ] Implement Manager/Supervisor authorization validation checks (`void.service.ts`)
- [ ] Declare void logs retrieval and post routes (`void.route.ts`)
- [ ] Write loss prevention audit tests (`void.test.ts`)
