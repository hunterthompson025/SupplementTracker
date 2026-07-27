// Firebase project configuration.
//
// These values are public by design — they identify the project, they do not
// grant access to it. Access is enforced by Firebase Authentication plus the
// Firestore security rules in ../../firestore.rules.

export const firebaseConfig = {
  apiKey: "AIzaSyAJS_UAgAS2PeI4n3Aki5808c8gcuzqdDw",
  authDomain: "supplement-tracker-fc966.firebaseapp.com",
  projectId: "supplement-tracker-fc966",
  storageBucket: "supplement-tracker-fc966.firebasestorage.app",
  messagingSenderId: "252314158309",
  appId: "1:252314158309:web:e999c59cc40ef14a36c00c"
};

/** Firestore document holding the entire tracker state. */
export const STATE_PATH = {collection: 'app', doc: 'state'};
