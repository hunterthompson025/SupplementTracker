// Single entry point for a full re-render. Called after every Firestore
// snapshot, so the UI always reflects the latest synced state.

import { store } from './store.js';
import { populateUserDropdown, renderUserList } from './users.js';
import { renderUserCheckboxes, renderSuppList } from './supplements.js';
import { loadHomePreview } from './usage.js';
import { renderInventory, renderCycleCountOptions } from './inventory.js';

export function renderAll(){
  populateUserDropdown();
  renderUserList();
  renderInventory();
  renderCycleCountOptions();
  loadHomePreview();
  if(store.activeMainUser){
    // Preserve the locked owner checkbox if an edit is in progress.
    renderUserCheckboxes(store.editingSupp ? store.editingSupp.uid : null);
    renderSuppList();
  }
}
