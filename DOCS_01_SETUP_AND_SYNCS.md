# Lumina Pro POS — Setup, Builds, Syncs (Web / Android / Electron)

## Prerequisites
- Node.js **18+** and npm **9+**
- (Android) Android Studio + SDK
- (Desktop) Electron build toolchain (already in `electron/`)

## Environment
- Copy `.env.example` → `.env` and fill what you use.
- Gemini is optional. Firebase config is in `services/firebaseConfig.ts` and `google-services.json`.

## Web (local dev)
```bash
npm install
npm run dev
```

## Web (production build)
```bash
npm run build
npm run preview
```

## Android (sync + open)
```bash
npm run build
npx cap sync android
npx cap open android
```

## Electron (sync + build)
```bash
npm run build
node scripts/sync-electron-web.mjs

cd electron
npm install
npm run build
# optional packaging:
# npm run electron:make
```

## Firebase setup checklist
- Firebase Console → **Authentication** → enable **Email/Password**
- Firebase Console → **Firestore** created + rules deployed (`firestore.rules`)
- App sign-up creates:
  - `stores/{storeId}`
  - `userIndex/{uid}`
  - `stores/{storeId}/users/{uid}`

