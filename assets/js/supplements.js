// Supplement management: the add/edit form and the per-user supplement list.

import { $, esc, show, hide, scrollIntoView } from './dom.js';
import { store, users, findUser, findSupp, supplementsOf,
         capsOnHand, daysRemaining, formatDays } from './store.js';
import { saveState } from './sync.js';

const TIME_LABELS = ['Morning', 'Noon', 'Evening', 'Bedtime'];

/** Shown wherever an inactive supplement appears, so it reads the same on
 *  every screen. */
export const INACTIVE_BADGE =
  '<span class="badge"><i class="ti ti-player-pause"></i> Inactive</span>';

// ── The supplement card ─────────────────────────────────────────
export function openSuppCard(uid){
  const user = findUser(uid);
  if(!user) return;
  store.activeMainUser = uid;
  store.editingSupp = null;
  show($('supp-card'));
  $('supp-card-user').textContent = user.name;
  resetSuppForm();
  renderSuppList();
  scrollIntoView($('supp-card'));
}

export function closeSuppCard(){
  store.activeMainUser = null;
  store.editingSupp = null;
  hide($('supp-card'));
}

// ── Form state ──────────────────────────────────────────────────
export function renderUserCheckboxes(lockUserId){
  const el = $('ns-users');
  if(!el) return;
  el.innerHTML = users().map(u => {
    const isLocked = Boolean(lockUserId) && u.id === lockUserId;
    const checked = isLocked || (!lockUserId && u.id === store.activeMainUser);
    return `<label class="user-check">
      <input type="checkbox" value="${esc(u.id)}" ${checked ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
      ${esc(u.name)}${isLocked ? ' (current)' : ''}
    </label>`;
  }).join('');
}

export function toggleTag(btn){
  btn.classList.toggle('sel');
}

function getSelectedTags(){
  return Array.from(document.querySelectorAll('#ns-tags .tag-btn.sel'))
    .map(b => b.textContent.trim());
}

function getCheckedUserIds(){
  return Array.from(document.querySelectorAll('#ns-users input[type=checkbox]:checked'))
    .map(c => c.value);
}

function setSelectedTags(times = []){
  document.querySelectorAll('#ns-tags .tag-btn').forEach(b => {
    b.classList.toggle('sel', times.includes(b.textContent.trim()));
  });
}

export function resetSuppForm(){
  $('ns-name').value = '';
  $('ns-brand').value = '';
  $('ns-cap').value = '60';
  $('ns-unit').value = 'bottles';
  $('ns-amount').value = '1';
  $('ns-dose').value = '1';
  $('ns-inactive').checked = false;
  setSelectedTags([]);
  show($('ns-users-wrap'));
  $('ns-users-label').textContent = 'Assign to user(s)';
  hide($('ns-edit-note'));
  $('ns-section-title').textContent = 'Add supplement';
  $('ns-submit-btn').innerHTML = '<i class="ti ti-plus"></i> Add supplement';
  hide($('ns-cancel-btn'));
  renderUserCheckboxes();
}

export function startEditSupp(uid, sid){
  const user = findUser(uid);
  const supp = findSupp(uid, sid);
  if(!user || !supp) return;

  store.editingSupp = {uid, sid};
  $('ns-name').value = supp.name;
  $('ns-brand').value = supp.brand || '';
  $('ns-cap').value = supp.capPerBottle;
  $('ns-unit').value = 'bottles';
  $('ns-amount').value = formatBottles(supp.bottles);
  $('ns-dose').value = supp.dosePerSession;
  $('ns-inactive').checked = Boolean(supp.inactive);
  setSelectedTags(supp.times || []);

  show($('ns-users-wrap'));
  $('ns-users-label').textContent = 'Also assign to additional user(s)';
  renderUserCheckboxes(uid);

  const note = $('ns-edit-note');
  note.innerHTML = `<i class="ti ti-edit"></i> Editing "${esc(supp.name)}" for ${esc(user.name)}`;
  show(note);
  $('ns-section-title').textContent = 'Edit supplement';
  $('ns-submit-btn').innerHTML = '<i class="ti ti-check"></i> Save changes';
  show($('ns-cancel-btn'));
  scrollIntoView($('supp-card'));
}

export function cancelEditSupp(){
  store.editingSupp = null;
  resetSuppForm();
}

/** Trim trailing zeros so 1.50 shows as "1.5" and 2.00 as "2". */
function formatBottles(bottles){
  const fixed = parseFloat(bottles).toFixed(2);
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

// ── Create / update ─────────────────────────────────────────────
export function amountToCaps(amount, unit, capPerBottle){
  return unit === 'capsules' ? amount : amount * capPerBottle;
}

function newSuppId(suffix){
  return 's' + Date.now() + '_' + suffix;
}

function readSuppForm(){
  const name = $('ns-name').value.trim();
  if(!name){
    alert('Enter a supplement name.');
    return null;
  }
  const capPerBottle = parseInt($('ns-cap').value, 10) || 60;
  const unit = $('ns-unit').value;
  const amount = parseFloat($('ns-amount').value);
  if(!amount || amount <= 0){
    alert('On-hand count must be greater than 0.');
    return null;
  }
  const caps = amountToCaps(amount, unit, capPerBottle);
  if(!caps || caps <= 0){
    alert('On-hand count must be greater than 0.');
    return null;
  }
  return {
    name,
    brand: $('ns-brand').value.trim(),
    capPerBottle,
    bottles: caps / capPerBottle,
    dosePerSession: parseInt($('ns-dose').value, 10) || 1,
    times: getSelectedTags(),
    inactive: $('ns-inactive').checked
  };
}

function assignToUser(uid, fields, idSuffix){
  const user = findUser(uid);
  if(!user) return;
  if(!user.supplements) user.supplements = [];
  user.supplements.push({id: newSuppId(idSuffix), ...fields});
}

export function addSupp(){
  const fields = readSuppForm();
  if(!fields) return;

  if(store.editingSupp){
    const ownerUid = store.editingSupp.uid;
    const supp = findSupp(ownerUid, store.editingSupp.sid);
    if(supp) Object.assign(supp, fields);

    // Any additional users checked (besides the locked owner) get their own copy.
    getCheckedUserIds()
      .filter(uid => uid !== ownerUid)
      .forEach((uid, i) => assignToUser(uid, fields, i + '_e'));

    store.editingSupp = null;
  } else {
    const checked = getCheckedUserIds();
    if(!checked.length){
      alert('Select at least one user to assign this supplement to.');
      return;
    }
    checked.forEach((uid, i) => assignToUser(uid, fields, String(i)));
  }

  resetSuppForm();
  saveState();
}

export function deleteSupp(uid, sid){
  if(!confirm('Remove this supplement?')) return;
  if(store.editingSupp && store.editingSupp.uid === uid && store.editingSupp.sid === sid){
    store.editingSupp = null;
    resetSuppForm();
  }
  const user = findUser(uid);
  if(user) user.supplements = supplementsOf(user).filter(s => s.id !== sid);
  saveState();
}

export function addBottle(uid, sid){
  const supp = findSupp(uid, sid);
  if(!supp) return;
  supp.bottles += 1;
  saveState();
}

// ── List ────────────────────────────────────────────────────────
export function timeBadges(times = []){
  return times
    .filter(t => TIME_LABELS.includes(t))
    .map(t => `<span class="badge ${t.toLowerCase()}">${esc(t)}</span>`)
    .join(' ');
}

export function renderSuppList(){
  const el = $('supp-list');
  if(!el) return;
  const user = findUser(store.activeMainUser);
  const supps = supplementsOf(user);
  if(!supps.length){
    el.innerHTML = '<div class="empty">No supplements yet.</div>';
    return;
  }
  el.innerHTML = supps.map(s => {
    const caps = Math.round(capsOnHand(s));
    const badges = (s.inactive ? INACTIVE_BADGE + ' ' : '') + timeBadges(s.times);
    return `<div class="supp-row${s.inactive ? ' is-inactive' : ''}">
      <div class="supp-row-main">
        <div class="supp-name">${esc(s.name)}</div>
        ${s.brand ? `<div class="supp-brand">${esc(s.brand)}</div>` : ''}
        <div class="supp-detail">
          ${caps} caps on hand &nbsp;·&nbsp;
          ${formatDays(daysRemaining(s))} left &nbsp;·&nbsp;
          ${parseFloat(s.bottles).toFixed(1)} bottles &nbsp;·&nbsp;
          ${s.capPerBottle} caps/bottle &nbsp;·&nbsp;
          ${s.dosePerSession} cap${s.dosePerSession !== 1 ? 's' : ''}/session
        </div>
        <div class="time-tags">${badges.trim() || '<span class="no-times">No times set</span>'}</div>
      </div>
      <div class="row-actions wrap">
        <button class="btn" data-action="edit-supp" data-uid="${esc(user.id)}" data-sid="${esc(s.id)}"><i class="ti ti-edit"></i> Edit</button>
        <button class="btn" data-action="add-bottle" data-uid="${esc(user.id)}" data-sid="${esc(s.id)}"><i class="ti ti-plus"></i> 1 bottle</button>
        <button class="btn danger" data-action="delete-supp" data-uid="${esc(user.id)}" data-sid="${esc(s.id)}"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}
