# Score Entry Screen — Redesign Instructions

Companion to `REDESIGN.md`. Use the same design tokens (navy background, gradient cards, gold accent `#f5c518`). Reference mockups are in `scoring/` (A–F). **Do not change scoring logic, data models, or APIs.** This is a layout and navigation change only. The screen is used on a phone, mid-round, often one-handed and outdoors, so large tap targets and few controls matter more than anything else.

## 1. Priorities
1. See which hole you're on and enter scores (the screen's whole job).
2. Clear a score when needed.
3. Check the scorecard and leaderboard (reachable, but never in the way).

## 2. What to remove from the current screen
- The top **Scorecard / Leaderboard** button row.
- The **"Group"** line (e.g. "5:00 PM · Hole 13 · Dave C / Jason K, …"). The team names are already on the cards.
- The **"Clear both scores"** button.
- The **Cancel** button. Do not add a replacement on this screen.
- The **hamburger** icon on this screen (replaced by the ⋯ menu).
- The "Hole 13 - Par 5" hero card with the pure-blue "BLUE" text. It is unreadable on navy.
- Any progress dots or hole-strip. Do not add them.

## 3. Layout (mockup A)
Top to bottom:
1. **Header:** back chevron (‹) on the left, **HOLE 13** centered (30px, 800 weight, uppercase), **⋯** overflow button on the right (44px tap target). Under the title, a muted subtitle: `Par 5 · ● Blue tees`. The dot is a small circle in the tee color. Never render tee names in pure blue text. Use a light/bright version of the tee color for the dot only.
2. **One score card per team** (two in the current format; keep it data-driven):
   - Team name, uppercase, 15px bold, top left.
   - A muted **Clear** text link, top right, shown **only when a score is set**.
   - Row: large **−** button (84×84px, 18px radius), big centered score (72px, 800 weight), large **+** button (84×84px).
   - Under the score, a small muted label: `Par`, `Birdie`, `Eagle`, `Bogey`, etc., derived from score vs. par.
   - Empty state: muted "–" in place of the number and the hint `Tap + to start at par`.
3. **Bottom bar (pinned to the bottom, thumb zone):**
   - **Leaderboard peek strip:** `Leaderboard` on the left, live position on the right in gold, e.g. `You: 2nd · −2 thru 12 ›`. Tapping opens the bottom sheet (section 5).
   - Below it: a small **‹ previous hole** button (64px wide, outlined) and a large gold **NEXT HOLE** button (flex 1, 18px text, 14px radius, ~60px tall).
   - On hole 18 the primary button reads **Finish round** and goes to the existing completion flow.

## 4. Score entry behavior
- **First tap on + sets the score to par** for that hole (a 5 on a par 5). Subsequent taps increment by 1.
- **First tap on − on an empty score also sets par**, then decrements on later taps. Do not allow a score below 1.
- **Clear** (per team) removes that team's score for the hole and returns the card to the empty state. No confirmation needed.
- Scores save as they change, using the existing save logic. Next/Previous only navigate.
- Navigating between holes keeps the same screen and animates nothing heavy. The header, par, and cards update in place.

## 5. Leaderboard / Scorecard bottom sheet (mockups B and C)
- Opens when the peek strip is tapped. Slides up from the bottom, covers ~80% of the screen over a dimmed scrim. Dismiss by dragging down, tapping the scrim, or tapping the grip handle.
- Top of sheet: a **segmented toggle** with two options, `Leaderboard` and `Scorecard`. The selected segment is gold with navy text.
- **Leaderboard tab:** rank, uppercase team name, score to par in gold. The viewer's own team row has a subtle highlighted background.
- **Scorecard tab:** two tables (holes 1–9 and 10–18). Rows: Hole, Par, and the viewer's team. Birdie or better in **gold**, bogey or worse in **red** (`#ff8a8a`), par in white. Holes not yet played are blank.
- **Tapping a hole column in the scorecard jumps to that hole** on the entry screen and closes the sheet. This is the only way to jump to an arbitrary hole, so include the hint text `Tap any hole to jump back and fix a score.`
- Opening and closing the sheet must never lose unsaved input.

## 6. ⋯ overflow menu (mockup D)
Dropdown anchored under the ⋯ button, dimmed scrim behind, dismiss on outside tap. Items, each with at least a 48px tap height:
1. **Scorecard:** opens the bottom sheet on the Scorecard tab.
2. **Score another group** (with a small gold `ADMIN` badge): **visible to organizers only**. Hide it entirely for regular players.
3. **Clear both scores:** clears every team's score for the current hole.

There is no Cancel round item. If the app needs a way to abandon a round, put it in the admin screens, not here.

## 7. Score another group (admin only) (mockups E and F)
This **replaces the existing organizer-only dropdown** of groups. Remove that dropdown from the score entry screen.

**Picker screen (E):** opened from the ⋯ menu. Full screen with ✕ at top left (returns to the previous entry screen) and the title `Score a group`. Subtitle: current event, format, and `Admin`. A list of group cards, one per group, each showing:
- Tee time and current hole (`5:10 PM · Hole 10`), bold.
- Player names, muted, smaller.
- Right side: status text, `Thru 8 ›`, `Not started ›`, or a muted `Your group` pill for the organizer's own group (still tappable).

Tapping a group opens the **normal score entry screen** for that group, starting on that group's current hole (or hole 1 if not started).

**Other-group mode (F):** identical to the normal entry screen with these differences:
- A **gold banner** under the header: `Scoring: 5:10 PM group` on the left and `Back to mine` on the right. Tapping `Back to mine` returns to the organizer's own group and own hole.
- The leaderboard peek strip is **not** shown. The bottom bar is just the previous and Next hole buttons.
- Header title, par, and tee info reflect the other group's current hole.
- The ⋯ menu still works. Tapping `Score another group` from this mode reopens the picker.

**Permissions:** enforce organizer-only access on the server/API as well as in the UI. Hiding the menu item is not enough.

## 8. Design tokens (same as REDESIGN.md)
```css
--bg:#0d1b3e; --surface-from:#111f45; --surface-to:#1a3068; --divider:#2b3d70;
--text:#fff; --text-muted:#8d9cc4; --text-faint:#5f70a3;
--accent:#f5c518; --danger:#ff8a8a; --sheet-bg:#0a1430; --control-bg:#0a1430;
```
- Cards: 16px radius, 135° gradient from `--surface-from` to `--surface-to`, 16px side margin, 14px gap between cards.
- +/− buttons: `--control-bg` fill, 1px `--divider` border, 18px radius, 40px glyph.
- Everything interactive is at least 44px tall; the main scoring buttons and Next hole are far larger on purpose.

## 9. Acceptance checklist
- [ ] Main screen shows only: header, team score cards, peek strip, previous, Next hole.
- [ ] No progress dots, Group line, Cancel, or Clear-both button on the main screen.
- [ ] First tap on + (or −) from empty sets par.
- [ ] Clear link appears per team only when a score exists.
- [ ] Peek strip opens a sheet with Leaderboard / Scorecard toggle; scorecard columns are tappable to jump to a hole.
- [ ] ⋯ menu contains Scorecard, Score another group (organizers only), Clear both scores.
- [ ] Old organizer-only group dropdown is removed.
- [ ] Other-group mode shows the gold banner and a working `Back to mine`.
- [ ] Organizer-only permission is enforced on the backend.
- [ ] Layout works at 390px wide with no scrolling needed on the entry screen for two teams.
- [ ] Next hole sits in the bottom thumb zone and reads `Finish round` on hole 18.
