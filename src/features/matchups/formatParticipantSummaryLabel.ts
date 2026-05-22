export function formatParticipantSummaryLabel(params: {
  guestCount: number;
  guestNumberingBreakdown?: string;
  isGuest: boolean;
  participantCount: number;
}) {
  if (params.isGuest) {
    return `${params.participantCount}人${
      params.guestNumberingBreakdown ? `（${params.guestNumberingBreakdown}）` : ""
    }`;
  }

  return `${params.participantCount}人（ゲスト${params.guestCount}人）`;
}
