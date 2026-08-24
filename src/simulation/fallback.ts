// AI呼び出しが失敗した場合のフォールバック（docs.md 23章）。
// 既存の人物・企業のみを参照し、常に有効なイベント/ニュースを生成する。
// 世界状態への変更は行わず、ナラティブのみで安全側に倒す。

import type { OrganizationRow, PersonRow } from "../types";
import type { ValidatedEventDraft, ValidatedNewsDraft } from "./validate";

export interface FallbackResult {
  event: ValidatedEventDraft;
  news: ValidatedNewsDraft;
}

// 記事本文の最低文字数。プロンプト側でも指示しているが、小型モデルが指示を守り切れず
// 短く終わらせてしまうことがあるため、機械的な安全策としてここで最終的に底上げする。
export const MIN_BODY_LENGTH = 150;

// 事故等の深刻な話題にまで無条件でジョークを足すと不謹慎になりうるため、
// それ以外のカテゴリでのみユーモラスな結びの一文を使う。
const HUMOROUS_CLOSERS = [
  "なお、この件について特に大きな混乱は無く、むしろ「今日はこれくらいで済んでよかった」という\n声すら聞かれた。モーゼン・クロニクルは、今後もこの手の“平和すぎるニュース”にすら\n真剣に向き合っていく所存である。",
  "続報については本紙記者が今後も追いかける方針だが、正直なところ今日はこの話題だけで\n紙面が持つかどうかを一番気にしているのは記者自身である。",
  "現地で本紙記者が話を聞いたところ、通りすがりの住民の一人は「へえ」とだけ答えて\n去っていった。取材班としては、もう少しコメントが欲しかったところである。",
  "関係者への追加取材は現在も続いているが、今のところ判明しているのは以上である。\n続報が入り次第、本紙は誰よりも早く（そして誰よりも大げさに）お伝えする。",
];

const NEUTRAL_CLOSER = "本紙は今後も現地の状況を注視し、続報が入り次第お伝えする。";

/**
 * 記事本文が短すぎる場合、末尾に一文を足して自然に底上げする。
 * 事故カテゴリなど深刻な話題ではユーモラスな結びを避け、中立的な一文のみを使う。
 */
export function padShortArticleBody(body: string, category: string, minLength = MIN_BODY_LENGTH): string {
  if (body.length >= minLength) return body;
  const useHumor = category !== "事故";
  let padded = useHumor
    ? `${body}\n\n${HUMOROUS_CLOSERS[Math.floor(Math.random() * HUMOROUS_CLOSERS.length)]}`
    : `${body}\n\n${NEUTRAL_CLOSER}`;
  if (padded.length < minLength) {
    padded = `${padded}\n\n${NEUTRAL_CLOSER}`;
  }
  return padded;
}

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

type Template = (ctx: {
  cityName: string;
  orgs: OrganizationRow[];
  people: PersonRow[];
}) => FallbackResult | null;

const productLaunch: Template = ({ cityName, orgs, people }) => {
  const org = pickRandom(orgs.filter((o) => o.kind === "company"));
  if (!org) return null;
  const spokesperson = pickRandom(people.filter((p) => p.organization_id === org.id));
  const speakerLine = spokesperson
    ? `同社の${spokesperson.occupation ?? "担当者"}${spokesperson.name}氏は「利用者の生活をより便利にしたい」とコメントした。`
    : "同社は今後も詳細を順次公表するとしている。";
  return {
    event: {
      event_type: "business",
      summary: `${org.name}が新サービスを発表`,
      detail: `${cityName}に本拠を置く${org.name}が、新たな取り組みを発表した。`,
      involves_magic: false,
      related_person_ids: spokesperson ? [spokesperson.id] : [],
      new_people: [],
      related_organization_ids: [org.id],
      new_organizations: [],
      new_facilities: [],
      new_city: null,
      weather: null,
      state_changes: [],
    },
    news: {
      title: `${org.name}が新サービスを発表`,
      body: `${cityName}の${org.name}は、新たな取り組みを発表した。詳細な提供時期は今後発表されるという。${speakerLine}`,
      category: "経済",
    },
  };
};

const minorIncident: Template = ({ cityName, orgs }) => {
  const org = pickRandom(orgs);
  if (!org) return null;
  return {
    event: {
      event_type: "incident",
      summary: `${cityName}市内で小規模なトラブル発生、大事には至らず`,
      detail: `${cityName}市内の${org.name}周辺で軽微なトラブルが発生したが、関係者の対応により大事には至らなかった。`,
      involves_magic: false,
      related_person_ids: [],
      new_people: [],
      related_organization_ids: [org.id],
      new_organizations: [],
      new_facilities: [],
      new_city: null,
      weather: null,
      state_changes: [],
    },
    news: {
      title: `${cityName}市内で小規模なトラブル、大事に至らず`,
      body: `${cityName}市内の${org.name}付近で${new Date().getUTCDate()}日朝、小規模なトラブルが発生した。関係者が迅速に対応し、大きな混乱には至らなかった。市は今後、再発防止に向けた確認を行うとしている。`,
      category: "事故",
    },
  };
};

const personAward: Template = ({ cityName, people }) => {
  const person = pickRandom(people);
  if (!person) return null;
  return {
    event: {
      event_type: "award",
      summary: `${person.name}氏の功績が地域で話題に`,
      detail: `${cityName}在住の${person.name}氏（${person.occupation ?? "市民"}）の日頃の功績が話題となった。`,
      involves_magic: false,
      related_person_ids: [person.id],
      new_people: [],
      related_organization_ids: [],
      new_organizations: [],
      new_facilities: [],
      new_city: null,
      weather: null,
      state_changes: [],
    },
    news: {
      title: `${cityName}在住の${person.name}氏、功績が話題に`,
      body: `${cityName}在住の${person.name}氏（${person.occupation ?? "市民"}）の取り組みが地域住民の間で話題となっている。周囲からは称賛の声が上がっており、今後の活動にも注目が集まっている。`,
      category: "文化",
    },
  };
};

const magicPhenomenon: Template = ({ cityName }) => {
  return {
    event: {
      event_type: "magic_phenomenon",
      summary: `${cityName}上空で珍しい魔法現象を観測`,
      detail: `${cityName}上空で、通常より強い魔素の揺らぎが観測された。市の魔法安全局は生活への影響はないとしている。`,
      involves_magic: true,
      related_person_ids: [],
      new_people: [],
      related_organization_ids: [],
      new_organizations: [],
      new_facilities: [],
      new_city: null,
      weather: null,
      state_changes: [],
    },
    news: {
      title: `${cityName}上空で珍しい魔法現象を観測、生活への影響なし`,
      body: `${cityName}上空で、通常よりやや強い魔素の揺らぎが観測された。市の魔法安全局によると、日常生活や交通への影響は確認されていないという。同様の現象は過去にも季節の変わり目に度々報告されている。`,
      category: "魔法",
    },
  };
};

const partnership: Template = ({ orgs }) => {
  const companies = orgs.filter((o) => o.kind === "company");
  if (companies.length < 2) return null;
  const a = pickRandom(companies);
  if (!a) return null;
  const b = pickRandom(companies.filter((o) => o.id !== a.id));
  if (!b) return null;
  return {
    event: {
      event_type: "business",
      summary: `${a.name}と${b.name}が業務提携を発表`,
      detail: `${a.name}と${b.name}が業務提携を発表した。両社は今後、事業面での協力を進めるとしている。`,
      involves_magic: false,
      related_person_ids: [],
      new_people: [],
      related_organization_ids: [a.id, b.id],
      new_organizations: [],
      new_facilities: [],
      new_city: null,
      weather: null,
      state_changes: [],
    },
    news: {
      title: `${a.name}と${b.name}が業務提携を発表`,
      body: `${a.name}と${b.name}は、業務提携を締結したと発表した。両社は今後、それぞれの強みを生かした協力体制を構築していく方針としている。市場関係者からは今後の展開に注目が集まっている。`,
      category: "経済",
    },
  };
};

const TEMPLATES: Template[] = [productLaunch, minorIncident, personAward, magicPhenomenon, partnership];

export function generateFallbackEventAndNews(
  cityName: string,
  orgs: OrganizationRow[],
  people: PersonRow[]
): FallbackResult {
  const shuffled = [...TEMPLATES].sort(() => Math.random() - 0.5);
  for (const template of shuffled) {
    const result = template({ cityName, orgs, people });
    if (result) return result;
  }
  // 最終フォールバック：企業・人物データが皆無でも必ず成立する汎用イベント。
  return {
    event: {
      event_type: "general",
      summary: `${cityName}は静かな一日となった`,
      detail: `${cityName}では特筆すべき大きな出来事はなく、平穏な一日となった。`,
      involves_magic: false,
      related_person_ids: [],
      new_people: [],
      related_organization_ids: [],
      new_organizations: [],
      new_facilities: [],
      new_city: null,
      weather: null,
      state_changes: [],
    },
    news: {
      title: `${cityName}、特段の混乱なく平穏な一日に`,
      body: `${cityName}では本日、特筆すべき大きな出来事は報告されなかった。市民生活は概ね平常通りだったという。`,
      category: "社会",
    },
  };
}
