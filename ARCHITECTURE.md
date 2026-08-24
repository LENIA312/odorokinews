# モーゼン・クロニクル システムドキュメント

最終更新: 2026-08-25

> **このドキュメントについて**
> このプロジェクトの「今の実装がどうなっているか」を網羅的にまとめた技術リファレンスです。
> `docs.md` はプロジェクト開始時に書かれた**初期仕様書(v0.1)**であり、現状とは名称・スコープが
> 乖離しています（歴史的資料として残しています）。実装の詳細を知りたい場合は本ドキュメントを参照してください。
>
> **運用ルール: 機能追加・変更を行うたびに、このファイルも必ず更新すること。**
> 特に以下を変更した場合は該当セクションを更新する: DBスキーマ（マイグレーション追加）、
> ルーティング、AIプロンプトの構造、管理画面の機能、地図の仕組み、環境変数・設定値。
> 末尾の「14. 更新履歴」にも1行で追記する。

## 目次

1. [概要・コンセプト](#1-概要コンセプト)
2. [技術スタック](#2-技術スタック)
3. [ディレクトリ構成](#3-ディレクトリ構成)
4. [データベース構造](#4-データベース構造d1--sqlite)
5. [世界進行の仕組み（シミュレーションパイプライン）](#5-世界進行の仕組みシミュレーションパイプライン)
6. [AIの仕組み・プロンプト構造](#6-aiの仕組みプロンプト構造)
7. [地図（マップ）システム](#7-地図マップシステム)
8. [管理画面（/admin）](#8-管理画面admin)
9. [ルーティング一覧](#9-ルーティング一覧)
10. [HTMLテンプレーティング / クライアントJSの流儀](#10-htmlテンプレーティング--クライアントjsの流儀)
11. [環境変数・シークレット・設定値](#11-環境変数シークレット設定値)
12. [運用コマンド](#12-運用コマンド)
13. [既知の制約・スコープ外](#13-既知の制約スコープ外)
14. [更新履歴](#14-更新履歴)

---

## 1. 概要・コンセプト

**モーゼン・クロニクル**（旧称 odorokinews）は、架空世界「**モーゼン・アングラ**」を舞台にしたニュースサイト。
公開URL: `https://odoroki.pisorium.com`（Cloudflare Workers の `*.workers.dev` でも到達可能）。
GitHubリポジトリ: `https://github.com/LENIA312/odorokinews`（public）。

コアコンセプトは「AIがニュースを創作する」のではなく、

```text
架空世界（DB上に人物・企業・都市が実在する）
    ↓
世界内でイベントが発生（イベントAI or フォールバックテンプレート）
    ↓
イベントの結果として世界の状態が変化（人物の状態・企業の状態・株価など）
    ↓
発生したイベントを記者AIがニュース記事化
    ↓
サイトに掲載
```

という順序を守ること。記事の内容は必ず「先に確定した出来事の事実」だけを根拠にする
（記者AI用プロンプトで新しい固有名詞・因果関係を創作することを明示的に禁止している）。

- 舞台となる国名: モーゼン・アングラ（world.name）
- 首都: ダイナン市（cities.id = 1、固定・常にActive）
- 世界暦: `world.current_date`（`YYYY-MM-DD`文字列）。2026-08-24 頃に一度 **1900年1月1日** へリセットされ、
  以後はニュース配信のたびに1日ずつ進む。
- サイト上では「シミュレーションである」ことを明記しない方針（ユーザー指示）。マップの説明文・時計の
  ラベルなどから「演出用」「シミュレーション」といった単語は意図的に排除している。

---

## 2. 技術スタック

| 技術 | 用途 |
|---|---|
| [Hono](https://hono.dev/) | ルーティング + SSR（HTMLをサーバー側で組み立てて返す） |
| Cloudflare Workers | 実行環境（`src/index.ts` の `fetch`/`scheduled` がエントリポイント） |
| Cloudflare D1 | SQLiteベースのDB（バインディング名 `DB`） |
| Cloudflare Workers AI | イベントAI・記者AI（バインディング名 `AI`、常にリモート実行） |
| Cloudflare Cron Triggers | 10分おきに「配信すべき時刻か」をチェック |
| TypeScript | 全ソース（`strict`ではないが型は概ね厳密に付けている） |
| Wrangler CLI | ローカル開発・マイグレーション・デプロイ |

外部npm依存は最小限（`hono` のみが実行時依存）。フロントエンドのビルドツールは使わず、
サーバー側で文字列結合により `<script>` の中身（生JS）を組み立てて返している（詳細は10章）。

---

## 3. ディレクトリ構成

```
src/
  index.ts                    Honoアプリ本体。全ルーティング + scheduled(Cron)ハンドラ
  types.ts                    Env / 各DBテーブル行の型定義
  constants.ts                サイト全体で共有する定数（カテゴリ・ステータス等のenum的配列）
  db/
    queries.ts                 D1クエリのヘルパー関数（SELECT/INSERT/UPDATE/DELETE全部ここ経由）
  simulation/
    runDailySimulation.ts      1回分の「世界を1日進める」処理のオーケストレーター
    prompts.ts                  イベントAI/記者AIへ渡すプロンプトの組み立て
    ai.ts                        Workers AI呼び出し + レスポンスからのJSON抽出
    validate.ts                  AI出力のバリデーション/サニタイズ（state_changesの検証も含む）
    stateChanges.ts              state_changes配列を実際にDBへ適用する共通処理
    fallback.ts                  AI失敗時に使うテンプレートベースのイベント/記事生成
    schedule.ts                  自動配信時刻(JST)の判定ロジック
  views/                       サーバーサイドHTMLテンプレート（ページ単位）
    layout.ts                    共通レイアウト（ヘッダー・時計・ナビ・フッター）
    admin.ts                     管理画面(/admin)全体（HTML+CSS+クライアントJSをすべて1ファイルで生成）
    map.ts                       地図(/map)のSVG生成 + クライアントJS（パン/ズーム・人物アニメーション）
    mapZones.ts                  地図のゾーン配置・道路網の構築ロジック（DBを描画用データへ変換）
    newsList.ts / newsDetail.ts / people.ts / personDetail.ts / world.ts / timeline.ts / economy.ts / notFound.ts
                                  各ページのビュー
    components.ts                 小さな共通コンポーネント（leadFromBody等）
  utils/
    html.ts                      `html`タグ付きテンプレート（自動エスケープ）と`raw()`
    date.ts                      世界日付のフォーマット関数
    kana.ts                      人物一覧の50音インデックス判定
migrations/0001〜0006_*.sql   D1スキーマ（マイグレーション、詳細は4章）
scripts/
  generate_people.mjs           既存の企業・都市に紐づく人物を大量生成するスクリプト（任意実行）
  backfill_kana.mjs             既存人物へのふりがな一括付与（一度きり使用）
  reset_to_1900.sql             世界暦とニュースを1900-01-01からやり直すためのリセットSQL
seed.sql / seed_more_people.sql D1への初期データ投入（国・都市・企業・人物）
wrangler.jsonc                 Workers設定（D1/AIバインディング、Cron、vars）
```

---

## 4. データベース構造（D1 / SQLite）

### 4.1 テーブル一覧（マイグレーション適用後の最終形）

#### `world`（常に1行のみ、`id=1`固定）

| 列 | 型 | 追加元 | 説明 |
|---|---|---|---|
| id | INTEGER PK | 0001 | 常に1 |
| name / name_en | TEXT | 0001 | 国名（モーゼン・アングラ / Mose'n Ungra） |
| origin_story | TEXT | 0001 | 建国神話（世界観フレーバーテキスト） |
| current_date | TEXT | 0001 | 世界暦 `YYYY-MM-DD`。ニュース配信のたびに+1日 |
| auto_publish_times | TEXT | 0003 | JSON配列 `["10:00","22:00"]` 等（JST）。管理画面から変更可能 |
| last_auto_publish_slot | TEXT | 0003 | 直近に自動実行した枠 `"YYYY-MM-DD HH:MM"`（二重実行防止） |
| last_published_at | TEXT | 0004 | 直近の配信ISO時刻（ヘッダー時計の秒針計算に使用） |
| weather | TEXT | 0006 | 現在の天候（`WEATHER_CONDITIONS`のいずれか）。管理画面から変更可 |
| created_at / updated_at | TEXT | 0001 | |

#### `cities`

| 列 | 型 | 追加元 | 説明 |
|---|---|---|---|
| id | INTEGER PK | 0001 | `1`=ダイナン市（首都・常にActive・削除不可の扱い） |
| name | TEXT | 0001 | |
| is_major | INTEGER | 0001 | 未使用に近い（管理画面には露出していない） |
| population | INTEGER? | 0001 | |
| description | TEXT? | 0001 | |
| industries | TEXT? | 0001 | JSON配列文字列（例 `["漁業","観光"]`） |
| status | TEXT | 0005 | `active` \| `draft`。Activeな都市のみ日次シミュレーションの舞台候補になる |
| map_x / map_y | REAL? | 0005 | 地図上のランドマーク座標（`id=1`以外の都市のみ地図に描画される。詳細は7章） |
| created_at / updated_at | TEXT | 0001 | |

#### `organizations`

| 列 | 型 | 追加元 | 説明 |
|---|---|---|---|
| id | INTEGER PK | 0001 | |
| name | TEXT | 0001 | |
| kind | TEXT | 0001 | `ORG_KINDS`: company / government / school / other |
| city_id | INTEGER? FK→cities | 0001 | 所属都市。企業作成時に指定可能（デフォルト1） |
| description | TEXT? | 0001 | |
| status | TEXT | 0001 | `ORG_STATUSES`: active / expanding / under_investigation / recovering / celebrating / bankrupt |
| industry | TEXT? | 0004 | 業種（例: 製造・造船） |
| employee_scale | TEXT? | 0004 | 従業員規模（例: 数百人） |
| founded_year | INTEGER? | 0004 | 創業年 |
| map_x / map_y | REAL? | 0004 | 地図上の座標（新規企業は自動配置。7章参照） |
| created_at / updated_at | TEXT | 0001 | |

企業が `bankrupt` になると、そこに勤めていた `people.organization_id` は自動的に `NULL` に戻る
（管理画面からの手動変更・AIのstate_changes経由のどちらでも同じ挙動。`clearPeopleOrganization` / `applyStateChanges`）。

#### `people`

| 列 | 型 | 追加元 | 説明 |
|---|---|---|---|
| id | INTEGER PK | 0001 | |
| name | TEXT | 0001 | |
| name_kana | TEXT? | 0002 | ふりがな（ひらがな）。50音ソート・検索・50音インデックスに使用 |
| age / gender | | 0001 | |
| city_id | INTEGER? FK→cities | 0001 | 所属都市。マップでの拠点判定に使う |
| occupation | TEXT? | 0001 | 自由入力のTEXT。管理画面のUIは`occupation_types`（後述）から選ぶ形式に制限しているが、DB上の制約(FK)ではない。AIが`new_people`で新規作成する人物の職業は従来通り自由入力のまま（`occupation_types`に無い値も付きうる） |
| organization_id | INTEGER? FK→organizations | 0001 | |
| money | INTEGER | 0001 | 所持金（現状ゲームプレイには未使用、表示のみ） |
| status | TEXT | 0001 | `PERSON_STATUSES`: alive / sick / injured / hospitalized / deceased / celebrating / under_investigation |
| origin | TEXT | 0001 | `simulation`(seed投入) / `news_generated`(AIが記事内で新規作成) / `admin_manual`(管理画面から追加。出産記録経由の新生児もこれ) |
| bio | TEXT? | 0001 | |
| annual_income | INTEGER? | 0007 | 年収。AIが新規作成する人物には付与されず（`null`のまま）、管理画面から後で設定する想定 |
| job_title | TEXT? | 0007 | 役職（例: 課長、代表取締役）。`occupation`（職業）とは別軸 |
| birth_date | TEXT? | 0007 | 生年月日。世界暦 `YYYY-MM-DD`。`age`から自動算出はしない（別々に管理する静的な値） |
| birthplace | TEXT? | 0007 | 生まれ（自由記述）。出産記録機能を使うと母親の所在都市名が自動で入る |
| created_at / updated_at | TEXT | 0001 | |

#### `relationships`

`person_id` ↔ `related_person_id` の関係。**必ず両方向で1組のペアとして保存する**（例:
Aの行が `relation_type='family_parent'`＝「Bは私の親」なら、Bの行は `relation_type='family_child'`＝
「Aは私の子」を持つ）。`RELATION_TYPES`（`constants.ts`）: `family_parent` / `family_child` /
`family_sibling` / `spouse` / `colleague` / `friend`。逆方向の対応表は `RELATION_TYPE_REVERSE`
（spouse/colleague/friend/family_siblingは自分自身が逆、family_parent⇔family_childのみ非対称）。

ペアの作成・削除は必ず `createRelationshipPair`/`deleteRelationshipPair`（`db/queries.ts`）経由で行い、
手動で片方だけINSERT/DELETEしない（家系図表示・関係一覧の整合性が崩れるため）。管理画面の人物編集
画面から直接追加・解除でき（8章）、「出産を記録」機能を使うと親子関係（+既存の子との`family_sibling`）が
自動的に作られる。人物詳細ページ(`/people/:id`)の「家系図」セクションは、この`family_*`/`spouse`関係を
世代別（親・本人+配偶者・兄弟姉妹・子）に整理して表示する（`personDetail.ts`の`buildFamilyTree`、
DB問い合わせは直接の関係のみで祖父母・孫までは辿らない）。

#### `events`（「実際に起きたこと」の事実レコード）

| 列 | 型 | 説明 |
|---|---|---|
| id | INTEGER PK | |
| world_date | TEXT | イベントが起きた世界日付 |
| event_type | TEXT | AIが決めた種別（business/incident/magic_phenomenon等）、管理画面の手動作成では `manual` |
| location_city_id | INTEGER? FK→cities | |
| summary / detail | TEXT | 事実の要約・詳細 |
| related_people / related_organizations | TEXT | JSON配列（ID） |
| world_state_impact | TEXT | 適用されたstate_changesの記録（JSON、監査用） |
| is_newsworthy | INTEGER | 常に1（将来「報道されない出来事」用に予約） |
| news_id | INTEGER? | 対応する記事（記事作成後にUPDATEで設定） |
| source | TEXT | `ai` / `fallback_template` / `admin_manual` / `admin_ai_assisted` |
| created_at | TEXT | |

#### `news`（実際に公開される記事）

| 列 | 型 | 説明 |
|---|---|---|
| id | INTEGER PK | |
| title / body | TEXT | |
| published_at | TEXT | 実時刻（記事が公開された実際の日時） |
| occurred_at | TEXT | 世界暦（`events.world_date`と同じ値を入れる） |
| category | TEXT | `NEWS_CATEGORIES` のいずれか |
| related_people / related_organizations | TEXT | JSON配列（ID） |
| related_city_id | INTEGER? FK→cities | |
| event_id | INTEGER NOT NULL FK→events | 1記事=1イベント |
| reporter_person_id | INTEGER? FK→people | 0008で追加。記事末尾の「記者: (名前)」表記に使う。日次シミュレーションでは`getRandomReporterId`でその都市の`occupation='記者'`の人物からランダムに1人自動選出（該当なしなら`null`のまま表記なし）。管理画面のAI補助/完全手動作成では明示的に指定でき、未指定なら同じロジックで自動割り当てされる |
| generated_by | TEXT | AIモデル名 / `fallback_template` / `admin_ai_assisted` / `admin_manual` |
| created_at | TEXT | |

#### `occupation_types`（0008で新規追加）

職業を管理画面から追加・改名・削除できるマスターリスト。`id`, `name`(UNIQUE), `created_at`,
`updated_at`のみのシンプルなテーブル。**`people.occupation`とのFK制約は無い**
（既存データを壊さないための設計判断。4.1節`people`の occupation の説明を参照）。
管理画面の人物編集フォームはこのテーブルから選ばせるセレクトボックスになっており、
人物の現在の職業がこのリストに無い値でも選択肢として保持したまま表示する
（`occupationSelectOptions()`、`admin.ts`）。初期投入（0008マイグレーション内のINSERT）で
既存seedデータ・`generate_people.mjs`の職業プールを網羅した約70件 + `記者`を用意している。

#### `timeline`

年表ページ(`/timeline`)用。`news`作成時に必ず1行追加される（`world_date`, `event_id`, `headline`）。

#### `economic_data`（追記専用・更新削除なし）

| 列 | 型 | 説明 |
|---|---|---|
| id | INTEGER PK | 挿入順=新しさの判定に使う（下記コラム参照） |
| world_date | TEXT | |
| organization_id | INTEGER? FK→organizations | `NULL`なら`metric='price_index'`（国全体の物価指数） |
| metric | TEXT | `stock_price` \| `price_index` |
| value | REAL | |
| created_at | TEXT | |

> **「最新値」の取り方の注意点**: `MAX(world_date)` でGROUP BYすると、同一日付内に複数回更新があった
> 場合に非決定的になるバグを過去に踏んだ（`latestEconomicDataByOrg`/`latestPriceIndex`）。
> 現在は `MAX(id)` / `ORDER BY id DESC` を使う（追記専用テーブルなのでid=挿入順=真の新しさ）。

#### `simulation_runs`（日次シミュレーションの実行履歴）

`world_date` に `UNIQUE` 制約があり、同一世界日への二重実行を防ぐ。`status`: running/success/failed。
ニュース削除時（後述）、対応する `event_id`/`news_id` は `NULL` に戻すが、行自体は削除しない
（実行履歴としての監査証跡は残す）。

### 4.2 マイグレーション履歴

| ファイル | 内容 |
|---|---|
| `0001_init.sql` | 初期スキーマ全体（上記の基本列） |
| `0002_add_name_kana.sql` | `people.name_kana` + インデックス |
| `0003_admin_controls.sql` | `world.auto_publish_times` / `last_auto_publish_slot` |
| `0004_org_enrichment.sql` | `organizations.industry/employee_scale/founded_year/map_x/map_y`、`world.last_published_at`、創業6社への座標・業種の一括UPDATE |
| `0005_city_management.sql` | `cities.status/map_x/map_y`。ダイナン市(id=1)を`active`かつ座標(650,430)に設定 |
| `0006_weather.sql` | `world.weather`（デフォルト `'晴れ'`） |
| `0007_person_life_details.sql` | `people.annual_income/job_title/birth_date/birthplace` |
| `0008_occupations_and_reporters.sql` | `occupation_types`テーブル新規作成+初期データ約70件、記者2人をpeopleへ追加投入、`news.reporter_person_id` |

新しいマイグレーションを追加したら、このテーブルと4.1節の該当テーブルの説明を両方更新すること。

### 4.3 主要な定数（`src/constants.ts`）

| 定数 | 値 |
|---|---|
| `NEWS_CATEGORIES` | 社会, 経済, 政治, 事故, 文化, 科学, 魔法, スポーツ |
| `PERSON_STATUSES` | alive, sick, injured, hospitalized, deceased, celebrating, under_investigation |
| `PERSON_STATUS_LABEL` | 上記の日本語ラベル（例: sick→療養中）。people.ts/personDetail.ts/map.tsで共通利用 |
| `ORG_STATUSES` | active, expanding, under_investigation, recovering, celebrating, bankrupt |
| `ORG_KINDS` | company, government, school, other |
| `CITY_STATUSES` | active, draft |
| `WEATHER_CONDITIONS` | 晴れ, 曇り, 雨, 雷雨, 霧, 雪, 強風, 魔力嵐 |
| `RELATION_TYPES` | family_parent, family_child, family_sibling, spouse, colleague, friend |
| `RELATION_TYPE_LABEL` | 上記の日本語ラベル（親/子/兄弟姉妹/配偶者/同僚/友人） |
| `RELATION_TYPE_REVERSE` | ペア作成・削除時に使う逆方向の関係種別の対応表 |

これらはDBの生値バリデーション・プロンプトへの列挙・管理画面のセレクトボックス生成すべての
唯一のソースなので、値を増減する場合はここを変更するだけでよい設計になっている。

---

## 5. 世界進行の仕組み（シミュレーションパイプライン）

### 5.1 全体フロー（`src/simulation/runDailySimulation.ts`）

`runDailySimulation(env)` が1回呼ばれるたびに、世界の日付が1日進み、イベントとニュースが1件確定する。
呼び出し元は「Cronの`scheduled`ハンドラ」と「管理画面の `POST /api/admin/simulate`（手動実行）」の2つ。

```
1. world.current_date + 1日 = targetDate
2. simulation_runs に同じworld_dateの成功記録があればスキップ（二重実行防止）
3. simulation_runs に 'running' で1行INSERT
4. Active な都市からランダムに1件選択（listActiveCities）
   - 該当なしなら city_id=1（ダイナン市）にフォールバック
5. その都市に属する組織・人物・直近5件のイベントを取得
6. env.AI があり、AI呼び出し上限(AI_MAX_CALLS_PER_RUN)内なら:
   a. buildEventPrompt() でプロンプトを組み立て、イベントAIを呼ぶ
   b. validateEventDraft() で検証。直前イベントと同じ組織が主役なら機械的に却下しフォールバックへ
   c. 検証OKなら source='ai'、NGならフォールバックテンプレートへ
   AIが無ければ最初からフォールバック
7. イベントAIが提案した新規人物(new_people)をpeopleへINSERT
8. state_changes を applyStateChanges() で実際にDBへ適用（6章・stateChanges.ts参照）
9. AIが株価変動を提案しなかった上場企業には±5%の自動微変動を与える
   （「ニュースがあったのに経済が全く動かない」ズレを防ぐ、daily simulation限定の挙動）
10. events テーブルへ1行INSERT
11. source==='ai'なら記者AIを呼び出し記事を生成、buildNewsPrompt()。
    失敗時やfallback経路では、イベントの事実だけから機械的に記事文面を組み立てる
12. news テーブルへ1行INSERT、events.news_id を更新、timelineへ1行追加
13. world.current_date / last_published_at を更新
14. simulation_runs を 'success' に更新（例外時は'failed'+エラーメッセージ）
```

### 5.2 Cron/スケジューリングの仕組み（`schedule.ts`）

`wrangler.jsonc` のCronは `*/10 * * * *`（10分おき）で固定。実際に「今このタイミングで配信すべきか」の
判定はコードではなくDB（`world.auto_publish_times`、JSON配列のJST時刻文字列）で行うため、**配信時刻を
変えるのに再デプロイは不要**（管理画面の設定タブから変更するだけで最大10分以内に反映される）。

- `findDueSlot(now, autoPublishTimes, lastSlot)`: 「もう過ぎているのにまだ実行していない最新の枠」を返す
- 二重発火防止は `world.last_auto_publish_slot` で行う（`scheduled`ハンドラが実行後に更新）
- `nextSlotUtcMillis()`: ヘッダーの「モーゼンの時計」が秒針を刻むための「次回配信予定時刻」計算に使用

### 5.3 都市選択ロジック（マルチシティ対応）

当初は `city_id=1`（ダイナン市）固定だったが、都市管理機能の追加後は
`listActiveCities()` で `status='active'` の都市一覧を取得し、その中からランダムに1件選ぶ。
選ばれた都市に **紐づく組織・人物のみ**（`listOrganizationsByCity`/`listPeopleByCity`）をAIプロンプトの
文脈として渡すため、都市をまたいだ無関係な人物・企業が誤って同じ出来事に登場することはない。
直近イベント一覧（`listRecentEvents`）だけは都市を問わず全体から取得している（重複回避・世界全体の
文脈提示のため）。

新しい都市をActiveにしただけでは組織・人物は自動生成されない。管理画面から手動で企業・人物を
追加するか、AIが記事内で新規人物(new_people)を作るのを待つ形になる（7章のマップ自動配置と合わせて
「まず空の都市として地図に現れ、徐々に中身が増えていく」という体験になる）。

### 5.4 state_changes の適用ルール（`stateChanges.ts` / `validate.ts`）

`state_changes` は「このイベントの結果として世界のどこがどう変わったか」を表す配列。3種類:

```ts
{ type: "person_status",       target_id: number, value: string /* PERSON_STATUSES */ }
{ type: "organization_status", target_id: number, value: string /* ORG_STATUSES */ }
{ type: "economic_stock_price", target_id: number, value: number }
```

適用ルール（`applyStateChanges`、日次シミュレーション・管理画面のAI補助作成・完全手動作成すべてで共通）:

- `person_status`: そのイベントに関係する人物（`related_people`に含まれるID）**のみ**が対象。無関係な人物へ
  波及しない安全策。
- `organization_status`: 対象組織のstatusを更新。`bankrupt`になった場合、そこに勤めていた人物全員の
  `organization_id`を自動的に`NULL`へ（=無所属に戻す）。
- `economic_stock_price`: 直近の株価が存在すればその**0.5〜2倍の範囲にクランプ**（AIの暴走的な数値を防ぐ）。
  初値の場合は100万を上限にクランプ。

検証（`validateStateChanges`、`validate.ts`）は、AI出力・管理画面からのリクエストの両方に対して
「対象IDが本当にそのイベントに関係する人物/組織か」「valueが許可された定数値か」をチェックし、
不正なものは黙って除外する（エラーで落とさず、安全な部分集合だけを採用する設計）。

### 5.5 フォールバック（`fallback.ts`）

AIが使えない/失敗した場合に必ず動く、テンプレートベースの出来事生成。5種類のテンプレート
（新サービス発表・軽微なトラブル・人物の功績が話題に・魔法現象の観測・業務提携）からランダムに1つ選び、
該当データ（企業/人物）が存在しない場合はそのテンプレートをスキップして次を試す。全部ダメでも
「特筆すべき出来事はなく平穏な一日」という汎用フォールバックが必ず成立するため、**シミュレーションが
完全に止まることはない**。

直前イベントと同じ組織が再度選ばれないよう、`runDailySimulation`側で候補から事前に除外している。

---

## 6. AIの仕組み・プロンプト構造

### 6.1 二段階AIパイプライン

1. **イベントAI**（`AI_EVENT_MODEL`）: 世界の状態（都市・組織一覧・人物一覧・直近イベント・天候）を見て、
   「今日起きた1つの主要な出来事」を構造化JSONで出力する。記事本文は書かない。
2. **記者AI**（`AI_NEWS_MODEL`）: イベントAIが出した「確定した事実」だけを見て、報道記事っぽい文体で
   タイトル・本文・カテゴリを書く。**事実にない新しい固有名詞・因果関係を創作することを明示的に禁止**。

この分離により、「AIが自由に嘘のニュースを書く」ことを構造的に防いでいる（`docs.md`のコアコンセプト）。

### 6.2 イベントAIプロンプト（`buildEventPrompt`, `prompts.ts`）

システムプロンプトの要点:
- 世界観（魔法・ファンタジー要素が住民にとって日常）の説明
- `related_people`/`related_organizations` は必ず与えられたID一覧から選ぶ（存在しないIDの捏造禁止）
- 新規人物は `related_people` に `{"new": {...}}` として1〜2件まで追加可
- 固定設定（都市名・人口・国名）の変更禁止、過度に暴力的な内容禁止
- **直近イベントとの重複禁止**を明示（さらにコード側でも直前1件との組織重複を機械的にブロックする
  二重の安全策、詳細は5.1節）
- state_changesを「反映しなくていい理由がない限り」空にしないことを強く指示

ユーザープロンプトに含まれる情報:
- 世界設定（国名・都市名・人口・都市説明・生成対象日付・現在の天候）
- **管理者からの指定（任意）**: 管理画面のAI補助作成機能から「必ず登場させる人物/組織」
  「ジャンル指定」「キーワード」を渡された場合のみ、専用セクションとして追記される（`EventHints`型）
- 参照可能な企業・組織一覧（id/name/kind/status）
- 参照可能な人物一覧（最大24件抜粋、id/name/age/occupation）
- 直近イベント一覧（新しい順、内容を含む）+ 直前イベントの主役組織名を明示して「別テーマにすること」と指示
- 出力JSONスキーマ（`event_type`, `summary`, `detail`, `involves_magic`, `related_people`,
  `related_organizations`, `state_changes`）

管理画面からの「必ず登場させる人物/組織」指定は、**AIが出力に含め忘れてもコード側で機械的に
`related_people`/`related_organizations` へ補完する**（5.3節・9章参照。プロンプト指示だけに頼らない）。

### 6.3 記者AIプロンプト（`buildNewsPrompt`, `prompts.ts`）

イベントAIが確定した事実（種別・要約・詳細・魔法関連か・関係人物名・関係組織名）だけを渡し、
「事実にない新しい固有名詞・数値・因果関係を勝手に作らない」ことを厳守させつつ、
**読んでくすっと笑ってしまうようなウィットに富んだ記事**を書くよう指示している
（誇張した言い回し・比喩・関係者コメント風の一言は、新しい「事実」を捏造しない範囲でOK。
ただし負傷・死亡など深刻な内容では被害者を茶化す不謹慎な表現は避けるよう明示）。
本文は5〜7段落程度（従来の3〜5段落からやや長めに変更）。出力は `title`/`body`/`category` のJSON。

管理画面のAI補助作成でジャンル指定がある場合、記者AIの出力カテゴリより**管理者の指定を優先**して
上書きする（`newsDraft.category = genre`、AIの自律性より明示的な指定を信頼する設計）。

記事の「記者」欄（`news.reporter_person_id`）はAIの出力スキームには含まれない。AIに書かせると
実在しない記者名を捏造しかねないため、**コード側で機械的に**（都市に紐づく`occupation='記者'`の
人物からランダム選出、または管理画面での明示指定）決定する。詳細は4.1節`news`テーブルの説明を参照。

### 6.4 バリデーション/サニタイズ（`validate.ts`）

AIの出力は信用せず、`validateEventDraft`/`validateNewsDraft`/`validateStateChanges` で必ず検証する。
文字数上限（要約200字・詳細600字・タイトル120字・本文5000字等）、許可された固定値以外の除去、
存在しないID参照の除去などをすべてここで行う。パース失敗やスキーマ不一致の場合は `null` を返し、
呼び出し側がフォールバックへ切り替える。

### 6.5 モデル設定

- `AI_EVENT_MODEL` / `AI_NEWS_MODEL`: 現在どちらも `@cf/meta/llama-3.1-8b-instruct-fp8`
  （`wrangler.jsonc`の`vars`で管理、コードへのハードコード禁止方針）
- `AI_MAX_CALLS_PER_RUN`: 1回のシミュレーションで許容するAI呼び出し回数（現在4）。管理画面のAI補助
  ニュース作成はこの上限とは別枠（呼ばれる頻度が低いため）
- `max_tokens`（`callAiForJson`/`callChatModel`, `ai.ts`）: 呼び出しごとに指定可能（既定900）。
  記事が長くなった対応として、記者AI呼び出し（日次シミュレーション・管理画面AI補助作成の両方）は
  `1600`を明示的に渡している。イベントAI呼び出しは既定の900のまま。
- Workers AIは**ローカル開発では実行できない**（`wrangler dev`のみでは`Binding AI needs to be run
  remotely`エラーになる）。動作確認は本番 or `wrangler dev --remote` で行う。

---

## 7. 地図（マップ）システム

`/map` ページと `GET /api/map/people`（人物の現在位置をポーリング取得するJSON API）で構成。
実座標データを持たない「模式図」で、DBの実データから毎リクエスト動的に組み立てる。

### 7.1 ゾーンの種類（`mapZones.ts`の`Zone`型）

| kind | 内容 |
|---|---|
| `org` | 組織（`organizations`テーブルの`map_x`/`map_y`から動的に構築） |
| `city` | ダイナン市(id=1)以外の都市のランドマーク（`cities`テーブルの`map_x`/`map_y`から構築） |
| `residential` / `other` | ダイナン市の固定ゾーン（`FIXED_ZONES`、大学・住宅街3箇所・商店街・公園、座標ハードコード） |

### 7.2 自動拡張ロジック

新しい組織・都市が追加されるたびに、地図は**既存の範囲の外側へ自動的に拡張**される:

- `assignNewOrgPosition(existingPoints)`: 既存ゾーン群のバウンディングボックス外側へ、他ゾーンと
  170px以上離れた位置を探索して配置。ダイナン市(id=1)所属の新規企業はこちらで**全既存ゾーン**を基準に配置。
- `assignNewCityPosition(existingPoints)`: 都市は企業よりずっと大きい区画なので、最低500pxの余白・
  400px以上の間隔を取って配置（`assignNewOrgPosition`と同じ探索アルゴリズムをスケールアップしたもの）。
- ダイナン市以外の都市に企業を追加する場合は、**その都市自身のランドマーク座標**を基準点として
  `assignNewOrgPosition([cityAnchor, ...同都市の既存企業])` を呼ぶ（ダイナン市のクラスタとは
  混ざらず、その都市の近くにまとまる）。

道路網（`buildAllEdges`）も同様に、創業時からの6組織+固定ゾーンは`FIXED_EDGES`で手動接続、
それ以外の組織・都市は最近傍ゾーンへ自動で1本道をつなぐ（`nearestZoneId`）。

表示範囲（SVGの`viewBox`）も `computeBounds()` でゾーン全体を包含するよう毎回動的に計算される
（`map.ts`）。マップの拡大・縮小（ホイール/ピンチ）・ドラッグ/スワイプでのパンはSVG要素内に
スコープされており、ページ全体のスクロール・拡大には影響しない。

### 7.3 人物の表示

`assignPersonZones()` が各人物へ「自宅ゾーン」「勤務先ゾーン」を割り当てる:
- `organization_id` があればそこが勤務先
- ダイナン市の住民で無所属なら、職業から大学/住宅街/商店街を推定
- **ダイナン市以外の都市の住民**は、専用の住宅街ゾーンがまだ無いため、所属組織が無ければ
  その都市自身のランドマークを自宅・勤務先の両方として扱う

クライアント側JS（`map.ts`のCLIENT_SCRIPT）が時刻に応じて自宅⇄勤務先を移動するアニメーションを
描画する（`computePosition`、経路はゾーングラフ上のBFS最短経路）。`status`が`hospitalized`/`deceased`の
人物は通勤ロジックより優先して病院/自宅に固定表示される。

組織の`status`が`active`以外（bankrupt等）や都市が`draft`の場合、そのゾーンに色付きリング
（`status-ring`）が表示される。直近ニュースに関係した組織には「注目」の光るリング
（`spotlight-ring`）も表示される。

### 7.4 人物検索・フォーカス・選択中インジケーター

マップ画面上部の検索ボックスから人物名（漢字/かな）で絞り込み、候補をタップするとその人物の
現在位置へパン&ズームし、一瞬だけ光る「フォーカスリング」を表示する（`focusOnPerson`、
`panZoom.focusOn`、`showFocusRing`。3秒で消える一過性の演出）。

これとは別に、**選択中の人物を継続的に示す「選択リング」**（`#selectionRing`）を用意している。
点をクリックする、または検索から選んだ場合、`selectedPersonId`にその人物のIDを保持し、
以後は`tick()`（毎フレームの位置更新ループ）内で呼ばれる`updateSelectionRing()`が、その人物の
現在位置（移動中でも追従する）に常時パルスアニメーション付きの円を表示し続ける。選択中の点自体も
`styleDot()`で半径7px・青いストローク太めに変えて視覚的に強調し、他の点に埋もれないよう
`peopleLayer`内で最前面へ再配置する。選択は新しい人物をクリック/検索するまで保持される
（明示的な解除UIは無い）。

---

## 8. 管理画面（/admin）

`GET /admin` は誰でも開けるが、中のデータ取得・操作API（`/api/admin/*`）はすべて
`x-admin-token` ヘッダーが `env.ADMIN_TOKEN` と一致しないと401を返す（`checkAdminAuth`）。
トークンはブラウザの`localStorage`にのみ保存し、サーバー側には保存しない。
`ADMIN_TOKEN`が未設定の場合、管理系エンドポイントは404を返す（存在を隠す）。

画面はタブ構成（`showTab()`、すべて1ページ内でJSによる表示切り替え）:

| タブ | 主な機能 |
|---|---|
| 概要 | 手動シミュレーション実行ボタン、実行履歴、最新ニュース一覧 |
| ニュース | 記事の一覧・編集（タイトル/本文/カテゴリ/**担当記者**）・**削除**・**新規作成**（AI補助 / 完全手動の2方式、担当記者の指定可） |
| 人物 | 職業タイプ管理、50音順一覧・**名前/職業/状態での絞込検索**・編集（役職/年収/生年月日/生まれ/**職業を選択式に変更**を含む全項目）・**新規作成**・**人間関係の追加/解除**・**出産の記録** |
| 経済 | 物価指数の更新、企業一覧・編集・**新規作成**（所在都市を選択可）、株価の個別更新 |
| 都市 | 都市の一覧・**新規作成**・編集（Active/Draftの切り替えを含む） |
| 設定 | 自動配信時刻の追加/削除/保存、**天候の変更** |

### 8.1 ニュース作成の2方式（詳細）

- **AIに依頼** (`POST /api/admin/news/generate`): 関連人物（検索式の複数選択）・関連組織
  （チェックボックス）・ジャンル・キーワードをすべて任意で指定。空でも通常のシミュレーションと同じ
  経路でAIが自律的に出来事を生成する。指定した人物・組織は、AIが出力に含めなくても機械的に
  `related_people`/`related_organizations`へ補完される。`env.AI`が使えない場合は503を返す
  （フォールバックへの黙った切り替えはしない＝管理者の意図を裏切らないため）。
- **完全手動** (`POST /api/admin/news/manual`): タイトル・本文・ジャンルをすべて直接入力。
  関連人物・組織を選んだ上で、任意で「状態変化」（人物の状態/組織の状態/株価）を直接指定できる。
  AIは一切使わない。

どちらの方式でも、`world.current_date`は進めない（=世界暦を跨がない補足記事という扱い）。
`events.source`/`news.generated_by` はそれぞれ `admin_ai_assisted` / `admin_manual` として記録される。
どちらの方式でも `reporterId` を任意で指定できる（未指定なら6.3節の通り自動割り当て）。

### 8.2 ニュース削除

`DELETE /api/admin/news/:id` は対応する `events`/`timeline` 行も削除し、`simulation_runs`からの
参照は`NULL`に戻す（実行履歴自体は消さない）。**人物・組織・経済へ既に適用された影響は取り消さない**
（記事の削除は「なかったことにする」機能ではない、という設計判断）。

### 8.3 人物・企業・都市の新規作成に共通する挙動

- 企業作成: 所在都市を選択可能（デフォルト1=ダイナン市）。地図上の座標は7.2節のロジックで自動決定。
- 都市作成: デフォルトは`draft`。地図上の座標も7.2節のロジックで自動決定。`id=1`を`draft`には
  戻せない（サーバー側でガード）。
- 人物作成: 所在都市を選択可能。`origin='admin_manual'`として記録。役職・年収・生年月日・生まれも
  作成時から指定可能（4.1節参照）。職業は8.5節の職業タイプから選択する（未登録の値も保持される）。

### 8.4 人間関係の追加/解除・出産の記録

人物編集画面内（**新規作成時は非表示**、既存人物の編集時のみ表示）に2つのサブセクションがある:

- **人間関係・家系図**: `GET /api/admin/people/:id/relationships` で現在の関係一覧を表示。
  名前検索で相手を選び、関係の種類（`RELATION_TYPES`）を選んで
  `POST /api/admin/relationships`（`{personId, relatedPersonId, relationType}`）で追加、
  一覧の「解除」ボタンから `DELETE /api/admin/relationships` で削除する。どちらも内部的には
  4.1節の`createRelationshipPair`/`deleteRelationshipPair`を呼び、両方向のペアを一括で
  作成/削除する。
- **出産を記録**: `POST /api/admin/people/childbirth`（`{motherId, fatherId?, name, name_kana?,
  gender?}`）。編集中の人物を母親として新しい人物を作成する。子は`age=0`・
  `birth_date=world.current_date`（記録した時点の世界暦）・`birthplace=母親の所在都市名`で
  作成され、母親（および指定があれば父親）との`family_parent`/`family_child`ペアが自動作成される。
  さらに母親の既存の子（今回生まれた子以外）がいれば、その子たちとの`family_sibling`ペアも
  自動的に張られる。

### 8.5 職業タイプ管理・人物一覧の絞込

人物タブ上部に「職業タイプ管理」パネル（初期状態は折りたたみ、表示/非表示ボタンで開閉）があり、
`occupation_types`テーブルへの追加・改名（`prompt()`ダイアログ）・削除（`confirm()`確認）ができる
（`GET/POST/PUT/DELETE /api/admin/occupation-types`）。追加・改名時、同名が既に存在すると
サーバー側のUNIQUE制約違反を捕捉して「この職業名はすでに登録されています」を返す。

人物一覧は、従来「直近更新50件」に固定されていて**全員が表示されない不具合があった**
（`listPeopleAdmin`のデフォルト`limit`を1000へ引き上げて解消）。名前検索に加えて職業・状態の
セレクトボックスで絞り込め、`GET /api/admin/people-list`に`q`/`occupation`/`status`を
組み合わせて渡せる（`listPeopleAdmin`、いずれも省略可）。

### 8.6 担当記者の指定（ニュース編集・作成共通）

ニュースの編集フォーム・作成フォーム（AI補助/完全手動どちらも）に「担当記者」の検索欄がある。
`GET /api/admin/people-list?occupation=記者` （職業タイプ管理で言う「記者」に限定した絞込）を
使って候補を出し、選択すると`reporterId`としてリクエストに含まれる。検索欄を空のままフォーカスすると
記者一覧がそのまま表示される。「解除」ボタンで指定なし（自動割り当てに戻す/外す）に戻せる。

---

## 9. ルーティング一覧

### 公開ページ（HTML）

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/` | トップ（最新ニュース10件） |
| GET | `/news` | ニュース一覧（`?category=`でカテゴリ絞り込み） |
| GET | `/news/:id` | 記事詳細 |
| GET | `/news/event/:eventId` | イベントIDから対応記事へリダイレクト |
| GET | `/world` | 世界・都市情報 |
| GET | `/people` | 人物一覧（50音順・検索・50音インデックス） |
| GET | `/people/:id` | 人物詳細 |
| GET | `/timeline` | 年表 |
| GET | `/economy` | 経済ページ（株価・物価指数） |
| GET | `/map` | 街の様子（地図） |
| GET | `/admin` | 管理画面（認証はAPI側） |

### 公開API（JSON）

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/map/people` | 人物の現在ゾーン・組織/都市のステータス・注目ニュースをJSONで返す |
| GET | `/api/health` | ヘルスチェック + 世界暦 |
| GET | `/api/clock` | ヘッダー時計用（世界暦・直近配信時刻・次回配信予定時刻・天候） |

### 管理API（要 `x-admin-token`）

| メソッド | パス | 内容 |
|---|---|---|
| POST | `/api/admin/simulate` | 手動でシミュレーションを1回実行 |
| GET | `/api/admin/status` | 概要タブ用の状態取得（世界・実行履歴・最新ニュース） |
| GET/PUT | `/api/admin/settings` | 自動配信時刻・天候の取得/自動配信時刻の更新 |
| PUT | `/api/admin/weather` | 天候の更新 |
| GET/POST | `/api/admin/cities` | 都市一覧取得 / 新規作成 |
| PUT | `/api/admin/cities/:id` | 都市の編集（id=1はActive固定） |
| GET | `/api/admin/news-list` | ニュース一覧（簡易） |
| GET/PUT/DELETE | `/api/admin/news/:id` | 記事の取得/編集/**削除** |
| POST | `/api/admin/news/generate` | AI補助でのニュース新規作成 |
| POST | `/api/admin/news/manual` | 完全手動でのニュース新規作成 |
| GET | `/api/admin/people-list` | 人物一覧（`?q=`名前検索・`?occupation=`・`?status=`絞込を組み合わせ可、既定1000件） |
| GET/PUT | `/api/admin/people/:id` | 人物の取得/編集 |
| POST | `/api/admin/people` | 人物の**新規作成** |
| GET | `/api/admin/people/:id/relationships` | その人物の人間関係一覧 |
| POST/DELETE | `/api/admin/relationships` | 人間関係の**追加/解除**（両方向ペア） |
| POST | `/api/admin/people/childbirth` | **出産の記録**（新規人物作成+親子/兄弟姉妹関係の自動作成） |
| GET/POST | `/api/admin/occupation-types` | 職業タイプの一覧取得/新規作成 |
| PUT/DELETE | `/api/admin/occupation-types/:id` | 職業タイプの改名/削除 |
| GET | `/api/admin/economy-list` | 経済タブ用の企業一覧+株価+物価指数 |
| POST/PUT | `/api/admin/organizations` `/organizations/:id` | 企業の新規作成/編集 |
| POST | `/api/admin/economy/stock` | 株価の個別更新 |
| PUT | `/api/admin/economy/price-index` | 物価指数の更新 |

### Cron

`scheduled()`（`src/index.ts`）が10分おきに呼ばれ、`findDueSlot()`が配信すべき枠を返した場合のみ
`runDailySimulation()`を実行する（5.2節）。

---

## 10. HTMLテンプレーティング / クライアントJSの流儀

- サーバー側HTMLは `src/utils/html.ts` の `` html`...` `` タグ付きテンプレートで組み立てる。
  埋め込んだ値は自動的にHTMLエスケープされる（XSS対策）。信頼できるHTML片（既にエスケープ済み、
  または意図的に生HTMLを埋め込みたい場合）は `raw(str)` でラップして `RawHtml` インスタンスにする。
  配列を埋め込む場合、中身が`RawHtml`ならそのまま結合、そうでなければ各要素をエスケープする
  （`.value`を先に取り出して配列化すると二重エスケープ/破損の原因になるので注意）。
- クライアント側の `<script>` の中身（`map.ts`の`CLIENT_SCRIPT`、`admin.ts`の`SCRIPT`）は、
  **TypeScriptのテンプレートリテラルではなく文字列配列 + `.join("\n")`** で書く。理由: `${}` を
  TypeScriptのビルド時に評価されず、ブラウザ側のJSとしてそのまま残したいため
  （素のテンプレートリテラルで書くと`${person.name}`などがビルド時に壊れる）。
- サーバー側で計算したデータを`<script>`タグ内に`JSON.stringify()`で埋め込む場合、
  必ず `.replace(/</g, "\\u003c")` を通す（`</script>`による早期タグクローズを防ぐ）。
- 管理画面(`admin.ts`)・地図(`map.ts`)はどちらも「1ファイルの中でHTML文字列配列+CSS文字列配列+
  JS文字列配列を全部組み立てて、最後に文字列結合して返す」という同じパターンを踏襲している。
  新しいUI要素を追加する際もこのパターンに合わせること。

### 動作確認の方法（このパターン特有の注意）

TypeScriptのコンパイル（`tsc --noEmit`）は文字列配列の中身までは検証してくれない
（ただの文字列なので）。変更のたびに以下を行うこと:

1. `npx tsc --noEmit` で型エラーがないか確認
2. 該当の文字列配列をNode.jsの`.cjs`ファイルとして書き出し、`node --check`で構文チェック
   （このセッションで使った手法。`export const X = [...]; module.exports = X.join("\n")`のように
   一時ファイル化して検証する）
3. SVGを触った場合はタグの開閉バランスをスクリプトでチェック（引用符を考慮したタグトークナイザ）
4. `wrangler dev --local` でローカルDBに対して実際にAPIを叩いて確認（Workers AIだけはローカルでは
   動かないため、AI関連は本番 or `--remote` で確認）

---

## 11. 環境変数・シークレット・設定値

`wrangler.jsonc` の `vars`（コードにハードコードしない方針）:

| 変数 | 値 | 説明 |
|---|---|---|
| `ENVIRONMENT` | `production` | |
| `AI_EVENT_MODEL` | `@cf/meta/llama-3.1-8b-instruct-fp8` | |
| `AI_NEWS_MODEL` | `@cf/meta/llama-3.1-8b-instruct-fp8` | |
| `AI_MAX_CALLS_PER_RUN` | `4` | |

シークレット（`wrangler secret put` で設定、`.dev.vars`にローカル用の値を置く）:

| 変数 | 説明 |
|---|---|
| `ADMIN_TOKEN` | 管理画面API認証用。未設定なら管理系エンドポイントは404 |

バインディング:

| 名前 | 種類 | 対象 |
|---|---|---|
| `DB` | D1 Database | `odorokinews-db`（database_id は `wrangler.jsonc` 参照） |
| `AI` | Workers AI | 常にリモート実行 |

Cronトリガー: `*/10 * * * *`（実際の配信頻度はDB側の`world.auto_publish_times`で管理、5.2節参照）。

---

## 12. 運用コマンド

```bash
# ローカル開発
npm run dev                              # wrangler dev（http://localhost:8787）

# マイグレーション
npm run db:migrations:apply:local
npm run db:migrations:apply:remote

# シード投入
npm run db:seed:local
npm run db:seed:remote

# デプロイ
npm run deploy

# 本番ログ
npm run tail
```

新しいマイグレーションファイルを追加したら、必ず `--local` で先に適用・動作確認してから
`--remote` を実行し、最後に `wrangler deploy` する（この順序を逆にしない）。

デプロイ前の型チェック: `npx tsc --noEmit`（package.jsonにスクリプト化していないので直接実行）。

---

## 13. 既知の制約・スコープ外

- Workers AIはローカル開発では実行不可（常にリモート）。
- 新しく`active`にした都市は、組織・人物が自動生成されるわけではない（手動追加 or AIの
  new_people頼み）。将来的に「都市ごとの初期シード生成」を作る余地がある。
- ニュース削除は世界状態のロールバックを行わない（意図的な設計、8.2節）。
- `relationships`（人間関係）は管理画面から手動で追加・出産記録経由で自動追加できるが、
  シミュレーション（AIのイベント生成）が自動で関係を追加する機能はまだ無い。
  家系図表示も直接の関係（親・子・兄弟姉妹・配偶者）のみで、祖父母・孫までは辿らない。
- 経済シミュレーションは簡易的（株価のクランプ付きランダム変動+AI提案のみ、需給モデル等は無い）。
- 住民1,000人規模の日次シミュレーションや複数ニュース媒体など、`docs.md`記載の将来拡張の多くは未着手。

---

## 14. 更新履歴

このセクションは機能追加・変更のたびに1行ずつ追記する（詳細は各章を参照）。

- 2026-08-25: 本ドキュメント新規作成。都市管理・天気機能・マップのモバイル対応・人物検索フォーカス・
  ニュースの削除/AI補助作成/完全手動作成・人物の新規作成までの実装状態を反映。
- 2026-08-25: 人物に年収/役職/生年月日/生まれを追加。人物ステータスに`sick`（療養中）を追加。
  人間関係を両方向ペアで管理する`RELATION_TYPES`を整備し、管理画面から人間関係の追加/解除・
  「出産の記録」（新規人物作成+親子/兄弟姉妹関係の自動作成）が可能に。人物詳細ページに家系図
  セクションを追加し、居住地表示のハードコードバグ（常に「ダイナン」表示）も修正。
- 2026-08-25: 記者AIの文体をユーモラス・やや長め（5〜7段落）に変更し、記事末尾に
  「記者: (名前)」の担当記者表記を追加（`news.reporter_person_id`、occupation='記者'の人物から
  自動選出 or 管理画面で明示指定）。職業を`occupation_types`マスターテーブルで管理画面から
  追加/改名/削除できるようにし、人物編集フォームの職業欄をセレクトボックスに変更。管理画面の
  人物一覧が50件上限で全員表示されなかった不具合を修正（既定1000件）し、名前/職業/状態での
  絞込検索を追加。マップの選択中/検索した人物に、移動にも追従する常時表示の選択リングを追加。
