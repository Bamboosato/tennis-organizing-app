import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth,
  signInWithEmailAndPassword, signOut,
} from "firebase/auth";
import {
  collection, connectFirestoreEmulator, deleteDoc, doc, getDoc,
  getDocs, getFirestore, onSnapshot, setDoc, terminate, updateDoc,
} from "firebase/firestore";

// Refuse to run without isolated local emulators; never use app credentials.
function localEndpoint(value) {
  assert.match(value || "", /^(127\.0\.0\.1|localhost):\d+$/);
  const [host, port] = value.split(":");
  return { host, port: Number(port) };
}
const firestoreEndpoint = localEndpoint(process.env.FIRESTORE_EMULATOR_HOST);
const authEndpoint = localEndpoint(process.env.FIREBASE_AUTH_EMULATOR_HOST);
const app = initializeApp({ apiKey: "demo-security-key", projectId: "demo-tennis-security" });
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, `http://${authEndpoint.host}:${authEndpoint.port}`, { disableWarnings: true });
connectFirestoreEmulator(db, firestoreEndpoint.host, firestoreEndpoint.port);
try {
  const email = "dependency-smoke@example.test";
  const password = "emulator-only-password";
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;
  assert.equal(auth.currentUser.uid, uid);
  const ref = doc(db, "security-smoke", uid);
  await setDoc(ref, { nickname: "検証部員", active: true });
  assert.equal((await getDoc(ref)).data().nickname, "検証部員");
  await updateDoc(ref, { nickname: "更新部員" });
  assert.equal((await getDocs(collection(db, "security-smoke"))).size, 1);
  // Ensure a live subscription receives a later write, then release it.
  let unsubscribe;
  let timeout;
  try {
    const observed = new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error("Snapshot update timed out")), 10_000);
      unsubscribe = onSnapshot(ref, snapshot => {
        if (snapshot.data()?.nickname === "購読確認") { clearTimeout(timeout); resolve(); }
      }, error => { clearTimeout(timeout); reject(error); });
    });
    await Promise.all([observed, updateDoc(ref, { nickname: "購読確認" })]);
  } finally { clearTimeout(timeout); unsubscribe?.(); }
  await deleteDoc(ref);
  assert.equal((await getDoc(ref)).exists(), false);
  await signOut(auth);
  assert.equal(auth.currentUser, null);
  await signInWithEmailAndPassword(auth, email, password);
  assert.equal(auth.currentUser.uid, uid);
  await signOut(auth);
  console.log("PASS: Auth signup/login/logout; Firestore create/read/update/query/snapshot/delete with isolated emulators");
} finally {
  await terminate(db);
  await deleteApp(app);
}
