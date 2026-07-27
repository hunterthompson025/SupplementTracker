// Order list generation.

import { $, esc, setAlert } from './dom.js';
import { users, supplementsOf, dailyCaps, capsOnHand, needsOrder } from './store.js';
import { daysLeftInMonth, formatLongDate } from './dates.js';

const TARGET_DAYS = 30;   // how many days of supply an order should top up to

let lastOrderText = '';

function buildOrderText(daysLeft){
  const lines = ['ORDER LIST — ' + formatLongDate(), ''];
  let hasItems = false;

  users().forEach(user => {
    // Same predicate the Inventory "Order" badge uses, so the two always agree.
    const needed = supplementsOf(user).filter(s => needsOrder(s, daysLeft));
    if(!needed.length) return;

    lines.push(user.name.toUpperCase() + ':');
    needed.forEach(s => {
      const daily = dailyCaps(s);
      const onHand = capsOnHand(s);
      const needCaps = Math.max(0, daily * TARGET_DAYS - onHand);
      const needBottles = Math.ceil(needCaps / s.capPerBottle);
      lines.push(`  • ${s.name}${s.brand ? ' — ' + s.brand : ''}`);
      lines.push(`    Need: ${needBottles} bottle${needBottles !== 1 ? 's' : ''} (~${Math.round(needCaps)} caps)`);
      lines.push(`    On hand: ${Math.round(onHand)} caps | Monthly use: ${Math.round(daily * TARGET_DAYS)} caps`);
    });
    lines.push('');
    hasItems = true;
  });

  return hasItems ? lines.join('\n') : null;
}

export function showOrderList(){
  const el = $('order-output');
  if(!el) return;
  const text = buildOrderText(daysLeftInMonth());

  if(!text){
    lastOrderText = '';
    setAlert(el, 'success', 'ti-check',
      'All supplements are stocked for next month. Nothing to order.', 'spaced');
    return;
  }

  lastOrderText = text;
  el.innerHTML = `<div class="order-list">${esc(text)}</div>
    <button class="btn order-copy" data-action="copy-order"><i class="ti ti-copy"></i> Copy to clipboard</button>`;
}

export function copyOrder(btn){
  if(!lastOrderText) return;
  navigator.clipboard.writeText(lastOrderText).then(() => {
    btn.innerHTML = '<i class="ti ti-check"></i> Copied!';
    setTimeout(() => { btn.innerHTML = '<i class="ti ti-copy"></i> Copy to clipboard'; }, 2500);
  }).catch(err => {
    console.error('Clipboard write failed:', err);
    btn.innerHTML = '<i class="ti ti-alert-circle"></i> Copy failed';
    setTimeout(() => { btn.innerHTML = '<i class="ti ti-copy"></i> Copy to clipboard'; }, 2500);
  });
}
