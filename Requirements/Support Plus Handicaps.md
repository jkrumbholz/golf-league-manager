# **Golf League Handicap & Tiebreaker Requirements**

## **1\. Overview**

Enhance the golf league application to support:

1. Standard handicaps.  
2. Plus handicaps.  
3. Handicap stroke allocation for any set of holes being played.  
4. 9-hole and 18-hole handicap calculations.  
5. Event-specific handicap adjustments.  
6. Clear scorecard indicators for strokes received and strokes given back.  
7. Deterministic event tiebreakers.  
8. A "Show Tiebreaker" UI that clearly explains exactly how a tie was resolved.

The implementation should preserve all existing functionality for standard handicaps while extending the system to correctly support plus handicaps.

The most important design principle is:

> **Do not confuse the physical hole number with the hole's handicap/stroke index.**

A hole can be physical hole 18 while being handicap \#1, \#18, or anything in between.

All handicap allocation must use the handicap/stroke index assigned to the actual holes being played.

---

# **2\. Handicap Concepts**

The application currently supports standard handicaps.

A standard handicap means the player **receives strokes**.

Example:

Handicap: 5  
Gross Score: 77  
Net Score: 72

A plus handicap means the player **gives strokes back**.

Example:

Handicap: \+2  
Gross Score: 72  
Net Score: 74

Therefore:

* Standard handicap → strokes are subtracted from gross score.  
* Plus handicap → strokes are added to gross score.

The application must explicitly understand the difference between these two types.

---

# **3\. Handicap Input**

Users should be able to enter handicaps naturally.

Examples:

1  
2  
5  
10.4  
\+1  
\+1.4  
\+2  
\+4.5

Interpretation:

1.4  \= standard handicap  
\+1.4 \= plus handicap

The user should NOT need to enter a negative number to represent a plus handicap.

For example:

\-1.4

should not be required or interpreted as the preferred representation of a \+1.4 handicap.

The application should preserve the plus sign when displaying the handicap.

For example:

\+1.4

must not subsequently be displayed as:

1.4  
---

# **4\. Internal Handicap Representation**

The implementation must preserve the distinction between:

* Handicap direction/type.  
* Handicap magnitude.

Conceptually, a handicap should be represented as something equivalent to:

{  
  value: 1.4,  
  type: "PLUS"  
}

or:

{  
  value: 1.4,  
  isPlus: true  
}

A standard handicap would be:

{  
  value: 1.4,  
  type: "STANDARD"  
}

The exact implementation should follow the application's existing architecture.

However, do NOT simply convert a plus handicap to a negative number and allow unrelated existing logic to interpret it.

The application must know whether the player is:

* Receiving strokes.  
* Giving strokes.

---

# **5\. Net Score Calculation**

## **Standard Handicap**

A standard handicap reduces the player's gross score.

Example:

Gross: 77  
Handicap: 5

Net: 72

Conceptually:

net \= gross \- strokesReceived

## **Plus Handicap**

A plus handicap increases the player's net score.

Example:

Gross: 72  
Handicap: \+2

Net: 74

Conceptually:

net \= gross \+ strokesGiven

The final net score must equal the sum of the hole-level net scores.

---

# **6\. Hole Number vs. Handicap/Stroke Index**

This distinction is critical.

Every hole has:

* A physical hole number.  
* A handicap/stroke index.

For example:

| Hole | Handicap |
| ----- | ----- |
| 1 | 11 |
| 2 | 5 |
| 3 | 17 |
| 4 | 3 |
| 5 | 9 |
| 6 | 1 |
| 7 | 15 |
| 8 | 7 |
| 9 | 13 |

The physical hole number is not the same as the handicap ranking.

For example:

Hole 3 \= Handicap \#17

means Hole 3 is one of the easiest holes on the course.

The application must use the handicap/stroke index when determining which holes receive or give strokes.

---

# **7\. Determining Hardest and Easiest Played Holes**

The application must determine difficulty **only among the holes actually being played**.

This is particularly important for 9-hole events.

Do NOT assume that a 9-hole event uses handicap rankings \#1 through \#9.

For example, suppose a 9-hole event plays holes 1–9 and the handicap rankings are:

| Hole | Handicap |
| ----- | ----- |
| 1 | 11 |
| 2 | 5 |
| 3 | 17 |
| 4 | 3 |
| 5 | 9 |
| 6 | 1 |
| 7 | 15 |
| 8 | 7 |
| 9 | 13 |

The easiest played holes are:

1. Hole 3 — Handicap \#17  
2. Hole 7 — Handicap \#15  
3. Hole 9 — Handicap \#13  
4. Hole 1 — Handicap \#11  
5. Hole 5 — Handicap \#9  
6. Hole 8 — Handicap \#7  
7. Hole 2 — Handicap \#5  
8. Hole 4 — Handicap \#3  
9. Hole 6 — Handicap \#1

Therefore:

**Hole 3 is the easiest hole in this 9-hole event.**

It is NOT handicap \#9.

This logic must work for any combination of holes.

---

# **8\. Standard Handicap Stroke Allocation**

Standard handicaps receive strokes beginning with the hardest holes **among the holes being played**.

Algorithm:

1. Identify all holes included in the event.  
2. Retrieve the handicap/stroke index for each played hole.  
3. Sort the played holes from hardest to easiest.  
4. Allocate strokes beginning with the hardest played hole.

Example:

Played holes:  
1, 2, 3, 4, 5, 6, 7, 8, 9

Using the example above, the hardest played holes are:

Hole 6 → Handicap \#1  
Hole 4 → Handicap \#3  
Hole 2 → Handicap \#5  
Hole 8 → Handicap \#7  
Hole 5 → Handicap \#9  
...

A player receiving 2 strokes therefore gets strokes on:

Hole 6  
Hole 4

NOT necessarily physical holes 1 and 2\.

---

# **9\. Plus Handicap Stroke Allocation**

Plus handicaps work in the opposite direction.

A plus handicap gives strokes back beginning with the easiest holes **among the holes being played**.

Algorithm:

1. Identify all holes included in the event.  
2. Retrieve the handicap/stroke index for each played hole.  
3. Sort the played holes from easiest to hardest.  
4. Allocate plus strokes beginning with the easiest played hole.

Because higher handicap numbers represent easier holes:

Higher handicap number \= easier hole  
Lower handicap number \= harder hole

But only consider holes included in the event.

---

# **10\. Plus Handicap Example — 9 Holes**

Using:

| Hole | Handicap |
| ----- | ----- |
| 1 | 11 |
| 2 | 5 |
| 3 | 17 |
| 4 | 3 |
| 5 | 9 |
| 6 | 1 |
| 7 | 15 |
| 8 | 7 |
| 9 | 13 |

The easiest played holes are:

Hole 3 → \#17  
Hole 7 → \#15  
Hole 9 → \#13  
Hole 1 → \#11  
Hole 5 → \#9  
...

Therefore:

### **\+1**

Stroke given back on:

Hole 3

### **\+2**

Strokes given back on:

Hole 3  
Hole 7

### **\+3**

Strokes given back on:

Hole 3  
Hole 7  
Hole 9

The system must NOT automatically assign \+1 to handicap \#9 simply because the event has nine holes.

---

# **11\. Events Playing Holes 10–18**

The same logic applies when an event plays holes 10–18.

For example:

| Hole | Handicap |
| ----- | ----- |
| 10 | 2 |
| 11 | 14 |
| 12 | 6 |
| 13 | 18 |
| 14 | 4 |
| 15 | 12 |
| 16 | 8 |
| 17 | 16 |
| 18 | 10 |

The easiest played holes are:

Hole 13 → \#18  
Hole 17 → \#16  
Hole 11 → \#14  
Hole 15 → \#12  
...

Therefore a \+2 handicap gives strokes on:

Hole 13  
Hole 17

The logic must be based on the actual holes and their handicap rankings.

---

# **12\. Arbitrary 9-Hole Hole Selections**

The implementation must support any nine holes.

Examples:

1-9  
10-18  
1,2,3,10,11,12,13,17,18

Do not hard-code logic based on:

* Hole numbers 1–9.  
* Handicap numbers 1–9.  
* Hole numbers 10–18.

The system must dynamically determine the difficulty order from the holes included in the event.

---

# **13\. 9-Hole Handicap Conversion**

When converting an 18-hole handicap to a 9-hole event, first convert the handicap to the appropriate 9-hole value according to the application's existing handicap rules.

Example:

18-hole handicap: \+4  
9-hole handicap: \+2

The resulting \+2 is then allocated to the two easiest holes **among the holes being played**.

It does NOT mean:

Handicap \#9  
Handicap \#8

unless those happen to be the two easiest holes in the selected nine.

Likewise, a standard 2 handicap receives strokes on the two hardest holes among the selected nine.

---

# **14\. Event Handicap Adjustments**

Events may apply an additional percentage or adjustment to a player's handicap.

The same logic must apply to both standard and plus handicaps.

The conceptual order is:

1. Start with the player's handicap.  
2. Convert it to the number of holes being played.  
3. Apply the event-specific handicap percentage/adjustment.  
4. Determine the resulting number of strokes.  
5. Allocate the strokes based on handicap direction and the actual holes being played.

## **Example — Plus Handicap**

Handicap: \+4  
Event: 9 holes  
Adjustment: 50%

Calculation:

\+4 / 2 \= \+2

\+2 × 50% \= \+1

Final handicap:

\+1

The player gives one stroke back on the easiest hole among the nine being played.

---

## **Example — Standard Handicap**

Handicap: 4  
Event: 9 holes  
Adjustment: 50%

Calculation:

4 / 2 \= 2

2 × 50% \= 1

Final handicap:

1

The player receives one stroke on the hardest hole among the nine being played.

---

# **15\. Fractional Handicaps and Rounding**

The application may already have established rules for rounding fractional handicaps.

Those existing rules should be preserved unless there is an explicit reason to change them.

Examples that may need to be handled:

\+3.5  
\+1.4  
3.5  
1.4

The system must apply the same established rounding conventions consistently to standard and plus handicaps.

Do not silently introduce a new rounding rule.

Document or preserve the existing behavior.

Most importantly, the plus/minus direction must never be lost during:

* Conversion.  
* Adjustment.  
* Rounding.  
* Storage.  
* Display.  
* Stroke allocation.

---

# **16\. Scorecard Stroke Indicators**

The scorecard should visually communicate whether a player receives or gives a stroke on a particular hole.

## **Standard Handicap**

When the player receives a stroke:

**Display a gold dot.**

Conceptually:

Hole 4  
Score: 4  
●

The gold dot represents:

> Player receives one stroke on this hole.

## **Plus Handicap**

When the player gives a stroke back:

**Display a gold "+" in the same location where the dot would normally appear.**

Conceptually:

Hole 9  
Score: 4  
\+

The gold `+` represents:

> Player gives one stroke back on this hole.

Do not use a gold dot for a stroke being given back.

Do not use a minus sign.

The distinction should be:

Gold dot \= stroke received  
Gold \+   \= stroke given

The indicator must appear on the actual physical hole where the stroke is allocated.

---

# **17\. Hole-Level Net Scores**

Hole-level scoring must reflect the direction of the handicap.

Standard example:

Gross: 5  
Receives stroke  
Net: 4

Plus example:

Gross: 4  
Gives stroke  
Net: 5

The sum of all hole-level net scores must equal the player's final net score.

Example:

Gross: 72  
Plus handicap: \+2  
Net: 74  
---

# **18\. Team Events**

The handicap functionality must continue to work with team events.

The exact team scoring logic should follow the application's existing event format.

When a team handicap is applicable, the implementation must clearly determine:

* Whether the handicap belongs to the individual player.  
* Whether the event combines player handicaps.  
* How the resulting team handicap is applied.

Do not change existing team scoring rules unless necessary to support plus handicaps.

Any existing team handicap calculation must be reviewed to ensure plus handicaps are handled correctly.

A plus handicap must never accidentally become a standard handicap when contributing to a team handicap.

---

# **19\. Event Tiebreaker**

The event must have a deterministic scorecard tiebreaker for both individual and team events.

If two or more competitors finish with the same final event score, use the following hierarchy.

## **Tiebreaker \#1 — Last 4 Holes**

Compare the combined score on:

Holes 6, 7, 8, 9

The lowest score wins.

For example:

Player A: 14  
Player B: 15

Player A wins.

## **Tiebreaker \#2 — Last 3 Holes**

If still tied, compare:

Holes 7, 8, 9

The lowest score wins.

## **Tiebreaker \#3 — Handicap Order**

If still tied, compare individual hole scores in handicap/stroke-index order:

Handicap \#1  
Handicap \#2  
Handicap \#3  
...  
Handicap \#9

The first handicap-ranked hole where the scores differ determines the winner.

---

# **20\. Tiebreaker Hole Mapping**

The tiebreaker must also distinguish between:

* Physical hole number.  
* Handicap/stroke index.

For example:

| Hole | Handicap |
| ----- | ----- |
| 1 | 7 |
| 2 | 3 |
| 3 | 9 |
| 4 | 1 |
| 5 | 5 |
| 6 | 8 |
| 7 | 2 |
| 8 | 6 |
| 9 | 4 |

The handicap comparison order is:

Hole 4 → \#1  
Hole 7 → \#2  
Hole 2 → \#3  
Hole 9 → \#4  
Hole 5 → \#5  
Hole 8 → \#6  
Hole 1 → \#7  
Hole 6 → \#8  
Hole 3 → \#9

Do not compare physical holes 1–9 in numerical order.

---

# **21\. Tiebreaker and Handicap Direction**

The tiebreaker is independent of whether the competitor has:

* A standard handicap.  
* A plus handicap.

The tiebreaker is based on the applicable event scores and the course's handicap/stroke-index ranking.

A plus handicap does NOT reverse the handicap ranking used by the tiebreaker.

For example:

Handicap \#1 remains Handicap \#1  
Handicap \#2 remains Handicap \#2  
...

regardless of whether a player is \+2, 5, or scratch.

---

# **22\. Multiple-Way Ties**

The system must support two-way and multi-way ties.

Example:

Player A: 36  
Player B: 36  
Player C: 36  
Player D: 37

Only A, B, and C enter the tiebreaker.

Suppose:

A: Last 4 \= 15  
B: Last 4 \= 16  
C: Last 4 \= 16

A finishes ahead.

B and C remain tied and continue to the next tiebreaker.

If:

B: Last 3 \= 11  
C: Last 3 \= 12

B finishes ahead of C.

The algorithm must resolve ties progressively rather than simply comparing everyone against the original winner.

---

# **23\. Tiebreaker Algorithm**

Conceptually:

1\. Sort competitors by final event score.

2\. Identify groups with identical scores.

3\. For each tied group:

   a. Compare last 4 holes (6-9).

   b. If still tied, compare last 3 holes (7-9).

   c. If still tied, compare individual hole scores  
      in handicap/stroke-index order.

4\. Continue until all possible ties are resolved.

5\. Produce a deterministic final ranking.

The result must not depend on:

* Database retrieval order.  
* Array order.  
* Player ID.  
* Name.  
* Any incidental ordering.

Unless the application has a separately defined final fallback rule, equal competitors should remain tied if every defined tiebreaker criterion is identical.

---

# **24\. "Show Tiebreaker" / "Show Your Work" UI**

Because the tiebreaker can affect standings, users need to be able to see exactly how the tie was resolved.

Whenever a competitor's finishing position was determined or affected by a tiebreaker, provide a control such as:

**Show Tiebreaker**

"Show Tiebreaker" is the preferred wording because it is immediately understandable.

This can be a button, link, or equivalent control depending on the existing UI.

If there was no tie, there is no reason to display the control.

---

# **25\. Tiebreaker Explanation Modal**

Clicking "Show Tiebreaker" should open a modal/pop-up or equivalent UI.

The explanation should show:

1. The competitors involved in the tie.  
2. Their final event scores.  
3. Each tiebreaker criterion that was required.  
4. The scores used for each criterion.  
5. Which criteria remained tied.  
6. The exact criterion that ultimately broke the tie.  
7. The resulting finishing order.

The goal is transparency.

A normal league participant should be able to read the explanation and understand exactly why one player finished ahead of another.

---

# **26\. Tiebreaker Example**

Example:

Tiebreaker

Jason and Mike both finished with a score of 36\.

Last 4 holes (6-9)

Jason: 15  
Mike: 15

Still tied.

Last 3 holes (7-9)

Jason: 11  
Mike: 12

Jason wins the tiebreaker.

The UI should clearly identify that the first criterion where the scores differ determines the result.

---

# **27\. Handicap-Based Tiebreaker Example**

If the last 4 and last 3 are tied:

Tiebreaker

Jason and Mike both finished with a score of 36\.

Last 4 holes (6-9)

Jason: 15  
Mike: 15

Still tied.

Last 3 holes (7-9)

Jason: 12  
Mike: 12

Still tied.

Handicap \#1 — Hole 4

Jason: 4  
Mike: 4

Still tied.

Handicap \#2 — Hole 7

Jason: 3  
Mike: 4

Jason wins the tiebreaker.

The actual physical hole number should be shown alongside the handicap ranking.

This is important because it lets the user understand exactly which hole was used.

---

# **28\. Multiple-Way Tiebreaker UI**

The UI must also accurately explain multi-way ties.

Example:

Tiebreaker

Jason, Mike, and Steve all finished with a score of 36\.

Last 4 holes (6-9)

Jason: 15  
Mike: 16  
Steve: 16

Jason wins 1st place.

Mike and Steve remain tied.

Last 3 holes (7-9)

Mike: 11  
Steve: 12

Mike wins 2nd place.

Final result:

1\. Jason  
2\. Mike  
3\. Steve

The explanation should reflect the actual progressive tie-breaking process.

Do not simply display a generic message saying that "scorecard tiebreaker was used."

---

# **29\. Tiebreaker Source of Truth**

The tiebreaker calculation and the UI explanation must use the **same underlying logic and result**.

Do not implement one version of the logic for standings and a second version for the popup.

The tiebreaker calculation should produce enough structured information to explain the result.

Conceptually:

{  
  ranking: ...,

  comparisons: \[  
    {  
      criterion: "last\_4\_holes",  
      description: "Last 4 holes (6-9)",  
      scores: ...,  
      result: "tie"  
    },  
    {  
      criterion: "last\_3\_holes",  
      description: "Last 3 holes (7-9)",  
      scores: ...,  
      result: "winner"  
    }  
  \]  
}

The exact structure should follow the application's architecture.

The important requirement is that:

> **The UI must consume the tiebreaker engine's explanation rather than independently recreating the calculation.**

This ensures the standings and "Show Tiebreaker" UI can never disagree.

---

# **30\. Missing or Invalid Scores**

A missing score must never silently be treated as zero for handicap or tiebreaker purposes.

If a required score is missing or invalid, use the application's existing score-validation behavior.

Ideally, competitors should not be eligible for final standings until all required scores are valid.

---

# **31\. Shared Calculation Logic**

Where possible, centralize handicap calculations so that the same logic is used by:

* Scorecard display.  
* Hole-level net scores.  
* Total net score.  
* Event standings.  
* Team calculations.  
* Tiebreakers where applicable.  
* "Show Tiebreaker" explanation.

Avoid duplicating handicap allocation rules in multiple components.

A change to the handicap rules should have one authoritative implementation.

---

# **32\. Important Edge Cases**

The implementation must account for:

* Standard whole-number handicaps.  
* Standard decimal handicaps.  
* Plus whole-number handicaps.  
* Plus decimal handicaps.  
* Scratch/zero handicap.  
* 9-hole events.  
* 18-hole events.  
* Events using holes 1–9.  
* Events using holes 10–18.  
* Events using arbitrary combinations of holes.  
* Event handicap percentages.  
* Handicap values greater than the number of holes.  
* Plus handicaps greater than the number of holes.  
* Fractional handicap results.  
* Multiple strokes on a hole where required.  
* Multiple-way ties.  
* Missing scores.  
* Invalid scores.

Do not introduce a new rounding convention without first checking the application's existing behavior.

---

# **33\. Acceptance Criteria**

## **Handicap Input**

* `1.4` is accepted as a standard handicap.  
* `+1.4` is accepted as a plus handicap.  
* The plus sign is preserved when displayed.  
* Users do not need to enter a negative number to represent a plus handicap.

## **Handicap Scoring**

* Standard handicaps reduce gross scores.  
* Plus handicaps increase gross scores.  
* Hole-level net scores are correct.  
* Total net scores equal the sum of hole-level net scores.

## **Standard Stroke Allocation**

* Standard handicaps receive strokes on the hardest played holes.  
* Stroke allocation uses handicap/stroke index.  
* Physical hole number is not used as the difficulty ranking.  
* The system only considers holes included in the event.

## **Plus Stroke Allocation**

* Plus handicaps give strokes on the easiest played holes.  
* Higher handicap numbers are considered easier.  
* The system only considers holes included in the event.  
* A 9-hole event does not automatically use handicap rankings 1–9.  
* A \+1 goes to the easiest actual hole being played.  
* A \+2 goes to the two easiest actual holes being played.  
* This works for any nine-hole combination.  
* This works for 18-hole events.

## **Handicap Conversion**

* 18-hole handicaps can be converted to 9-hole handicaps.  
* \+4 becomes \+2 for a standard 9-hole conversion.  
* A \+4 with a 50% event adjustment on 9 holes becomes \+1.  
* The resulting stroke is allocated to the easiest actual hole being played.  
* Standard handicaps follow the same conversion principle in the opposite direction.

## **Scorecard**

* A gold dot indicates a stroke received.  
* A gold "+" indicates a stroke given back.  
* Indicators appear on the correct physical holes.  
* The indicator logic uses the same handicap allocation engine as scoring.

## **Tiebreakers**

* Total event score is the primary ranking.  
* Last 4 holes (6–9) are the first tiebreaker.  
* Last 3 holes (7–9) are the second tiebreaker.  
* Handicap \#1 through \#9 are then compared.  
* Handicap rankings map to actual physical holes.  
* Two-way ties work.  
* Three-way and larger ties work.  
* Tiebreaker behavior is deterministic.  
* Database or array ordering cannot affect the result.

## **Tiebreaker Transparency**

* A "Show Tiebreaker" control appears when appropriate.  
* Clicking it opens a modal/pop-up or equivalent.  
* The tied competitors are shown.  
* Their final scores are shown.  
* Each required comparison is shown.  
* Last-4 and last-3 calculations are shown when applicable.  
* Handicap-ranked comparisons show both handicap rank and physical hole number.  
* The exact comparison that broke the tie is clearly identified.  
* Multi-way ties are explained correctly.  
* The UI uses the same calculation result as the standings.  
* Tiebreaker logic is not independently duplicated in the UI.

---

# **34\. Implementation Guidance**

Before changing code:

1. Locate the existing handicap data model.  
2. Locate the existing handicap input/display logic.  
3. Locate the existing 9-hole/18-hole handicap conversion.  
4. Locate the existing event handicap adjustment logic.  
5. Locate the existing hole handicap/stroke-index data.  
6. Locate the existing hole-level net score calculation.  
7. Locate the existing standings/ranking calculation.  
8. Locate the existing scorecard UI.  
9. Locate the existing event/team scoring logic.  
10. Determine the existing rounding behavior for fractional handicaps.

Then implement the new functionality using the existing architecture wherever practical.

Avoid unnecessary rewrites.

The goal is to **extend the existing handicap system safely**, not replace unrelated functionality.

Before considering the work complete, test both standard and plus handicaps using:

* 9-hole events.  
* 18-hole events.  
* Different hole selections.  
* Different handicap rankings.  
* Event handicap adjustments.  
* Fractional handicaps.  
* Individual events.  
* Team events.  
* Ties.

The most important test case is a 9-hole event where the easiest physical hole is **not handicap \#9**. The system must allocate a plus stroke to the actual easiest hole being played based on its course handicap/stroke index.

