# Requirements: Virtual Partner Random Draw for Team Golf Formats

## 1. Overview

Support team-based golf formats when an event has an odd number of players by allowing one player to be assigned a **Virtual Partner**.

A Virtual Partner is a placeholder teammate whose identity is randomly selected by the application after the round is complete. All players play their own ball and record their individual scores throughout the round.

After the round, the organizer initiates an animated random draw. The application randomly selects an eligible participant, reveals the result through a suspenseful animation, and automatically generates an additional team scorecard using the two players' existing scores.

The Virtual Partner is not a duplicated player or a new registered participant.

**Critical rule:** The selected participant remains on their original team and can win with both their original team and the Virtual Partner team. The player can legitimately finish first and second in the same event. This is intentional behavior.

## 2. Supported Formats

Virtual Partner functionality must support these existing team formats:

- Best Ball
- Low / High / Combo
- High Ball

Reuse the existing scoring engine and format-specific calculations wherever possible. Do not create a separate scoring engine for Virtual Partner teams.

## 3. Pre-Round Setup

When configuring a team-format event:

1. The organizer assigns players to teams using the existing workflow.
2. The organizer can designate one player as having a **Virtual Partner** instead of a regular teammate.
3. Virtual Partner must be an explicit option in the existing team assignment interface.
4. The designation must reference the existing participant, not create a duplicate player, participant, or individual scorecard.
5. The designated player remains on their originally assigned team.
6. The application records the Virtual Partner designation so it can be resolved after the round.

The Virtual Partner should be represented as a placeholder teammate until the draw is completed.

## 4. During the Round

- Every participant plays their own ball and records their individual scores normally.
- The Virtual Partner designation must not change the existing scoring workflow.
- The organizer does not need to identify the Virtual Partner's teammate before or during the round.
- Existing individual scorecards and team assignments remain unchanged.

## 5. Post-Round Random Draw

### 5.1 Initiating the Draw

After the round, the organizer can initiate the draw using a **Draw Virtual Partner** action in the event administration interface.

Before starting, the application must:

1. Identify the player designated as having a Virtual Partner.
2. Retrieve eligible participants from the same round.
3. Exclude the Virtual Partner-designated player from the eligible pool.
4. Validate that at least one eligible participant exists.
5. Display an introduction identifying whose partner is being drawn.

The organizer initiates the process but cannot manually select or influence the outcome.

### 5.2 Random Selection and Persistence

**The application must randomly select and persist the result before the animation begins.**

The selection must be performed using an appropriate randomization method on the trusted backend where available.

Requirements:

- Every eligible participant must have an equal probability of selection.
- The Virtual Partner-designated player must never be eligible to be selected as their own teammate.
- Selection must not be weighted by score, handicap, original team, player order, or any other attribute.
- The selected participant must be a valid participant in the current round.
- The final result must be determined independently of the animation.
- Persist the selected participant and the draw state before starting the reveal.
- Once persisted, the result must not change because of a page refresh, animation restart, navigation, or client-side interaction.

The animation must reveal the already-selected participant. It must never determine the result by randomly choosing a name when the animation stops.

If persistence fails, do not show the draw as completed or proceed as if the result were saved. Provide an appropriate error and allow a safe retry.

### 5.3 Suspenseful Draw Animation

Create a polished, entertaining draw experience designed for a group of golfers watching on a shared screen.

The experience should feel like a live event ceremony rather than a standard application workflow.

Include the following stages:

**Stage 1 — Introduction**

- Display a prominent title such as "Who's Your Partner?"
- Show the Virtual Partner-designated player's name and avatar, if available.
- Build anticipation before starting the name shuffle.

**Stage 2 — Name Shuffle**

- Rapidly cycle through eligible participants' names or player cards.
- Use an animated visual treatment that evokes drawing a name from a hat.
- Make the sequence visually engaging and readable.

**Stage 3 — Suspense Buildup**

- Gradually slow the animation.
- Increase anticipation with pauses, visual emphasis, or other tasteful effects.
- Ensure the timing feels intentional and dramatic rather than mechanical.

**Stage 4 — Dramatic Reveal**

- Reveal the previously persisted participant as the selected teammate.
- Use a prominent visual treatment, such as a spotlight, card flip, or dramatic reveal.
- Make the selected player's name large enough to read from a distance.

**Stage 5 — Celebration**

- Display the completed pairing prominently.
- Use tasteful celebratory effects, such as confetti or a visual flourish.
- Support sound effects only if available and provide a mute option.
- Provide a clear action to continue to the team results or standings.

The interface must work well on desktop, tablet, and a large shared display. Respect reduced-motion preferences where supported, and ensure the draw remains understandable without sound or animation.

### 5.4 Animation Reliability

The animation is a presentation layer only.

- It must use the persisted draw result.
- Reloading or revisiting the page must not generate a new result.
- If the page is refreshed during the animation, the application must recover using the persisted result.
- If the draw was persisted but the animation was interrupted, the application can replay the reveal for presentation purposes without conducting another draw.
- Multiple requests to start the same draw must not create different results.
- Prevent concurrent draw requests from overwriting the selected participant.
- Do not display a successful completion state until the result has been persisted.

### 5.5 Redrawing a Partner

After a draw has been completed, the organizer may need to redraw due to an administrative mistake.

Provide a separate **Redraw Partner** action.

- Require explicit confirmation before redrawing.
- Clearly communicate that the existing selection will be replaced.
- Generate and persist a new random selection using the same eligibility rules.
- Log the redraw, including the previous selection, new selection, timestamp, and organizer identity where available.
- Replace the existing Virtual Partner team result instead of creating a duplicate team or scorecard.
- Recalculate the standings after the new selection is applied.

Simply revisiting the draw page or clicking the original Draw Virtual Partner action must never trigger a redraw.

## 6. Virtual Partner Scorecard Generation

Once the random draw result has been persisted, generate the additional team scorecard using the existing scoring infrastructure.

The scorecard must:

1. Associate the Virtual Partner-designated player with the randomly selected teammate.
2. Reference both players' existing individual scorecards.
3. Calculate the team result using the selected event's existing format rules.
4. Preserve both players' original team assignments and individual scores.
5. Associate the generated team result with the Virtual Partner team.
6. Recalculate the standings to include the additional team result.

Use the existing format-specific scoring logic for Best Ball, Low / High / Combo, and High Ball.

Do not duplicate individual player records, participants, or individual round scorecards.

## 7. Standings and Results

The Virtual Partner team must appear in the standings using the same ranking and tie-breaking rules as other teams.

The selected teammate remains eligible for their original team's result and the Virtual Partner team's result.

The system must support the following outcomes:

- The selected player wins with their original team.
- The selected player wins with the Virtual Partner team.
- The selected player finishes first and second in the same event.
- The same participant appears on two team scorecards without being duplicated as a player.

Do not enforce exclusive team membership in a way that prevents this feature from working.

The Virtual Partner team must be treated as an additional team result, not as a reassignment of the selected player's existing team membership.

## 8. Data Integrity and Recalculation

- Individual scorecards remain the source of truth for player scores.
- Store the Virtual Partner designation, persisted draw result, and team scoring relationships using the existing data model where appropriate.
- Ensure a participant can contribute to multiple team scorecards without duplicating the participant or individual score data.
- Generate the Virtual Partner team scorecard idempotently.
- Repeated saves, page refreshes, and recalculations must not create duplicate team results.
- If individual scores change after the draw, recalculate the Virtual Partner team's result and standings.
- If the selected teammate is changed through an authorized redraw, replace the previous result and recalculate standings.
- If the Virtual Partner designation is removed or the draw is administratively cleared, invalidate the associated team result and update the standings.
- Use appropriate transaction handling and concurrency controls so the draw result and its associated team result cannot become inconsistent.

## 9. Acceptance Criteria

### Setup and scoring

1. The organizer can designate a player as having a Virtual Partner during event setup.
2. The designation does not create a duplicate player, participant, or individual scorecard.
3. All participants play and record scores using the existing individual scoring workflow.
4. The feature supports Best Ball, Low / High / Combo, and High Ball.

### Random draw

5. The organizer can initiate the draw but cannot manually choose the teammate.
6. The application randomly selects an eligible participant from the same round.
7. The Virtual Partner-designated player is excluded from the selection.
8. Every eligible participant has an equal chance of selection.
9. The result is persisted before the animation begins.
10. The animation reveals the persisted result and cannot influence the selection.
11. Refreshing or reopening the event preserves the selected participant.
12. An interrupted animation can recover without selecting a new participant.
13. Duplicate or concurrent requests cannot accidentally produce conflicting draw results.
14. Redrawing requires explicit confirmation and replaces the existing result.

### Scorecard and standings

15. The application generates an additional team scorecard using the two existing individual scorecards.
16. The selected teammate remains on their original team.
17. The Virtual Partner team appears in the standings with the correct score.
18. A participant can legitimately finish first and second in the event.
19. Changes to individual scores update the Virtual Partner team result.
20. Repeated recalculations do not create duplicate team results.
21. Removing or replacing a Virtual Partner result updates the standings correctly.

## 10. Implementation Guidance for Cursor

Before implementing, inspect the existing:

- Team assignment and event configuration models.
- Participant and individual scorecard relationships.
- Team scorecard generation workflow.
- Format-specific scoring calculations.
- Standings and tie-breaking logic.
- Event administration interface and existing animation or modal patterns.

Implement this feature by extending the current architecture wherever possible.

Prioritize correct data relationships, reliable random selection, persisted draw results, idempotent scorecard generation, and standings integrity. Build the animated draw as a presentation layer on top of the persisted result.

Do not introduce a separate scoring engine, duplicate participant records, or change the behavior of existing events that do not use a Virtual Partner.

Before finishing, test the random draw, refresh recovery, redraw workflow, scoring calculations, and standings with realistic odd-player-count events.