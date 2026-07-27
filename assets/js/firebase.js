// Firebase initialisation.
//
// The compat SDK is loaded from gstatic via plain <script> tags in index.html,
// which puts a `firebase` global in scope. Classic scripts always execute
// before module scripts, so the global is guaranteed to exist by the time this
// module evaluates — unless the CDN request itself failed, hence the guard.

import { firebaseConfig, STATE_PATH } from './config.js';

if(typeof firebase === 'undefined'){
  throw new Error('The Firebase SDK failed to load. Check your network connection and reload.');
}

firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();
export const db = firebase.firestore();
export const STATE_DOC = db.collection(STATE_PATH.collection).doc(STATE_PATH.doc);
export const Persistence = firebase.auth.Auth.Persistence;
