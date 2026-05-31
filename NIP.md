# budgetstr — Custom Event Kinds

budgetstr is an encrypted, shareable budgeting client built on Nostr. All
financial data is end-to-end encrypted with **NIP-44** before it ever leaves
the device. Relays only ever see ciphertext.

## Monthly balance semantics

The dashboard computes Balance, Income, and Expenses for the **current
calendar month** based on each entry's recurrence:

| Recurrence | Current-month contribution |
|------------|---------------------------|
| `none` | Counts only if the entry's date falls in this month |
| `daily` | `amount × days_active_in_month` |
| `weekly` | `amount × occurrences_in_month` (counting from anchor date every 7 days) |
| `monthly` | `amount` (once per month, from the anchor month onward) |
| `yearly` | Counted only in the entry's anniversary month (due date); **deferred** from the balance in all other months |

Yearly expenses are aggregated into a separate **"Yearly expenses savings"**
field, which shows: (a) the annual total of all yearly expense amounts, and
(b) a suggested monthly set-aside (`annual_total / 12`). This field is
informational — it does **not** reduce the monthly balance, giving the user a
clear picture of what to save each month for upcoming annual bills while
keeping the monthly budget free from "phantom" deductions.

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

## Piggy bank (lightning savings accounts)

A private list of lightning addresses the user sends savings to (e.g.
River, Strike, Cash App, Alby Hub). Each account stores a label, the
lightning address, and an optional provider key.

- **Kind**: `30078` (NIP-78 application-specific data, addressable)
- **`d` tag**: `budgetstr/piggybank`
- **Content**: NIP-44 ciphertext (encrypted to self) of a JSON array of
  account objects:

```json
[
  {
    "id": "uuid",
    "label": "River savings",
    "address": "username@river.com",
    "provider": "river"
  }
]
```

- **`alt` tag**: `"budgetstr piggy bank accounts"`.

The dashboard renders each account with a clickable `lightning:` URI link and
a QR code button so the user can quickly scan or tap to send funds from any
wallet.

## Category budgets

A private list of spending categories, each with an optional monthly budget.
The user can add, remove, and rename categories. When a budget is set, the
dashboard tracks current-month expense entries in that category against it
and shows a progress bar (spent vs budgeted).

- **Kind**: `30078` (NIP-78 application-specific data, addressable)
- **`d` tag**: `budgetstr/categories`
- **Content**: NIP-44 ciphertext (encrypted to self) of a JSON array:

```json
[
  { "name": "Food", "budget": 400, "currency": "USD" },
  { "name": "Housing", "budget": 1200, "currency": "USD" },
  { "name": "Fun", "budget": 100, "currency": "USD" }
]
```

- **`alt` tag**: `"budgetstr category budgets"`.

When the user has not published a category list, a set of built-in defaults is
used (Food, Housing, Transport, Utilities, Health, Entertainment, Shopping,
Salary, Gift, Other) — all with `budget: 0` (no limit). Entries created before
categories were customized still carry their original category string and are
matched by name.
