// Small DOM helpers shared by every view module.

/** Look up an element by id. */
export const $ = (id) => document.getElementById(id);

/** Show / hide via the .hidden utility class, so each element keeps its own
 *  natural display value (flex, inline-flex, block, …) from the stylesheet. */
export const show = (el) => { if(el) el.classList.remove('hidden'); };
export const hide = (el) => { if(el) el.classList.add('hidden'); };
export const toggle = (el, visible) => { if(el) el.classList.toggle('hidden', !visible); };

const HTML_ESCAPES = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};

/** Escape a value for interpolation into an innerHTML template.
 *  Supplement and user names are free text, so every one of them goes
 *  through here before being written into markup. */
export function esc(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

/** Render an alert into a container, or clear it when message is falsy. */
export function setAlert(el, kind, icon, message, extraClass = ''){
  if(!el) return;
  el.innerHTML = message
    ? `<div class="alert ${kind} ${extraClass}"><i class="ti ${icon}"></i> ${message}</div>`
    : '';
}

/** Show an alert, then clear it after a delay. */
export function flashAlert(el, kind, icon, message, ms = 4000){
  setAlert(el, kind, icon, message);
  setTimeout(()=>{ if(el) el.innerHTML = ''; }, ms);
}

/** Scroll an element into view from the top. */
export function scrollIntoView(el){
  if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
}
