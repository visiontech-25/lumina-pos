# Lumina Pro POS — Security & Troubleshooting

## Security essentials
- Firestore security rules live in `firestore.rules`
- Production login uses Firebase Auth (no local password fallback)
- Sensitive actions use manager PIN (`ManagerPinModal.tsx`)

## Common issues

### Signup fails / “operation-not-allowed”
Enable **Firebase Console → Authentication → Sign-in method → Email/Password**.

### Cloud data not syncing
- Check online status badge in header
- Check outbox size (pending syncs)
- Verify Firestore rules allow your store/user

### Electron prints don’t work
- If using **Network printer**, set IP + port 9100 in Settings → Hardware
- If using **System**, browser print dialog is used (no raw ESC/POS)

### Android Bluetooth print fails
- Ensure printer supports **Bluetooth SPP**
- Use correct **MAC address**
- Grant Bluetooth permissions (Android 12+ prompts)

