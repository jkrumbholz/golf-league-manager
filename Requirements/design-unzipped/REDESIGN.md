# Golf League App — UI/UX Redesign Instructions

The features already work. **Do not change data models, APIs, or business logic.** Restructure navigation and restyle the UI to match the attached screenshots in `screens/` (mobile-first, 390px wide; scale up gracefully on desktop by centering content in a max-width ~640px column).

## 1. Problems to fix
- Admin pages stack multiple cards (list + add form) on one page. Hard to follow.
- Admin features are mixed into the player experience.
- Styling (cream background, white bordered cards, green pill buttons) should be replaced with the dark leaderboard style below.

## 2. Core principle: one thing per screen
Every admin page is a **list**. An **+ Add** button sits top right and opens a **separate full-screen form**. Tapping a row drills into the next level. Never show a list and a create-form on the same page.

## 3. Roles and routing
Organizers are also players. Everyone gets the player experience; organizers additionally see **Admin** in the hamburger menu.

**After login:**
- Member of exactly 1 league → redirect straight to that league home (`02`).
- Member of 2+ leagues → show "My leagues" (`01`); tapping one opens league home (`02`).
- Member of 0 leagues → empty state ("You're not in a league yet. Ask your organizer to add you."). Organizers see a "Create a league" button linking to admin.

### Route map
| Route | Screen | Mockup |
|---|---|---|
| `/leagues` | My leagues (player) | 01 |
| `/leagues/:id` | League home: live event hero + upcoming events | 02 |
| `/events/:id` | Live leaderboard (+ "Enter my score") | 03 |
| `/admin/leagues` | Admin: leagues list, + Add | 05 |
| `/admin/leagues/new` | Add league form | 06 |
| `/admin/leagues/:id` | League: tabs **Seasons / Players**, + Add | 07, 08 |
| `/admin/leagues/:id/seasons/new` | Add season form | (same layout as 06/10) |
| `/admin/seasons/:id` | Season: events list, + Add | 09 |
| `/admin/seasons/:id/events/new` | Add event form | 10 |
| `/admin/leagues/:id/players/new` | Add/invite player form | (same layout as 06/10) |

Protect all `/admin/*` routes to organizers only.

## 4. Global navigation (mockup 04)
- Hamburger (☰) top right on every top-level screen, opens a right-side drawer with a dimmed scrim.
- Drawer items: signed-in name, **My leagues**, **Admin** (organizers only), **Profile**, **Log out** (red, separated at bottom).
- Drill-in screens show a back chevron (‹) top left. Form screens show ✕ top left instead and no top-right action.
- Log out must move here from wherever it currently lives.

## 5. Screen specs
- **01 My leagues:** list rows with league name, current season · player count, chevron. "Live" gold pill if an event is in progress.
- **02 League home:** if an event is live, a hero card (gold "Live now" pill, event name, format · date · course, "View leaderboard ›"). Below, "Upcoming events" list ordered by date. Bottom tab bar: Events / Standings / Players.
- **03 Leaderboard:** matches the inspiration image exactly: rank, uppercase player name, score to par (white), total strokes (gold). Header shows event and course/status. Primary button "Enter my score" opens the existing score-keeping flow. Highlight the signed-in player's row subtly.
- **05 Admin leagues:** title "Leagues", + Add top right, rows with name, counts, chevron.
- **07 League (Seasons tab):** underlined tabs. Rows show season name, date range, status pill (Active gold / Ended muted).
- **08 League (Players tab):** rows show name and role (Organizer / Player / Invited). + Add adds a player.
- **09 Season events:** rows show name, format · date, status pill (Done / Live / none).
- **06 / 10 Forms:** full screen, labeled fields, single gold submit button at bottom. After a successful save, return to the parent list with the new item visible. Show inline validation errors under the field.
- The + Add button is contextual: on the Seasons tab it adds a season; on the Players tab it adds a player.

## 6. Design tokens (derived from the inspiration image)
```css
:root {
  --bg: #0d1b3e;              /* page background */
  --surface-from: #111f45;    /* card gradient start */
  --surface-to: #1a3068;      /* card gradient end (135deg) */
  --divider: #2b3d70;         /* row dividers, input borders */
  --text: #ffffff;
  --text-muted: #8d9cc4;
  --text-faint: #5f70a3;
  --accent: #f5c518;          /* gold: totals, primary buttons, live pills */
  --danger: #ff8a8a;          /* log out */
  --radius-card: 14px;
  --radius-input: 10px;
}
```
- **Font:** system sans stack (`'Helvetica Neue', Arial, sans-serif`). Names, titles, and buttons are 800 weight and **uppercase**. Small meta text is 12px, muted, uppercase.
- **Cards:** one gradient card per list, rows separated by 1px `--divider` lines (not a separate bordered card per row). 16px side margin.
- **Buttons:** primary = gold background, navy text, 12px radius, full width on forms. "+ Add" = small gold pill.
- **Inputs:** navy fill, 1px `--divider` border, white text, muted placeholder, uppercase muted labels above.
- **Pills:** gold = live/active, muted blue = done/ended.
- **Tap targets** at least 44px tall. Replace all previous cream/green colors.

## 7. Implementation order
1. Add design tokens and shared components: `AppShell` (header with back/title/action), `ListCard`/`ListRow`, `Pill`, `FormField`, `PrimaryButton`, `Drawer`.
2. Implement the hamburger drawer and role-based menu items.
3. Implement post-login routing (0 / 1 / many leagues).
4. Build the player screens (01–03) using existing data queries.
5. Break up the admin pages into the list + form routes in the table above, reusing the existing create/mutation logic in the new form screens.
6. Delete the old stacked-card admin pages once replaced.

## 8. Acceptance checklist
- [ ] No screen shows both a list and a create form.
- [ ] Single-league players land directly on league home after login.
- [ ] Multi-league players see the league picker.
- [ ] Admin is reachable only through the hamburger, only for organizers.
- [ ] Log out lives in the hamburger.
- [ ] Every drill-in has a back button; every form has ✕ and returns to its parent list on save.
- [ ] Leaderboard visually matches the inspiration image.
- [ ] Works at 390px width with no horizontal scroll.
