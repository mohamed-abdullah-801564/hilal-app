const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } = require("firebase/auth");
const { getFirestore, doc, setDoc, collection, query, where, getDocs } = require("firebase/firestore");

const firebaseConfig = {
  apiKey:            "AIzaSyDi6rtNdie2ueJPYC2fWgHiM6AG-ao8RMo",
  authDomain:        "bismillah-573d3.firebaseapp.com",
  projectId:         "bismillah-573d3",
  storageBucket:     "bismillah-573d3.firebasestorage.app",
  messagingSenderId: "282242582668",
  appId:             "1:282242582668:web:55658acd7c0d649c2f93a9",
  measurementId:     "G-0RZ46VYWX2",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const EMAIL = "jmdhusain1986@gmail.com";
const PASSWORD = "islam<>123";

async function main() {
  console.log(`[SetupAdmin] Processing admin setup for: ${EMAIL}`);
  let uid = null;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
    uid = userCredential.user.uid;
    console.log(`[SetupAdmin] Signed in successfully with provided credentials. UID: ${uid}`);
  } catch (signInErr) {
    console.log(`[SetupAdmin] Sign-in with password '${PASSWORD}' returned code: ${signInErr.code}`);
    if (signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/wrong-password') {
      try {
        console.log(`[SetupAdmin] Sending password reset email to ${EMAIL}...`);
        await sendPasswordResetEmail(auth, EMAIL);
        console.log(`[SetupAdmin] Password reset email sent to ${EMAIL}.`);
      } catch (resetErr) {
        console.log(`[SetupAdmin] Password reset trigger error:`, resetErr.message);
      }
    } else if (signInErr.code === 'auth/user-not-found') {
      try {
        const createCredential = await createUserWithEmailAndPassword(auth, EMAIL, PASSWORD);
        uid = createCredential.user.uid;
        console.log(`[SetupAdmin] Created new user. UID: ${uid}`);
      } catch (createErr) {
        console.error(`[SetupAdmin] Account creation failed:`, createErr.message);
      }
    }
  }

  // Next, query Firestore users collection to find UID if not signed in
  if (!uid) {
    try {
      const q = query(collection(db, "users"), where("email", "==", EMAIL));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        uid = querySnap.docs[0].id;
        console.log(`[SetupAdmin] Found existing user in Firestore 'users' collection with UID: ${uid}`);
      }
    } catch (qErr) {
      console.log(`[SetupAdmin] Firestore query error:`, qErr.message);
    }
  }

  // If still no UID, use a deterministic admin key for Firestore
  const targetDocId = uid || "admin_jmdhusain1986";

  console.log(`[SetupAdmin] Updating Firestore user and admin documents for ID: ${targetDocId}`);

  try {
    await setDoc(doc(db, "users", targetDocId), {
      email: EMAIL,
      role: "admin",
      isAdmin: true,
      updatedAt: Date.now()
    }, { merge: true });

    await setDoc(doc(db, "admins", targetDocId), {
      email: EMAIL,
      role: "admin",
      isAdmin: true,
      updatedAt: Date.now()
    }, { merge: true });

    console.log(`[SetupAdmin] SUCCESS: Firestore 'users/${targetDocId}' and 'admins/${targetDocId}' created/updated with role='admin' and isAdmin=true.`);
  } catch (fsErr) {
    console.error(`[SetupAdmin] Firestore update failed:`, fsErr);
  }
}

main();
