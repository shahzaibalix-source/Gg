# Lindenhof Town Simulator — Security Specification (Public Visitor + Admin-Only Backend RBAC)

## 1. Data Invariants
1. **Default-Deny Baseline**: Every Firestore path not explicitly matched is denied for all reads and writes.
2. **Login-Free Public Visitors (`request.auth == null` or non-admin signed-in user)**:
   - Can read ONLY public town state: `/town_plots/{plotId}`, `/town_meta/economy`, `/town_meta/settings`, `/town_meta/expansion_manifest`, `/resident_directory_shards/{shardId}`, and `/test/{docId}`.
   - Have **ZERO write permissions** anywhere in Firestore. Cannot alter house ownership, resident usernames, follower shards, buildings, treasury, welcome text, or Instagram URL.
   - Have **ZERO read permissions** for private resident records (`/resident_records/{plotId}`), username locks (`/resident_usernames/{usernameKey}`), `/admins/{uid}`, or `/admin_gate/{docId}`.
3. **Super Admin (`email_verified == true` and `email in ['knightrepacks@gmail.com', 'shahzaibalix@gmail.com']` or `/admins/{uid}` exists)**:
   - Exclusive write authority for `/town_plots/{plotId}`, `/town_meta/economy`, `/town_meta/settings`, `/town_meta/expansion_manifest`, `/resident_directory_shards/{shardId}`, `/resident_records/{plotId}`, `/resident_usernames/{usernameKey}`, and `/admins/{adminUid}`.
   - All writes enforce strict `isValid[Entity]()` schema checks (`keys().hasAll`, `keys().hasOnly`, `.size()`, regex IDs, `https://` Instagram URL guard, and `request.time` server timestamps).
   - No client user or visitor can self-promote to Admin.

4. **Verified Residents (`email_verified == true`)**:
   - **`/resident_wallets/{userId}`**: Strictly readable and writable ONLY by `request.auth.uid == userId` (or Super Admin for read/delete). Zero `list` access for non-admins. Wallet balance may only increase during a valid daily check-in (`lastCheckInDay != existing().lastCheckInDay`, `totalCheckIns == existing().totalCheckIns + 1`, capped at `+250` LDF Coins per day) and may only decrease or stay unchanged when purchasing residential upgrades.
   - **`/plot_customizations/{plotId}`**: Publicly readable so visitors see house bios and exterior upgrades in 3D. Only verified owners (`ownerUid == request.auth.uid`) or Super Admins can update, with immutable `ownerUid` and `plotId`.
   - **`/plot_guestbook/{entryId}`**: Publicly readable visitor guestbook notes. Only verified signed-in users (`authorUid == request.auth.uid`, `message.size() <= 180`, `createdAt == request.time`) can create entries; updates are forbidden; deletion restricted to the note's author or Super Admin.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: `PERMISSION_DENIED`)
1. Unauthenticated visitor creates or updates a `town_plots` document -> DENIED (`isAdmin()` false).
2. Non-admin Google-authenticated user attempts to update `town_plots/res-08` to claim a house -> DENIED (`isAdmin()` false).
3. Public visitor attempts to read `/resident_records/res-01` to scrape Instagram handles -> DENIED (`allow read: if isAdmin()`).
4. Non-admin Google user attempts `list` query on `/resident_records` -> DENIED (`allow list: if isAdmin()`).
5. Visitor or non-admin user attempts to write `/town_meta/settings` with a malicious `instagramUrl` -> DENIED (`isAdmin()` false).
6. Even if compromised, a `town_meta/settings` write with `javascript:alert(1)` as `instagramUrl` -> DENIED (`matches('^https://.*')`).
7. Non-admin user attempts to write `/admins/{uid}` to grant themselves Super Admin -> DENIED (`isAdmin()` false).
8. Spoofed admin email with `email_verified: false` attempts admin write or `admin_gate` read -> DENIED (`request.auth.token.email_verified == true`).
9. Non-admin user attempts to update `town_meta/economy` treasury balance -> DENIED (`isAdmin()` false).
10. Attempt to write an undeclared shadow field (e.g. `isAdmin: true`) inside `town_plots`, `resident_wallets`, `plot_customizations`, or `plot_guestbook` -> DENIED (`keys().hasOnly(...)`).
11. User attempts to mint +99,999 LDF Coins in `resident_wallets/{uid}` on the same `lastCheckInDay` -> DENIED (`balance <= existing().balance` when day unchanged; max `+250` delta on check-in).
12. User attempts to forge another user's `authorUid` in `/plot_guestbook/{entryId}` or overwrite another owner's `/plot_customizations/{plotId}` -> DENIED (`authorUid == request.auth.uid` / `existing().ownerUid == request.auth.uid`).
