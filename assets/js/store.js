// Shared application state.
//
// `state` mirrors the Firestore `app/state` document and is the only thing
// that gets persisted. The other fields are view-local and reset on sign-out.
//
// Shape:
//   users:  [{id, name, supplements: [{id, stockId, dosePerSession, times, inactive}]}]
//   stocks: [{id, name, brand, capPerBottle, bottles}]
//
// A *stock* is one physical supply of one product. A *regimen* — an entry in a
// user's `supplements` — is how one person takes it. Keeping them apart is what
// makes sharing work: two people who share a bottle point at the same stock, so
// there is exactly one count and it cannot drift between them. Dose, times and
// the inactive flag stay per-person, because two people can share a bottle and
// still take it differently.

export const store = {
  state: {users:[], stocks:[]},
  activeMainUser: null,  // id of the user whose supplement card is open
  editingSupp: null      // {uid, sid} while an existing supplement is being edited
};

export function resetStore(){
  store.state = {users:[], stocks:[]};
  store.activeMainUser = null;
  store.editingSupp = null;
}

export function users(){
  return store.state.users || [];
}

export function stocks(){
  return store.state.stocks || [];
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

export function findStock(stockId){
  return stocks().find(k => k.id === stockId) || null;
}

/** The stock a regimen draws from. */
export function stockOf(supp){
  return supp ? findStock(supp.stockId) : null;
}

/** Everyone who draws from a stock, as {user, supp} pairs, in user order. */
export function consumersOf(stockId){
  const out = [];
  users().forEach(user => {
    supplementsOf(user).forEach(supp => {
      if(supp.stockId === stockId) out.push({user, supp});
    });
  });
  return out;
}

/** Match on name + brand, case- and space-insensitively. Used to spot that a
 *  supplement being added is the one somebody else already stocks. */
export function findStockByName(name, brand){
  const key = s => String(s ?? '').trim().toLowerCase();
  return stocks().find(k =>
    key(k.name) === key(name) && key(k.brand) === key(brand)) || null;
}

// ── Counts ──────────────────────────────────────────────────────
// Every screen derives its numbers from these functions and nothing else, so
// Home, Maintenance, Inventory and the order list can never disagree.

/** Days of supply for a stock that nobody is consuming. */
export const NEVER_RUNS_OUT = 9999;

/** Daily capsule consumption for one person's regimen. A regimen with no times
 *  set is treated as one session per day, matching the original behaviour.
 *
 *  An inactive regimen consumes nothing. Because every other count derives from
 *  this function, that one rule is enough to keep it out of usage deductions,
 *  "days left", weekly/monthly use and the order list. */
export function dailyCaps(supp){
  if(supp.inactive) return 0;
  return supp.dosePerSession * ((supp.times || []).length || 1);
}

/** Combined daily draw on a stock across everyone who takes it. This is the
 *  number that was wrong before stocks existed: a bottle two people share
 *  empties at the sum of their doses, not at either one alone. */
export function stockDailyCaps(stockId){
  return consumersOf(stockId).reduce((sum, c) => sum + dailyCaps(c.supp), 0);
}

/** Capsules currently on hand in a stock. */
export function capsOnHand(stock){
  return stock ? stock.bottles * stock.capPerBottle : 0;
}

/** Days of supply left at the current combined dose. */
export function daysRemaining(stock){
  if(!stock) return NEVER_RUNS_OUT;
  const daily = stockDailyCaps(stock.id);
  return daily > 0 ? capsOnHand(stock) / daily : NEVER_RUNS_OUT;
}

/** True when this stock runs out before the next monthly order goes in. */
export function needsOrder(stock, daysLeft){
  return stockDailyCaps(stock.id) > 0 && daysRemaining(stock) < daysLeft;
}

/** Display form of daysRemaining(). */
export function formatDays(daysRem){
  return daysRem >= NEVER_RUNS_OUT ? '—' : Math.round(daysRem) + 'd';
}

// ── Migration ───────────────────────────────────────────────────

/** Legacy documents kept name/brand/capPerBottle/bottles on each user's
 *  supplement. Split those into a stock plus a regimen.
 *
 *  Each legacy supplement gets its OWN stock, even where two users clearly had
 *  the same product. The old data cannot distinguish a genuinely shared bottle
 *  from two separate ones, and guessing would either double the real count or
 *  throw half of it away — so every existing number survives exactly as it was,
 *  and linking two users to one stock stays an explicit action in Maintenance.
 *
 *  Stock ids derive from the supplement id rather than a clock, so every client
 *  migrates the same legacy document to identical output and re-running this on
 *  an already-migrated document changes nothing. */
export function migrateState(state){
  const next = state && typeof state === 'object' ? state : {};
  if(!Array.isArray(next.users)) next.users = [];
  if(!Array.isArray(next.stocks)) next.stocks = [];

  next.users.forEach(user => {
    if(!Array.isArray(user.supplements)) user.supplements = [];
    user.supplements.forEach(supp => {
      if(supp.stockId) return;             // already migrated
      const stockId = 'k_' + supp.id;
      if(!next.stocks.some(k => k.id === stockId)){
        next.stocks.push({
          id: stockId,
          name: supp.name,
          brand: supp.brand || '',
          capPerBottle: supp.capPerBottle,
          bottles: supp.bottles
        });
      }
      supp.stockId = stockId;
      delete supp.name;
      delete supp.brand;
      delete supp.capPerBottle;
      delete supp.bottles;
    });
  });

  return next;
}
