// Global error visibility, so real failures surface in the UI instead of
// silently dying in the console.
//
// This module deliberately imports nothing and installs its listeners on
// evaluation. main.js imports it first so the handlers are in place before
// Firebase initialises.

export function showFatalError(detail){
  let el = document.getElementById('fatal-error-banner');
  if(!el){
    el = document.createElement('div');
    el.id = 'fatal-error-banner';
    el.className = 'fatal-banner';
    document.body.appendChild(el);
  }
  el.textContent = 'Error: ' + detail;
}

export function clearFatalError(){
  const el = document.getElementById('fatal-error-banner');
  if(el) el.remove();
}

window.addEventListener('error', e=>{
  console.error('Uncaught error:', e.error || e.message, e);
  showFatalError((e.error && (e.error.stack || e.error.message)) || e.message || 'Unknown script error');
});

window.addEventListener('unhandledrejection', e=>{
  console.error('Unhandled promise rejection:', e.reason);
  showFatalError((e.reason && (e.reason.stack || e.reason.message)) || String(e.reason));
});
