# Basta Kape: Web-Based POS & Inventory Management System

A prime example of a business navigating the transition from manual to digital operations is Basta Kape, located at 50 K-1st, Quezon City, Metro Manila. Founded on November 8, 2019, by John Zymulgna L. Sencio, the coffee shop was established as a simple, community-centric space for passionate coffee aficionados. 

The shop was aptly named "Basta Kape" to reflect its no-fuss focus on quality coffee, quickly cultivating a loyal local following and becoming a beloved neighborhood institution. The establishment operates daily from 7:00 AM to 9:00 PM, with peak customer traffic occurring during the morning rush (7:30 AM – 9:30 AM) and the late afternoon (4:00 PM – 7:00 PM). To manage these high-volume periods, the business typically utilizes three to four staff members per shift, including a dedicated cashier and two baristas. (See Appendix B, Page 53, Question 1, 2, & 3).

However, rapid success and steady growth have exposed the limitations of its manual operations. The first problem severely impacting the business is the strict reliance on manual transaction handling and sales calculations for both walk-in and online orders. Currently, every single in-store order must be written down on a paper slip and calculated by hand using mental math or a basic calculator. Simultaneously, the shop accepts online orders via Facebook and Instagram, meaning the cashier must manually reply to chats, transcribe the customer's messages onto paper slips, and manually check a store phone to verify GCash payments. This process is a significant problem because the dual responsibility creates a severe bottleneck; cashiers often cannot respond to online queries promptly during peak hours, resulting in canceled orders and frustrated customers. Furthermore, the pressure to serve a high volume of customers quickly frequently leads to calculation mistakes and inaccurate billing at the counter, while manual transcription from chats to paper slips doubles the workload and increases the risk of preparation errors due to illegible handwriting or incomplete customer instructions. (See Appendix B, Page 54-56 & 62-64, Question 10, 13, 43, 44, 45, & 46)

Second, Basta Kape struggles with highly inaccurate and disorganized inventory management due to its complete reliance on human memory and paper logs. The current process requires staff members to manually write down every ingredient they use throughout a shift in a physical logbook, and then perform a massive manual count of remaining supplies after the shop closes. This process is a problem because during peak hours, this tedious task is frequently delayed, forgotten, or simply guessed at the end of the day, creating a severe disconnect between what the logbook claims is in stock and what is actually sitting on the shelves. This lack of real-time visibility routinely leads to embarrassing stock shortages. It is especially problematic for online orders, where a cashier might accept a GCash payment via chat only to discover the ingredients are already gone, leading to complicated refunds and customer dissatisfaction. Additionally, relying on visual guesses for purchasing decisions often results in over-ordering perishable goods, causing costly spoilage and tied-up capital. (See Appendix B, Page 57,58, & 64, Question 20, 23, 25, & 47)

Finally, the management faces constant challenges in generating accurate financial and operational reports. At the end of each business day, the current process dictates that Mr. Sencio must endure the "most tiring part" of his day: gathering dozens of handwritten receipt booklets and paper order slips to manually tally every transaction and reconcile it with the physical cash drawer and digital GCash logs using a calculator. This process is a problem because it is highly prone to human error; a single misplaced decimal or lost paper slip creates a "nightmare" that requires hours of manual auditing to find even a small 50-peso discrepancy. Furthermore, because all data is trapped in a physical ledger book, it is extremely difficult to track long-term profit margins or identify top-selling items. This lack of instant access to accurate, digital data forces management to make critical business decisions—such as menu changes or promotional strategies— based on "gut feeling" rather than reliable, verifiable numbers. (See Appendix B, Page 59 & 60, Question 30, 32, & 33)

## Purpose and Description

The main purpose of this project is to provide Basta Kape with an easy-to-use, unified tool that simplifies the shop's daily tasks and acts as a reliable partner for both in-store and online operations. To make taking orders as smooth as possible, the proponents will build a clear, picture-based point-of-sale menu for the cashiers to process walk-in transactions instantly. 

Simultaneously, the system will feature a dedicated online ordering link where remote customers can browse the menu, place their orders, and upload digital payments directly. Once any order is finalized—whether from the front counter or the online portal—the details will immediately synchronize and appear on a single digital screen for the drink makers. This eliminates the need for the cashier to manually transcribe chat messages onto paper slips, ensuring that every single cup of coffee is prepared correctly and creating a seamless workflow from the moment an order is placed to the moment it is served. 

As each coffee is sold across both platforms, the new setup will automatically manage the shop's supplies by acting as an automatic pantry. It instantly subtracts the exact ingredients used for every specific drink, guaranteeing that the team always has a clear understanding of what supplies are left on the shelves. This synchronized tracking is crucial for preventing the shop from accepting online payments for items that are already out of stock. Behind the scenes, the program will continuously gather all of this ongoing activity—from the combined number of walk-in and online drinks sold to the exact amount of ingredients used—and organize this information into simple, easy-to-read daily and monthly sales summaries for the owner. 

Ultimately, by taking care of the tracking, counting, and summarizing, this project will allow the Basta Kape team to focus completely on serving great coffee and keeping all their customers happy.

## Objectives

1. To develop an integrated, multi-channel digital ordering system that speeds up the entire transaction process. The proponents will build a user-friendly POS interface for cashiers and a dedicated online ordering portal for remote customers. Both platforms will instantly calculate exact totals and synchronize customer requests directly to a single digital display for the drink makers. This ensures smooth checkouts, eliminates the operational bottleneck of cashiers answering online chats, and guarantees that custom drinks from any source are prepared accurately.

2. Furthermore, the proponents aim to build a highly real-time, centralized stock monitoring feature that operates seamlessly in the background for both physical and digital sales. Whenever a drink is sold in-store or ordered online, the system will immediately subtract the precise amount of ingredients used from a digital inventory list. This continuous tracking guarantees management has a highly accurate view of available supplies, allowing the team to confidently make reordering decisions and preventing the system from accepting online orders for out-of-stock items.

3. Finally, the proponents aims to implement a reliable, centralized system for creating automated business summaries. The reports module will instantly record the details of every completed sale— unifying both physical cash transactions and digital online payments. It will use that continuous stream of data to easily generate clear daily, weekly, and monthly financial reports. This feature will provide the owner with perfectly accurate details on total income and profit margins without the need for manual tallying, allowing for confident, data-driven business decisions.

## Scope and Limitation

This study covers the development and implementation of a Web-Based Point of Sale (POS) and Inventory Management System specifically tailored for the daily operations of Basta Kape, located in Quezon City. The system is designed to transition the café from manual, paper-based tracking to a centralized digital platform, directly addressing core operational issues in sales calculation, order processing speed, and real-time stock monitoring.

### User Roles and Access Levels

To ensure data security and a proper division of operational tasks, the system will feature distinct user access levels. The scope of access for each user is defined as follows:

*   **Owner**
    This role is designed for the head of the business. The Owner has the highest level of access and can view all activities within the system. They have full access to financial details, allowing them to track daily cash sales, identify top-selling drinks, and monitor overall profit over time. Additionally, they can oversee staff by reviewing login histories and tracking system actions to ensure operations are running smoothly and securely. 
    While the Owner can monitor the entire shop, this account is not intended for daily routine tasks. The Owner’s screen is not used for taking customer orders, updating menu prices, or logging new stock deliveries. Instead, their access is focused entirely on reviewing clear reports, identifying sales trends, and making informed decisions to help the business grow.

*   **Administrator (Manager)**
    Responsible for the essential back-end configuration that keeps the shop running. This role holds the authority to manage the menu, update ingredient formulas, and oversee the employee database. They serve as the primary controller for inventory accuracy, possessing the tools to perform manual overrides for spoiled goods and officially log new deliveries from suppliers.

*   **Cashier**
    The Cashier role is focused on handling daily customer transactions at the front counter. They are the primary users who access the billing and payment features to enter customer orders, calculate the correct totals, and process payments accurately. Additionally, the Cashier has access to view the inventory, allowing them to quickly check the availability of specific drinks and ingredients while taking customer requests.
    Their system access allows them to manage their active shift and generate immediate sales reports to balance the cash drawer, but they are restricted from changing past transaction records or manually editing the main inventory stock.

*   **Barista**
    The Barista role is focused on preparing drinks and completing customer orders. Their screen shows a live list of incoming orders as soon as they are entered by the cashier. They can update the status of each drink from pending to completed as they work.
    Additionally, the Barista can oversee the menu and view the inventory to check the availability of ingredients at their station. However, their access to the menu and inventory is strictly "view-only," meaning they cannot edit items, change prices, or manually adjust stock numbers. This setup ensures they remain focused on drink preparation without being distracted by sales reports or administrative settings.

*   **Customer**
    The Customer role is designed for patrons who want to place online orders directly through the system instead of messaging the shop’s social media pages. They have access to an external digital menu where they can select drinks, choose sizes, and add custom modifiers. Customers can manage their cart, submit their orders, and upload their proof of payment (such as a GCash screenshot). Their access is strictly limited to their own ordering interface; they cannot view any shop data, inventory levels, or administrative settings.

### System Scope: Modules and Features

The system is structured into specific modules and pages categorized by common functionalities and user-specific access levels.

#### Common System Modules
*   **Secure Authentication Module**: A centralized login portal requiring a unique username and password. The system automatically detects the user's assigned role upon login and redirects them to their respective workspace.
*   **Digital Menu Reference Module**: A common digital catalog accessible to all staff, displaying the cafe's complete menu, current prices, and available add-ons to serve as a quick reference during operations.

#### Owner Module
*   **Executive Dashboard**: A high-level overview interface displaying real-time business metrics, including total daily/monthly gross sales, peak hour transaction volumes, and top-selling items.
*   **Detailed Financial Reporting Module**: A comprehensive analytic module where the Owner can generate custom date-range reports for sales summaries, profit margins, and inventory consumption, exportable for external tax preparation or business meetings.

#### Administrator (Admin) Module
*   **Admin Control Dashboard**: An operational dashboard highlighting system alerts, such as active low-stock warnings and recent staff login activities.
*   **Menu & Recipe Management Module**: A configuration interface to dynamically add, edit, or disable product categories, individual drinks, sizes, and prices. This page also maps raw materials to end products, defining the exact recipe (e.g., grams of coffee beans, milliliters of milk) that will be automatically deducted upon each sale.
*   **Master Inventory & Restock Module**: The central hub for stock control. The Admin can input new supplier deliveries, adjust stock levels manually for discrepancies or spoilage, and set specific "Low Stock" warning thresholds for every ingredient.
*   **User Account Management Module**: A security module allowing the Admin to create, update, or deactivate system access accounts and passwords for the Cashiers and Baristas.
*   **Purchase Order**: This module digitalizes the process of replenishing shop supplies, replacing the owner’s current manual method of texting or calling individual suppliers. Within this interface, the Admin can generate a formal list of required raw materials, such as coffee beans, milk, and syrups, based on current stock levels. This page allows the Admin to draft, review, and finalize orders before sending them to the respective suppliers. By maintaining a digital record of these requests, the system ensures better tracking of pending deliveries and helps prevent the over-ordering of perishable goods, addressing a key concern regarding capital waste and spoilage.

#### Cashier Module
*   **Ordering and Checkout Module**: The primary front-end screen. It features a fast, touch-friendly visual menu. The Cashier can select items, apply custom drink requests (e.g., extra espresso shots), and view a real-time running total with automated calculations to process cash or digital payments easily.
*   **Daily Shift and Sales Report Module**: A reporting feature accessible to the Cashier. This allows them to generate and view a summary of the total sales, total orders, and cash collected specifically during their assigned shift. This report is crucial for the Cashier to accurately balance the cash drawer before turning it over to the next staff member or the owner.
*   **Transaction History Module**: A restricted viewing tool where the Cashier can track the finalized receipts processed during their current shift to double-check past orders, though they cannot delete or alter these records without the Administrator's approval.

#### Barista Module
*   **Live Order Queue (Kitchen Display) Module**: A real-time, auto-refreshing digital board displaying incoming orders pushed instantly from the Cashier's POS. Each order card highlights the specific drink, requested size, and clearly bold any custom modifications to prevent preparation errors.
*   **Order Status Controls**: Simple interactive buttons on each order card allowing the Barista to update the workflow status (e.g., from "Pending" to "Done"), automatically clearing the item from the active preparation queue.
*   **Station Stock Viewer**: A simplified inventory view allowing the Barista to quickly check the recorded levels of critical supplies (like milk or syrups) during a shift to anticipate when they need to request a restock from the Admin.

#### Customer Module
*   **Online Menu and Cart Module**: An interactive digital menu accessible via a direct store link. Customers can browse available items, customize their drinks (e.g., hot/iced, extra shots), and add them to a digital cart. The system automatically calculates their total bill, including any extra charges for add-ons, before they check out.
*   **Digital Checkout and Payment Upload Module**: A checkout page where customers can finalize their order details and upload their GCash payment screenshot or input their reference number. This feature directly sends the order and payment proof to the Cashier's screen for quick verification, bypassing the need for manual chat replies.
*   **Live Order Status Tracker**: A simple tracking interface that allows the customer to see the current status of their order (e.g., Pending, Preparing, or Ready for Pickup) in real-time. This eliminates the need for the customer to repeatedly message the shop for updates and reduces the cashier's screen time.

### Limitations of the System

While the system is comprehensively designed to improve the operational efficiency of Basta Kape, it is bound by the following limitations:
*   **Payment Gateway Limitations**: The system can record payments made via digital wallets like GCash, but it does not have a direct, embedded payment API gateway. The cashier must verify the payment visually and manually input the GCash reference number into the system to confirm and log the sale.
*   **No Third-Party Delivery Interactions**: The system handles direct, in-house orders. External APIs or automatic syncing with third-party delivery platforms (e.g., Foodpanda, GrabFood) are entirely excluded from this project.
