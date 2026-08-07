// Entry point: wires DOM events to feature modules, then starts auth.
//
// errors.js is imported first and imports nothing itself, so its window error
// handlers are installed before Firebase initialises.
import './errors.js';

import { $ } from './dom.js';
import { showScreen } from './nav.js';
import { initAuth, signOutUser } from './auth.js';
import { addUser, deleteUser } from './users.js';
import { openSuppCard, toggleTag, addSupp, cancelEditSupp, startEditSupp, addBottle, deleteSupp, updateStockHint } from './supplements.js';
import { loadHomePreview, logUsage } from './usage.js';
import { prefillCycleCount, submitCycleCount } from './inventory.js';
import { showOrderList, copyOrder } from './orders.js';

// ── Click actions ───────────────────────────────────────────────
// Every clickable control carries data-action (plus data-* arguments). One
// delegated listener dispatches them, so dynamically rendered markup needs no
// inline handlers and no rebinding after a re-render.
const ACTIONS = {
  'show-screen':      (d, el) => showScreen(d.screen, el),
  'sign-out':         () => signOutUser(),
  'add-user':         () => addUser(),
  'delete-user':      d => deleteUser(d.uid),
  'open-supp-card':   d => openSuppCard(d.uid),
  'toggle-tag':       (d, el) => toggleTag(el),
  'add-supp':         () => addSupp(),
  'cancel-edit-supp': () => cancelEditSupp(),
  'edit-supp':        d => startEditSupp(d.uid, d.sid),
  'add-bottle':       d => addBottle(d.uid, d.sid),
  'delete-supp':      d => deleteSupp(d.uid, d.sid),
  'log-usage':        () => logUsage(),
  'prefill-cc':       d => prefillCycleCount(d.sid),
  'submit-cc':        () => submitCycleCount(),
  'show-order-list':  () => showOrderList(),
  'copy-order':       (d, el) => copyOrder(el)
};

function handleClick(event){
  const el = event.target.closest('[data-action]');
  if(!el) return;
  const action = ACTIONS[el.dataset.action];
  if(!action){
    console.warn('Unknown data-action:', el.dataset.action);
    return;
  }
  action(el.dataset, el, event);
}

// ── Static field listeners ──────────────────────────────────────
function wireInputs(){
  $('home-user').addEventListener('change', loadHomePreview);
  $('home-days').addEventListener('input', loadHomePreview);
  $('new-user-name').addEventListener('keydown', e => {
    if(e.key === 'Enter') addUser();
  });
  // Flag an existing supply as soon as the name matches, before submit.
  $('ns-name').addEventListener('input', updateStockHint);
  $('ns-brand').addEventListener('input', updateStockHint);
}

// ── Boot ────────────────────────────────────────────────────────
document.addEventListener('click', handleClick);
wireInputs();
initAuth();
