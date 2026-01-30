# Lumina Pro POS — Restaurant + Hardware

## Restaurant mode
Enable in **Settings → Business Mode → Restaurant**.

### Table service flow
- Floor/table selection (Restaurant tab)
- Create order on a table (POS in restaurant mode)
- Add per-item:
  - modifiers
  - course
  - kitchen station
- **Send to Kitchen** prints a kitchen ticket and marks items/order as sent.
- **KDS tab** shows tickets per station with transitions: Sent → Preparing → Ready → Served.
- Payment:
  - tips (%)
  - service charge (%)
  - split count (stored)

## Hardware (universal selection)
Configure in **Settings → Hardware**:

### Printer connection types
- **Network (LAN/TCP 9100)**: most universal (Desktop + Android supported)
- **Bluetooth (Android SPP)**: requires Bluetooth MAC address
- **System**: browser/system print fallback
- **USB**: marked beta (future backend)

### Cash drawer
- Default: **Pulse via printer** (ESC/POS pulse)

## Platform bridges
- **Android**: `android/.../LuminaHardwarePlugin.java`
- **Electron**:
  - renderer bridge: `electron/src/preload.ts` exposes `window.luminaHardware`
  - IPC handlers: `electron/src/index.ts` supports LAN/TCP raw ESC/POS

