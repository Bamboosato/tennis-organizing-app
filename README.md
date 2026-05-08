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
