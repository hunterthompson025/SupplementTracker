// Date helpers. "Days left" drives both the inventory warnings and the order
// list: a supplement needs ordering if it runs out before the end of the month.

/** Whole days remaining in the current month (at least 1). */
export function daysLeftInMonth(today = new Date()){
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return Math.max(1, daysInMonth - today.getDate());
}

export function formatLongDate(date = new Date()){
  return date.toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'});
}
