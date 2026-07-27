// Inventory screen: the roll-up table and the cycle-count form.

import { $, esc, setAlert, flashAlert, scrollIntoView } from './dom.js';
import { users, findUser, findSupp, supplementsOf,
         dailyCaps, capsOnHand, daysRemaining, needsOrder, formatDays } from './store.js';
import { saveState } from './sync.js';
import { daysLeftInMonth } from './dates.js';
import { amountToCaps, INACTIVE_BADGE } from './supplements.js';

/** One row per user+supplement pair, sorted by supplement then user.
 *
 *  Stock is not pooled across users: each person's count is their own, so a row
 *  here shows exactly the number Maintenance and the Home preview show for that
 *  person. Summing a shared supplement into a single row would hide the case
 *  where one user is nearly out and the other is well stocked. */
function inventoryRows(daysLeft){
  const rows = [];
  users().forEach(user => {
    supplementsOf(user).forEach(s => {
      const daily = dailyCaps(s);
      rows.push({
        uid: user.id, uname: user.name, sid: s.id,
        name: s.name, brand: s.brand,
        inactive: Boolean(s.inactive),
        caps: capsOnHand(s),
        weekly: daily * 7,
        monthly: daily * 30,
        daysRem: daysRemaining(s),
        runsOut: needsOrder(s, daysLeft)
      });
    });
  });
  return rows.sort((a, b) =>
    a.name.localeCompare(b.name) || a.uname.localeCompare(b.uname));
}

export function renderInventory(){
  const metricsEl = $('inv-metrics');
  const alertEl = $('inv-alert');
  const tbody = $('inv-tbody');
  if(!metricsEl || !alertEl || !tbody) return;

  const daysLeft = daysLeftInMonth();
  const rows = inventoryRows(daysLeft);

  if(!rows.length){
    metricsEl.innerHTML = '';
    setAlert(alertEl, 'info', 'ti-info-circle',
      'No supplements tracked yet. Add users and supplements in Maintenance.');
    tbody.innerHTML = '<tr><td colspan="7" class="inv-empty">No data</td></tr>';
    return;
  }

  const lowCount = rows.filter(r => r.runsOut).length;

  metricsEl.innerHTML = `
    <div class="metric"><div class="metric-label">Total supplements</div><div class="metric-value">${rows.length}</div></div>
    <div class="metric"><div class="metric-label">Users tracked</div><div class="metric-value">${users().length}</div></div>
    <div class="metric"><div class="metric-label">Days left in month</div><div class="metric-value">${daysLeft}</div></div>
    <div class="metric"><div class="metric-label">Need to order</div><div class="metric-value ${lowCount > 0 ? 'danger' : ''}">${lowCount}</div></div>`;

  if(lowCount > 0){
    setAlert(alertEl, 'danger', 'ti-alert-triangle',
      `${lowCount} supplement${lowCount > 1 ? 's' : ''} will run out before next month's order.`);
  } else {
    setAlert(alertEl, 'success', 'ti-check',
      'All supplements should last until next month’s order.');
  }

  tbody.innerHTML = rows.map(r => {
    const badge = r.inactive
      ? INACTIVE_BADGE
      : r.runsOut
        ? '<span class="badge warn"><i class="ti ti-alert-triangle"></i> Order</span>'
        : '<span class="badge ok"><i class="ti ti-check"></i> OK</span>';
    return `<tr class="${r.runsOut ? 'low-row' : ''}${r.inactive ? ' is-inactive' : ''}">
      <td><strong>${esc(r.name)}</strong>${r.brand ? `<div class="inv-brand">${esc(r.brand)}</div>` : ''}</td>
      <td>
        <span class="inv-user">
          ${esc(r.uname)}
          <button class="btn small" data-action="prefill-cc" data-uid="${esc(r.uid)}" data-sid="${esc(r.sid)}" title="Update ${esc(r.uname)}&#39;s count"><i class="ti ti-edit"></i></button>
        </span>
      </td>
      <td class="r">${Math.round(r.caps)}</td>
      <td class="r">${Math.round(r.weekly)}</td>
      <td class="r">${Math.round(r.monthly)}</td>
      <td class="r">${formatDays(r.daysRem)}</td>
      <td class="r">${badge}</td>
    </tr>`;
  }).join('');
}

// ── Cycle count ─────────────────────────────────────────────────
export function renderCycleCountOptions(){
  const sel = $('cc-select');
  if(!sel) return;
  const prev = sel.value;
  const opts = [];
  users().forEach(user => {
    supplementsOf(user).forEach(s => {
      const label = esc(s.name) + (s.brand ? ' (' + esc(s.brand) + ')' : '');
      opts.push(`<option value="${esc(user.id)}|${esc(s.id)}">${label}</option>`);
    });
  });
  sel.innerHTML = opts.length ? opts.join('') : '<option value="">— no supplements yet —</option>';
  if(prev && Array.from(sel.options).some(o => o.value === prev)) sel.value = prev;
}

export function prefillCycleCount(uid, sid){
  const sel = $('cc-select');
  sel.value = uid + '|' + sid;
  scrollIntoView(sel.closest('.card'));
  $('cc-amount').focus();
}

export function submitCycleCount(){
  const sel = $('cc-select');
  const alertEl = $('cc-alert');
  const value = sel.value;
  if(!value){
    setAlert(alertEl, 'danger', 'ti-alert-circle', 'Select a supplement.');
    return;
  }

  const [uid, sid] = value.split('|');
  const user = findUser(uid);
  const supp = findSupp(uid, sid);
  if(!user || !supp){
    setAlert(alertEl, 'danger', 'ti-alert-circle', 'Supplement not found.');
    return;
  }

  const amount = parseFloat($('cc-amount').value);
  if(!amount || amount <= 0){
    setAlert(alertEl, 'danger', 'ti-alert-circle', 'On-hand count must be greater than 0.');
    return;
  }
  const caps = amountToCaps(amount, $('cc-unit').value, supp.capPerBottle);
  if(!caps || caps <= 0){
    setAlert(alertEl, 'danger', 'ti-alert-circle', 'On-hand count must be greater than 0.');
    return;
  }

  supp.bottles = caps / supp.capPerBottle;
  $('cc-amount').value = '';
  saveState();
  flashAlert(alertEl, 'success', 'ti-check',
    `Updated ${esc(supp.name)} (${esc(user.name)}) to ${Math.round(caps)} caps on hand.`);
}
