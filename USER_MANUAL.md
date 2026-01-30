# Lumina Pro POS — User Manual (Dedicated)

Welcome. This manual is written for **store owners, cashiers, managers, and kitchen staff**.  
If you’re not sure what to do next, start with **“Daily workflow”**.

---

## Daily workflow (simple)

### Start of day
1. **Login**
2. Check the **cloud sync badge** (top bar):
   - **Green** = synced
   - **Orange** = offline
   - **Blue** = pending changes
3. Confirm:
   - Your **products** are loaded
   - Receipt printer is configured (Settings → **Hardware**)

### During sales (retail)
1. Open **Terminal**
2. Search product (name/SKU/barcode)
3. Tap items to add to cart
4. Complete payment (Cash/Card/M‑Pesa)
5. Receipt prints (or opens print dialog if web)

### During service (restaurant)
1. Go to **Restaurant**
2. Select a table
3. Add items in the POS screen
4. Add **Modifiers/Course/Station** if needed
5. Tap **Send to kitchen**
6. Kitchen uses **KDS** to progress: Preparing → Ready → Served
7. Pay with tips/service charge when customer is ready

### End of day
1. Check **Reports** / **Fiscal**
2. Confirm “pending sync” goes to **0**
3. (Optional) Export sales CSV

---

## Retail POS (Terminal)

### Add items to cart
- Use search at top
- Tap product cards
- In the cart panel:
  - **+ / −** adjusts quantity
  - Remove items by decreasing to 0

### Discounts
- Use the discount field (if enabled in POS) and promotions apply automatically.

### Payment methods
- **Cash**: completes immediately
- **Card**: completes immediately (recorded as card)
- **M‑Pesa**: prompts for phone and waits confirmation

---

## Restaurant mode

### Modifiers / course / kitchen routing
In the cart (restaurant mode), use **Mods/Course** on each item to set:
- **Modifiers**: e.g. “no onions”, “extra spicy”
- **Course**: starter / main / dessert / drink
- **Station**: kitchen / bar / dessert / cold / none

### Send to kitchen
Use **Send** to:
- mark the order as sent
- print a kitchen ticket (if kitchen printer is configured)
- show the ticket in the **KDS** screen

### KDS (Kitchen Display System)
Go to **KDS** tab:
- Filter tickets by status
- Update status:
  - Sent → Preparing → Ready → Served

### Paying a table (tips + service + split)
On a ready ticket:
- Tap **Pay**
- Choose:
  - tip %
  - service %
  - split count
  - payment method

---

## Hardware (Printers / Drawer / Scanner / Scale)

Open **Settings → Hardware**.

### Receipt printer
Choose one:
- **Network (LAN/TCP 9100)**: recommended for most ESC/POS printers  
  Enter printer **IP** and **Port** (usually 9100).
- **Bluetooth (Android)**: enter printer Bluetooth **MAC address**
- **System**: uses OS/browser print dialog (no raw ESC/POS features)

### Kitchen printer
Same options as receipt printer.

### Cash drawer
Most drawers open via **printer pulse**:
- set Cash Drawer mode: **Pulse via Printer**
- pick Printer target: receipt or kitchen printer

### Barcode scanner
Most scanners behave like a **keyboard**:
- click the search input and scan; it types the barcode.

### Scale
If you use a scale with barcodes, scan the scale barcode in the search field.

---

## Inventory

### Add / edit products
Inventory → Add Product:
- name, category, price, stock, SKU are core fields
- barcode is optional but recommended

### Print labels
Inventory table → **Printer icon** prints a basic label.

---

## Sales history + refunds

### View a sale
Sales tab → open sale to inspect items and payment method.

### Refunds
Refund requires admin policy + manager PIN (if enabled).

---

## Customers
- Add customers for tracking and loyalty history.

---

## Using Lumina AI (help)

Lumina AI is designed to answer like a helpful colleague:
- you can ask “how do I…”
- it will suggest the exact screen and button names

If your question is unusual, it will recommend the closest section in this manual.

