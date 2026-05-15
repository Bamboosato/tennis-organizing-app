export function formatGuestNumberingBreakdown(femaleCount: number, maleCount: number) {
  const ranges: string[] = [];

  if (femaleCount > 0) {
    ranges.push(`${formatNumberRange(1, femaleCount)}：女性`);
  }

  if (maleCount > 0) {
    ranges.push(`${formatNumberRange(femaleCount + 1, femaleCount + maleCount)}：男性`);
  }

  return ranges.join("、");
}

export function formatNumberRange(start: number, end: number) {
  return start === end ? `${start}` : `${start}-${end}`;
}
