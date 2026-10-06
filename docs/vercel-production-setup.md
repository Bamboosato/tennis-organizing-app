# tennis-organizing-app Vercel 本番設定チェックリスト

作成日: 2026-05-14

文書区分: 初回本番設定手順と2026-05の確認記録。2026-10-06の文書整合確認ではVercelのproject・ドメイン・環境変数を再確認していない。「設定済み」「完了」は当時の記録であり、利用時に再確認する。現行versionは `package.json`、機能は[README](../README.md)を正とする。

## 1. 目的

ver1.00 本番展開に必要な Vercel 側設定を固定する。

## 2. Project 登録状況

CLI確認結果:

| 項目 | 値 |
| --- | --- |
| Vercel scope | `bamboosato` |
| Project name | `tennis-organizing-app` |
| Project ID | `prj_z1XNHPZ5l6WCfxhARxot7HbzI0pI` |
| Production URL | `https://tennis-organizing-app.bamboosato.com` |
| Existing Vercel URL | `https://tennis-organizing-app.vercel.app` |
| Node.js version | `24.x` |
| CLI link | 済み |

実行コマンド:

```powershell
vercel project ls --filter tennis-organizing-app --format=json
vercel link --yes --project tennis-organizing-app
```

`vercel link` によりローカルに `.vercel/` が作成されたため、`.gitignore` で除外する。

2026-05-22 時点で、主公開URLを `https://tennis-organizing-app.bamboosato.com` に変更する。既存の Vercel URL `https://tennis-organizing-app.vercel.app` も継続利用可能とする。

## 3. Production Environment Variables

Production で確認済みの変数名:

| 変数 | 状態 |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | 設定済み |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | 設定済み |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | 設定済み |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | 設定済み |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 設定済み |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 設定済み |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | 設定済み |
| `MATCHUP_API_BASE_URL` | 設定済み |
| `MATCHUP_API_KEY` | 設定済み |

CLI確認コマンド:

```powershell
vercel env ls production --format=json
```

`MATCHUP_API_BASE_URL` と `MATCHUP_API_KEY` は、ローカル `.env.local` の値を利用して Production へ追加済み。値は表示しない。

現行ソースで必須のFirebase公開設定4項目はビルド時に埋め込まれるため、変更後は再ビルド・再デプロイが必要。`MATCHUP_API_KEY` はサーバー側proxyで利用し、未設定時の生成は500を返す。詳細は[READMEの環境変数](../README.md#環境変数)を参照する。

## 4. Preview Environment Variables

ver1.00 は `tennis-matchup-app` と同様に Preview Deployment を使用しない方針とする。したがって Preview Environment Variables の API 系2変数はリリース完了条件に含めない。

CLIで確認した Preview 変数名:

| 変数 | 状態 |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | 設定済み |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | 設定済み |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | 設定済み |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | 設定済み |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 設定済み |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 設定済み |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | 設定済み |
| `MATCHUP_API_BASE_URL` | 未設定 |
| `MATCHUP_API_KEY` | 未設定 |

CLI確認コマンド:

```powershell
vercel env ls preview --format=json
```

Preview を将来使う方針に変更する場合のみ、Vercel Dashboard または CLI で `MATCHUP_API_BASE_URL` と `MATCHUP_API_KEY` を Preview に追加する。今回の ver1.00 リリースでは Production Deployment のみを確認対象とし、Production 側の必要変数は設定済み。

`.env.local.example` の `VERCEL_AUTOMATION_BYPASS_SECRET` は設定例として存在するが、現行proxyは読み取らず、上流fetchに保護バイパス用ヘッダーを付けない。変数を設定するだけでProtected Previewを呼び出せる仕様ではない。

## 5. No.8 / No.9 完了判定

| No | 作業 | 状態 |
| --- | --- | --- |
| No.8 | Vercel Project 作成 / GitHub repo Import | 完了 |
| No.9 | Vercel Production Environment Variables 登録 | 完了 |
| No.9補足 | Preview Environment Variables の API 系2変数 | 対象外。ver1.00 では Preview Deployment を使用しない |
