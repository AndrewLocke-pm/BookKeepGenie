// The Ledger is the primary transaction list view.
// Phase 5 will implement the full redesigned Ledger page.
// For now it re-renders the existing Transactions page at the /ledger route,
// preserving all data-testid attributes that automated tests rely on.
export { default } from './transactions';
