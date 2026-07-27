// Sign-in gate.
//
// Firebase Auth is what actually protects the data: the Firestore rules in
// firestore.rules reject any read or write without an authenticated user, so
// hiding the UI here is convenience, not the security boundary.

import { auth, Persistence } from './firebase.js';
import { $, show, hide, setAlert } from './dom.js';
import { resetStore } from './store.js';
import { startListener, stopListener } from './sync.js';
import { renderAll } from './render.js';
import { closeSuppCard } from './supplements.js';
import { clearFatalError } from './errors.js';

function authErrorMessage(code){
  switch(code){
    case 'auth/invalid-email':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Incorrect email or password.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled for this Firebase project.';
    default:
      return 'Sign-in failed (' + code + ').';
  }
}

function showAuthError(message){
  setAlert($('auth-error'), 'danger', 'ti-alert-circle', message, 'auth-error');
}

function signInUser(event){
  event.preventDefault();
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;
  const btn = $('auth-submit');
  if(!email || !password) return;

  showAuthError('');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2"></i> Signing in…';

  auth.signInWithEmailAndPassword(email, password)
    .catch(err => {
      console.error('Sign-in error:', err);
      showAuthError(authErrorMessage(err.code || err.message));
      $('auth-password').value = '';
    })
    .finally(() => {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-login"></i> Sign in';
    });
}

export function signOutUser(){
  if(!confirm('Sign out of Supplement Tracker?')) return;
  auth.signOut().catch(err => console.error('Sign-out error:', err));
}

function enterApp(user){
  hide($('auth-checking'));
  hide($('auth-form'));
  hide($('auth-overlay'));
  show($('app-root'));
  $('auth-user-label').textContent = user.email || '';
  startListener(renderAll);
}

function showLogin(){
  stopListener();
  resetStore();
  closeSuppCard();
  clearFatalError();
  hide($('app-root'));
  hide($('auth-checking'));
  show($('auth-overlay'));
  show($('auth-form'));
  $('auth-password').value = '';
  showAuthError('');
}

export function initAuth(){
  // LOCAL persistence keeps the session alive between visits, so each phone
  // only has to sign in once.
  auth.setPersistence(Persistence.LOCAL)
    .catch(err => console.error('Could not set auth persistence:', err));

  $('auth-form').addEventListener('submit', signInUser);
  auth.onAuthStateChanged(user => user ? enterApp(user) : showLogin());
}
