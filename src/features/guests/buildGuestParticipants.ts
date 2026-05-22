export type GuestParticipant = {
  id: string;
  name: string;
  gender: "female" | "male";
};

type GuestParticipantNameStyle = "numberWithGender" | "guestNickname";

type BuildGuestParticipantsOptions = {
  idPrefix?: string;
  nameStyle?: GuestParticipantNameStyle;
};

export function buildGuestParticipants(
  femaleCount: number,
  maleCount: number,
  options: BuildGuestParticipantsOptions = {},
): GuestParticipant[] {
  const participants: GuestParticipant[] = [];
  const totalCount = femaleCount + maleCount;
  const idPrefix = options.idPrefix ?? "guest";
  const nameStyle = options.nameStyle ?? "numberWithGender";

  for (let index = 0; index < totalCount; index += 1) {
    const gender = index < femaleCount ? "female" : "male";
    const displayNumber = String(index + 1).padStart(2, "0");

    participants.push({
      id: `${idPrefix}-${displayNumber}`,
      name: formatGuestParticipantName(displayNumber, gender, nameStyle),
      gender,
    });
  }

  return participants;
}

function formatGuestParticipantName(
  displayNumber: string,
  gender: GuestParticipant["gender"],
  nameStyle: GuestParticipantNameStyle,
) {
  if (nameStyle === "guestNickname") {
    return `ゲスト-${displayNumber}`;
  }

  return `${displayNumber}${gender === "female" ? "F" : "M"}`;
}
