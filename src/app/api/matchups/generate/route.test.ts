import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function createGenerateRequest(body: unknown) {
  return new Request("http://localhost/api/matchups/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function createValidBody(overrides: Record<string, unknown> = {}) {
  return {
    eventName: "  API smoke  ",
    matchupMode: "standard",
    participantCount: 4,
    participants: [
      { id: " p1 ", name: "  佐藤  ", gender: "female" },
      { id: "p2", name: "鈴木", gender: "male" },
      { id: "p3", name: "高橋", gender: "female" },
      { id: "p4", name: "田中", gender: "male" },
    ],
    courtCount: 1,
    roundCount: 1,
    ...overrides,
  };
}

describe("POST /api/matchups/generate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("forwards a sanitized standard-mode payload with participant gender", async () => {
    vi.stubEnv("MATCHUP_API_KEY", "test-api-key");
    vi.stubEnv("MATCHUP_API_BASE_URL", "https://matchup.example.test");

    const upstreamBody = {
      data: {
        conditions: {
          participants: [
            { id: "p1", name: "佐藤", gender: "female", index: 0 },
            { id: "p2", name: "鈴木", gender: "male", index: 1 },
          ],
        },
      },
    };
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(JSON.stringify(upstreamBody), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(createGenerateRequest(createValidBody()));
    const body = await response.json();
    const [url, init] = fetchMock.mock.calls[0];

    expect(response.status).toBe(200);
    expect(body).toEqual(upstreamBody);
    expect(url.toString()).toBe("https://matchup.example.test/api/v1/matchups/generate");
    expect(init?.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer test-api-key",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      eventName: "API smoke",
      matchupMode: "standard",
      participantCount: 4,
      participants: [
        { id: "p1", name: "佐藤", gender: "female" },
        { id: "p2", name: "鈴木", gender: "male" },
        { id: "p3", name: "高橋", gender: "female" },
        { id: "p4", name: "田中", gender: "male" },
      ],
      courtCount: 1,
      roundCount: 1,
    });
  });

  it("rejects gender-aware modes when participant gender is missing", async () => {
    vi.stubEnv("MATCHUP_API_KEY", "test-api-key");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      createGenerateRequest(
        createValidBody({
          matchupMode: "sameGenderPriority",
          participants: [
            { id: "p1", name: "佐藤", gender: "female" },
            { id: "p2", name: "鈴木", gender: "male" },
            { id: "p3", name: "高橋", gender: "female" },
            { id: "p4", name: "田中" },
          ],
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "同性対決優先・混合対決優先では参加者の性別が必要です。",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a configuration error before calling upstream when the API key is missing", async () => {
    vi.stubEnv("MATCHUP_API_KEY", "");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(createGenerateRequest(createValidBody()));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toEqual({
      code: "SERVER_CONFIGURATION_ERROR",
      message: "対戦表APIキーが設定されていません。",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
