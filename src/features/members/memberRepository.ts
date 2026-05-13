import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Member, MemberFormInput } from "./model";
import { buildSortKeyKana } from "./sortKeyKana";

const MAX_ACTIVE_MEMBERS = 99;

export function subscribeMembers(
  uid: string,
  onChange: (members: Member[]) => void,
  onError?: (error: Error) => void,
) {
  const membersRef = collection(db, "users", uid, "members");
  const membersQuery = query(membersRef, orderBy("displayOrder", "asc"));

  return onSnapshot(
    membersQuery,
    (snapshot) => {
      onChange(snapshot.docs.map(memberFromSnapshot));
    },
    (error) => {
      onError?.(error);
    },
  );
}

export async function addMember(uid: string, input: MemberFormInput, activeMemberCount: number) {
  if (activeMemberCount >= MAX_ACTIVE_MEMBERS) {
    throw new Error("登録できるメンバーは最大99人です。");
  }

  const now = new Date().toISOString();

  await addDoc(collection(db, "users", uid, "members"), {
    ...normalizeMemberInput(input),
    status: "active",
    displayOrder: Date.now(),
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });
}

export async function updateMember(uid: string, memberId: string, input: MemberFormInput) {
  await updateDoc(doc(db, "users", uid, "members", memberId), {
    ...normalizeMemberInput(input),
    updatedAt: new Date().toISOString(),
    updatedAtServer: serverTimestamp(),
  });
}

export async function deactivateMember(uid: string, memberId: string) {
  const now = new Date().toISOString();

  await updateDoc(doc(db, "users", uid, "members", memberId), {
    status: "inactive",
    deactivatedAt: now,
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  });
}

function normalizeMemberInput(input: MemberFormInput) {
  const nickname = input.nickname.trim();

  if (!nickname) {
    throw new Error("ニックネームを入力してください。");
  }

  return {
    nickname,
    fullName: input.fullName.trim(),
    gender: input.gender,
    note: input.note.trim(),
    sortKeyKana: buildSortKeyKana(nickname),
  };
}

function memberFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): Member {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    nickname: String(data.nickname ?? ""),
    fullName: String(data.fullName ?? ""),
    gender: data.gender === "male" ? "male" : "female",
    note: String(data.note ?? ""),
    sortKeyKana: String(data.sortKeyKana ?? ""),
    status: data.status === "inactive" ? "inactive" : "active",
    displayOrder: Number(data.displayOrder ?? 0),
    createdAt: String(data.createdAt ?? ""),
    updatedAt: String(data.updatedAt ?? ""),
    deactivatedAt: typeof data.deactivatedAt === "string" ? data.deactivatedAt : undefined,
  };
}
