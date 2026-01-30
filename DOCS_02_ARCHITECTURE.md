# Lumina Pro POS — Architecture

## High-level
- **React + TypeScript + Vite** UI
- **Offline-first** persistence:
  - `services/localDb.ts` (IndexedDB)
  - `services/storeRepo.ts` (repo API + fallback)
  - `services/firebaseService.ts` (outbox sync to Firestore)
- **Event ledger**:
  - `services/fiscalLedger.ts` append-only events
  - `services/ledgerDerivation.ts` rebuilds read models

## App layout
- `App.tsx`: central state + tab routing + sync loop
- Components:
  - `POS.tsx`, `Inventory.tsx`, `SalesHistory.tsx`, `Reports.tsx`, `Analytics.tsx`
  - Restaurant: `Restaurant.tsx`, `KDS.tsx`

## Data model
- `types.ts` is the single source for app entities:
  - retail: `Product`, `Sale`, `Customer`, `Promotion`, etc.
  - restaurant: `RestaurantSection`, `RestaurantTable`, `RestaurantOrder`
  - hardware: `HardwareConfig`, `PrinterConfig`

## Sync + multi-tenant
- All cloud paths are scoped by `storeId`: `stores/{storeId}/{collection}/{docId}`
- Auth links the user to store via `userIndex/{uid}`

