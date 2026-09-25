# 📊 Frontend Integration Guide: Sales and Financials Module

This guide details the API endpoints, data models, query parameters, and chart formatting for the **Sales & Financials** module in the Basta Kape management application.

---

## 📌 1. Overview

The **Sales & Financials** module consolidates:

1. **Sales & Revenue**: Confirmed paid orders (`paymentStatus: PAID`), gross revenue, discounts, net sales, and average ticket size (regardless of fulfillment completion status).
2. **Procurement & Inventory Expenses**: Raw ingredient and packaging delivery costs (`IngredientBatch`).
3. **Inventory Stock Transactions & Costing**:
    - **Cost of Goods Sold (COGS)**: Raw ingredients consumed in sales (`SALE` stock transactions $\times$ `batch.unitCost`).
    - **Procurement Inflows**: Delivered stock batches (`DELIVERY`).
    - **Operational Wastage & Losses**: Spoilage, kitchen waste, expired items, theft, shrinkage (`StockTransaction`).
    - **Discrepancy Corrections**: Inventory valuation adjustments (`PHYSICAL_COUNT_CORRECTION`).
4. **Prepared Food Expirations & Loss**: Expired display cookies/pastries, spoiled shelf items, sampling, and disposals (`PreparedItemTransaction`).
5. **Profitability & Financial Health**: Gross Profit, Net Operating Profit, Gross/Net Profit Margin %, and Loss Rate %.
6. **Multi-Series Daily Financial Trends**: Daily tracking of Sales vs. Expenses vs. Losses vs. Net Profit.

---

## 🔐 2. Access Control & RBAC

- **Authentication**: `Authorization: Bearer <token>`
- **Required Permission**: `READ` on `SALES_MANAGEMENT` or `REPORTS_MANAGEMENT`.

---

## 🌐 3. API Endpoints

### 1️⃣ Sales & Financials Analytics

- **Endpoint**: `GET /api/reports/sales-analytics`
- **Query Parameters**:
    - `dateFrom` (string, ISO or `YYYY-MM-DD`, e.g. `2026-08-01`): Start of period.
    - `dateTo` (string, ISO or `YYYY-MM-DD`, e.g. `2026-08-31`): End of period.
    - `type` (optional enum):
        - `summary`: High-level financial & sales KPI metrics (including COGS and stock transaction counts).
        - `financials`: Structured Profit & Loss (P&L) breakdown (with COGS and procurement).
        - `daily-trend`: Multi-metric daily time-series (sales, expenses, losses, net profit).
        - `losses`: Detailed waste & expiration losses.
        - `expenses`: Procurement & supplier expenses breakdown + Stock transactions costing summary.
        - `stock-transactions`: Detailed inventory stock transactions costing analysis by type (`DELIVERY`, `SALE`, `WASTE`, `SPOILED`, `EXPIRED`, `THEFT`, `PROMOTIONAL_USE`, `PHYSICAL_COUNT_CORRECTION`) and top consumed ingredients.
        - `top-products`: Top 5 bestselling menu items.
        - `order-type-breakdown`: Dine In / Take Out / Delivery distribution.
        - `payment-breakdown`: Cash / GCash / Maya / Card distribution.
        - `orders`: Order transaction list.
        - _(omitted)_: Returns the complete, compiled dataset with all sections.

---

## 📑 4. Report Preview & Export Endpoints

Users can generate exportable Excel and PDF reports for both `sales` and `financials`:

- **Preview**: `POST /api/reports/preview`
    - Body: `{ "module": "financials", "filters": { "dateFrom": "2026-08-01", "dateTo": "2026-08-31" } }`
- **Export File**: `POST /api/reports/export`
    - Body: `{ "module": "financials", "filters": { "dateFrom": "2026-08-01", "dateTo": "2026-08-31" }, "format": "excel" }` _(or `"pdf"`)_
