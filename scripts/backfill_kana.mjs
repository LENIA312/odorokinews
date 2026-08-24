// 既存の人物データ（name_kana未設定）に、ひらがな読みを一括で補完する。
// generate_people.mjs と同じ名前プールを使っているため、
// 「姓 名」の空白区切りをそのままプールと突き合わせて読みを復元する。
//
// 使い方:
//   node scripts/backfill_kana.mjs input.json > backfill_kana.sql
//   （input.json は `wrangler d1 execute ... --json` で people テーブルの id,name を
//    出力したもの。もしくは引数なしで実行すると known_names.json を使う）

import fs from "fs";

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

const GIVEN = [
  ["翔太", "しょうた"], ["大輔", "だいすけ"], ["健太", "けんた"], ["直樹", "なおき"], ["拓也", "たくや"],
  ["涼太", "りょうた"], ["悠斗", "ゆうと"], ["蓮", "れん"], ["陸", "りく"], ["大和", "やまと"],
  ["颯太", "そうた"], ["海斗", "かいと"], ["龍之介", "りゅうのすけ"], ["亮", "りょう"], ["誠", "まこと"],
  ["修", "おさむ"], ["剛", "つよし"], ["隆", "たかし"], ["学", "まなぶ"], ["淳", "じゅん"],
  ["美咲", "みさき"], ["陽菜", "ひな"], ["結衣", "ゆい"], ["愛", "あい"], ["さくら", "さくら"],
  ["恵", "めぐみ"], ["由美", "ゆみ"], ["直美", "なおみ"], ["真由美", "まゆみ"], ["麻衣", "まい"],
  ["綾", "あや"], ["沙織", "さおり"], ["智子", "ともこ"], ["裕子", "ゆうこ"], ["幸子", "さちこ"],
  ["凛", "りん"], ["葵", "あおい"], ["花", "はな"], ["咲希", "さき"], ["琴音", "ことね"],
];

// seed.sqlの最初の12人（プール外の手作業人物）
const HAND_AUTHORED = {
  "灰谷 錬": "はいたに れん",
  "桜庭 誠一": "さくらば せいいち",
  "桜庭 美咲": "さくらば みさき",
  "月森 ルナリア": "つきもり るなりあ",
  "風間 宗介": "かざま そうすけ",
  "早乙女 蘭": "さおとめ らん",
  "常盤 ヒカゲ": "ときわ ひかげ",
  "飛竜配達員ガロ": "ひりゅうはいたついん がろ",
  "緑川 千夏": "みどりかわ ちなつ",
  "妖精ピコ": "ようせい ぴこ",
  "田村 光": "たむら ひかる",
  "田村 陽": "たむら はる",
};

const surnameMap = new Map(SURNAMES);
const givenMap = new Map(GIVEN);

function resolveKana(name) {
  if (HAND_AUTHORED[name]) return HAND_AUTHORED[name];
  const parts = name.split(" ");
  if (parts.length === 2) {
    const [surname, given] = parts;
    const s = surnameMap.get(surname);
    const g = givenMap.get(given);
    if (s && g) return `${s} ${g}`;
  }
  return null; // 手動対応が必要
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/backfill_kana.mjs <people.json>");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
// wrangler d1 execute --json の出力形式 [{results:[{id,name},...]}] を想定
const rows = Array.isArray(raw) ? raw[0]?.results ?? raw : raw.results ?? raw;

const statements = [];
const unresolved = [];
for (const row of rows) {
  const kana = resolveKana(row.name);
  if (!kana) {
    unresolved.push(row);
    continue;
  }
  statements.push(`UPDATE people SET name_kana = '${kana.replace(/'/g, "''")}' WHERE id = ${row.id};`);
}

process.stdout.write(statements.join("\n") + "\n");
if (unresolved.length) {
  console.error("解決できなかった人物:", JSON.stringify(unresolved, null, 2));
}
