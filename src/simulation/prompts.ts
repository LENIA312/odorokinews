import type { OrganizationRow, PersonRow, TimelineRow } from "../types";

export interface WorldContext {
  worldName: string;
  cityName: string;
  cityDescription: string;
  population: number | null;
  targetDate: string;
  organizations: OrganizationRow[];
  people: PersonRow[];
  recentTimeline: TimelineRow[];
}

const EVENT_SYSTEM_PROMPT = `あなたは架空世界シミュレーションの「イベントAI」です。
この世界はギャグ＋ファンタジー要素（魔法・ドラゴン・幽霊の住民票・妖精の会社員など）が
社会に普通に組み込まれていますが、住民はそれを不思議とは思わず、通常の日常として扱います。
あなたの仕事は、その世界で実際に起こりそうな「1つの主要な出来事」を考えることです。
ニュース記事そのものは書かず、出来事の事実だけを構造化データとして出力してください。

厳守事項:
- 出力は指定されたJSON形式のみ。説明文やMarkdownのコードフェンスは一切付けない。
- related_people / related_organizations は、必ず与えられたID一覧の中から選ぶこと。存在しないIDを作ってはいけない。
- どうしても新しい人物が必要な場合のみ related_people に {"new": {...}} を1〜2件まで追加してよい。
- 都市名・人口・国名などの固定設定を変更する内容にしないこと。
- 過度に暴力的・グロテスクな内容は避け、報道可能な範囲の出来事にすること。
- 直近のイベントと似た内容の繰り返しは避けること。
- 出来事によって関係する人物の状態（負傷・入院・死亡・称賛される等）、企業の状態
  （調査中・拡大中・回復中等）、あるいは株価に明確に影響が出るなら、
  それを state_changes として必ず反映すること。「反映しなくていい理由がない限り」
  空配列にはしないこと。世界の状態とニュースの内容が食い違うことは許されない。`;

export function buildEventPrompt(ctx: WorldContext): { system: string; user: string } {
  const orgList = ctx.organizations
    .map((o) => `- id=${o.id} name="${o.name}" kind=${o.kind} status=${o.status}`)
    .join("\n");
  const peopleList = ctx.people
    .slice(0, 24)
    .map((p) => `- id=${p.id} name="${p.name}" age=${p.age ?? "?"} occupation="${p.occupation ?? "不明"}"`)
    .join("\n");
  const recent = ctx.recentTimeline.length
    ? ctx.recentTimeline.map((t) => `- ${t.world_date}: ${t.headline}`).join("\n")
    : "(まだ記録がない)";

  const user = `# 世界設定
国名: ${ctx.worldName}
都市: ${ctx.cityName}（人口: ${ctx.population ?? "不明"}）
都市の説明: ${ctx.cityDescription}
生成対象の世界日付: ${ctx.targetDate}

# 参照可能な企業・組織
${orgList || "(なし)"}

# 参照可能な人物（一部抜粋）
${peopleList || "(なし)"}

# 直近のイベント（重複を避けること）
${recent}

# 出力JSONスキーマ
{
  "event_type": "string（例: business, incident, magic_phenomenon, award, politics など）",
  "summary": "string（1文の事実サマリー、40文字程度）",
  "detail": "string（2〜4文の詳細説明）",
  "involves_magic": true または false,
  "related_people": [ {"id": 数値} または {"new": {"name": "string", "age": 数値, "gender": "string", "occupation": "string", "organization_id": 数値またはnull}} ],
  "related_organizations": [ 上記一覧に存在するid の配列 ],
  "state_changes": [
    {"type": "person_status", "target_id": 数値, "value": "alive|injured|hospitalized|deceased|celebrating|under_investigation"},
    {"type": "organization_status", "target_id": 数値, "value": "active|expanding|under_investigation|recovering|celebrating"},
    {"type": "economic_stock_price", "target_id": 数値, "value": 数値}
  ]
}
state_changes は「イベントの結果として世界の状態が変わるなら必ず含める」ものです。
例えば事故で人が負傷したなら person_status、企業が不祥事を起こしたり業績を
伸ばしたりしたなら organization_status や economic_stock_price を含めてください。
本当に何も状態が変わらない出来事（雑談レベルの小ネタ等）の場合のみ空配列にしてください。
JSONのみを出力してください。`;

  return { system: EVENT_SYSTEM_PROMPT, user };
}

const NEWS_SYSTEM_PROMPT = `あなたは架空世界の報道機関「モーゼン・クロニクル」の記者AIです。
与えられた「出来事の事実」だけを根拠に、まじめな新聞・ニュース記事風の日本語記事を書いてください。

厳守事項:
- 与えられた事実にない新しい固有名詞・数値・因果関係を勝手に作らないこと。
- 世界観上のギャグ要素（魔法や幽霊など）が事実に含まれる場合も、記事内では特別視せず、通常の社会的出来事として淡々と報道すること。
- 出力は指定されたJSON形式のみ。説明文やMarkdownのコードフェンスは一切付けない。
- body は3〜5段落程度の日本語の文章（改行は\\nで表現してよい）。`;

export function buildNewsPrompt(
  ctx: { cityName: string; targetDate: string },
  event: {
    event_type: string;
    summary: string;
    detail: string;
    involves_magic: boolean;
    relatedPeopleNames: string[];
    relatedOrgNames: string[];
  }
): { system: string; user: string } {
  const user = `# 出来事の事実
発生都市: ${ctx.cityName}
発生日: ${ctx.targetDate}
種別: ${event.event_type}
概要: ${event.summary}
詳細: ${event.detail}
魔法関連: ${event.involves_magic ? "はい" : "いいえ"}
関係人物: ${event.relatedPeopleNames.join("、") || "(特になし)"}
関係組織: ${event.relatedOrgNames.join("、") || "(特になし)"}

# 出力JSONスキーマ
{
  "title": "string（記事タイトル、40文字程度）",
  "body": "string（記事本文）",
  "category": "社会 | 経済 | 政治 | 事故 | 文化 | 科学 | 魔法 | スポーツ のいずれか"
}
JSONのみを出力してください。`;

  return { system: NEWS_SYSTEM_PROMPT, user };
}
