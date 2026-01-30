/**
 * Lumina Auth Service
 * Modular authentication logic with Ghost Account prevention and email verification.
 */

import { auth, db } from './firebaseConfig';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  deleteUser,
  signOut,
  UserCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { createNewStore } from './firebaseService';
import type { User } from '../types';

export interface SignUpResult {
  success: boolean;
  user?: User;
  error?: string;
  requiresVerification?: boolean;
}

export interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
  requiresVerification?: boolean;
}

/**
 * Sign up with email/password. Prevents Ghost Account:
 * - If Firestore profile creation fails after Auth creation, deletes the Auth user.
 * - Sends verification email immediately upon success.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  storeName: string,
  userName: string
): Promise<SignUpResult> {
  let cred: UserCredential | null = null;

  try {
    // 1. Create Firebase Auth user first
    cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: userName });

    // 2. Send verification email immediately (non-blocking for UX, but we await it)
    await sendEmailVerification(cred.user);

    // 3. Create store in Firestore
    const storeId = await createNewStore(storeName, email, cred.user.uid);

    // 4. Persist store linkage (userIndex)
    await setDoc(doc(db, 'userIndex', cred.user.uid), {
      storeId,
      email: email.toLowerCase()
    });

    // 5. Persist store-scoped user profile
    const newUser: User = {
      id: cred.user.uid,
      storeId,
      name: userName,
      email,
      pin: '1234',
      role: 'admin',
      permissions: {
        canManageInventory: true,
        canViewReports: true,
        canManageProspects: true,
        canManageSettings: true
      }
    };
    await setDoc(
      doc(db, `stores/${storeId}/users`, cred.user.uid),
      newUser,
      { merge: true } as any
    );

    return {
      success: true,
      user: newUser,
      requiresVerification: true
    };
  } catch (err: any) {
    // Ghost Account prevention: if Auth user was created but Firestore failed, delete Auth user
    if (cred?.user) {
      try {
        await deleteUser(cred.user);
      } catch (deleteErr) {
        console.warn('Could not rollback Auth user after Firestore failure:', deleteErr);
      }
    }

    const errorMsg = mapAuthError(err, 'signup');
    return { success: false, error: errorMsg };
  }
}

/**
 * Sign in with email/password. Enforces email verification before dashboard access.
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<LoginResult> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    // Access control: require verified email
    if (!cred.user.emailVerified) {
      await signOut(auth);
      return {
        success: false,
        error: 'Please verify your email before accessing the POS. Check your inbox for the verification link.',
        requiresVerification: true
      };
    }

    // Load store mapping and profile
    const idxSnap = await getDoc(doc(db, 'userIndex', cred.user.uid));
    const idx = idxSnap.exists() ? (idxSnap.data() as any) : null;

    if (!idx?.storeId) {
      await signOut(auth);
      return {
        success: false,
        error: 'Account is not linked to a store. Contact admin.'
      };
    }

    const userSnap = await getDoc(
      doc(db, `stores/${idx.storeId}/users`, cred.user.uid)
    );
    const profile = userSnap.exists() ? (userSnap.data() as any) : null;

    const foundUser: User = {
      id: cred.user.uid,
      storeId: idx.storeId,
      name: profile?.name || cred.user.displayName || 'Operator',
      email: cred.user.email || email,
      pin: profile?.pin || '0000',
      role: profile?.role || 'staff',
      permissions: profile?.permissions || {
        canManageInventory: false,
        canViewReports: false,
        canManageProspects: true,
        canManageSettings: false
      }
    };

    return { success: true, user: foundUser };
  } catch (err: any) {
    const errorMsg = mapAuthError(err, 'login');
    return { success: false, error: errorMsg };
  }
}

function mapAuthError(err: any, context: 'signup' | 'login'): string {
  const prefix = context === 'signup' ? 'Failed to create account. ' : 'Login failed. ';
  if (err.code === 'auth/email-already-in-use') {
    return prefix + 'This email is already registered. Please login instead.';
  }
  if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
    return prefix + 'Invalid email or password.';
  }
  if (err.code === 'auth/invalid-email') {
    return prefix + 'Invalid email address.';
  }
  if (err.code === 'auth/weak-password') {
    return prefix + 'Password must be at least 6 characters.';
  }
  if (err.code === 'auth/operation-not-allowed') {
    return prefix + 'Email/password authentication is not enabled. Enable it in Firebase Console.';
  }
  if (err.code === 'auth/too-many-requests') {
    return prefix + 'Too many attempts. Please try again later.';
  }
  return prefix + (err.message || 'Please try again.');
}
