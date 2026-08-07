// Supplement management: the add/edit form and the per-user supplement list.
//
// The form edits two things at once. Name, brand, caps-per-bottle and the
// on-hand count belong to the *stock* and are shared by everyone who takes it;
// dose, times and the inactive flag belong to this person's *regimen* alone.

import { $, esc, show, hide, toggle, scrollIntoView } from './dom.js';
import { store, users, findUser, findSupp, supplementsOf, stocks,
         findStock, stockOf, consumersOf, findStockByName,
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

/** Trim float noise without losing a nearly-empty large bottle to rounding:
 *  1 capsule of a 240-count bottle is 0.0042 bottles, which two decimals would
 *  have flattened to zero. */
function formatBottles(bottles){
  return String(Math.round((parseFloat(bottles) || 0) * 10000) / 10000);
}

/** Remember what the on-hand field was populated with, so an edit that leaves
 *  it alone can leave the stored count alone too. Re-deriving the count from
 *  the displayed value on every save made it drift a little each time. */
function setAmountField(value){
  const el = $('ns-amount');
  el.value = value;
  el.dataset.original = value;
}

function amountUntouched(){
  const el = $('ns-amount');
  return el.dataset.original !== undefined
    && el.value.trim() === el.dataset.original
    && $('ns-unit').value === 'bottles';
}

export function resetSuppForm(){
  $('ns-name').value = '';
  $('ns-brand').value = '';
  $('ns-cap').value = '60';
  $('ns-unit').value = 'bottles';
  setAmountField('1');
  delete $('ns-amount').dataset.original;
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
  updateStockHint();
}

export function startEditSupp(uid, sid){
  const user = findUser(uid);
  const supp = findSupp(uid, sid);
  const stock = stockOf(supp);
  if(!user || !supp || !stock) return;

  store.editingSupp = {uid, sid};
  $('ns-name').value = stock.name;
  $('ns-brand').value = stock.brand || '';
  $('ns-cap').value = stock.capPerBottle;
  $('ns-unit').value = 'bottles';
  setAmountField(formatBottles(stock.bottles));
  $('ns-dose').value = supp.dosePerSession;
  $('ns-inactive').checked = Boolean(supp.inactive);
  setSelectedTags(supp.times || []);

  show($('ns-users-wrap'));
  $('ns-users-label').textContent = 'Also assign to additional user(s)';
  renderUserCheckboxes(uid);

  const others = consumersOf(stock.id).filter(c => c.user.id !== uid);
  const shared = others.length
    ? ` Name, brand, caps/bottle and the count are shared with ${
        esc(others.map(c => c.user.name).join(', '))} — changing them changes it for everyone.`
    : '';
  const note = $('ns-edit-note');
  note.innerHTML = `<i class="ti ti-edit"></i> Editing "${esc(stock.name)}" for ${esc(user.name)}.${shared}`;
  show(note);
  $('ns-section-title').textContent = 'Edit supplement';
  $('ns-submit-btn').innerHTML = '<i class="ti ti-check"></i> Save changes';
  show($('ns-cancel-btn'));
  updateStockHint();
  scrollIntoView($('supp-card'));
}

export function cancelEditSupp(){
  store.editingSupp = null;
  resetSuppForm();
}

/** Tell the user, before they submit, that this name already has a supply on
 *  the shelf and that adding it will draw from that supply rather than invent a
 *  second one. This is the affordance that replaces keeping a "shared" user. */
export function updateStockHint(){
  const el = $('ns-stock-hint');
  if(!el) return;
  if(store.editingSupp){
    toggle(el, false);
    return;
  }
  const match = findStockByName($('ns-name').value, $('ns-brand').value);
  if(!match){
    toggle(el, false);
    return;
  }
  const takers = consumersOf(match.id).map(c => c.user.name);
  const who = takers.length ? esc(takers.join(', ')) : 'nobody yet';
  el.innerHTML = `<i class="ti ti-link"></i> Shares the existing supply of `
    + `<strong>${esc(match.name)}</strong> (${Math.round(capsOnHand(match))} caps on hand, taken by ${who}). `
    + `The count and caps/bottle below are ignored — one supply, one count.`;
  toggle(el, true);
}

// ── Create / update ─────────────────────────────────────────────
export function amountToCaps(amount, unit, capPerBottle){
  return unit === 'capsules' ? amount : amount * capPerBottle;
}

function newId(prefix, suffix){
  return prefix + Date.now() + '_' + suffix;
}

/** Read the form into a stock half and a regimen half. `amountChanged` is false
 *  when the on-hand field was left exactly as it was loaded. */
function readSuppForm(){
  const name = $('ns-name').value.trim();
  if(!name){
    alert('Enter a supplement name.');
    return null;
  }
  const capPerBottle = parseInt($('ns-cap').value, 10) || 60;
  const amount = parseFloat($('ns-amount').value);
  if(!amount || amount <= 0){
    alert('On-hand count must be greater than 0.');
    return null;
  }
  const caps = amountToCaps(amount, $('ns-unit').value, capPerBottle);
  if(!caps || caps <= 0){
    alert('On-hand count must be greater than 0.');
    return null;
  }
  return {
    stock: {
      name,
      brand: $('ns-brand').value.trim(),
      capPerBottle,
      bottles: caps / capPerBottle
    },
    regimen: {
      dosePerSession: parseInt($('ns-dose').value, 10) || 1,
      times: getSelectedTags(),
      inactive: $('ns-inactive').checked
    },
    amountChanged: !amountUntouched()
  };
}

/** Point a user at a stock. Does nothing if they already draw from it — the
 *  old code pushed unconditionally, so re-saving an edit with another user
 *  ticked added a second copy every time and doubled that stock's row in
 *  Inventory. */
function assignToStock(uid, stockId, regimen, idSuffix){
  const user = findUser(uid);
  if(!user) return false;
  if(!user.supplements) user.supplements = [];
  if(user.supplements.some(s => s.stockId === stockId)) return false;
  user.supplements.push({id: newId('s', idSuffix), stockId, ...regimen});
  return true;
}

export function addSupp(){
  const fields = readSuppForm();
  if(!fields) return;

  if(store.editingSupp){
    const ownerUid = store.editingSupp.uid;
    const supp = findSupp(ownerUid, store.editingSupp.sid);
    const stock = stockOf(supp);
    if(!supp || !stock){
      store.editingSupp = null;
      resetSuppForm();
      return;
    }

    Object.assign(supp, fields.regimen);
    stock.name = fields.stock.name;
    stock.brand = fields.stock.brand;
    stock.capPerBottle = fields.stock.capPerBottle;
    // Only when the field was actually edited, so saving a dose change cannot
    // nudge the count by a fraction of a capsule.
    if(fields.amountChanged) stock.bottles = fields.stock.bottles;

    // Additional users share this same stock rather than getting a copy.
    getCheckedUserIds()
      .filter(uid => uid !== ownerUid)
      .forEach((uid, i) => assignToStock(uid, stock.id, fields.regimen, i + '_e'));

    store.editingSupp = null;
  } else {
    const checked = getCheckedUserIds();
    if(!checked.length){
      alert('Select at least one user to assign this supplement to.');
      return;
    }

    // One stock for everyone selected. If this product is already on the shelf,
    // draw from that supply instead of inventing a second count for it.
    let stock = findStockByName(fields.stock.name, fields.stock.brand);
    if(!stock){
      stock = {id: newId('k', '0'), ...fields.stock};
      if(!store.state.stocks) store.state.stocks = [];
      store.state.stocks.push(stock);
    }
    checked.forEach((uid, i) => assignToStock(uid, stock.id, fields.regimen, String(i)));
  }

  resetSuppForm();
  saveState();
}

/** Drop this person's regimen. The stock outlives it while anyone else still
 *  takes it; once the last taker is gone the supply goes too. */
export function deleteSupp(uid, sid){
  if(!confirm('Remove this supplement?')) return;
  if(store.editingSupp && store.editingSupp.uid === uid && store.editingSupp.sid === sid){
    store.editingSupp = null;
    resetSuppForm();
  }
  const user = findUser(uid);
  const supp = findSupp(uid, sid);
  const stockId = supp && supp.stockId;
  if(user) user.supplements = supplementsOf(user).filter(s => s.id !== sid);
  if(stockId && !consumersOf(stockId).length){
    store.state.stocks = stocks().filter(k => k.id !== stockId);
  }
  saveState();
}

export function addBottle(uid, sid){
  const stock = stockOf(findSupp(uid, sid));
  if(!stock) return;
  stock.bottles += 1;
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
    const stock = findStock(s.stockId);
    if(!stock) return '';
    const caps = Math.round(capsOnHand(stock));
    const badges = (s.inactive ? INACTIVE_BADGE + ' ' : '') + timeBadges(s.times);
    const others = consumersOf(stock.id).filter(c => c.user.id !== user.id);
    const sharedNote = others.length
      ? `<div class="supp-shared"><i class="ti ti-users"></i> Shared supply with ${
          esc(others.map(c => c.user.name).join(', '))}</div>`
      : '';
    return `<div class="supp-row${s.inactive ? ' is-inactive' : ''}">
      <div class="supp-row-main">
        <div class="supp-name">${esc(stock.name)}</div>
        ${stock.brand ? `<div class="supp-brand">${esc(stock.brand)}</div>` : ''}
        <div class="supp-detail">
          ${caps} caps on hand &nbsp;·&nbsp;
          ${formatDays(daysRemaining(stock))} left &nbsp;·&nbsp;
          ${parseFloat(stock.bottles).toFixed(1)} bottles &nbsp;·&nbsp;
          ${stock.capPerBottle} caps/bottle &nbsp;·&nbsp;
          ${s.dosePerSession} cap${s.dosePerSession !== 1 ? 's' : ''}/session
        </div>
        ${sharedNote}
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
