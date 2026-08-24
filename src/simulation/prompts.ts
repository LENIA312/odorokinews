import { ORG_STATUSES, PERSON_STATUSES, WEATHER_CONDITIONS } from "../constants";
import type { EventRow, OrganizationRow, PersonRow } from "../types";

export interface EventHints {
  mustIncludePersonIds?: number[];
  mustIncludeOrgIds?: number[];
  genre?: string | null;
  keywords?: string | null;
}

export interface WorldContext {
  worldName: string;
  cityId: number;
  cityName: string;
  cityDescription: string;
  population: number | null;
  targetDate: string;
  weather: string;
  organizations: OrganizationRow[];
  people: PersonRow[];
  recentEvents: EventRow[];
  hints?: EventHints;
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
  その場合、name/name_kana/age/gender/occupation に加えて job_title（役職。無ければ null）と
  annual_income（年収。学生や子供など収入が無い場合は0）も必ず埋めること。空欄のまま残さない。
- 出来事の内容として自然な場合のみ、new_organizations（新しい企業・組織）や new_facilities
  （新しい住宅街・公園・商店街などの施設）を1件程度追加してよい（例: 新しい店がオープンした、
  新しい公園が完成した、新しい会社が設立された、など）。無理に追加する必要はない。
  追加する場合、city_id には必ず下記の「この出来事の舞台となる都市のID」を指定すること。
- 都市名・人口・国名などの固定設定を変更する内容にしないこと。
- 過度に暴力的・グロテスクな内容は避け、報道可能な範囲の出来事にすること。
- 直近のイベントと似た内容の繰り返しは避けること。
- 出来事によって関係する人物の状態（負傷・入院・死亡・称賛される等）、企業の状態
  （調査中・拡大中・回復中等）、あるいは株価に明確に影響が出るなら、
  それを state_changes として必ず反映すること。「反映しなくていい理由がない限り」
  空配列にはしないこと。世界の状態とニュースの内容が食い違うことは許されない。
- weatherフィールドで、次に世界へ反映する天候を1つ選ぶこと。基本は現在の天候を維持し、
  季節感や出来事の内容に照らして自然な場合のみ変える。晴れ→曇り→雨のように段階を踏んだ
  推移を優先し、晴れから吹雪へ一気に飛ぶような不自然な急変は避けること（ただし出来事自体が
  天候にまつわる魔法現象などの場合はその限りではない）。`;

export function buildEventPrompt(ctx: WorldContext): { system: string; user: string } {
  const orgById = new Map(ctx.organizations.map((o) => [o.id, o]));
  const peopleById = new Map(ctx.people.map((p) => [p.id, p]));
  const orgList = ctx.organizations
    .map((o) => `- id=${o.id} name="${o.name}" kind=${o.kind} status=${o.status}`)
    .join("\n");
  const peopleList = ctx.people
    .slice(0, 24)
    .map((p) => `- id=${p.id} name="${p.name}" age=${p.age ?? "?"} occupation="${p.occupation ?? "不明"}"`)
    .join("\n");

  const parseOrgIds = (json: string | null): number[] => {
    if (!json) return [];
    try {
      const arr = JSON.parse(json);
      return Array.isArray(arr) ? arr.filter((v) => Number.isInteger(v)) : [];
    } catch {
      return [];
    }
  };

  const recent = ctx.recentEvents.length
    ? ctx.recentEvents
        .map((e) => {
          const orgNames = parseOrgIds(e.related_organizations)
            .map((id) => orgById.get(id)?.name)
            .filter(Boolean)
            .join("、");
          return `- ${e.world_date} [${e.event_type}]${orgNames ? ` (${orgNames})` : ""}: ${e.summary}`;
        })
        .join("\n")
    : "(まだ記録がない)";

  const lastEventOrgNames = ctx.recentEvents.length
    ? Array.from(
        new Set(
          parseOrgIds(ctx.recentEvents[0].related_organizations)
            .map((id) => orgById.get(id)?.name)
            .filter((n): n is string => Boolean(n))
        )
      )
    : [];

  const hints = ctx.hints;
  const mustPeopleNames = (hints?.mustIncludePersonIds ?? [])
    .map((id) => peopleById.get(id))
    .filter((p): p is PersonRow => Boolean(p))
    .map((p) => `id=${p.id} name="${p.name}"`);
  const mustOrgNames = (hints?.mustIncludeOrgIds ?? [])
    .map((id) => orgById.get(id))
    .filter((o): o is OrganizationRow => Boolean(o))
    .map((o) => `id=${o.id} name="${o.name}"`);
  const hasHints = mustPeopleNames.length > 0 || mustOrgNames.length > 0 || hints?.genre || hints?.keywords;
  const hintsSection = hasHints
    ? `\n# 管理者からの指定（必ず反映すること）
${mustPeopleNames.length ? `- 必ず登場させる人物: ${mustPeopleNames.join("、")}\n` : ""}${mustOrgNames.length ? `- 必ず登場させる組織: ${mustOrgNames.join("、")}\n` : ""}${hints?.genre ? `- ジャンル指定: ${hints.genre}\n` : ""}${hints?.keywords ? `- 含めたいキーワード: ${hints.keywords}\n` : ""}上記の指定は related_people / related_organizations に必ず含め、指定に沿った出来事にすること。\n`
    : "";

  const user = `# 世界設定
国名: ${ctx.worldName}
この出来事の舞台となる都市のID: ${ctx.cityId}
都市: ${ctx.cityName}（人口: ${ctx.population ?? "不明"}）
都市の説明: ${ctx.cityDescription}
生成対象の世界日付: ${ctx.targetDate}
現在の天候: ${ctx.weather}（出来事の内容と矛盾しないように。無理に天候そのものを話題にする必要はない）
${hintsSection}
# 参照可能な企業・組織
${orgList || "(なし)"}

# 参照可能な人物（一部抜粋）
${peopleList || "(なし)"}

# 直近のイベント（新しい順、内容も含む。同じような話の繰り返しは絶対に避けること）
${recent}
${lastEventOrgNames.length ? `\n直前のイベントは${lastEventOrgNames.join("、")}が主役だったため、今回は別の組織・別のテーマを主役にすること。` : ""}

# 出力JSONスキーマ
{
  "event_type": "string（例: business, incident, magic_phenomenon, award, politics など）",
  "summary": "string（1文の事実サマリー、40文字程度）",
  "detail": "string（2〜4文の詳細説明）",
  "involves_magic": true または false,
  "related_people": [ {"id": 数値} または {"new": {"name": "string", "name_kana": "string（nameのひらがな読み。例: 田中太郎→たなか たろう）", "age": 数値, "gender": "string", "occupation": "string", "organization_id": 数値またはnull, "job_title": "stringまたはnull（役職）", "annual_income": 数値（年収、収入が無ければ0）}} ],
  "related_organizations": [ 上記一覧に存在するid の配列 ],
  "new_organizations": [ {"name": "string", "kind": "company|government|school|other", "industry": "stringまたはnull", "city_id": ${ctx.cityId}} ]（任意、無ければ空配列）,
  "new_facilities": [ {"name": "string", "kind": "residential|university|park|shopping_street|other", "city_id": ${ctx.cityId}} ]（任意、無ければ空配列）,
  "weather": "${WEATHER_CONDITIONS.join("|")}"（次に世界へ反映する天候。変える必要が無ければ現在と同じ値でよい）,
  "state_changes": [
    {"type": "person_status", "target_id": 数値, "value": "${PERSON_STATUSES.join("|")}"},
    {"type": "organization_status", "target_id": 数値, "value": "${ORG_STATUSES.join("|")}"},
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
与えられた「出来事の事実」だけを根拠に、読んだ人が思わずくすっと笑ってしまうような、
ウィットに富んだ新聞・ニュース記事風の日本語記事を書いてください。

厳守事項:
- 与えられた事実にない新しい固有名詞・数値・因果関係を勝手に作らないこと。ただし、ユーモアを
  出すための誇張した言い回し・比喩・住民や関係者のコメント風の一言などは、新しい「事実」を
  捏造しない範囲で自由に加えてよい。
- 世界観上のギャグ要素（魔法や幽霊など）は特別視せず通常の社会的出来事として報道しつつ、
  語り口はできるだけ愉快に、時にはかなり突飛な例え・大げさな表現を使ってよい。生真面目で
  淡々とした記事にはしないこと。ユーモアは控えめにするより、むしろ足りないくらいなら
  もっと盛り込むつもりで書くこと。ただし負傷・死亡など深刻な内容を扱う場合は、当人や被害者を
  茶化すような不謹慎な表現は避けること（周辺のリアクションやディテールで笑いを取るのは構わない）。
- 出力は指定されたJSON形式のみ。説明文やMarkdownのコードフェンスは一切付けない。
- body は5〜7段落程度の日本語の文章にすること（改行は\\nで表現してよい）。**本文は必ず
  150文字以上**書くこと。事実を水増しする必要はなく、比喩・関係者コメント・周辺描写・
  ちょっとした余談を加えて自然に厚みを持たせること。短すぎる記事（1〜2文で終わるもの）は
  不可。`;

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
