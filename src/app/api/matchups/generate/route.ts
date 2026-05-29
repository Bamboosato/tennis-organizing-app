import { NextResponse } from "next/server";

type MatchupMode = "standard" | "sameGenderPriority" | "mixedDoublesPriority";
type MatchFormat = "doubles" | "singles";
type ParticipantInput = {
  id: string;
  name: string;
  gender?: "female" | "male";
};
type GenerateRequest = {
  eventName?: string;
  matchFormat: MatchFormat;
  matchupMode?: MatchupMode;
  participantCount: number;
  participants: ParticipantInput[];
  courtCount: number;
  roundCount: number;
};

const MATCH_FORMATS = new Set(["doubles", "singles"]);
const MATCHUP_MODES = new Set(["standard", "sameGenderPriority", "mixedDoublesPriority"]);

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "リクエスト形式を確認してください。", 400);
  }

  const validation = validateGenerateRequest(body);
  if (!validation.ok) {
    return errorResponse("VALIDATION_ERROR", validation.message, 422);
  }

  const apiKey = process.env.MATCHUP_API_KEY;
  const baseUrl = process.env.MATCHUP_API_BASE_URL || "https://tennis-matchup-app.vercel.app";

  if (!apiKey) {
    return errorResponse("SERVER_CONFIGURATION_ERROR", "対戦表APIキーが設定されていません。", 500);
  }

  try {
    const upstreamResponse = await fetch(new URL("/api/v1/matchups/generate", baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(validation.value),
      cache: "no-store",
    });
    const upstreamBody = await readJson(upstreamResponse);

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        upstreamBody || {
          error: {
            code: "MATCHUP_API_ERROR",
            message: "対戦表APIでエラーが発生しました。",
          },
        },
        { status: upstreamResponse.status },
      );
    }

    const responseValidationMessage = validateUpstreamResponse(validation.value, upstreamBody);
    if (responseValidationMessage) {
      return errorResponse("MATCHUP_API_RESPONSE_INVALID", responseValidationMessage, 502);
    }

    return NextResponse.json(upstreamBody);
  } catch {
    return errorResponse("MATCHUP_API_UNREACHABLE", "対戦表APIに接続できませんでした。", 502);
  }
}

function validateGenerateRequest(body: unknown): { ok: true; value: GenerateRequest } | { ok: false; message: string } {
  if (!isRecord(body)) {
    return { ok: false, message: "入力内容を確認してください。" };
  }

  const matchFormat = typeof body.matchFormat === "string" ? body.matchFormat : "doubles";
  const matchupMode = typeof body.matchupMode === "string" ? body.matchupMode : "standard";
  const participantCount = typeof body.participantCount === "number" ? body.participantCount : NaN;
  const participants = body.participants;
  const courtCount = typeof body.courtCount === "number" ? body.courtCount : NaN;
  const roundCount = typeof body.roundCount === "number" ? body.roundCount : NaN;

  if (!MATCH_FORMATS.has(matchFormat)) {
    return { ok: false, message: "対戦形式を確認してください。" };
  }

  if (!MATCHUP_MODES.has(matchupMode)) {
    return { ok: false, message: "対戦モードを確認してください。" };
  }

  const minParticipantCount = matchFormat === "singles" ? 2 : 4;

  if (!Number.isInteger(participantCount) || participantCount < minParticipantCount || participantCount > 30) {
    return { ok: false, message: `参加者は${minParticipantCount}人以上30人以下にしてください。` };
  }

  if (!Array.isArray(participants) || participants.length !== participantCount) {
    return { ok: false, message: "参加者一覧を確認してください。" };
  }

  if (!Number.isInteger(courtCount) || courtCount < 1 || courtCount > 8) {
    return { ok: false, message: "コート数は1面以上8面以下にしてください。" };
  }

  if (!Number.isInteger(roundCount) || roundCount < 1 || roundCount > 20) {
    return { ok: false, message: "実施回数は1回以上20回以下にしてください。" };
  }

  const normalizedParticipants: ParticipantInput[] = [];
  for (const participant of participants) {
    if (!isRecord(participant) || typeof participant.id !== "string" || typeof participant.name !== "string") {
      return { ok: false, message: "参加者一覧を確認してください。" };
    }

    const id = participant.id.trim();
    const name = participant.name.trim();
    const gender = participant.gender;

    if (!id || !name) {
      return { ok: false, message: "参加者名を確認してください。" };
    }

    if (gender !== undefined && gender !== "female" && gender !== "male") {
      return { ok: false, message: "参加者の性別を確認してください。" };
    }

    if (matchFormat === "doubles" && matchupMode !== "standard" && (gender !== "female" && gender !== "male")) {
      return { ok: false, message: "同性対決優先・混合対決優先では参加者の性別が必要です。" };
    }

    normalizedParticipants.push({ id, name, gender });
  }

  return {
    ok: true,
    value: {
      eventName: typeof body.eventName === "string" ? body.eventName.trim() : "",
      matchFormat: matchFormat as MatchFormat,
      matchupMode: matchupMode as MatchupMode,
      participantCount,
      participants: normalizedParticipants,
      courtCount,
      roundCount,
    },
  };
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateUpstreamResponse(request: GenerateRequest, body: unknown) {
  if (request.matchFormat !== "singles") {
    return null;
  }

  if (!isRecord(body) || !isRecord(body.data)) {
    return "対戦表APIのレスポンス形式を確認してください。";
  }

  const data = body.data;
  if (!isRecord(data.conditions) || data.conditions.matchFormat !== "singles" || data.conditions.playersPerCourt !== 2) {
    return "対戦表APIのシングルス条件が仕様と一致していません。";
  }

  if (!Array.isArray(data.rounds)) {
    return "対戦表APIのシングルス結果にラウンド情報が含まれていません。";
  }

  for (const round of data.rounds) {
    if (!isRecord(round) || !Array.isArray(round.courts)) {
      return "対戦表APIのシングルス結果にコート情報が含まれていません。";
    }

    for (const court of round.courts) {
      if (!isRecord(court)) {
        return "対戦表APIのシングルス結果にコート情報が含まれていません。";
      }

      if (court.isUnused === true) {
        continue;
      }

      if (!isRecord(court.singlesMatch)) {
        return "対戦表APIのシングルス結果に対戦者情報が含まれていません。";
      }

      if (typeof court.singlesMatch.player1Id !== "string" || typeof court.singlesMatch.player2Id !== "string") {
        return "対戦表APIのシングルス結果に対戦者情報が含まれていません。";
      }
    }
  }

  return null;
}
