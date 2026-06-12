# Basta Kape Server - Orders Feature Checklist

## 1. Cashier Shift Management (`RegisterShift`)

- [x] Define schemas & Zod validation types (`register-shift.types.ts`)
- [x] Create repository queries (`register-shift.repository.ts`)
- [x] Create shift service business logic (`register-shift.service.ts`)
- [x] Declare API endpoints (`GET /active`, `POST /open`, `POST /close`, `GET /register-shifts` [scope: ALL], `GET /register-shifts/my-shifts` [scope: self/own]) & Swagger docs (`register-shift.route.ts`)
- [x] Write integration and validation tests (`register-shift.test.ts`)
- [x] Create detailed summary and put it in the md file so it can be used in frontend, no frontend code (documented in [frontend-integration.md](file:///c:/Users/Christian%20Nicolas/Desktop/basta-kape/basta-kape-server/src/feature/register-shift/frontend-integration.md))

---

## 2. Order Management & Queue Lifecycle (`Order`, `OrderItem`, `OrderStatusHistory`)

- [x] Define schemas & Zod validation types (`order.types.ts`)
- [x] Create repository queries (`order.repository.ts`)
- [x] Implement ordering and status management business logic (`order.service.ts`)
- [x] Declare API routes (`GET /`, `GET /:id`, `POST /`, `PATCH /:id/status`) & Swagger docs (`order.route.ts`)
- [x] Write ordering flow integration tests (`order.test.ts`)
- [x] Create detailed summary and put it in the md file so it can be used in frontend, no frontend code (documented in [frontend-integration.md](file:///c:/Users/Christian%20Nicolas/Desktop/basta-kape/basta-kape-server/src/feature/order/frontend-integration.md))

---

- [x] Create an endpoint in customer to get their orders (order history)

- [x] Create detailed summary and put it in the md file so it can be use in frontend, no frontend code (documented in [frontend-integration.md](file:///c:/Users/Christian%20Nicolas/Desktop/basta-kape/basta-kape-server/src/feature/customer/frontend-integration.md))

## 3. Product Modifiers & Customizations (`ModifierGroup`, `ModifierOption`, `OrderItemModifier`)

- [x] Define schemas & Zod validation types (`modifier.types.ts`)
- [x] Implement group/option configuration database logic (`modifier.repository.ts`)
- [x] Implement customizations service validation (`modifier.service.ts`)
- [x] Declare configuration API routes & Swagger docs (`modifier.route.ts`)
- [x] Write modifier configuration integration tests (`modifier.test.ts`)
- [x] Create detailed summary and put it in the md file so it can be used in frontend, no frontend code (documented in [frontend-integration.md](file:///c:/Users/Christian%20Nicolas/Desktop/basta-kape/basta-kape-server/src/feature/modifier/frontend-integration.md))
- [x] Connect modifier options to the inventory system via modifier option recipes (`/modifiers/options/:optionId/recipe` endpoints)
- [x] Implement transaction-level automatic inventory ingredient stock deduction for completed orders (variant + modifiers)
- [x] Integrate modifier option produceable capacities and bottlenecks into production forecast projection outputs
- [ ] Refactor POS order creation (`create-order-dialog.tsx`) to enforce modifier selection constraints (`maxSelect`, `isRequired`, warning alerts) similarly to the customer details page.
- [ ] Add visual warning/out-of-stock indicators for modifier options based on active inventory forecast bottlenecks.

---

Not implemented in frontend yet

## 4. Digital & Cash Payments (`OrderPayment`)

- [x] Define validation schemas for Cash/GCash details (`payment.types.ts`)
- [x] Build payment processing database queries (`payment.repository.ts`)
- [x] Implement cash change and payment proof verification service logic (`payment.service.ts`)
- [x] Declare payment routes & Swagger docs (`payment.route.ts`)
- [x] Write payment verification integration tests (`payment.test.ts`)
- [x] Create detailed summary and put it in the md file so it can be used in frontend, no frontend code (documented in [frontend-integration.md](file:///c:/Users/Christian%20Nicolas/Desktop/basta-kape/basta-kape-server/src/feature/payment/frontend-integration.md))

---

## 5. Discounts & Philippine BIR Compliance (`Discount`, `OrderDiscount`)

- [x] Define discount types and BIR metadata schemas (`discount.types.ts`)
- [x] Build discount configuration queries (`discount.repository.ts`)
- [x] Implement BIR discount deductions calculations (`discount.service.ts`)
- [x] Declare discount configuration & application endpoints (`discount.route.ts`)
- [x] Write BIR-compliant calculation tests (`discount.test.ts`)
- [x] Create detailed summary and put it in the md file so it can be used in frontend, no frontend code (documented in [frontend-integration.md](file:///c:/Users/Christian%20Nicolas/Desktop/basta-kape/basta-kape-server/src/feature/discount/frontend-integration.md))

---

## 6. Order Void Logs & Audits (`OrderVoidLog`)

- [x] Define schemas for void overrides (`void.types.ts`)
- [x] Build supervisor auditing database logic (`void.repository.ts`)
- [x] Implement Manager/Supervisor authorization validation checks (`void.service.ts`)
- [x] Declare void logs retrieval and post routes (`void.route.ts`)
- [x] Write loss prevention audit tests (`void.test.ts`)
- [x] Create detailed summary and put it in the md file so it can be used in frontend, no frontend code (documented in [frontend-integration.md](file:///c:/Users/Christian%20Nicolas/Desktop/basta-kape/basta-kape-server/src/feature/void/frontend-integration.md))
