import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  onSnapshot,
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("the client is offline")
    ) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export async function saveCloudStateKey(stateKey: string, value: unknown): Promise<void> {
  const cleanKey = stateKey.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 120);
  const path = `app_state/${cleanKey}`;
  const payloadJson = typeof value === "string" ? value : JSON.stringify(value);
  if (payloadJson.length > 940000) {
    return;
  }
  try {
    await setDoc(doc(db, "app_state", cleanKey), {
      key: cleanKey,
      payloadJson,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Logged by handleFirestoreError; do not crash UI
    }
  }
}

export async function loadCloudStateKey(stateKey: string): Promise<{ payloadJson: string; updatedAt: string } | null> {
  const cleanKey = stateKey.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 120);
  const path = `app_state/${cleanKey}`;
  try {
    const snap = await getDoc(doc(db, "app_state", cleanKey));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data && typeof data.payloadJson === "string") {
      return {
        payloadJson: data.payloadJson,
        updatedAt: String(data.updatedAt || ""),
      };
    }
    return null;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.GET, path);
    } catch {
      // Logged by handleFirestoreError
    }
    return null;
  }
}

export function subscribeCloudStateKey(
  stateKey: string,
  onUpdate: (payloadJson: string, updatedAt: string) => void
): () => void {
  const cleanKey = stateKey.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 120);
  const path = `app_state/${cleanKey}`;
  return onSnapshot(
    doc(db, "app_state", cleanKey),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data && typeof data.payloadJson === "string") {
        onUpdate(data.payloadJson, String(data.updatedAt || ""));
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch {
        // Logged by handleFirestoreError
      }
    }
  );
}
