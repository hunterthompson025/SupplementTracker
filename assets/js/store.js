// Shared application state.
//
// `state` mirrors the Firestore `app/state` document and is the only thing
// that gets persisted. The other fields are view-local and reset on sign-out.

export const store = {
  state: {users:[]},
  activeMainUser: null,  // id of the user whose supplement card is open
  editingSupp: null      // {uid, sid} while an existing supplement is being edited
};

export function resetStore(){
  store.state = {users:[]};
  store.activeMainUser = null;
  store.editingSupp = null;
}

export function users(){
  return store.state.users || [];
}

export function findUser(uid){
  return users().find(u => u.id === uid) || null;
}

export function supplementsOf(user){
  return (user && user.supplements) || [];
}

export function findSupp(uid, sid){
  return supplementsOf(findUser(uid)).find(s => s.id === sid) || null;
}

// ── Counts ──────────────────────────────────────────────────────
// Every screen derives its numbers from these four functions and nothing else,
// so Home, Maintenance, Inventory and the order list can never disagree.
// A supplement's stock is per-user: two users who take the same supplement each
// have their own record with their own count.

/** Days of supply for a supplement that is never consumed. */
export const NEVER_RUNS_OUT = 9999;

/** Daily capsule consumption for one supplement. A supplement with no times
 *  set is treated as one session per day, matching the original behaviour.
 *
 *  An inactive supplement consumes nothing. Because every other count derives
 *  from this function, that one rule is enough to keep it out of usage
 *  deductions, "days left", weekly/monthly use and the order list. */
export function dailyCaps(supp){
  if(supp.inactive) return 0;
  return supp.dosePerSession * ((supp.times || []).length || 1);
}

/** Capsules currently on hand. */
export function capsOnHand(supp){
  return supp.bottles * supp.capPerBottle;
}

/** Days of supply left at the current dose. */
export function daysRemaining(supp){
  const daily = dailyCaps(supp);
  return daily > 0 ? capsOnHand(supp) / daily : NEVER_RUNS_OUT;
}

/** True when this supplement runs out before the next monthly order goes in. */
export function needsOrder(supp, daysLeft){
  return dailyCaps(supp) > 0 && daysRemaining(supp) < daysLeft;
}

/** Display form of daysRemaining(). */
export function formatDays(daysRem){
  return daysRem >= NEVER_RUNS_OUT ? '—' : Math.round(daysRem) + 'd';
}
