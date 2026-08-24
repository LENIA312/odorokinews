// ダイナン市の人物データを追加生成し、SQLのINSERT文を標準出力する。
// id は指定せず AUTOINCREMENT に任せる（既存データと衝突しないため）。
//
// 使い方:
//   node scripts/generate_people.mjs 100 > seed_more_people.sql
//   npx wrangler d1 execute odorokinews-db --local  --file=./seed_more_people.sql
//   npx wrangler d1 execute odorokinews-db --remote --file=./seed_more_people.sql

const COUNT = Number(process.argv[2] ?? 100);

const SURNAMES = [
  "佐藤", "鈴木", "高橋", "田中", "渡辺", "伊藤", "山本", "中村", "小林", "加藤",
  "吉田", "山田", "佐々木", "山口", "松本", "井上", "木村", "林", "斎藤", "清水",
  "森", "池田", "橋本", "山崎", "石川", "中島", "前田", "藤田", "岡田", "長谷川",
  "村上", "近藤", "石井", "坂本", "遠藤", "青木", "福田", "三浦", "西村", "藤井",
];

const GIVEN_MALE = [
  "翔太", "大輔", "健太", "直樹", "拓也", "涼太", "悠斗", "蓮", "陸", "大和",
  "颯太", "海斗", "龍之介", "亮", "誠", "修", "剛", "隆", "学", "淳",
];

const GIVEN_FEMALE = [
  "美咲", "陽菜", "結衣", "愛", "さくら", "恵", "由美", "直美", "真由美", "麻衣",
  "綾", "沙織", "智子", "裕子", "幸子", "凛", "葵", "花", "咲希", "琴音",
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
  const surname = pick(SURNAMES);
  const given = isFemale ? pick(GIVEN_FEMALE) : pick(GIVEN_MALE);
  const name = `${surname} ${given}`;
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

  const money = Math.floor(20000 + Math.random() * 800000);

  rows.push(
    `(${esc(name)}, ${age}, ${esc(gender)}, 1, ${esc(occupation)}, ${esc(organizationId)}, ${money}, 'alive', 'simulation', NULL, ${esc(NOW)}, ${esc(NOW)})`
  );
}

const sql =
  "INSERT INTO people (name, age, gender, city_id, occupation, organization_id, money, status, origin, bio, created_at, updated_at) VALUES\n" +
  rows.join(",\n") +
  ";\n";

process.stdout.write(sql);
