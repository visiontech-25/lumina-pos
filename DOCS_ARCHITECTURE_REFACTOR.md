# Lumina POS — Architecture Refactor Guide

This document maps the **target architecture** (api/features/hooks/layouts/store) to the **current structure** and outlines migration steps.

## Target Structure

```
src/
├── api/                    # Firebase config and shared services
│   ├── firebase.ts         # ← services/firebaseConfig.ts
│   ├── authService.ts      # ← services/authService.ts
│   └── storeService.ts     # ← services/firebaseService.ts + storeRepo.ts
├── components/             # Reusable UI elements
│   └── Shared/             # Buttons, Modals, Inputs (extract from current components)
├── features/               # Major POS Modules
│   ├── auth/               # Login, Sign-up, Protected Routes ← components/Auth.tsx
│   ├── checkout/           # Scanner, Cart, Payment ← components/POS.tsx, InvoiceModal
│   ├── inventory/          # Product Entry, Bulk Upload ← components/Inventory.tsx
│   └── customers/          # Clienteling, Purchase History ← components/Customers.tsx
├── hooks/                  # Custom React hooks
│   ├── useAuth.ts          # Auth state
│   ├── useStock.ts         # Stock levels, low-stock alerts
│   └── useSync.ts          # Offline sync status
├── layouts/                # Dashboard and Auth Layouts
│   ├── AuthLayout.tsx      # Login/Signup wrapper
│   └── DashboardLayout.tsx # Sidebar + main content
├── store/                  # State management (Zustand or Redux)
│   └── useStore.ts         # Products, sales, user, etc.
└── utils/                  # Formatters and validations
    ├── formatters.ts       # Currency, Date
    └── validations.ts      # Email, phone, etc.
```

## Current → Target Mapping

| Current | Target |
|--------|--------|
| `services/firebaseConfig.ts` | `api/firebase.ts` |
| `services/authService.ts` | `api/authService.ts` |
| `services/firebaseService.ts` | `api/storeService.ts` |
| `services/storeRepo.ts` | `api/storeService.ts` (merge) |
| `components/Auth.tsx` | `features/auth/Auth.tsx` |
| `components/POS.tsx` | `features/checkout/POS.tsx` |
| `components/Inventory.tsx` | `features/inventory/Inventory.tsx` |
| `components/Customers.tsx` | `features/customers/Customers.tsx` |
| `utils/stringUtils.ts` | `utils/stringUtils.ts` |

## Migration Steps

1. Create `src/` folder and subfolders.
2. Move files one module at a time, updating imports.
3. Update `vite.config.ts` to use `src` as root (or keep root and use `src/` for new code).
4. Extract shared components (Button, Modal, Input) into `components/Shared/`.
5. Add hooks: `useAuth`, `useStock`, `useSync`.
6. Add layouts: `AuthLayout`, `DashboardLayout`.

## Notes

- The current structure works; refactor incrementally.
- Keep `App.tsx` at root until layouts are ready.
- Use path aliases in `tsconfig.json` for cleaner imports.
