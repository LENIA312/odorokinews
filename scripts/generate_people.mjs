// ダイナン市の人物データを追加生成し、SQLのINSERT文を標準出力する。
// id は指定せず AUTOINCREMENT に任せる（既存データと衝突しないため）。
//
// 使い方:
//   node scripts/generate_people.mjs 100 > seed_more_people.sql
//   npx wrangler d1 execute odorokinews-db --local  --file=./seed_more_people.sql
//   npx wrangler d1 execute odorokinews-db --remote --file=./seed_more_people.sql

const COUNT = Number(process.argv[2] ?? 100);

// 各配列は [表記, ひらがな読み] のペア。50音順ソート機能のため読みを必須で持たせる。
const SURNAMES = [
  ["佐藤", "さとう"], ["鈴木", "すずき"], ["高橋", "たかはし"], ["田中", "たなか"], ["渡辺", "わたなべ"],
  ["伊藤", "いとう"], ["山本", "やまもと"], ["中村", "なかむら"], ["小林", "こばやし"], ["加藤", "かとう"],
  ["吉田", "よしだ"], ["山田", "やまだ"], ["佐々木", "ささき"], ["山口", "やまぐち"], ["松本", "まつもと"],
  ["井上", "いのうえ"], ["木村", "きむら"], ["林", "はやし"], ["斎藤", "さいとう"], ["清水", "しみず"],
  ["森", "もり"], ["池田", "いけだ"], ["橋本", "はしもと"], ["山崎", "やまざき"], ["石川", "いしかわ"],
  ["中島", "なかじま"], ["前田", "まえだ"], ["藤田", "ふじた"], ["岡田", "おかだ"], ["長谷川", "はせがわ"],
  ["村上", "むらかみ"], ["近藤", "こんどう"], ["石井", "いしい"], ["坂本", "さかもと"], ["遠藤", "えんどう"],
  ["青木", "あおき"], ["福田", "ふくだ"], ["三浦", "みうら"], ["西村", "にしむら"], ["藤井", "ふじい"],
];

const GIVEN_MALE = [
  ["翔太", "しょうた"], ["大輔", "だいすけ"], ["健太", "けんた"], ["直樹", "なおき"], ["拓也", "たくや"],
  ["涼太", "りょうた"], ["悠斗", "ゆうと"], ["蓮", "れん"], ["陸", "りく"], ["大和", "やまと"],
  ["颯太", "そうた"], ["海斗", "かいと"], ["龍之介", "りゅうのすけ"], ["亮", "りょう"], ["誠", "まこと"],
  ["修", "おさむ"], ["剛", "つよし"], ["隆", "たかし"], ["学", "まなぶ"], ["淳", "じゅん"],
];

const GIVEN_FEMALE = [
  ["美咲", "みさき"], ["陽菜", "ひな"], ["結衣", "ゆい"], ["愛", "あい"], ["さくら", "さくら"],
  ["恵", "めぐみ"], ["由美", "ゆみ"], ["直美", "なおみ"], ["真由美", "まゆみ"], ["麻衣", "まい"],
  ["綾", "あや"], ["沙織", "さおり"], ["智子", "ともこ"], ["裕子", "ゆうこ"], ["幸子", "さちこ"],
  ["凛", "りん"], ["葵", "あおい"], ["花", "はな"], ["咲希", "さき"], ["琴音", "ことね"],
];

const OCCUPATIONS_GENERAL = [
  "会社員", "公務員", "教師", "エンジニア", "デザイナー", "看護師", "薬剤師", "弁護士",
  "会計士", "営業職", "店員", "料理人", "美容師", "タクシー運転手", "警備員", "消防士",
  "警察官", "観光ガイド", "カフェ店員", "大学生", "高校生", "主婦", "主夫", "自営業",
  "建築士", "プログラマー", "データアナリスト", "銀行員", "保険外交員", "音楽家",
  "画家", "俳優", "スポーツ選手", "配管工", "電気工事士", "写真家", "翻訳家",
];

const OCCUPATIONS_MAGIC = [
  "魔法薬剤師", "魔法整備士", "竜舎スタッフ", "妖精保育士", "幽霊対応専門員", "結界メンテナンス業",
];

// organization_id: 1=市役所(government), 2=蒼海重工, 3=ムーンライト魔法発電,
// 4=ダイナン中央病院, 5=翼竜急便, 6=妖精人材センター
const ORG_OCCUPATIONS = {
  1: ["市役所職員", "戸籍係", "土木職員", "広報担当"],
  2: ["製造ライン技術者", "設計技師", "資材調達担当", "品質管理"],
  3: ["発電技師", "魔法工学研究員", "施設保安員"],
  4: ["看護師", "臨床検査技師", "受付事務", "薬剤師"],
  5: ["配送ドライバー", "飛竜調教師", "配送センター管理"],
  6: ["人材コーディネーター", "求人担当", "研修講師"],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function esc(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}

const NOW = "2026-08-24T00:00:00Z";
const rows = [];

for (let i = 0; i < COUNT; i++) {
  const isFemale = Math.random() < 0.5;
  const [surname, surnameKana] = pick(SURNAMES);
  const [given, givenKana] = isFemale ? pick(GIVEN_FEMALE) : pick(GIVEN_MALE);
  const name = `${surname} ${given}`;
  const nameKana = `${surnameKana} ${givenKana}`;
  const age = 18 + Math.floor(Math.random() * 58); // 18-75
  const gender = isFemale ? "female" : "male";

  const assignToOrg = Math.random() < 0.4;
  let organizationId = null;
  let occupation;
  if (assignToOrg) {
    organizationId = 1 + Math.floor(Math.random() * 6);
    occupation = pick(ORG_OCCUPATIONS[organizationId]);
  } else {
    occupation = Math.random() < 0.08 ? pick(OCCUPATIONS_MAGIC) : pick(OCCUPATIONS_GENERAL);
  }
  // 「主婦/主夫」は性別と表記を一致させる。
  if (occupation === "主婦" || occupation === "主夫") {
    occupation = isFemale ? "主婦" : "主夫";
  }

  const money = Math.floor(20000 + Math.random() * 800000);

  rows.push(
    `(${esc(name)}, ${esc(nameKana)}, ${age}, ${esc(gender)}, 1, ${esc(occupation)}, ${esc(organizationId)}, ${money}, 'alive', 'simulation', NULL, ${esc(NOW)}, ${esc(NOW)})`
  );
}

const sql =
  "INSERT INTO people (name, name_kana, age, gender, city_id, occupation, organization_id, money, status, origin, bio, created_at, updated_at) VALUES\n" +
  rows.join(",\n") +
  ";\n";

process.stdout.write(sql);
