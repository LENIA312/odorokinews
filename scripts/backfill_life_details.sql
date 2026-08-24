-- 既存の全住人に生年月日・年収・生まれを補完する一度きりのスクリプト。
-- 年収未設定・生年月日未設定の人物にのみ適用するため、何度実行しても安全（冪等）。

-- 生年月日: 世界暦の現在日付から year(age) を差し引き、さらに0〜299日のランダムなずれを与える
-- （全員が同じ月日にならないようにするため）。age が無い場合は対象外。
UPDATE people
SET birth_date = date(
  (SELECT current_date FROM world WHERE id = 1),
  '-' || age || ' years',
  '-' || CAST(ABS(RANDOM() % 300) AS TEXT) || ' days'
)
WHERE birth_date IS NULL AND age IS NOT NULL;

-- 生まれ: 現在の所在都市名をそのまま割り当てる（転居前の情報は無いため簡略化）。
UPDATE people
SET birthplace = (SELECT name FROM cities WHERE cities.id = people.city_id)
WHERE birthplace IS NULL AND city_id IS NOT NULL;

-- 年収: 職業のおおまかな区分に応じてレンジを分けたランダム値。
UPDATE people
SET annual_income = CASE
  WHEN occupation IN ('大学生', '高校生', '無職') THEN CAST(20000 + ABS(RANDOM() % 200000) AS INTEGER)
  WHEN occupation IN ('主婦', '主夫') THEN CAST(ABS(RANDOM() % 500000) AS INTEGER)
  WHEN occupation IN ('代表取締役社長', '市長', '外科医', '弁護士', '開発部門長', '施設管理責任者', '会計士')
    THEN CAST(7000000 + ABS(RANDOM() % 8000000) AS INTEGER)
  ELSE CAST(2500000 + ABS(RANDOM() % 4500000) AS INTEGER)
END
WHERE annual_income IS NULL;
