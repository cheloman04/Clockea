export type Outcome = 'achieved' | 'partial' | 'missed';

export const OUTCOME_CONFIG: Record<Outcome, { label: string; color: string; hint: string }> = {
  achieved: { label: 'Achieved',           color: '#4ade80', hint: 'Completed as planned' },
  partial:  { label: 'Partially Achieved', color: '#fe7f2d', hint: 'Made progress, not done' },
  missed:   { label: 'Not Achieved',       color: '#EF4444', hint: 'Did not reach the goal' },
};

export const OUTCOMES = (Object.keys(OUTCOME_CONFIG) as Outcome[]).map((value) => ({
  value,
  ...OUTCOME_CONFIG[value],
}));
