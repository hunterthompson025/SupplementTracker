// Home screen: preview and log days of supplement usage.

import { $, esc, setAlert, flashAlert } from './dom.js';
import { findUser, supplementsOf, stockOf, consumersOf,
         dailyCaps, capsOnHand } from './store.js';
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
    const stock = stockOf(s);
    if(!stock) return '';
    // Only this person's share comes off. Everyone else logs their own days
    // against the same supply, which is exactly how a shared bottle empties.
    const used = dailyCaps(s) * days;
    const before = Math.round(capsOnHand(stock));
    const after = Math.max(0, before - used);
    const others = consumersOf(stock.id).filter(c => c.user.id !== user.id);
    const sharedNote = others.length
      ? `<span class="badge shared"><i class="ti ti-users"></i> Shared with ${
          esc(others.map(c => c.user.name).join(', '))}</span> `
      : '';
    const delta = s.inactive
      ? `<div class="preview-used">not counted</div>
         <div class="preview-remaining">${before} → ${before}</div>`
      : `<div class="preview-used">−${used} cap${used !== 1 ? 's' : ''}</div>
         <div class="preview-remaining">${before} → ${after}</div>`;
    return `<div class="supp-row${s.inactive ? ' is-inactive' : ''}">
      <div class="supp-row-main">
        <div class="supp-name">${esc(stock.name)}</div>
        <div class="time-tags">${sharedNote}${s.inactive ? INACTIVE_BADGE + ' ' : ''}${timeBadges(s.times)}</div>
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
  let shared = 0;
  supps.forEach(s => {
    // Inactive supplements are left exactly as they are — not even a zero
    // subtraction, which would round-trip through a float division.
    if(s.inactive){ skipped++; return; }
    const stock = stockOf(s);
    if(!stock) return;
    if(consumersOf(stock.id).length > 1) shared++;
    const remaining = Math.max(0, capsOnHand(stock) - dailyCaps(s) * days);
    stock.bottles = remaining / stock.capPerBottle;
  });
  await saveState();
  btn.disabled = false;

  const notes = [];
  if(skipped) notes.push(` ${skipped} inactive supplement${skipped !== 1 ? 's' : ''} left unchanged.`);
  if(shared) notes.push(` ${shared} shared suppl${shared !== 1 ? 'ies' : 'y'} updated for everyone.`);
  flashAlert(alertEl, 'success', 'ti-check',
    `Logged ${days} day${days !== 1 ? 's' : ''} of supplements for ${esc(user.name)}.${notes.join('')}`);
}
