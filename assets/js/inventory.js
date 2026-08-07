// Inventory screen: the roll-up table and the cycle-count form.

import { $, esc, setAlert, flashAlert, scrollIntoView } from './dom.js';
import { stocks, findStock, consumersOf, dailyCaps, stockDailyCaps,
         capsOnHand, daysRemaining, needsOrder, formatDays } from './store.js';
import { saveState } from './sync.js';
import { daysLeftInMonth } from './dates.js';
import { amountToCaps, INACTIVE_BADGE } from './supplements.js';

/** One row per stock — per physical supply, not per person.
 *
 *  A supply that two people share empties at the sum of their doses, so its
 *  weekly and monthly use are summed across everyone who takes it and "days
 *  left" is measured against that combined draw. Splitting a shared supply into
 *  one row per person is what made the counts disagree: each row showed the
 *  whole bottle while claiming only one person's share of the consumption. */
function inventoryRows(daysLeft){
  return stocks().map(stock => {
    const takers = consumersOf(stock.id);
    const daily = stockDailyCaps(stock.id);
    return {
      sid: stock.id,
      name: stock.name,
      brand: stock.brand,
      takers: takers.map(c => ({
        name: c.user.name,
        inactive: Boolean(c.supp.inactive),
        daily: dailyCaps(c.supp)
      })),
      shared: takers.length > 1,
      inactive: takers.length > 0 && daily === 0,
      caps: capsOnHand(stock),
      weekly: daily * 7,
      monthly: daily * 30,
      daysRem: daysRemaining(stock),
      runsOut: needsOrder(stock, daysLeft)
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/** Each person on the row, with their own daily draw, so a shared row still
 *  shows who is responsible for how much of it. */
function takerCell(row){
  if(!row.takers.length){
    return '<span class="inv-user muted">Nobody</span>';
  }
  return row.takers.map(t => `<span class="inv-user${t.inactive ? ' is-inactive' : ''}">`
    + `${esc(t.name)}<span class="inv-user-dose">${t.inactive ? 'paused' : t.daily + '/day'}</span>`
    + '</span>').join('');
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
  const sharedCount = rows.filter(r => r.shared).length;

  metricsEl.innerHTML = `
    <div class="metric"><div class="metric-label">Supplies tracked</div><div class="metric-value">${rows.length}</div></div>
    <div class="metric"><div class="metric-label">Shared supplies</div><div class="metric-value">${sharedCount}</div></div>
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
      <td>
        <strong>${esc(r.name)}</strong>
        ${r.shared ? '<span class="badge shared"><i class="ti ti-users"></i> Shared</span>' : ''}
        ${r.brand ? `<div class="inv-brand">${esc(r.brand)}</div>` : ''}
      </td>
      <td>
        <div class="inv-users">
          ${takerCell(r)}
          <button class="btn small" data-action="prefill-cc" data-sid="${esc(r.sid)}" title="Update the count for ${esc(r.name)}"><i class="ti ti-edit"></i></button>
        </div>
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
// Options are keyed by stock, so a supplement two people share appears exactly
// once. It used to appear once per person under an identical label, which made
// picking the right one impossible — you always got whichever user came first.
export function renderCycleCountOptions(){
  const sel = $('cc-select');
  if(!sel) return;
  const prev = sel.value;
  const opts = stocks()
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(stock => {
      const takers = consumersOf(stock.id).map(c => c.user.name);
      const label = esc(stock.name)
        + (stock.brand ? ' (' + esc(stock.brand) + ')' : '')
        + (takers.length ? ' — ' + esc(takers.join(', ')) : '');
      return `<option value="${esc(stock.id)}">${label}</option>`;
    });
  sel.innerHTML = opts.length ? opts.join('') : '<option value="">— no supplements yet —</option>';
  if(prev && Array.from(sel.options).some(o => o.value === prev)) sel.value = prev;
}

export function prefillCycleCount(sid){
  const sel = $('cc-select');
  sel.value = sid;
  scrollIntoView(sel.closest('.card'));
  $('cc-amount').focus();
}

export function submitCycleCount(){
  const sel = $('cc-select');
  const alertEl = $('cc-alert');
  const stock = findStock(sel.value);
  if(!stock){
    setAlert(alertEl, 'danger', 'ti-alert-circle', 'Select a supplement.');
    return;
  }

  const amount = parseFloat($('cc-amount').value);
  if(!amount || amount <= 0){
    setAlert(alertEl, 'danger', 'ti-alert-circle', 'On-hand count must be greater than 0.');
    return;
  }
  const caps = amountToCaps(amount, $('cc-unit').value, stock.capPerBottle);
  if(!caps || caps <= 0){
    setAlert(alertEl, 'danger', 'ti-alert-circle', 'On-hand count must be greater than 0.');
    return;
  }

  stock.bottles = caps / stock.capPerBottle;
  $('cc-amount').value = '';
  saveState();

  const takers = consumersOf(stock.id).map(c => c.user.name);
  const who = takers.length > 1 ? ` for ${esc(takers.join(' and '))}` : '';
  flashAlert(alertEl, 'success', 'ti-check',
    `Updated ${esc(stock.name)} to ${Math.round(caps)} caps on hand${who}.`);
}
