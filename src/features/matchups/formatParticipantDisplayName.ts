export type ParticipantGender = "female" | "male";

const GENDER_MARKS: Record<ParticipantGender, string> = {
  female: "♀",
  male: "♂",
};

export function formatParticipantDisplayName(participant: { name: string; gender?: ParticipantGender }) {
  const mark = participant.gender ? GENDER_MARKS[participant.gender] : "";

  return `${participant.name}${mark}`;
}
