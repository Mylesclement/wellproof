// The trust score weights. Change them here; every screen and the formula
// text shown to users read from this one object.
//
//   score = completeness × 40  +  within range × 60  −  5 per open flag (max 30)
export const SCORE = {
  completenessWeight: 40,
  withinRangeWeight: 60,
  penaltyPerOpenFlag: 5,
  maxPenalty: 30,
  // The score covers this many full days, ending yesterday. Today is left
  // out because its readings are usually not all in yet.
  periodDays: 14,
  grades: [
    { min: 85, label: "Strong" },
    { min: 70, label: "Fair" },
    { min: 0, label: "Needs work" },
  ],
} as const;

export const SCORE_FORMULA = `${SCORE.completenessWeight} × completeness + ${SCORE.withinRangeWeight} × steps within range − ${SCORE.penaltyPerOpenFlag} per unexplained flag (max ${SCORE.maxPenalty})`;
