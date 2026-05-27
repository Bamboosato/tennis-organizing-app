"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import packageJson from "../../package.json";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  FileDown,
  Home as HomeIcon,
  LogIn,
  LogOut,
  Mail,
  Minus,
  Plus,
  Save,
  Swords,
  UserPlus,
  Users,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { buildGuestParticipants } from "@/features/guests/buildGuestParticipants";
import { formatGuestSummaryNumberingBreakdown } from "@/features/guests/formatGuestNumberingBreakdown";
import { formatParticipantDisplayName } from "@/features/matchups/formatParticipantDisplayName";
import { formatParticipantSummaryLabel } from "@/features/matchups/formatParticipantSummaryLabel";
import { addMember, deactivateMember, subscribeMembers, updateMember } from "@/features/members/memberRepository";
import { emptyMemberForm, type Member, type MemberFormInput } from "@/features/members/model";
import { useMatchupPdfExport } from "@/hooks/useMatchupPdfExport";
import { APP_ICON_192_SRC } from "@/lib/constants/assets";

type MatchupMode = "standard" | "sameGenderPriority" | "mixedDoublesPriority";
type Screen = "login" | "passwordSetup" | "home" | "memberManagement";
type SortMode = "registered" | "kana";

const APP_COPYRIGHT_YEAR = 2026;
const APP_VERSION = packageJson.version;
const PARTICIPANT_COUNT_MAX = 30;
const GENDER_COUNT_MIN = 0;
const COURT_COUNT_MIN = 1;
const COURT_COUNT_MAX = 8;
const ROUND_COUNT_MIN = 1;
const ROUND_COUNT_MAX = 20;
type MatchupParticipant = {
  id: string;
  name: string;
  gender?: "female" | "male";
  index?: number;
};
type MatchupPair = {
  player1Id: string;
  player2Id: string;
};
type MatchupCourt = {
  courtNumber: number;
  pairA?: MatchupPair | null;
  pairB?: MatchupPair | null;
  isUnused?: boolean;
};
type MatchupRound = {
  roundNumber: number;
  courts: MatchupCourt[];
  restPlayerIds: string[];
};
type MatchupResult = {
  conditions: {
    eventName?: string;
    matchupMode?: MatchupMode;
    participants: MatchupParticipant[];
    courtCount: number;
    roundCount: number;
  };
  rounds: MatchupRound[];
  seed: number;
};
type GenerateMatchupPayload = {
  eventName: string;
  matchupMode: MatchupMode;
  participantCount: number;
  participants: MatchupParticipant[];
  courtCount: number;
  roundCount: number;
};
type CourtReductionConfirmation = {
  payload: GenerateMatchupPayload;
  requestedCourtCount: number;
  usableCourtCount: number;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupPasswordConfirmation, setSetupPasswordConfirmation] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [memberState, setMemberState] = useState<{ members: Member[]; uid: string | null }>({
    members: [],
    uid: null,
  });
  const [memberForm, setMemberForm] = useState<MemberFormInput>(emptyMemberForm);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberError, setMemberError] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("registered");
  const [eventName, setEventName] = useState("週末テニス会");
  const [matchupMode, setMatchupMode] = useState<MatchupMode>("standard");
  const [guestFemaleCount, setGuestFemaleCount] = useState("4");
  const [guestMaleCount, setGuestMaleCount] = useState("4");
  const [draftGuestFemaleCount, setDraftGuestFemaleCount] = useState("4");
  const [draftGuestMaleCount, setDraftGuestMaleCount] = useState("4");
  const [memberGuestFemaleCount, setMemberGuestFemaleCount] = useState("0");
  const [memberGuestMaleCount, setMemberGuestMaleCount] = useState("0");
  const [draftMemberGuestFemaleCount, setDraftMemberGuestFemaleCount] = useState("0");
  const [draftMemberGuestMaleCount, setDraftMemberGuestMaleCount] = useState("0");
  const [courtCount, setCourtCount] = useState("2");
  const [roundCount, setRoundCount] = useState("4");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [draftSelectedMemberIds, setDraftSelectedMemberIds] = useState<string[]>([]);
  const [isMemberSelectionOpen, setIsMemberSelectionOpen] = useState(false);
  const [memberSelectionError, setMemberSelectionError] = useState("");
  const [matchupResult, setMatchupResult] = useState<MatchupResult | null>(null);
  const [matchupError, setMatchupError] = useState("");
  const [isMatchupCompleteToastVisible, setIsMatchupCompleteToastVisible] = useState(false);
  const [isMatchupGenerating, setIsMatchupGenerating] = useState(false);
  const [courtReductionConfirmation, setCourtReductionConfirmation] = useState<CourtReductionConfirmation | null>(null);
  const { clearPdfError, exportPdf, isExportingPdf, pdfErrorMessage } = useMatchupPdfExport();
  const returningToLoginAfterRegistration = useRef(false);

  useEffect(() => {
    let resolved = false;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      resolved = true;
      setAuthLoading(false);

      if (returningToLoginAfterRegistration.current) {
        return;
      }

      setUser(currentUser);
      if (currentUser) {
        setScreen((currentScreen) => {
          if (currentUser.isAnonymous || currentScreen === "login" || currentScreen === "passwordSetup") {
            return "home";
          }

          return currentScreen;
        });
      } else {
        setScreen((currentScreen) => (currentScreen === "passwordSetup" ? "passwordSetup" : "login"));
      }
    });
    const fallbackTimer = window.setTimeout(() => {
      if (!resolved) {
        setAuthLoading(false);
      }
    }, 2500);

    return () => {
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || user.isAnonymous) {
      return;
    }

    return subscribeMembers(
      user.uid,
      (nextMembers) => {
        setMemberError("");
        setMemberState({
          members: nextMembers,
          uid: user.uid,
        });
      },
      (error) => {
        setMemberError(toMessage(error, "メンバー一覧を取得できませんでした。"));
      },
    );
  }, [user]);

  useEffect(() => {
    if (!isMatchupCompleteToastVisible) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsMatchupCompleteToastVisible(false);
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isMatchupCompleteToastVisible]);

  const members = useMemo(
    () => (memberState.uid === user?.uid ? memberState.members : []),
    [memberState, user?.uid],
  );
  const activeMembers = useMemo(() => members.filter((member) => member.status === "active"), [members]);
  const selectedMembers = useMemo(
    () => activeMembers.filter((member) => selectedMemberIds.includes(member.id)),
    [activeMembers, selectedMemberIds],
  );
  const selectedFemaleCount = useMemo(
    () => selectedMembers.filter((member) => member.gender === "female").length,
    [selectedMembers],
  );
  const selectedMaleCount = selectedMembers.length - selectedFemaleCount;
  const sortedMembers = useMemo(() => {
    return [...activeMembers].sort((left, right) => {
      if (sortMode === "registered") {
        return right.displayOrder - left.displayOrder;
      }

      const leftKey = left.sortKeyKana || left.nickname;
      const rightKey = right.sortKeyKana || right.nickname;

      return leftKey.localeCompare(rightKey, "ja");
    });
  }, [activeMembers, sortMode]);

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword("");
      setScreen("home");
    } catch (error) {
      setAuthError(toMessage(error, "ログインできませんでした。"));
    }
  }

  async function handlePasswordSetupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");

    if (setupPassword !== setupPasswordConfirmation) {
      setAuthError("パスワードが一致しません。");
      return;
    }

    const normalizedEmail = email.trim();
    returningToLoginAfterRegistration.current = true;

    try {
      await createUserWithEmailAndPassword(auth, normalizedEmail, setupPassword);
      await signOut(auth);
      setUser(null);
      setEmail(normalizedEmail);
      setPassword("");
      setSetupPassword("");
      setSetupPasswordConfirmation("");
      setScreen("login");
      setAuthNotice("ID登録が完了しました。ログインしてください。");
    } catch (error) {
      setAuthError(toMessage(error, "ID登録できませんでした。"));
    } finally {
      returningToLoginAfterRegistration.current = false;
    }
  }

  async function handleGuestLogin() {
    setAuthError("");
    setAuthNotice("");
    setMemberState({ members: [], uid: null });

    try {
      await signInAnonymously(auth);
      setScreen("home");
    } catch (error) {
      setAuthError(toMessage(error, "Guestログインできませんでした。"));
    }
  }

  async function handlePasswordReset() {
    const normalizedEmail = email.trim();
    setAuthError("");
    setAuthNotice("");

    if (!normalizedEmail) {
      setAuthError("パスワード再設定にはメールアドレスを入力してください。");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setAuthNotice("パスワード再設定メールを送信しました。メールのリンクから再設定してください。");
    } catch (error) {
      setAuthError(toMessage(error, "パスワード再設定メールを送信できませんでした。"));
    }
  }

  async function handleLogout() {
    await signOut(auth);
    setMemberState({ members: [], uid: null });
    setMemberForm(emptyMemberForm);
    setEditingMemberId(null);
    setMemberError("");
    setSelectedMemberIds([]);
    setDraftSelectedMemberIds([]);
    setMemberGuestFemaleCount("0");
    setMemberGuestMaleCount("0");
    setDraftMemberGuestFemaleCount("0");
    setDraftMemberGuestMaleCount("0");
    setIsMemberSelectionOpen(false);
    setMemberSelectionError("");
    setMatchupResult(null);
    setMatchupError("");
    setIsMatchupCompleteToastVisible(false);
    setIsMatchupGenerating(false);
    setCourtReductionConfirmation(null);
    setPassword("");
    setScreen("login");
  }

  function openPasswordSetup() {
    setAuthError("");
    setAuthNotice("");
    setSetupPassword("");
    setSetupPasswordConfirmation("");
    setScreen("passwordSetup");
  }

  function openMemberRegistration() {
    if (!user || user.isAnonymous) {
      return;
    }

    setMemberForm(emptyMemberForm);
    setEditingMemberId(null);
    setMemberError("");
    setScreen("memberManagement");
  }

  function returnHomeFromMemberManagement() {
    setMemberForm(emptyMemberForm);
    setEditingMemberId(null);
    setMemberError("");
    setScreen("home");
  }

  function cancelMemberEdit() {
    setMemberForm(emptyMemberForm);
    setEditingMemberId(null);
    setMemberError("");
  }

  function openMemberSelection() {
    if (!user) {
      return;
    }

    if (user.isAnonymous) {
      setDraftGuestFemaleCount(guestFemaleCount);
      setDraftGuestMaleCount(guestMaleCount);
      setMemberSelectionError("");
      setIsMemberSelectionOpen(true);
      return;
    }

    const activeMemberIds = new Set(activeMembers.map((member) => member.id));

    setDraftSelectedMemberIds(selectedMemberIds.filter((memberId) => activeMemberIds.has(memberId)));
    setDraftMemberGuestFemaleCount(memberGuestFemaleCount);
    setDraftMemberGuestMaleCount(memberGuestMaleCount);
    setMemberSelectionError("");
    setIsMemberSelectionOpen(true);
  }

  function cancelMemberSelection() {
    if (user?.isAnonymous) {
      setDraftGuestFemaleCount(guestFemaleCount);
      setDraftGuestMaleCount(guestMaleCount);
    } else {
      setDraftSelectedMemberIds(selectedMemberIds);
      setDraftMemberGuestFemaleCount(memberGuestFemaleCount);
      setDraftMemberGuestMaleCount(memberGuestMaleCount);
    }

    setIsMemberSelectionOpen(false);
    setMemberSelectionError("");
  }

  function confirmMemberSelection() {
    if (user?.isAnonymous) {
      setGuestFemaleCount(draftGuestFemaleCount);
      setGuestMaleCount(draftGuestMaleCount);
    } else {
      const draftGuestCount =
        toDisplayCount(draftMemberGuestFemaleCount) + toDisplayCount(draftMemberGuestMaleCount);

      if (draftSelectedMemberIds.length + draftGuestCount > 30) {
        setMemberSelectionError("ゲスト含めて30人を超えています。");
        return;
      }

      setSelectedMemberIds(draftSelectedMemberIds);
      setMemberGuestFemaleCount(draftMemberGuestFemaleCount);
      setMemberGuestMaleCount(draftMemberGuestMaleCount);
    }

    setIsMemberSelectionOpen(false);
    setMemberSelectionError("");
  }

  function toggleDraftMemberSelection(memberId: string) {
    setMemberSelectionError("");
    setDraftSelectedMemberIds((current) => {
      if (current.includes(memberId)) {
        return current.filter((id) => id !== memberId);
      }

      return [...current, memberId];
    });
  }

  function clearDraftMemberSelection() {
    setMemberSelectionError("");
    setDraftSelectedMemberIds([]);
  }

  function selectAllDraftMembers() {
    setMemberSelectionError("");
    setDraftSelectedMemberIds(sortedMembers.map((member) => member.id));
  }

  function handleCreateMatchup() {
    if (!user || isMatchupGenerating) {
      return;
    }

    clearPdfError();
    const parsedCourtCount = parseCount(courtCount);
    const parsedRoundCount = parseCount(roundCount);
    const participants = user.isAnonymous
      ? buildGuestParticipants(toDisplayCount(guestFemaleCount), toDisplayCount(guestMaleCount))
      : [
          ...selectedMembers.map((member) => ({
            id: member.id,
            name: member.nickname,
            gender: member.gender,
          })),
          ...buildGuestParticipants(toDisplayCount(memberGuestFemaleCount), toDisplayCount(memberGuestMaleCount), {
            idPrefix: "member-guest",
          }),
        ];

    setMatchupError("");
    setMatchupResult(null);
    setIsMatchupCompleteToastVisible(false);
    setCourtReductionConfirmation(null);

    if (
      participants.length < 4 ||
      participants.length > 30 ||
      parsedCourtCount === null ||
      parsedCourtCount < 1 ||
      parsedCourtCount > 8 ||
      parsedRoundCount === null ||
      parsedRoundCount < 1 ||
      parsedRoundCount > 20
    ) {
      setMatchupError("参加者数、コート数、実施回数を確認してください。");
      return;
    }

    const usableCourtCount = toUsableCourtCount(participants.length, parsedCourtCount);
    const payload: GenerateMatchupPayload = {
      eventName,
      matchupMode,
      participantCount: participants.length,
      participants,
      courtCount: usableCourtCount,
      roundCount: parsedRoundCount,
    };

    if (parsedCourtCount > usableCourtCount) {
      setCourtReductionConfirmation({
        payload,
        requestedCourtCount: parsedCourtCount,
        usableCourtCount,
      });
      return;
    }

    void createMatchup(payload);
  }

  async function createMatchup(payload: GenerateMatchupPayload) {
    setCourtReductionConfirmation(null);
    setIsMatchupCompleteToastVisible(false);
    setIsMatchupGenerating(true);

    try {
      const response = await fetch("/api/matchups/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as { data?: MatchupResult; error?: { message?: string } } | null;

      if (!response.ok || !body?.data) {
        throw new Error(body?.error?.message || "対戦表を作成できませんでした。");
      }

      setMatchupResult(body.data);
      setIsMatchupCompleteToastVisible(true);
    } catch (error) {
      setMatchupError(toMessage(error, "対戦表を作成できませんでした。"));
    } finally {
      setIsMatchupGenerating(false);
    }
  }

  function cancelCourtReductionConfirmation() {
    setCourtReductionConfirmation(null);
  }

  function confirmCourtReduction() {
    if (!courtReductionConfirmation || isMatchupGenerating) {
      return;
    }

    void createMatchup(courtReductionConfirmation.payload);
  }

  async function handleMemberSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || user.isAnonymous) {
      return;
    }

    setMemberError("");

    try {
      if (editingMemberId) {
        await updateMember(user.uid, editingMemberId, memberForm);
      } else {
        await addMember(user.uid, memberForm, activeMembers.length);
      }

      setMemberForm(emptyMemberForm);
      setEditingMemberId(null);
    } catch (error) {
      setMemberError(toMessage(error, "メンバーを保存できませんでした。"));
    }
  }

  function startEdit(member: Member) {
    setMemberForm({
      nickname: member.nickname,
      fullName: member.fullName,
      gender: member.gender,
      note: member.note,
    });
    setEditingMemberId(member.id);
    setMemberError("");
    setScreen("memberManagement");
  }

  async function handleDeactivate(member: Member) {
    if (!user || user.isAnonymous) {
      return;
    }

    setMemberError("");

    try {
      await deactivateMember(user.uid, member.id);
      if (editingMemberId === member.id) {
        setEditingMemberId(null);
        setMemberForm(emptyMemberForm);
      }
    } catch (error) {
      setMemberError(toMessage(error, "メンバーを非表示にできませんでした。"));
    }
  }

  if (authLoading) {
    return (
      <main className="app-shell">
        <div className="app-frame">
          <p className="status-message">読み込み中です。</p>
        </div>
      </main>
    );
  }

  const loginIdLabel = user ? (user.isAnonymous ? "Guest" : user.email || "メール未設定") : "";

  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <Users className="brand-mark-fallback" size={26} />
              <Image
                alt=""
                className="brand-mark-image"
                height={48}
                src={APP_ICON_192_SRC}
                unoptimized
                width={48}
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            </div>
            <div>
              <p className="eyebrow">tennis-organizing-app</p>
              <h1 className="brand-title">テニスサークル メンバー登録＆対戦表作成をサポートします！</h1>
              <p className="brand-subtitle">(現状はダブルスに限ります)</p>
            </div>
          </div>
          {user ? (
            <div className="topbar-actions">
              <div className="login-id-pill" aria-label={`ログインID ${loginIdLabel}`}>
                <Mail size={18} aria-hidden="true" />
                <span>ログインID</span>
                <strong>{loginIdLabel}</strong>
              </div>
              <button className="button button-secondary" title="ログアウトします。" type="button" onClick={handleLogout}>
                <LogOut size={18} />
                ログアウト
              </button>
            </div>
          ) : null}
        </header>

        {!user && screen === "passwordSetup" ? (
          <PasswordSetupPanel
            authError={authError}
            email={email}
            onBack={() => {
              setAuthError("");
              setScreen("login");
            }}
            onEmailChange={setEmail}
            onPasswordChange={setSetupPassword}
            onPasswordConfirmationChange={setSetupPasswordConfirmation}
            onSubmit={handlePasswordSetupSubmit}
            password={setupPassword}
            passwordConfirmation={setupPasswordConfirmation}
          />
        ) : !user ? (
          <LoginPanel
            authError={authError}
            authNotice={authNotice}
            email={email}
            onEmailChange={setEmail}
            onGuestLogin={handleGuestLogin}
            onNewRegistration={openPasswordSetup}
            onPasswordChange={setPassword}
            onPasswordReset={handlePasswordReset}
            onSubmit={handleLoginSubmit}
            password={password}
          />
        ) : screen === "memberManagement" && !user.isAnonymous ? (
          <MemberManagementScreen
            activeMemberCount={activeMembers.length}
            editingMemberId={editingMemberId}
            error={memberError}
            form={memberForm}
            members={sortedMembers}
            onBack={returnHomeFromMemberManagement}
            onCancelEdit={cancelMemberEdit}
            onChange={setMemberForm}
            onDeactivate={handleDeactivate}
            onEdit={startEdit}
            onSortModeChange={setSortMode}
            onSubmit={handleMemberSubmit}
            sortMode={sortMode}
          />
        ) : (
          <HomeScreen
            activeMemberCount={activeMembers.length}
            courtReductionConfirmation={courtReductionConfirmation}
            courtCount={courtCount}
            draftGuestFemaleCount={draftGuestFemaleCount}
            draftGuestMaleCount={draftGuestMaleCount}
            draftMemberGuestFemaleCount={draftMemberGuestFemaleCount}
            draftMemberGuestMaleCount={draftMemberGuestMaleCount}
            draftSelectedMemberIds={draftSelectedMemberIds}
            eventName={eventName}
            guestFemaleCount={guestFemaleCount}
            guestMaleCount={guestMaleCount}
            isGuest={user.isAnonymous}
            isExportingPdf={isExportingPdf}
            isMatchupGenerating={isMatchupGenerating}
            memberSelectionError={memberSelectionError}
            matchupMode={matchupMode}
            matchupError={matchupError}
            matchupResult={matchupResult}
            memberSelectionOpen={isMemberSelectionOpen}
            memberGuestFemaleCount={memberGuestFemaleCount}
            memberGuestMaleCount={memberGuestMaleCount}
            members={sortedMembers}
            onCourtCountChange={setCourtCount}
            onCourtReductionCancel={cancelCourtReductionConfirmation}
            onCourtReductionConfirm={confirmCourtReduction}
            onDraftGuestFemaleCountChange={setDraftGuestFemaleCount}
            onDraftGuestMaleCountChange={setDraftGuestMaleCount}
            onDraftMemberGuestFemaleCountChange={setDraftMemberGuestFemaleCount}
            onDraftMemberGuestMaleCountChange={setDraftMemberGuestMaleCount}
            onEventNameChange={setEventName}
            onMemberRegistration={openMemberRegistration}
            onMemberSelectionCancel={cancelMemberSelection}
            onMemberSelectionConfirm={confirmMemberSelection}
            onMemberSelectionOpen={openMemberSelection}
            onMatchupModeChange={setMatchupMode}
            onMatchupCreate={handleCreateMatchup}
            onPdfCreate={exportPdf}
            onRoundCountChange={setRoundCount}
            onSelectedMembersClear={clearDraftMemberSelection}
            onSelectedMembersSelectAll={selectAllDraftMembers}
            onSelectedMemberToggle={toggleDraftMemberSelection}
            onSortModeChange={setSortMode}
            pdfErrorMessage={pdfErrorMessage}
            roundCount={roundCount}
            selectedFemaleCount={selectedFemaleCount}
            selectedMaleCount={selectedMaleCount}
            selectedMemberIds={selectedMemberIds}
            sortMode={sortMode}
          />
        )}
        <footer className="app-footer">
          &copy; {APP_COPYRIGHT_YEAR} Bamboosato&nbsp; v{APP_VERSION}
        </footer>
      </div>
      {isMatchupCompleteToastVisible ? (
        <div className="fixed-toast fixed-toast-success" role="status" aria-live="polite">
          対戦表作成が完了しました。
        </div>
      ) : null}
    </main>
  );
}

function LoginPanel(props: {
  authError: string;
  authNotice: string;
  email: string;
  onEmailChange: (value: string) => void;
  onGuestLogin: () => void;
  onNewRegistration: () => void;
  onPasswordChange: (value: string) => void;
  onPasswordReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  password: string;
}) {
  return (
    <section className="panel auth-panel">
      <div className="panel-header">
        <h2>ログイン</h2>
      </div>
      <div className="panel-body">
        <form className="form-grid" onSubmit={props.onSubmit}>
          <div className="field">
            <label htmlFor="email">メールアドレス</label>
            <input
              autoComplete="email"
              id="email"
              inputMode="email"
              onChange={(event) => props.onEmailChange(event.target.value)}
              required
              type="email"
              value={props.email}
            />
          </div>
          <PasswordField
            autoComplete="current-password"
            id="password"
            label="パスワード"
            onChange={props.onPasswordChange}
            value={props.password}
          />
          {props.authNotice ? <p className="status-message">{props.authNotice}</p> : null}
          {props.authError ? <p className="error-message">{props.authError}</p> : null}
          <div className="actions">
            <button className="button button-primary" type="submit">
              <LogIn size={18} />
              ログイン
            </button>
            <button className="button button-secondary" type="button" onClick={props.onNewRegistration}>
              <UserPlus size={18} />
              新規登録
            </button>
            <button className="button button-secondary" type="button" onClick={props.onGuestLogin}>
              Guest
            </button>
            <button className="button button-link" type="button" onClick={props.onPasswordReset}>
              パスワード再設定
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function PasswordField(props: {
  autoComplete: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const visibilityLabel = isVisible ? `${props.label}を非表示にする` : `${props.label}を表示する`;

  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <div className="password-input-wrap">
        <input
          autoComplete={props.autoComplete}
          id={props.id}
          minLength={6}
          onChange={(event) => props.onChange(event.target.value)}
          required
          type={isVisible ? "text" : "password"}
          value={props.value}
        />
        <button
          aria-label={visibilityLabel}
          aria-pressed={isVisible}
          className="password-visibility-button"
          title={visibilityLabel}
          type="button"
          onClick={() => setIsVisible((current) => !current)}
        >
          {isVisible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

function PasswordSetupPanel(props: {
  authError: string;
  email: string;
  onBack: () => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmationChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  password: string;
  passwordConfirmation: string;
}) {
  return (
    <section className="panel auth-panel">
      <div className="panel-header panel-header-row">
        <div>
          <h2>パスワード設定</h2>
          <p className="muted">新規IDを登録します。</p>
        </div>
        <button className="button button-secondary" type="button" onClick={props.onBack}>
          <ArrowLeft size={18} />
          戻る
        </button>
      </div>
      <div className="panel-body">
        <form className="form-grid" onSubmit={props.onSubmit}>
          <div className="field">
            <label htmlFor="setup-email">メールアドレス</label>
            <input
              autoComplete="email"
              id="setup-email"
              inputMode="email"
              onChange={(event) => props.onEmailChange(event.target.value)}
              required
              type="email"
              value={props.email}
            />
          </div>
          <PasswordField
            autoComplete="new-password"
            id="setup-password"
            label="パスワード"
            onChange={props.onPasswordChange}
            value={props.password}
          />
          <PasswordField
            autoComplete="new-password"
            id="setup-password-confirmation"
            label="パスワード確認"
            onChange={props.onPasswordConfirmationChange}
            value={props.passwordConfirmation}
          />
          {props.authError ? <p className="error-message">{props.authError}</p> : null}
          <div className="actions">
            <button className="button button-primary" type="submit">
              <Save size={18} />
              OK
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function HomeScreen(props: {
  activeMemberCount: number;
  courtReductionConfirmation: CourtReductionConfirmation | null;
  courtCount: string;
  draftGuestFemaleCount: string;
  draftGuestMaleCount: string;
  draftMemberGuestFemaleCount: string;
  draftMemberGuestMaleCount: string;
  draftSelectedMemberIds: string[];
  eventName: string;
  guestFemaleCount: string;
  guestMaleCount: string;
  isGuest: boolean;
  isExportingPdf: boolean;
  isMatchupGenerating: boolean;
  memberSelectionError: string;
  matchupMode: MatchupMode;
  matchupError: string;
  matchupResult: MatchupResult | null;
  memberSelectionOpen: boolean;
  memberGuestFemaleCount: string;
  memberGuestMaleCount: string;
  members: Member[];
  onCourtCountChange: (value: string) => void;
  onCourtReductionCancel: () => void;
  onCourtReductionConfirm: () => void;
  onDraftGuestFemaleCountChange: (value: string) => void;
  onDraftGuestMaleCountChange: (value: string) => void;
  onDraftMemberGuestFemaleCountChange: (value: string) => void;
  onDraftMemberGuestMaleCountChange: (value: string) => void;
  onEventNameChange: (value: string) => void;
  onMemberRegistration: () => void;
  onMemberSelectionCancel: () => void;
  onMemberSelectionConfirm: () => void;
  onMemberSelectionOpen: () => void;
  onMatchupModeChange: (value: MatchupMode) => void;
  onMatchupCreate: () => void;
  onPdfCreate: (result: MatchupResult) => Promise<void>;
  onRoundCountChange: (value: string) => void;
  onSelectedMembersClear: () => void;
  onSelectedMembersSelectAll: () => void;
  onSelectedMemberToggle: (memberId: string) => void;
  onSortModeChange: (mode: SortMode) => void;
  pdfErrorMessage: string | null;
  roundCount: string;
  selectedFemaleCount: number;
  selectedMaleCount: number;
  selectedMemberIds: string[];
  sortMode: SortMode;
}) {
  const matchupModeOptions: Array<{ label: string; title: string; value: MatchupMode }> = [
    { label: "通常", title: "男女に関係なく組合せを作成します。", value: "standard" },
    { label: "同性対決優先", title: "同性同士の対戦を優先して組合せを作成します。", value: "sameGenderPriority" },
    { label: "混合対決優先", title: "男女混合の対戦を優先して組合せを作成します。", value: "mixedDoublesPriority" },
  ];
  const guestFemaleDisplayCount = toDisplayCount(props.guestFemaleCount);
  const guestMaleDisplayCount = toDisplayCount(props.guestMaleCount);
  const guestParticipantCount = guestFemaleDisplayCount + guestMaleDisplayCount;
  const memberGuestFemaleDisplayCount = toDisplayCount(props.memberGuestFemaleCount);
  const memberGuestMaleDisplayCount = toDisplayCount(props.memberGuestMaleCount);
  const memberGuestParticipantCount = memberGuestFemaleDisplayCount + memberGuestMaleDisplayCount;
  const summaryGuestFemaleCount = props.isGuest ? guestFemaleDisplayCount : memberGuestFemaleDisplayCount;
  const summaryGuestMaleCount = props.isGuest ? guestMaleDisplayCount : memberGuestMaleDisplayCount;
  const summaryGuestBreakdown = formatGuestSummaryNumberingBreakdown(summaryGuestFemaleCount, summaryGuestMaleCount);
  const registeredParticipantCount = props.selectedMemberIds.length + memberGuestParticipantCount;
  const participantCount = props.isGuest
    ? guestParticipantCount
    : registeredParticipantCount;
  const participantLabel = formatParticipantSummaryLabel({
    guestCount: memberGuestParticipantCount,
    isGuest: props.isGuest,
    participantCount,
  });
  const selectedSummaryCount = participantCount;
  const femaleSummaryCount = props.isGuest
    ? guestFemaleDisplayCount
    : props.selectedFemaleCount + memberGuestFemaleDisplayCount;
  const maleSummaryCount = props.isGuest ? guestMaleDisplayCount : props.selectedMaleCount + memberGuestMaleDisplayCount;
  const parsedCourtCount = parseCount(props.courtCount);
  const parsedRoundCount = parseCount(props.roundCount);
  const usableCourtCount = toUsableCourtCount(participantCount, parsedCourtCount);
  const canCreateMatchup =
    participantCount >= 4 &&
    participantCount <= 30 &&
    parsedCourtCount !== null &&
    parsedCourtCount >= 1 &&
    parsedCourtCount <= 8 &&
    usableCourtCount >= 1 &&
    parsedRoundCount !== null &&
    parsedRoundCount >= 1 &&
    parsedRoundCount <= 20;
  const summaryRoundCount = canCreateMatchup ? (parsedRoundCount ?? 0) : 0;
  const summaryParticipantSeparator = props.isGuest ? " / " : "/ ";
  const summaryRoundSeparator = props.isGuest ? " / " : "/ ";
  const memberRegistrationTitle = props.isGuest
    ? "Guestではメンバー登録を利用できません。"
    : "メンバー登録画面を開きます。";
  const memberSelectionTitle = props.isGuest
    ? "女性人数・男性人数を入力します。"
    : "参加メンバーとゲスト人数を選択します。";
  const matchupCreateTitle = canCreateMatchup
    ? "現在の条件で対戦表を作成します。"
    : "参加者数、コート数、実施回数を確認してください。";

  return (
    <div className="home-matchup-layout">
      <section className="home-hero">
        <div>
          <p className="section-kicker">Tennis Organizing App</p>
          <p className="home-hero-copy">登録したメンバーを選択して、対戦表を作成します。Guestでは連番表示の対戦表になります。</p>
        </div>
        <div className={`hero-actions ${props.isGuest ? "hero-actions-guest" : ""}`}>
          {!props.isGuest ? (
            <div className="registered-count-pill" aria-label={`登録メンバー ${props.activeMemberCount}人`}>
              <span>登録メンバ</span>
              <strong>{props.activeMemberCount}人</strong>
              <span>（最大99人登録可）</span>
            </div>
          ) : null}
          <span className="button-title-wrap" title={memberRegistrationTitle}>
            <button
              className="button button-primary"
              disabled={props.isGuest}
              title={memberRegistrationTitle}
              type="button"
              onClick={props.onMemberRegistration}
            >
              <UserPlus size={18} />
              メンバー登録
            </button>
          </span>
        </div>
      </section>

      <section className="panel condition-panel">
        <div className="condition-heading">
          <p className="section-kicker">Conditions</p>
          <p className="condition-intro">メンバー選択（選択or人数入力）、コート数、実施回数、対戦モードを指定します。</p>
        </div>

        <div className="condition-block">
          <span className="condition-label">対戦モード</span>
          <div className="mode-selector" role="group" aria-label="対戦モード">
            {matchupModeOptions.map((option) => (
              <button
                aria-pressed={props.matchupMode === option.value}
                className={`mode-option ${props.matchupMode === option.value ? "mode-option-active" : ""}`}
                key={option.value}
                title={option.title}
                type="button"
                onClick={() => props.onMatchupModeChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="condition-grid">
          <div className="field condition-field condition-field-event">
            <label htmlFor="event-name">開催名</label>
            <input
              id="event-name"
              onChange={(event) => props.onEventNameChange(event.target.value)}
              placeholder="例: 週末テニス会"
              value={props.eventName}
            />
          </div>

          <div className="condition-member-field">
            <span className="condition-label">参加メンバー</span>
            <div className="member-select-summary">
              <span className="button-title-wrap" title={memberSelectionTitle}>
                <button
                  className="button button-secondary member-select-button"
                  title={memberSelectionTitle}
                  type="button"
                  onClick={props.memberSelectionOpen ? props.onMemberSelectionCancel : props.onMemberSelectionOpen}
                >
                  <Users size={18} />
                  メンバー選択
                </button>
              </span>
              <div className="condition-summary">
                <div>
                  <span>選択中</span>
                  <strong>{selectedSummaryCount}人</strong>
                </div>
                <div>
                  <span>女性 / 男性</span>
                  <strong>
                    {femaleSummaryCount} / {maleSummaryCount}
                  </strong>
                </div>
              </div>
            </div>
            {props.memberSelectionOpen ? (
              props.isGuest ? (
                <GuestParticipantCountDropdown
                  femaleCount={props.draftGuestFemaleCount}
                  maleCount={props.draftGuestMaleCount}
                  onCancel={props.onMemberSelectionCancel}
                  onConfirm={props.onMemberSelectionConfirm}
                  onFemaleCountChange={props.onDraftGuestFemaleCountChange}
                  onMaleCountChange={props.onDraftGuestMaleCountChange}
                />
              ) : (
                <ParticipantSelectionDropdown
                  error={props.memberSelectionError}
                  guestFemaleCount={props.draftMemberGuestFemaleCount}
                  guestMaleCount={props.draftMemberGuestMaleCount}
                  members={props.members}
                  onCancel={props.onMemberSelectionCancel}
                  onClear={props.onSelectedMembersClear}
                  onConfirm={props.onMemberSelectionConfirm}
                  onGuestFemaleCountChange={props.onDraftMemberGuestFemaleCountChange}
                  onGuestMaleCountChange={props.onDraftMemberGuestMaleCountChange}
                  onSelectAll={props.onSelectedMembersSelectAll}
                  onSortModeChange={props.onSortModeChange}
                  onToggle={props.onSelectedMemberToggle}
                  selectedMemberIds={props.draftSelectedMemberIds}
                  sortMode={props.sortMode}
                />
              )
            ) : null}
          </div>

          <div className="field condition-field condition-field-narrow">
            <CountStepperField
              label="コート数"
              value={props.courtCount}
              numericValue={parsedCourtCount ?? 0}
              min={COURT_COUNT_MIN}
              max={COURT_COUNT_MAX}
              inputTestId="court-count-input"
              decrementTestId="court-count-decrement"
              incrementTestId="court-count-increment"
              decrementLabel="コート数を1面減らす"
              incrementLabel="コート数を1面増やす"
              onChange={props.onCourtCountChange}
              onCommit={() => props.onCourtCountChange(commitCountInput(props.courtCount, COURT_COUNT_MIN, COURT_COUNT_MAX))}
              onStep={(delta) => props.onCourtCountChange(stepCountInput(props.courtCount, COURT_COUNT_MIN, COURT_COUNT_MAX, delta))}
            />
          </div>
          <div className="field condition-field">
            <CountStepperField
              label="実施回数"
              value={props.roundCount}
              numericValue={parsedRoundCount ?? 0}
              min={ROUND_COUNT_MIN}
              max={ROUND_COUNT_MAX}
              inputTestId="round-count-input"
              decrementTestId="round-count-decrement"
              incrementTestId="round-count-increment"
              decrementLabel="実施回数を1回減らす"
              incrementLabel="実施回数を1回増やす"
              onChange={props.onRoundCountChange}
              onCommit={() => props.onRoundCountChange(commitCountInput(props.roundCount, ROUND_COUNT_MIN, ROUND_COUNT_MAX))}
              onStep={(delta) => props.onRoundCountChange(stepCountInput(props.roundCount, ROUND_COUNT_MIN, ROUND_COUNT_MAX, delta))}
            />
          </div>
        </div>

        <div className="numbering-summary">
          <div className="numbering-summary-text">
            <p className="section-kicker">Summary</p>
            <p className="numbering-summary-main">
              参加 {participantLabel}{summaryParticipantSeparator}コート {usableCourtCount}面{summaryRoundSeparator}{summaryRoundCount}回
            </p>
            {summaryGuestBreakdown ? (
              <p className="numbering-summary-guest-breakdown">ゲスト {summaryGuestBreakdown}</p>
            ) : null}
            {props.matchupError ? <p className="error-message action-error">{props.matchupError}</p> : null}
          </div>
          <span
            className="button-title-wrap numbering-summary-action"
            title={props.isMatchupGenerating ? "対戦表を作成しています。" : matchupCreateTitle}
          >
            <button
              className="button button-primary"
              disabled={!canCreateMatchup || props.isMatchupGenerating}
              title={props.isMatchupGenerating ? "対戦表を作成しています。" : matchupCreateTitle}
              type="button"
              onClick={props.onMatchupCreate}
            >
              <Swords size={18} />
              {props.isMatchupGenerating ? "作成中..." : "対戦表作成"}
            </button>
          </span>
        </div>
      </section>

      {props.matchupResult ? (
        <MatchupResultPanel
          isExportingPdf={props.isExportingPdf}
          isGuest={props.isGuest}
          onPdfCreate={props.onPdfCreate}
          pdfErrorMessage={props.pdfErrorMessage}
          result={props.matchupResult}
        />
      ) : null}
      {props.courtReductionConfirmation ? (
        <CourtReductionDialog
          isGenerating={props.isMatchupGenerating}
          onCancel={props.onCourtReductionCancel}
          onConfirm={props.onCourtReductionConfirm}
          requestedCourtCount={props.courtReductionConfirmation.requestedCourtCount}
          usableCourtCount={props.courtReductionConfirmation.usableCourtCount}
        />
      ) : null}
    </div>
  );
}

function CourtReductionDialog(props: {
  isGenerating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  requestedCourtCount: number;
  usableCourtCount: number;
}) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-describedby="court-reduction-description"
        aria-labelledby="court-reduction-title"
        aria-modal="true"
        className="confirmation-dialog"
        role="dialog"
      >
        <div>
          <p className="section-kicker">確認</p>
          <h2 id="court-reduction-title">コート数を調整します</h2>
        </div>
        <p id="court-reduction-description">
          入力されたコート数 {props.requestedCourtCount}面 は参加人数に対して多いため、
          <br />
          コート数：
          <strong>{props.usableCourtCount}面</strong>で対戦表を作成します。
        </p>
        <div className="dialog-actions">
          <button className="button button-secondary" disabled={props.isGenerating} type="button" onClick={props.onCancel}>
            キャンセル
          </button>
          <button className="button button-primary" disabled={props.isGenerating} type="button" onClick={props.onConfirm}>
            OK
          </button>
        </div>
      </section>
    </div>
  );
}

function MatchupResultPanel(props: {
  isExportingPdf: boolean;
  isGuest: boolean;
  onPdfCreate: (result: MatchupResult) => Promise<void>;
  pdfErrorMessage: string | null;
  result: MatchupResult;
}) {
  const participantsById = new Map(props.result.conditions.participants.map((participant) => [participant.id, participant]));
  const eventName = props.result.conditions.eventName?.trim() || "対戦表";

  function playerName(playerId: string) {
    const participant = participantsById.get(playerId);

    if (!participant) {
      return playerId;
    }

    return formatParticipantDisplayName(participant);
  }

  function pairLabel(pair?: MatchupPair | null) {
    if (!pair) {
      return "なし";
    }

    return `${playerName(pair.player1Id)} / ${playerName(pair.player2Id)}`;
  }

  return (
    <section className={`panel matchup-result-panel ${props.isGuest ? "matchup-result-panel-guest" : ""}`}>
      <div className="result-heading">
        <div>
          <p className="section-kicker">Matchup Table</p>
          <h2>{eventName}</h2>
        </div>
        <div className="result-actions">
          <button
            className="button button-secondary"
            disabled={props.isExportingPdf}
            title="現在の対戦表をPDFファイルとして出力します。"
            type="button"
            onClick={() => void props.onPdfCreate(props.result)}
          >
            <FileDown size={18} />
            {props.isExportingPdf ? "PDF出力中..." : "PDF作成"}
          </button>
        </div>
      </div>
      {props.pdfErrorMessage ? <p className="error-message">{props.pdfErrorMessage}</p> : null}

      <div className="round-list">
        {props.result.rounds.map((round) => {
          const restNames = round.restPlayerIds.map(playerName);
          const courtCards = round.courts.map((court) => (
            <article className="court-card" key={`${round.roundNumber}-${court.courtNumber}`}>
              <h4>コート{court.courtNumber}</h4>
              {court.isUnused ? (
                <p className="court-unused">未使用</p>
              ) : (
                <dl>
                  <div>
                    <dt>A</dt>
                    <dd>{pairLabel(court.pairA)}</dd>
                  </div>
                  <div>
                    <dt>B</dt>
                    <dd>{pairLabel(court.pairB)}</dd>
                  </div>
                </dl>
              )}
            </article>
          ));
          const restCard = (
            <div className="rest-card" key={`${round.roundNumber}-rest`}>
              <span>{props.isGuest ? "休憩者" : "休憩"}</span>
              <strong>{restNames.length > 0 ? restNames.join("、") : props.isGuest ? "この回の休憩者はいません。" : "なし"}</strong>
            </div>
          );

          return (
            <section className="round-card" key={round.roundNumber}>
              <div className="round-heading">
                <h3>第{round.roundNumber}ラウンド</h3>
              </div>
              {props.isGuest ? (
                <div className="guest-result-row">
                  <div className="guest-court-scroll" aria-label={`第${round.roundNumber}ラウンドのコート一覧`}>
                    <div className="guest-court-track">{courtCards}</div>
                  </div>
                  {restCard}
                </div>
              ) : (
                <>
                  <div className="court-card-grid">{courtCards}</div>
                  {restCard}
                </>
              )}
            </section>
          );
        })}
      </div>
      <div className="result-seed-row">
        <div className="seed-pill">seed {props.result.seed}</div>
      </div>
    </section>
  );
}

type CountStepperFieldProps = {
  label: string;
  value: string;
  numericValue: number;
  min: number;
  max: number;
  inputTestId: string;
  decrementTestId: string;
  incrementTestId: string;
  decrementLabel: string;
  incrementLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
  onStep: (delta: number) => void;
};

function CountStepperField({
  label,
  value,
  numericValue,
  min,
  max,
  inputTestId,
  decrementTestId,
  incrementTestId,
  decrementLabel,
  incrementLabel,
  disabled = false,
  onChange,
  onCommit,
  onStep,
}: CountStepperFieldProps) {
  const inputId = `${inputTestId}-field`;
  const decrementDisabled = disabled || numericValue <= min;
  const incrementDisabled = disabled || numericValue >= max;

  return (
    <div className="count-stepper-field">
      <label htmlFor={inputId}>{label}</label>
      <div className={`count-stepper-control ${disabled ? "count-stepper-control-disabled" : ""}`}>
        <button
          aria-label={decrementLabel}
          className="count-stepper-button"
          data-testid={decrementTestId}
          disabled={decrementDisabled}
          title={decrementLabel}
          type="button"
          onClick={() => onStep(-1)}
        >
          <Minus aria-hidden="true" size={18} />
        </button>
        <input
          data-testid={inputTestId}
          disabled={disabled}
          id={inputId}
          inputMode="numeric"
          max={max}
          min={min}
          pattern="[0-9]*"
          type="text"
          value={value}
          onBlur={onCommit}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onCommit();
            }
          }}
        />
        <button
          aria-label={incrementLabel}
          className="count-stepper-button"
          data-testid={incrementTestId}
          disabled={incrementDisabled}
          title={incrementLabel}
          type="button"
          onClick={() => onStep(1)}
        >
          <Plus aria-hidden="true" size={18} />
        </button>
      </div>
    </div>
  );
}

function GuestParticipantCountDropdown(props: {
  femaleCount: string;
  maleCount: string;
  onCancel: () => void;
  onConfirm: () => void;
  onFemaleCountChange: (value: string) => void;
  onMaleCountChange: (value: string) => void;
}) {
  const selectedCount = toDisplayCount(props.femaleCount) + toDisplayCount(props.maleCount);
  const femaleMax = Math.max(GENDER_COUNT_MIN, PARTICIPANT_COUNT_MAX - toDisplayCount(props.maleCount));
  const maleMax = Math.max(GENDER_COUNT_MIN, PARTICIPANT_COUNT_MAX - toDisplayCount(props.femaleCount));

  return (
    <section className="participant-selection-dropdown participant-count-dropdown">
      <div className="participant-dropdown-header">
        <div>
          <h3>参加人数入力（最大30人まで）</h3>
          <p className="muted">選択中: {selectedCount}人</p>
        </div>
      </div>
      <div className="participant-dropdown-body">
        <div className="guest-count-grid">
          <div className="field">
            <CountStepperField
              label="女性人数"
              value={props.femaleCount}
              numericValue={toDisplayCount(props.femaleCount)}
              min={GENDER_COUNT_MIN}
              max={femaleMax}
              inputTestId="guest-female-count-input"
              decrementTestId="guest-female-count-decrement"
              incrementTestId="guest-female-count-increment"
              decrementLabel="女性人数を1人減らす"
              incrementLabel="女性人数を1人増やす"
              onChange={props.onFemaleCountChange}
              onCommit={() => props.onFemaleCountChange(commitCountInput(props.femaleCount, GENDER_COUNT_MIN, femaleMax))}
              onStep={(delta) => props.onFemaleCountChange(stepCountInput(props.femaleCount, GENDER_COUNT_MIN, femaleMax, delta))}
            />
          </div>
          <div className="field">
            <CountStepperField
              label="男性人数"
              value={props.maleCount}
              numericValue={toDisplayCount(props.maleCount)}
              min={GENDER_COUNT_MIN}
              max={maleMax}
              inputTestId="guest-male-count-input"
              decrementTestId="guest-male-count-decrement"
              incrementTestId="guest-male-count-increment"
              decrementLabel="男性人数を1人減らす"
              incrementLabel="男性人数を1人増やす"
              onChange={props.onMaleCountChange}
              onCommit={() => props.onMaleCountChange(commitCountInput(props.maleCount, GENDER_COUNT_MIN, maleMax))}
              onStep={(delta) => props.onMaleCountChange(stepCountInput(props.maleCount, GENDER_COUNT_MIN, maleMax, delta))}
            />
          </div>
        </div>
      </div>
      <div className="participant-dropdown-actions">
        <button className="button button-secondary" title="入力を破棄して閉じます。" type="button" onClick={props.onCancel}>
          キャンセル
        </button>
        <button className="button button-primary" title="入力した人数を確定します。" type="button" onClick={props.onConfirm}>
          OK
        </button>
      </div>
    </section>
  );
}

function ParticipantSelectionDropdown(props: {
  error: string;
  guestFemaleCount: string;
  guestMaleCount: string;
  members: Member[];
  onCancel: () => void;
  onClear: () => void;
  onConfirm: () => void;
  onGuestFemaleCountChange: (value: string) => void;
  onGuestMaleCountChange: (value: string) => void;
  onSelectAll: () => void;
  onSortModeChange: (mode: SortMode) => void;
  onToggle: (memberId: string) => void;
  selectedMemberIds: string[];
  sortMode: SortMode;
}) {
  const selectedCount = props.selectedMemberIds.length;
  const guestCount = toDisplayCount(props.guestFemaleCount) + toDisplayCount(props.guestMaleCount);
  const totalSelectedCount = selectedCount + guestCount;
  const guestFemaleMax = Math.max(
    GENDER_COUNT_MIN,
    PARTICIPANT_COUNT_MAX - selectedCount - toDisplayCount(props.guestMaleCount),
  );
  const guestMaleMax = Math.max(
    GENDER_COUNT_MIN,
    PARTICIPANT_COUNT_MAX - selectedCount - toDisplayCount(props.guestFemaleCount),
  );
  const selectableMemberIds = props.members.map((member) => member.id);
  const allSelectableMembersSelected =
    selectableMemberIds.length > 0 && selectableMemberIds.every((memberId) => props.selectedMemberIds.includes(memberId));

  return (
    <section className="participant-selection-dropdown">
      <div className="participant-dropdown-header">
        <div className="participant-dropdown-title-row">
          <h3>参加メンバー選択（最大30人）</h3>
          <p className="muted">合計: {totalSelectedCount} / 30</p>
        </div>
        <div className="participant-guest-count-panel">
          <div className="participant-guest-count-title">ゲスト人数</div>
          <div className="guest-count-grid participant-guest-count-grid">
            <div className="field">
              <CountStepperField
                label="女性"
                value={props.guestFemaleCount}
                numericValue={toDisplayCount(props.guestFemaleCount)}
                min={GENDER_COUNT_MIN}
                max={guestFemaleMax}
                inputTestId="member-guest-female-count-input"
                decrementTestId="member-guest-female-count-decrement"
                incrementTestId="member-guest-female-count-increment"
                decrementLabel="追加女性を1人減らす"
                incrementLabel="追加女性を1人増やす"
                onChange={props.onGuestFemaleCountChange}
                onCommit={() =>
                  props.onGuestFemaleCountChange(commitCountInput(props.guestFemaleCount, GENDER_COUNT_MIN, guestFemaleMax))
                }
                onStep={(delta) =>
                  props.onGuestFemaleCountChange(stepCountInput(props.guestFemaleCount, GENDER_COUNT_MIN, guestFemaleMax, delta))
                }
              />
            </div>
            <div className="field">
              <CountStepperField
                label="男性"
                value={props.guestMaleCount}
                numericValue={toDisplayCount(props.guestMaleCount)}
                min={GENDER_COUNT_MIN}
                max={guestMaleMax}
                inputTestId="member-guest-male-count-input"
                decrementTestId="member-guest-male-count-decrement"
                incrementTestId="member-guest-male-count-increment"
                decrementLabel="追加男性を1人減らす"
                incrementLabel="追加男性を1人増やす"
                onChange={props.onGuestMaleCountChange}
                onCommit={() =>
                  props.onGuestMaleCountChange(commitCountInput(props.guestMaleCount, GENDER_COUNT_MIN, guestMaleMax))
                }
                onStep={(delta) =>
                  props.onGuestMaleCountChange(stepCountInput(props.guestMaleCount, GENDER_COUNT_MIN, guestMaleMax, delta))
                }
              />
            </div>
          </div>
        </div>
        <div className="actions participant-header-actions">
          <SortModeSelect onChange={props.onSortModeChange} value={props.sortMode} />
          <span className="button-title-wrap" title="表示中のメンバーをすべて選択します。">
            <button
              className="button button-secondary participant-select-action-button"
              disabled={selectableMemberIds.length === 0 || allSelectableMembersSelected}
              title="表示中のメンバーをすべて選択します。"
              type="button"
              onClick={props.onSelectAll}
            >
              全選択
            </button>
          </span>
          <span className="button-title-wrap" title="選択をすべて解除します。">
            <button
              className="button button-secondary participant-select-action-button"
              disabled={selectedCount === 0}
              title="選択をすべて解除します。"
              type="button"
              onClick={props.onClear}
            >
              選択解除
            </button>
          </span>
        </div>
      </div>
      <div className="participant-dropdown-body">
        {props.members.length === 0 ? (
          <p className="status-message">メンバー未登録です。</p>
        ) : (
          <div className="participant-list">
            {props.members.map((member) => {
              const selected = props.selectedMemberIds.includes(member.id);

              return (
                <label className={`participant-card ${selected ? "participant-card-selected" : ""}`} key={member.id}>
                  <span className="participant-card-name">
                    <strong title={member.nickname}>{member.nickname}</strong>
                  </span>
                  <small className="participant-card-gender">{member.gender === "female" ? "女性" : "男性"}</small>
                  <input
                    checked={selected}
                    onChange={() => props.onToggle(member.id)}
                    type="checkbox"
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>
      <div className="participant-dropdown-actions">
        {props.error ? (
          <p className="participant-dropdown-error" role="alert">
            {props.error}
          </p>
        ) : null}
        <button className="button button-secondary" title="変更を破棄して閉じます。" type="button" onClick={props.onCancel}>
          キャンセル
        </button>
        <button className="button button-primary" title="選択したメンバーを確定します。" type="button" onClick={props.onConfirm}>
          OK
        </button>
      </div>
    </section>
  );
}

function SortModeSelect(props: {
  onChange: (mode: SortMode) => void;
  value: SortMode;
}) {
  return (
    <label className="sort-select-field">
      <span>並び順</span>
      <select
        title="メンバーの表示順を選びます。"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value === "kana" ? "kana" : "registered")}
      >
        <option value="registered">登録順（新しい順）</option>
        <option value="kana">アイウエオ順</option>
      </select>
    </label>
  );
}

function MemberManagementScreen(props: {
  activeMemberCount: number;
  editingMemberId: string | null;
  error: string;
  form: MemberFormInput;
  members: Member[];
  onBack: () => void;
  onCancelEdit: () => void;
  onChange: (value: MemberFormInput) => void;
  onDeactivate: (member: Member) => void;
  onEdit: (member: Member) => void;
  onSortModeChange: (mode: SortMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  sortMode: SortMode;
}) {
  return (
    <div className="member-management-screen">
      <section className="panel management-heading">
        <div>
          <p className="section-kicker">Members</p>
          <h2>メンバー登録</h2>
        </div>
        <button className="button button-secondary" type="button" onClick={props.onBack}>
          <HomeIcon size={18} />
          ホームへ
        </button>
      </section>
      <div className="grid member-management-grid">
        <MemberFormPanel
          activeMemberCount={props.activeMemberCount}
          editingMemberId={props.editingMemberId}
          error={props.error}
          form={props.form}
          onCancelEdit={props.onCancelEdit}
          onChange={props.onChange}
          onSubmit={props.onSubmit}
        />
        <MemberListPanel
          members={props.members}
          onDeactivate={props.onDeactivate}
          onEdit={props.onEdit}
          onSortModeChange={props.onSortModeChange}
          sortMode={props.sortMode}
        />
      </div>
    </div>
  );
}

function MemberFormPanel(props: {
  activeMemberCount: number;
  editingMemberId: string | null;
  error: string;
  form: MemberFormInput;
  onCancelEdit: () => void;
  onChange: (value: MemberFormInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const title = props.editingMemberId ? "メンバー編集" : "メンバー登録";

  return (
    <section className="panel member-form-panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <p className="muted">登録中: {props.activeMemberCount} / 99</p>
      </div>
      <div className="panel-body">
        <form className="form-grid" onSubmit={props.onSubmit}>
          <div className="inline-fields">
            <div className="field">
              <label htmlFor="nickname">ニックネーム</label>
              <input
                id="nickname"
                maxLength={10}
                onChange={(event) => props.onChange({ ...props.form, nickname: event.target.value })}
                required
                value={props.form.nickname}
              />
            </div>
          </div>
          <div className="inline-fields">
            <div className="field">
              <label htmlFor="fullName">氏名</label>
              <input
                id="fullName"
                onChange={(event) => props.onChange({ ...props.form, fullName: event.target.value })}
                value={props.form.fullName}
              />
            </div>
            <div className="field">
              <label htmlFor="gender">性別</label>
              <select
                id="gender"
                onChange={(event) => props.onChange({ ...props.form, gender: event.target.value === "male" ? "male" : "female" })}
                value={props.form.gender}
              >
                <option value="female">女性</option>
                <option value="male">男性</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="note">備考</label>
            <textarea
              id="note"
              onChange={(event) => props.onChange({ ...props.form, note: event.target.value })}
              value={props.form.note}
            />
          </div>
          {props.error ? <p className="error-message">{props.error}</p> : null}
          <div className="actions">
            <button className="button button-primary" type="submit">
              {props.editingMemberId ? <Save size={18} /> : <Plus size={18} />}
              {props.editingMemberId ? "更新" : "登録"}
            </button>
            {props.editingMemberId ? (
              <button className="button button-secondary" type="button" onClick={props.onCancelEdit}>
                キャンセル
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}

function clampCount(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function commitCountInput(value: string, min: number, max: number) {
  const parsed = parseCount(value);

  if (parsed === null) {
    return String(min);
  }

  return String(clampCount(parsed, min, max));
}

function stepCountInput(value: string, min: number, max: number, delta: number) {
  const parsed = parseCount(value);
  const base = parsed === null ? min - delta : parsed;

  return String(clampCount(base + delta, min, max));
}

function toDisplayCount(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.trunc(parsed));
}

function toUsableCourtCount(participantCount: number, requestedCourtCount: number | null) {
  if (requestedCourtCount === null || requestedCourtCount < 1) {
    return 0;
  }

  const maxUsableCourtCount = Math.floor(participantCount / 4);

  if (maxUsableCourtCount < 1) {
    return 0;
  }

  return Math.min(requestedCourtCount, maxUsableCourtCount);
}

function parseCount(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.trunc(parsed);
}

function MemberListPanel(props: {
  members: Member[];
  onDeactivate: (member: Member) => void;
  onEdit: (member: Member) => void;
  onSortModeChange: (mode: SortMode) => void;
  sortMode: SortMode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>メンバー一覧</h2>
        <div className="actions">
          <SortModeSelect onChange={props.onSortModeChange} value={props.sortMode} />
        </div>
      </div>
      <div className="panel-body">
        {props.members.length === 0 ? (
          <p className="status-message">メンバー未登録です。</p>
        ) : (
          <div className="member-list">
            {props.members.map((member) => (
              <article className="member-card" key={member.id}>
                <div className="member-main">
                  <div>
                    <div className="member-name">{member.nickname}</div>
                    <div className="muted">{member.fullName || "氏名未入力"}</div>
                  </div>
                  <span className="tag">{member.gender === "female" ? "女性" : "男性"}</span>
                </div>
                {member.note ? <p className="muted">{member.note}</p> : null}
                <div className="actions">
                  <button className="button button-secondary" type="button" onClick={() => props.onEdit(member)}>
                    編集
                  </button>
                  <button className="button button-danger" type="button" onClick={() => props.onDeactivate(member)}>
                    非表示
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function toMessage(error: unknown, fallback: string) {
  if (isFirebaseError(error)) {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "メールアドレスまたはパスワードが正しくありません。未登録の場合は新規登録してください。";
      case "auth/email-already-in-use":
        return "このメールアドレスは登録済みです。ログイン画面からログインしてください。";
      case "auth/weak-password":
        return "パスワードは6文字以上で入力してください。";
      case "auth/invalid-email":
        return "メールアドレスの形式を確認してください。";
      case "auth/operation-not-allowed":
        return "Firebase Authentication のメール/パスワード認証が有効になっているか確認してください。";
      case "auth/missing-email":
        return "メールアドレスを入力してください。";
      case "auth/network-request-failed":
        return "ネットワーク接続を確認してから、もう一度お試しください。";
      case "permission-denied":
        return "Firestore の権限設定によりメンバー情報へアクセスできません。Security Rules を確認してください。";
      case "unavailable":
        return "Firestore に接続できません。ネットワーク接続を確認してください。";
      default:
        return fallback;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function isFirebaseError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string";
}
