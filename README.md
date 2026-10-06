# tennis-organizing-app

テニス練習会向けのメンバー管理とダブルス／シングルス対戦表作成アプリです。

公開URL: [tennis-organizing-app.bamboosato.com](https://tennis-organizing-app.bamboosato.com/)

既存の Vercel URL: [tennis-organizing-app.vercel.app](https://tennis-organizing-app.vercel.app/)

現行 package version: `1.1.0`（画面フッターは `v1.1.0`）。以下はリポジトリの現行実装に基づく説明です。

## 実装済み機能

| 機能 | 内容 |
| --- | --- |
| 認証 | Firebaseのメール／パスワード認証、新規ID登録、パスワード再設定、Guest（匿名）ログイン、ログアウト |
| メンバー管理 | ユーザー別にニックネーム・氏名・性別・備考を保存。登録・編集・非表示、登録順（新しい順）／アイウエオ順の切替。activeメンバーは画面上最大99人 |
| 参加者選択 | 登録メンバーと当日ゲストを組み合わせて最大30人。仮選択を `OK` で確定し、`キャンセル` で破棄 |
| ダブルス | 4–30人、通常／同性対決優先／混合対決優先。1コート4人 |
| シングルス | 2–30人、1対1の対戦。1コート2人。対戦モード選択はなく、性別は表示用に保持 |
| 条件入力 | 開催名、コート1–8面、実施1–20回。人数に対してコート数が多い場合は減算確認 |
| 対戦結果 | ラウンド別のコート・対戦者・休憩者・seed、完了トースト。参加者名は `佐藤 F`／`ゲスト01 M` のように性別記号付きで表示 |
| PDF | 両形式・両ログイン方式に対応。日本語フォント、A4縦、最大2コート横並び、休憩表示、ページ分割 |
| ナビゲーション | URL別画面、PCのタブ・対戦表メニュー、スマホの全画面メニュー、アカウントモーダル |
| PWA | Web App Manifest、productionでのService Worker登録、静的アセットキャッシュ、standalone起動時のスプラッシュ |

対戦組合せは、サーバー側の `/api/matchups/generate` を経由して `tennis-matchup-app` APIで生成します。`MATCHUP_API_KEY` はブラウザーに公開しません。

### 画面と利用手順

| URL | 内容 | Guestログイン |
| --- | --- | --- |
| `/` | アプリ説明と各機能へのリンク | 利用可 |
| `/members` | メンバー登録・編集・一覧・非表示 | 利用不可 |
| `/matchups/doubles` | ダブルスの条件入力・結果・PDF | 利用可 |
| `/matchups/singles` | シングルスの条件入力・結果・PDF | 利用可 |

未ログインでは各URLにログイン画面を表示します。メールログイン後はそのURLの画面を表示します。新規ID登録後はログイン画面へ戻り、改めてログインします。

1. メール／パスワード、または `Guestログイン` で開始します。
2. 登録ユーザーは必要に応じてメンバーを登録します。
3. ダブルスまたはシングルス画面で `メンバー選択` を開き、登録メンバーとゲスト人数を選んで `OK` を押します。Guestログインでは女性人数・男性人数を入力します。
4. 開催名・コート数・実施回数を設定し、ダブルスでは対戦モードも選びます。
5. `対戦表作成` を押します。コート減算確認が出た場合は `OK` で生成します。
6. 結果から `PDF作成` で保存します。

Guestログインと、登録ユーザーが追加する当日ゲストは別の扱いです。当日ゲストはメンバーとして保存せず、女性から先に `ゲスト01` から連番にします。

### 保存と制約

- メンバーはCloud Firestoreの `users/{uid}/members/{memberId}` に保存します。ローカル開発でも、設定したFirebase projectに書き込みます。
- 非表示は `inactive` への更新です。物理削除と復元UIはありません。99人上限はクライアントで検証し、Firestore Rulesは件数上限を強制しません。
- ダブルスとシングルスの条件・結果は別々にメモリー保持し、アプリ内の画面移動で維持します。再読み込みでは初期化し、ログアウト操作でもリセットします。結果の履歴保存・共有URLはありません。
- PWAは静的アセットのみをキャッシュします。画面HTML・API・FirestoreデータをService Workerでキャッシュせず、完全オフラインでの利用は提供しません。独自のインストールバナー・Push通知・Background Syncはありません。

## 文書

- [要件分析・現行設計](docs/requirements-design.md)
- [フローティングナビゲーション・URL別画面設計](docs/floating-navigation-ui-design.md)
- [PWA Service Worker・スプラッシュ設計](docs/pwa-service-worker-design.md)
- [実装・文書の整合確認記録](docs/implementation-documentation-audit.md)
- [ver1.00 リリース対象棚卸し（当時の記録）](docs/release-v1.00-scope.md)
- [Firebase 本番設定チェックリスト](docs/firebase-production-setup.md)
- [Vercel 本番設定チェックリスト](docs/vercel-production-setup.md)
- [PDFレイアウトサンプル 2コート](docs/pdf-layout-portrait-2-courts.png)
- [PDFレイアウトサンプル 3コート](docs/pdf-layout-portrait-3-courts.png)

PDFサンプルはダブルスの設計例です。現行の性別記号やシングルス表示は、現行設計とPDFモデルを参照してください。

## 開発環境

Next.js App Router、React、TypeScript、Firebase Client SDK、jsPDF／jspdf-autotableを使用します。Node.jsはCIと同じ `24.x` を基準にします。

`.env.local.example` を参考に `.env.local` を作成します。`.env.local` は秘密情報を含むためGit管理対象外です。

```powershell
npm ci
npm run dev
```

ローカルURLは `http://localhost:3000` です。必要な外部サービスはFirebase Authentication、Cloud Firestore、`tennis-matchup-app` APIです。

### 環境変数

| 変数 | 用途 | 必須条件 |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web SDK | 必須 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Authentication | 必須 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firestore project | 必須。Rules反映先と一致させる |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web app | 必須 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase config | Web app設定に合わせる |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase config | Web app設定に合わせる |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase config | Web app設定に合わせる。Firebase Analyticsの初期化はなし |
| `MATCHUP_API_BASE_URL` | 上流APIのbase URL | 未設定時は `https://tennis-matchup-app.vercel.app` |
| `MATCHUP_API_KEY` | 上流APIのBearer認証 | 対戦表生成時に必須。サーバー側のみ |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Protected Preview向けの設定例 | 通常不要。現行proxyはこの値を読み取りません |

Firebase Client SDKの必須4変数はビルド時にも必要です。`NEXT_PUBLIC_*` はブラウザー用設定です。Firebase Admin SDKは本アプリでは使用しません。`tennis-matchup-app` 側の管理・APIキー設定は別サービスで管理します。

`MATCHUP_API_KEY` は運用方針上ローカルと本番で共通とし、分離・ローテーションが必要な場合に変更します。

### 検証

```powershell
npm run lint
npx --no-install tsc --noEmit
npm test
npm run build
npm run test:e2e -- --workers=1
npm audit
```

- `npm test`: VitestでAPI proxy、ゲスト採番・内訳、参加者表示・Summary、PDFモデルを検証します。
- `npm run test:e2e`: PlaywrightのChromiumでmanifest、Service Worker配信・静的キャッシュ／API非キャッシュ、PWAスプラッシュ、アイコンURLを検証します。認証・メンバー管理・生成操作全体のE2Eではありません。
- E2Eは本番ビルド後の `next start` をポート `3001` で起動します。先に `npm run build` を実行してください。`reuseExistingServer: true` のため、既存サーバーを再利用する場合は最新ビルドか確認します。実行は同一端末で直列にします。
- E2Eのサーバー設定はFirebaseのダミー値を指定しますが、`NEXT_PUBLIC_*` はビルド時に埋め込まれます。認証・Firestoreの検証用環境やEmulator接続は別途必要です。
- [GitHub Actions](.github/workflows/ci.yml) は `main` へのpush・PRでNode.js 24を使い、lint、型検査、Vitest、build、Chromium E2E、auditを実行します。

変更の影響に応じてE2Eを未実施／対象ケースのみ／クロスブラウザー／全件から選び、選定理由と未実施範囲を記録します。主要な手動確認観点は[要件文書](docs/requirements-design.md#7-テスト設計)を参照してください。

## Firebase Rules

Firebase AuthenticationのEmail/Password・Anonymous providerを有効化し、Cloud Firestoreを準備します。[Firebase設定文書](docs/firebase-production-setup.md)を参照してください。

Rulesは本人のpassword providerにread/create/updateを許可し、Guestと物理deleteを許可しません。`.firebaserc` のdefault projectは `tennis-organizing-app` です。反映前に対象projectを確認します。

```powershell
firebase login
firebase use tennis-organizing-app
firebase deploy --only firestore:rules --project tennis-organizing-app
```

## デプロイとバージョン

- VercelはGitHubリポジトリと連携し、Production Branchの `main` へのmerge／pushで本番デプロイする運用です。
- 設定手順・初回設定記録は[Vercel設定文書](docs/vercel-production-setup.md)を参照してください。記録済みの環境状態は作業時に再確認します。
- Previewを使う場合は必要な環境変数を別途設定します。ver1.00初回リリースではPreviewを使用しませんでした。
- versionは `package.json` を正とし、フッターもその値を参照します。現行は `1.1.0` です。
- `ver1.00`、package version `1.0.0`、release branch `codex/release-v1.00`、tag名 `v1.00` は初回リリースの方針です。現行の固定値にはしません。
