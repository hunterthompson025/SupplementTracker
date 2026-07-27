// User management.

import { $, esc } from './dom.js';
import { store, users, supplementsOf } from './store.js';
import { saveState } from './sync.js';
import { closeSuppCard } from './supplements.js';

export function populateUserDropdown(){
  const sel = $('home-user');
  if(!sel) return;
  const prev = sel.value;
  const list = users();
  sel.innerHTML = list.length === 0
    ? '<option value="">— add a user in Maintenance —</option>'
    : list.map(u => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('');
  if(prev && list.some(u => u.id === prev)) sel.value = prev;
}

export function addUser(){
  const input = $('new-user-name');
  const name = input.value.trim();
  if(!name) return;
  if(!store.state.users) store.state.users = [];
  store.state.users.push({id: 'u' + Date.now(), name, supplements: []});
  input.value = '';
  saveState();
}

export function deleteUser(uid){
  if(!confirm('Delete this user and all their supplements?')) return;
  store.state.users = users().filter(u => u.id !== uid);
  if(store.activeMainUser === uid) closeSuppCard();
  saveState();
}

export function renderUserList(){
  const el = $('user-list');
  if(!el) return;
  const list = users();
  if(!list.length){
    el.innerHTML = '<div class="empty">No users yet. Add one above.</div>';
    return;
  }
  el.innerHTML = list.map(u => {
    const count = supplementsOf(u).length;
    return `<div class="supp-row center">
      <div class="supp-row-main">
        <div class="supp-name">${esc(u.name)}</div>
        <div class="supp-detail">${count} supplement${count !== 1 ? 's' : ''}</div>
      </div>
      <div class="row-actions">
        <button class="btn" data-action="open-supp-card" data-uid="${esc(u.id)}"><i class="ti ti-pill"></i> Manage supplements</button>
        <button class="btn danger" data-action="delete-user" data-uid="${esc(u.id)}"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}
