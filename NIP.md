# budgetstr — Custom Event Kinds

budgetstr is an encrypted, shareable budgeting client built on Nostr. All
financial data is end-to-end encrypted with **NIP-44** before it ever leaves
the device. Relays only ever see ciphertext.

## Kind 34529 — Budget Entry (addressable, owner-private)

A single budget entry (an income or expense line item) owned by its author.

- **Kind**: `34529` (addressable, `30000`–`39999`)
- **Content**: A **NIP-44 ciphertext** produced by encrypting the JSON payload
  below **to the author's own pubkey** (self-encryption). Only the author can
  decrypt their own entries.
- **Tags**:
  - `d` — required, a unique identifier for the entry (UUID).
  - `alt` — required, NIP-31 human-readable description
    (`"Encrypted budgetstr entry"`).

### Decrypted JSON payload

```json
{
  "title": "Groceries",
  "amount": 54.20,
  "currency": "USD",
  "type": "expense",          // "expense" | "income"
  "category": "Food",
  "note": "Weekly shop",
  "date": "2026-05-28",        // ISO date
  "createdAt": 1748390400,     // unix seconds
  "recurrence": "monthly"      // "none" | "daily" | "weekly" | "monthly" | "yearly"
}
```

`recurrence` is optional; entries without it are treated as one-time
(`"none"`). Because the entire payload is encrypted, none of these fields are
queryable at the relay level — that is intentional for privacy.

## Kind 1431 — Shared Budget Entry (regular, recipient-encrypted)

A copy of a budget entry shared with another user. The author re-encrypts the
entry payload to the recipient's pubkey so the recipient (and only the
recipient) can read it.

- **Kind**: `1431` (regular, `1000`–`9999`)
- **Content**: A **NIP-44 ciphertext** produced by encrypting the JSON payload
  (same shape as kind 34529, plus a `sharedBy` field with the author's npub and
  an `entryId` field referencing the original `d` tag) **to the recipient's
  pubkey**.
- **Tags**:
  - `p` — required, the recipient's pubkey (hex). Lets the recipient query
    shared entries with `{ kinds: [1431], '#p': [myPubkey] }`.
  - `entry` — the original entry's `d` identifier so re-shares of the same
    entry can be de-duplicated / updated client-side.
  - `alt` — required, NIP-31 human-readable description
    (`"A budget entry shared with you on budgetstr"`).

### Decrypted JSON payload

```json
{
  "title": "Groceries",
  "amount": 54.20,
  "currency": "USD",
  "type": "expense",
  "category": "Food",
  "note": "Weekly shop",
  "date": "2026-05-28",
  "createdAt": 1748390400,
  "recurrence": "monthly",
  "entryId": "uuid-of-original-entry",
  "sharedBy": "npub1..."
}
```

To **revoke** a share, the author publishes a NIP-09 deletion (kind 5)
referencing the kind 1431 event id.

## Contacts list

The user's list of people they share budgets with is stored as a private,
self-encrypted application-data event:

- **Kind**: `30078` (NIP-78 application-specific data, addressable)
- **`d` tag**: `notebudget/contacts` (kept stable for backward compatibility)
- **Content**: NIP-44 ciphertext (encrypted to self) of a JSON array of
  `{ "pubkey": "<hex>", "name": "<optional label>" }` objects.
- **`alt` tag**: `"budgetstr private contacts"`.

## Shared-balance partners list

A separate private list of "partners" (e.g. a spouse) whose budgets are pooled
into a combined balance. When a partner is linked, every entry the user creates
is automatically shared with them (a kind 1431 event, see above), and entries
shared **by** confirmed partners are summed into the user's combined Balance,
Income, and Expense totals.

- **Kind**: `30078` (NIP-78 application-specific data, addressable)
- **`d` tag**: `budgetstr/partners`
- **Content**: NIP-44 ciphertext (encrypted to self) of a JSON array of
  `{ "pubkey": "<hex>", "name": "<optional label>" }` objects.
- **`alt` tag**: `"budgetstr shared-balance partners"`.

A two-way shared balance requires each partner to add the other; each side
independently shares its entries with the other, encrypted end-to-end. To stop
sharing, a partner is removed from this list (existing shared copies can be
revoked via NIP-09 deletion).
