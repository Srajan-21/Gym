export function formatSetDisplay(
  exerciseName: string | undefined,
  weightKg: number,
  reps: number
): string {
  const lower = (exerciseName ?? '').toLowerCase();
  const isPlank = lower.includes('plank');
  const isCardioTime =
    lower.includes('walking') ||
    lower.includes('cycling') ||
    lower.includes('cardio') ||
    lower.includes('running') ||
    lower.includes('treadmill');

  if (reps === 0) {
    return weightKg > 0 ? `${weightKg}kg × 0 (Not done)` : '0 (Not done)';
  }

  const unitSuffix = isPlank ? ' sec' : isCardioTime ? ' min' : '';
  if (weightKg > 0) {
    return `${weightKg}kg × ${reps}${unitSuffix}`;
  }
  return `${reps}${unitSuffix}`;
}
