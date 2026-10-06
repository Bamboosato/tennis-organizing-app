# 実装・文書の整合確認記録

確認日: 2026-10-06

## 1. 対象と判定方法

確認開始時のローカル `main` は `ed269664ec1f175e7c8619653171b70b38133e3a`、package versionは `1.1.0`。`git ls-remote origin HEAD` でGitHub既定ブランチのHEADとの一致を確認した。作業開始時の未コミット変更はなし。

README、`docs/*.md`、環境変数の設定例を、ルート・共通シェル・認証・Firestore repository／Rules・API proxy・Guest採番・表示・PDF・PWA・テスト・CI設定と照合した。実装機能をソースで追い、文書の記載と根拠を対応付けた。

GitHubリポジトリ内の文書が対象。本番のFirebase／Vercel設定、外部APIの実稼働、実機の画面描画を今回確認したという意味ではない。

## 2. 確認観点

| 観点 | 照合内容 |
| --- | --- |
| 機能 | 認証、メンバー管理、ダブルス／シングルス、参加者選択、結果、PDF、URL別画面、PWA |
| 非機能 | APIキー秘匿、権限の実装箇所、通信依存、キャッシュ範囲、CI・テスト環境、端末差の未検証範囲 |
| データ | 人数・コート・回数境界、メンバー文書、日時フィールド、Guest採番、表示名とAPI値、形式別状態 |
| UI | ホームと条件入力の分離、PC／スマホメニュー、アカウント、Summary、性別記号、PDFの省略 |

正常系は機能と手順、異常系は入力・上流・設定エラー、境界値は形式別参加人数と各上限、状態遷移は認証・仮選択・タブ移動・リロード・ログアウト・非同期処理を切り分けた。

## 3. 不整合と文書対応

| 項目 | 確認した不整合・記載漏れ | 対応と根拠 |
| --- | --- | --- |
| バージョン | READMEがver1.00／package `1.0.0` を現行値として説明 | `package.json` の `1.1.0` と、シェルがその値をフッターへ表示することを反映 |
| 画面構成 | 条件入力・結果をホーム内と説明し、認証・フォームの実装位置が `src/app/page.tsx` のまま | 共通layoutと [AppClientShell](../src/app/AppClientShell.tsx)、4つのURL、機能画面での入力・結果へ修正 |
| シングルス | README・基幹要件で未記載、参加者下限が一律4人 | `matchFormat`、2–30人、1コート2人、モード非表示、結果とPDFの1対1表示を反映 |
| 参加者 | Guestログインと追加Guestの区別、確定時上限検証の違いが不明瞭 | 仮選択、初期値、登録ユーザーのOK時30人検証、Guestの生成時制約を明記 |
| 表示名 | APIへ性別記号付きの名前を送る説明が残っていた | APIはnameとgenderを別送信し、[表示関数](../src/features/matchups/formatParticipantDisplayName.ts)でF／Mを付与する仕様に修正 |
| 状態保持 | ログイン後リダイレクト、画面移動で編集状態破棄という説明 | 現在URLでの画面切替、タブ移動時のフォーム保持、形式別React state、リロード・ログアウト時初期化を記載 |
| Firestore | 保存しないprofileがデータ案にあり、サーバー日時フィールドが未記載 | [repository](../src/features/members/memberRepository.ts)の実際の保存項目、モデルへの取込範囲を反映 |
| 上限保証 | 99人上限・文字数制限の検証場所が曖昧 | クライアント検証と [Rules](../firestore.rules)の権限制御を区別。複数端末の同時登録を厳密に保証しないことを明記 |
| API | 形式別入力とシングルス応答検証が未記載 | [proxy](../src/app/api/matchups/generate/route.ts)のデフォルト値・エラーstatus／code・応答検証・未実装の制御を記載 |
| PDF | シングルス・ファイル名・30行予算・長文省略が未記載／古い改ページ目安 | [PDFモデル](../src/features/matchups/pdf/buildPdfDocumentModel.ts)と [描画](../src/features/matchups/pdf/exportMatchupPdf.ts)を反映。設計サンプル画像は最新出力の証跡ではないと明記 |
| PWA | README未記載、PWA設計に `/brand/` とロゴprecache・スプラッシュが欠落 | [SW](../public/sw.js)と [スプラッシュ](../src/components/pwa/PwaSplashScreen.tsx)を反映。完全オフライン機能とは区別 |
| テスト | 自動テストなしという古い記録と、Emulator・画面全体が未整備である現状の区別不足 | Vitest・PWAの5 E2E・Chromium・CIの対象と、認証CRUD／ナビ全体／実機等の未自動化範囲を明記 |
| 環境変数 | 必須4項目のビルド時条件、未使用のPreview bypass変数が不明瞭 | Firebase公開値の必須条件、proxyがbypass変数を読まないことをREADME・設定文書・設定例コメントへ反映 |
| 記録の時点 | 初回棚卸し・環境の「設定済み」が現行の確認結果に見える | ver1.00記録を履歴と明示。Firebase／Vercelの当時の証跡を保存し、今回再確認していないことを明記 |

アプリの実行コード、Security Rules、依存関係、テスト・CI設定は変更していない。`.env.local.example` の変更も説明コメントのみ。

## 4. 今回の検証と範囲

| 検証 | 結果 | 意図・選定理由 |
| --- | --- | --- |
| GitHub／ローカルHEAD比較 | 一致 | GitHub文書と違う実装を基準にしない |
| 実装と文書の静的照合 | 実施 | 機能漏れ・古い手順・未実装機能の誤記を検出 |
| `npm test` | 6ファイル・26件成功 | 既存のAPI／採番／表示／PDFモデルの仕様を確認 |
| Markdown相対リンク・見出しアンカー・コードブロック検査 | 成功 | READMEから文書・根拠へ到達できること |
| `git diff --check` | 成功 | 空白・パッチの形式不備を検出 |
| ローカルE2E | 未実施 | 文書とコメントだけの変更で、実行・UIへの影響がないため |

ローカルではクロスブラウザー・全件E2E・実機PWA・認証／Firestoreの実操作・実API・PDF描画・本番設定／デプロイは未確認。lint・型検査・build・auditも今回ローカルでは再実行していない。GitHub Actionsは既存のPRワークフローが別途実行する。

前提条件は元のクリーンな作業ツリーと既存依存関係。単体テストは一度の直列コマンドで実行し、同一実機に対する並列スクリプト実行は行っていない。

### 4.1 GitHub上の検証結果

[PR #21](https://github.com/Bamboosato/tennis-organizing-app/pull/21) の文書修正コミット `922f4c8` に対する [CI実行](https://github.com/Bamboosato/tennis-organizing-app/actions/runs/37401153193) は、lint・型検査・Vitest・build・Chromium E2Eまで成功し、最後の `Audit dependencies` で失敗した。Vercel Previewのデプロイチェックは成功。

`npm audit` の検出は24件（low 1、moderate 7、high 14、critical 2）。`package.json` と `package-lock.json` は確認開始時のmainと同一であり、今回の文書変更による依存追加・更新ではない。到達可能性や各修正方法の評価は今回の対象外。依存更新を行わず、失敗を記録する。過去のver1.00記録にある `found 0 vulnerabilities` は当時の結果であり、現在の監査結果には使用しない。

CIのChromium E2E成功は既存のPWAケースの範囲に限る。ローカルE2E未実施、および認証・メンバー管理・対戦表生成の実操作／クロスブラウザー／実機／本番設定の未確認範囲は変わらない。本節はPR段階の検証記録であり、マージ・本番デプロイ後の確認結果ではない。マージ状態はPR、デプロイ状態はVercelの履歴を参照する。

## 5. 文書更新時の再発防止

- 機能追加・変更時はREADMEの機能表と要件文書を同時に見直す。画面・API・保存・PWAの詳細は対応文書を更新する。
- versionは `package.json` を正とし、リリース履歴の数値と現行値を区別する。
- 「実装済み」「計画」「検証済み」を区別し、実装根拠・確認日・環境を付ける。
- テスト方針は現存するテストの対象と、今後検証する観点を区別する。結果にE2E範囲・理由・未実施範囲を残す。
- 古い本番設定・リリース証跡は消さず、履歴表示と現行文書へのリンクで誤読を防ぐ。
