/**
 * Example ballots for the count tool. Each one makes a rule visible: the same
 * ballots, counted under two cities' rules, elect different people.
 */

/**
 * Four voters filled in two names at rank 1 and then ranked Ash second. New York
 * City rules end a ballot at an overvote, so those four never count and Bea wins
 * 10 to 8 in round 2. Minneapolis rules skip the overvoted rank, so the four go to
 * Ash, who wins 12 to 10 and is also the head-to-head winner.
 */
export const OVERVOTE_EXAMPLE = `# Four voters marked Ash and Cal both at rank 1, then Ash at rank 2.
Bea x8
Ash,Cal x6
Cal,Bea x2
Cal,Ash x2
Ash|Cal,Ash x4
`;

/**
 * Bea and Cal tie for last in round 1 with no earlier round to settle it, so the
 * rules' seeded draw decides who goes out, and whoever stays wins with 6 of 10.
 */
export const TIE_EXAMPLE = `# Bea and Cal tie for last in round 1; the tiebreak decides the winner.
Ash x4
Bea,Cal x3
Cal,Bea x3
`;
