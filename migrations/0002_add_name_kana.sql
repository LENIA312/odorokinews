-- 人物の50音順ソート・絞り込みのため、ひらがな読みを保持する列を追加する。
ALTER TABLE people ADD COLUMN name_kana TEXT;

CREATE INDEX idx_people_name_kana ON people(name_kana);
