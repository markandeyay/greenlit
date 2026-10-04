// Closeness thresholds and game rules (Section 4.3). Import these; never hardcode.

export const RULES = {
  maxGuesses: 10,
  yearClose: 3,                 // years
  boxOfficeGreenPct: 0.10,      // within 10% is green
  boxOfficeCloseRatio: 2.0,     // within 2x is yellow
  scoreClose: 5,                // points on 0-100
  maxSupportingCast: 4,
  hintUnlockAfter: [5, 8],      // guesses
} as const;
