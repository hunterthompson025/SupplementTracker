// Screen switching.

export function showScreen(name, btn){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const screen = document.getElementById('screen-' + name);
  if(screen) screen.classList.add('active');
  if(btn) btn.classList.add('active');
}
