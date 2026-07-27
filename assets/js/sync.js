// Firestore persistence: real-time listener, saves, and the header sync badge.

import { STATE_DOC } from './firebase.js';
import { store } from './store.js';
import { $ } from './dom.js';
import { showFatalError } from './errors.js';

let unsubscribe = null;

const DENIED_HINT = 'Firestore denied access. Check that your security rules allow '
  + 'signed-in users to read and write app/state.';

export function setSyncStatus(status, label){
  const dot = $('sync-dot');
  const lbl = $('sync-label');
  if(!dot || !lbl) return;
  dot.className = 'sync-dot'
    + (status === 'syncing' ? ' syncing' : status === 'error' ? ' error' : '');
  lbl.textContent = label;
}

/** Subscribe to the state document. `onChange` runs after every snapshot. */
export function startListener(onChange){
  if(unsubscribe) return;
  setSyncStatus('syncing', 'Connecting...');
  unsubscribe = STATE_DOC.onSnapshot(snap => {
    store.state = snap.exists ? snap.data() : {users:[]};
    if(!store.state.users) store.state.users = [];
    setSyncStatus('ok', 'Synced');
    onChange();
  }, err => {
    console.error(err);
    const denied = err.code === 'permission-denied';
    setSyncStatus('error', denied ? 'Access denied' : 'Sync error');
    if(denied) showFatalError(DENIED_HINT);
  });
}

export function stopListener(){
  if(unsubscribe){
    unsubscribe();
    unsubscribe = null;
  }
}

export async function saveState(){
  setSyncStatus('syncing', 'Saving...');
  try{
    await STATE_DOC.set(store.state);
    setSyncStatus('ok', 'Synced');
  } catch(err){
    console.error(err);
    setSyncStatus('error', err.code === 'permission-denied' ? 'Access denied' : 'Save failed');
    if(err.code === 'permission-denied') showFatalError(DENIED_HINT);
  }
}
