// Home screen: preview and log days of supplement usage.

import { $, esc, setAlert, flashAlert } from './dom.js';
import { findUser, supplementsOf, dailyCaps, capsOnHand } from './store.js';
import { saveState } from './sync.js';
import { timeBadges, INACTIVE_BADGE } from './supplements.js';

function readDays(){
  return Math.max(1, parseInt($('home-days').value, 10) || 1);
}

export function loadHomePreview(){
  const el = $('home-preview');
  if(!el) return;
  const user = findUser($('home-user').value);
  const supps = supplementsOf(user);
  const days = readDays();

  if(!supps.length){
    el.innerHTML = '<div class="empty compact">No supplements configured for this user.</div>';
    return;
  }

  const heading = `<div class="preview-note">Preview — ${days} day${days !== 1 ? 's' : ''} of usage for ${esc(user.name)}:</div>`;
  el.innerHTML = heading + supps.map(s => {
    const used = dailyCaps(s) * days;
    const before = Math.round(capsOnHand(s));
    const after = Math.max(0, before - used);
    const delta = s.inactive
      ? `<div class="preview-used">not counted</div>
         <div class="preview-remaining">${before} → ${before}</div>`
      : `<div class="preview-used">−${used} cap${used !== 1 ? 's' : ''}</div>
         <div class="preview-remaining">${before} → ${after}</div>`;
    return `<div class="supp-row${s.inactive ? ' is-inactive' : ''}">
      <div class="supp-row-main">
        <div class="supp-name">${esc(s.name)}</div>
        <div class="time-tags">${s.inactive ? INACTIVE_BADGE + ' ' : ''}${timeBadges(s.times)}</div>
      </div>
      <div class="preview-delta">${delta}</div>
    </div>`;
  }).join('');
}

export async function logUsage(){
  const alertEl = $('home-alert');
  const user = findUser($('home-user').value);
  const days = readDays();

  if(!user){
    setAlert(alertEl, 'danger', 'ti-alert-circle', 'Select a user first.');
    return;
  }
  const supps = supplementsOf(user);
  if(!supps.length){
    setAlert(alertEl, 'danger', 'ti-alert-circle', 'No supplements configured for this user.');
    return;
  }

  const btn = $('log-btn');
  btn.disabled = true;
  let skipped = 0;
  supps.forEach(s => {
    // Inactive supplements are left exactly as they are — not even a zero
    // subtraction, which would round-trip through a float division.
    if(s.inactive){ skipped++; return; }
    const remaining = Math.max(0, capsOnHand(s) - dailyCaps(s) * days);
    s.bottles = remaining / s.capPerBottle;
  });
  await saveState();
  btn.disabled = false;

  const note = skipped ? ` ${skipped} inactive supplement${skipped !== 1 ? 's' : ''} left unchanged.` : '';
  flashAlert(alertEl, 'success', 'ti-check',
    `Logged ${days} day${days !== 1 ? 's' : ''} of supplements for ${esc(user.name)}.${note}`);
}
