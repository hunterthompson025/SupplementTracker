// Order list generation.

import { $, esc, setAlert } from './dom.js';
import { stocks, consumersOf, stockDailyCaps, capsOnHand, needsOrder } from './store.js';
import { daysLeftInMonth, formatLongDate } from './dates.js';

const TARGET_DAYS = 30;   // how many days of supply an order should top up to

let lastOrderText = '';

/** One entry per supply, not per person: a bottle two people share gets ordered
 *  once, for the combined thirty-day draw. Listing it under each person meant
 *  ordering it twice and sizing each order to half the real consumption. */
function buildOrderText(daysLeft){
  const needed = stocks()
    .filter(stock => needsOrder(stock, daysLeft))
    .sort((a, b) => a.name.localeCompare(b.name));

  if(!needed.length) return null;

  const lines = ['ORDER LIST — ' + formatLongDate(), ''];
  needed.forEach(stock => {
    const daily = stockDailyCaps(stock.id);
    const onHand = capsOnHand(stock);
    const needCaps = Math.max(0, daily * TARGET_DAYS - onHand);
    const needBottles = Math.ceil(needCaps / stock.capPerBottle);
    const takers = consumersOf(stock.id).map(c => c.user.name);
    lines.push(`• ${stock.name}${stock.brand ? ' — ' + stock.brand : ''}`);
    lines.push(`    For: ${takers.join(', ') || '—'}`);
    lines.push(`    Need: ${needBottles} bottle${needBottles !== 1 ? 's' : ''} (~${Math.round(needCaps)} caps)`);
    lines.push(`    On hand: ${Math.round(onHand)} caps | Monthly use: ${Math.round(daily * TARGET_DAYS)} caps`);
    lines.push('');
  });

  return lines.join('\n');
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
