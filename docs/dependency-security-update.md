# 依存更新・監査運用・検証結果

対応日: 2026-10-06。[実装前の対応案](dependency-vulnerability-response-plan.md)に沿った変更。

## 更新内容と監査結果

Next.js / `eslint-config-next` を `16.3.8` に更新し、PostCSS override を `8.5.29` に変更した。Firestore 配下に限定して `@grpc/grpc-js@1.14.5` を override し、上流の `~1.9.0` 制約だけでは解消できない advisory に対応した。互換範囲内の間接依存も更新した。`npm audit fix --force` は使用していない。

主要な解決版は `sharp@0.35.5`、`websocket-driver@0.7.5`、`protobufjs@7.6.6`、`dompurify@3.4.16`、`fflate@0.8.3`、`vitest@4.1.11`、`vite@8.3.2`。完全な版と依存関係は `package-lock.json` を正とする。Firebase 全体や React のメジャー更新は行っていない。

| 監査 | critical | high | moderate / low | 合計 |
| --- | ---: | ---: | ---: | ---: |
| 対応前の main CI | 2 | 14 | 8 | 24 |
| 対応後の全依存 | 0 | 5 | 0 | 5 |
| 対応後の本番依存（`--omit=dev`） | 0 | 0 | 0 | 0 |

Windows / Node.js `24.13.0` / npm `11.6.2` で `npm ci` による再インストールと再監査を実施した。critical 解消は例外設定によるものではなく、依存の更新によるもの。本番依存の判定は監査上の分類であり、アプリ全体に脆弱性が存在しないことを保証するものではない。

## 残る開発依存と監査のルール

残る5項目は `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces@3.0.3` の1原因。[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)には2026-10-06時点で公開修正版がない。本番依存には含まれず、アプリの HTTP 入力をこの lint 用 glob 経路へ渡す処理は確認されなかった。untrusted PR のソースをlintする経路はあるため、開発・CIリスクをゼロと扱わない。

`security-audit-exception.json` にこの advisory、5パッケージの版、理由、担当、期限を記録した。担当はリポジトリのmaintainer。期限は **2026-11-05 00:00 UTC（日本時間09:00）**。定期監視の自動化は未設定であり、依存更新PRまたは期限前の再評価時に手動確認する。

`npm run audit:security` は本番・全依存の監査を直列で取得して次を判定する。

- 本番依存に脆弱性があれば、深刻度にかかわらず失敗する。
- 全依存では上記 advisory に到達する開発専用・記録済み版の5項目だけを例外にする。パッケージ名だけで除外しない。
- critical は常に失敗する。同じパッケージに別の advisory が追加された場合も失敗する。
- 例外の版・依存経路・dev分類が変わった場合、期限切れ、原因チェーンの循環・欠落、通信失敗・不正な監査JSONも失敗する。
- JSON証跡は `.security-audit/production.json` / `full.json` に保存し、CIでは `dependency-audit` artifactとして保存する。

通常の `npm audit` はhigh 5項目が残るため終了コード1を返す。専用gateの成功を「全件解消」と表記しない。upstreamに修正版が出たら依存を更新し、全監査が0件になったことを確認して例外を削除する。期限延長や版の変更は自動では行わず、影響を再評価してPRでレビューする。

## 検証観点と範囲

先に機能（認証・Firestore・画面遷移・生成・PDF・PWA）、非機能（依存解決・Windows/Linux・通信と非同期）、データ（隔離データ・日本語・無効入力）、UI（PC/モバイル幅）を整理した。正常系、異常系、境界値、状態遷移を分けて検証した。

| 確認 | ローカル結果・検証意図 |
| --- | --- |
| `npm ci` | 成功。更新したlockfileで再インストールできること |
| lint / 型検査 / 本番build | 成功。Next.js、CSS、ネイティブ画像依存の更新後もビルドできること |
| 既存Vitest | 6ファイル・26ケース成功。APIの正常・不正入力・上流異常、ゲスト採番、表示・PDFモデルの回帰確認 |
| 監査ポリシー | 専用のNode.jsテストで正常な例外、期限の境界、critical、新規項目、版・分類の変化、取得失敗、原因循環を確認 |
| PWA E2E | Chromium 5ケース成功、1 worker。manifest、SW更新ヘッダー、静的キャッシュ・API非キャッシュ、スプラッシュ、アイコンを確認 |
| PC / モバイルの対象フロー | ダミー認証・生成レスポンスでGuest → ダブルス → モバイルメニュー → シングルス、生成結果、502エラー表示 → 再試行成功を確認 |
| PDFの実出力 | 日本語の開催名・性別記号を含むダブルスとシングルスで、実際のjsPDFダウンロードが成功。生成・認証はモック、PDF処理とフォント取得は実処理 |
| Firebase Emulator | Windows Java 21のselector初期化がloopback接続エラーで失敗し、ローカルではSDK通信の検証に到達せず。IPv4 / selector切替でも再現。Linux CIで同じSDK検証を必須化 |

画面確認の証跡はローカルの `output/playwright/` にある。確認中のconsoleにはローカルで未提供のVercel Analytics scriptの404と、意図した生成エラーの502があり、回復後にエラー表示が消えたことを確認した。

E2Eは「対象ケースのみ」を選定した。フレームワーク・CSS・PDF依存の更新による主要な回帰を確認する目的で、既存PWAケースとPC / モバイル幅の主要操作を実施した。Firefox / WebKit全件、全ての人数・コート・ラウンドの組み合わせ、実ユーザーのFirebaseデータ、実上流APIによる生成、PDF全ページの目視は未実施。本番の認証・書き込みは検証用操作で変更していない。

PWAテストは新しいビルドのサーバーを使用し、ケース内でSW・cacheを初期化する。同じ実機でブラウザーテストを並列実行せず、CIも `--workers=1` とした。

## SDK互換検証の再現手順

`scripts/firebase-security-smoke.mjs` はローカルEmulatorの接続先が指定されない場合に実行を拒否し、`demo-tennis-security` 専用projectと固定のテスト用設定を使用する。Node.js版Firebase Client SDKでAuthのsignup/login/logout、Firestoreの作成・取得・更新・query・snapshot購読/解除・削除を確認する。gRPC更新の互換性を、実アプリの部員データに触れずに検証する。

CIではJava 21と `firebase-tools@15.17.0` を使用する。ローカルでJava 21とFirebase CLIが使える場合のコマンドは次のとおり。

```powershell
firebase emulators:exec --only auth,firestore --project demo-tennis-security --config scripts/firebase-smoke.config.json "node scripts/firebase-security-smoke.mjs"
```

設定はloopbackのAuth `9199` / Firestore `8180` とUI無効を指定する。Emulatorは起動ごとに新しいデータを使い、既存のサーバーや本番projectを再利用しない。テスト専用RulesはSDK通信確認用であり、本番Rulesの置換や安全性検証ではない。失敗時はSDK例外とEmulatorログを分け、環境問題と互換性問題を切り分ける。

更新したNext.jsのサーバーtraceにはgRPC関連の補助ファイルが含まれるため、クライアント利用だけを根拠にサーバー成果物から完全に除外されたと断定していない。修正版を解決したうえでSDK通信を確認する。
