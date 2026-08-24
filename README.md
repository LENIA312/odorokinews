# odorokinews

架空世界「モーゼン・アングラ」で実際に出来事を発生させ、その出来事をニュースメディア
「モーゼン・クロニクル」が報道する、というコンセプトのニュースシミュレーションシステムです。

- 実装の詳細（DB構造・AIプロンプト・ルーティング・管理画面・地図の仕組み等）は
  [ARCHITECTURE.md](./ARCHITECTURE.md) を参照してください（機能追加のたびに更新される最新版）。
- [docs.md](./docs.md) はプロジェクト開始時の初期仕様書(v0.1)で、現状とは名称・スコープが
  乖離した歴史的資料です。

このリポジトリは docs.md の「v0.1 最小垂直スライス」
（1日1回、世界でイベントが発生 → ニュース記事が生成 → Webサイトに表示される）
を実装したものです。Cloudflare Workers / D1 / Workers AI / Cron Triggers のみで、
無料枠の範囲で動作する構成になっています。

## 構成

- **Webサイト（SSR）**: [Hono](https://hono.dev/) によるサーバーサイドレンダリング
  - `/` `/news` `/news/:id` — ニュース
  - `/world` — 世界・都市情報
  - `/people` `/people/:id` — 人物データベース
  - `/timeline` — 年表
  - `/economy` — 簡易経済情報
- **D1**: 世界・都市・企業・人物・イベント・ニュース・年表・経済データ・実行履歴を保存
- **Workers AI**: 「イベントAI」がその日の出来事を考え、「記者AI」がニュース記事に変換
- **Cron Trigger**: 1日1回、世界を1日進めるシミュレーションを自動実行
- **フォールバック**: AI呼び出しに失敗しても、既存の人物・企業のみを使った
  テンプレートベースの出来事/記事を生成し、DBが壊れないようにする

```
src/
  index.ts                    Honoアプリ本体（ルーティング + scheduledハンドラ）
  types.ts                    Env / DBの型定義
  db/queries.ts                D1クエリヘルパー
  simulation/
    runDailySimulation.ts      1日分のシミュレーションを実行するオーケストレーター
    prompts.ts                  イベントAI/記者AIへのプロンプト
    ai.ts                        Workers AI呼び出し + JSON抽出
    validate.ts                  AI出力のバリデーション/サニタイズ
    fallback.ts                  AI失敗時のフォールバックテンプレート
  views/                       サーバーサイドHTMLテンプレート
  utils/                       HTMLエスケープ・日付フォーマット
migrations/0001_init.sql      D1スキーマ
seed.sql                       初期データ（国・都市・企業・人物）
```

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. D1データベースの作成

```bash
npx wrangler d1 create odorokinews-db
```

出力された `database_id` を [wrangler.jsonc](./wrangler.jsonc) の
`d1_databases[0].database_id` に設定してください。

### 3. マイグレーション適用 + 初期データ投入

ローカル開発用:

```bash
npm run db:migrations:apply:local
npm run db:seed:local
```

本番（リモートD1）用（初回デプロイ後に一度だけ）:

```bash
npm run db:migrations:apply:remote
npm run db:seed:remote
```

### 3.5 人物データを追加したい場合（任意）

`seed.sql` の12人に加えて、[scripts/generate_people.mjs](./scripts/generate_people.mjs) で
既存の企業・都市に紐づく人物をまとめて生成できます。

```bash
node scripts/generate_people.mjs 100 > seed_more_people.sql
npx wrangler d1 execute odorokinews-db --local  --file=./seed_more_people.sql
npx wrangler d1 execute odorokinews-db --remote --file=./seed_more_people.sql
```

何度でも実行でき、実行するたびに新しい人物が追加されます（既存データは変更されません）。

### 4. ローカル開発

```bash
npm run dev
```

`http://localhost:8787` でサイトが確認できます。ローカルではWorkers AIの
実呼び出しは行われない（または失敗する）ため、基本的にフォールバック
テンプレート経路で動作を確認する形になります。

手動でシミュレーションを1回走らせたい場合は、`.dev.vars` に

```
ADMIN_TOKEN=好きな値
```

を設定してから、以下を実行してください。

```bash
curl -X POST http://localhost:8787/api/admin/simulate \
  -H "x-admin-token: 好きな値"
```

Cronハンドラ自体をローカルで試す場合は `wrangler dev --test-scheduled` を使い、
`http://localhost:8787/__scheduled` にアクセスしてください。

### 5. デプロイ

```bash
npm run deploy
```

デプロイ後、本番のADMIN_TOKENを設定する場合:

```bash
npx wrangler secret put ADMIN_TOKEN
```

Cron Trigger は `wrangler.jsonc` の `triggers.crons` で管理しています
（デフォルトは毎日 00:10 UTC）。

## 設定値

モデル名・AI呼び出し上限はコードにハードコードせず、`wrangler.jsonc` の
`vars` で管理しています（将来モデルが変わった場合はここだけ変更すれば良い設計）。

- `AI_EVENT_MODEL` / `AI_NEWS_MODEL`: Workers AIのモデル名
- `AI_MAX_CALLS_PER_RUN`: 1回のシミュレーションで許容するAI呼び出し回数の目安

## 今後の拡張（未実装）

docs.md 26章に準じて、以下は今回のスコープ外です。

- ダイナン以外の都市・他国
- 住民AI（1,000人規模の日次シミュレーション）
- 社会AI（世論・流行）
- 複数ニュース媒体・速報/続報
- 詳細な経済シミュレーション（株式市場・為替など）
