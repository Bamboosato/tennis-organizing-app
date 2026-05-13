# tennis-organizing-app

テニス練習会向けのメンバー管理と対戦表作成アプリです。

## Current Artifacts

- [要件分析・設計方針](docs/requirements-design.md)
- [PDFレイアウトサンプル 2コート](docs/pdf-layout-portrait-2-courts.png)
- [PDFレイアウトサンプル 3コート](docs/pdf-layout-portrait-3-courts.png)

## Setup Notes

開発時は `.env.local.example` を参考に `.env.local` を作成します。
`.env.local` は秘密情報を含むため Git 管理対象外です。

主な外部サービス:

- Firebase Authentication
- Cloud Firestore
- `tennis-matchup-app` API

## Development

```powershell
npm install
npm run dev
```

ローカルURL:

```txt
http://localhost:3000
```

検証:

```powershell
npm run lint
npm run build
```

## Firebase Rules

メンバー登録はローカル画面からでも Cloud Firestore へ保存します。
Firebase Console または Firebase CLI で `firestore.rules` を `tennis-organizing-app` に反映してください。

Firebase CLI を使う場合:

```powershell
firebase login
firebase use tennis-organizing-app
firebase deploy --only firestore:rules
```

## Implemented Scope

- Next.js App Router の初期構成
- Firebase Client SDK 初期化
- メール/パスワード認証
- 新規ID登録後にログイン画面へ戻るパスワード設定フロー
- Guestログイン
- `tennis-matchup-app` に近い条件入力型ホーム画面
- ホーム画面からのメンバー登録画面遷移
- Firestore `users/{uid}/members/{memberId}` へのメンバー登録、編集、非表示
- 登録順 / アイウエオ順の表示切替
