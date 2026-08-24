-- 「施設」の概念を追加する。住宅街・大学・公園・商店街など、雇用主ではない
-- 公共・生活系のゾーンを、企業(organizations)とは別のテーブルで管理する。
-- 都市ごとに施設を持たせることで、新しい都市も単一のランドマークではなく
-- 複数の施設で構成された街並みとして地図に表示できるようにする。
CREATE TABLE facilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL, -- residential / university / park / shopping_street / other
  city_id INTEGER NOT NULL REFERENCES cities(id),
  description TEXT,
  map_x REAL NOT NULL,
  map_y REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_facilities_city ON facilities(city_id);

-- 従来 mapZones.ts にハードコードしていたダイナン市の固定ゾーンを施設として投入する。
-- 座標は旧FIXED_ZONESと同一の値を維持する。
INSERT INTO facilities (name, kind, city_id, description, map_x, map_y, created_at, updated_at) VALUES
('ダイナン工科大学', 'university', 1, NULL, 280, 220, '2026-08-25T00:00:00Z', '2026-08-25T00:00:00Z'),
('住宅街・北', 'residential', 1, NULL, 380, 480, '2026-08-25T00:00:00Z', '2026-08-25T00:00:00Z'),
('商店街', 'shopping_street', 1, NULL, 820, 470, '2026-08-25T00:00:00Z', '2026-08-25T00:00:00Z'),
('中央公園', 'park', 1, NULL, 980, 240, '2026-08-25T00:00:00Z', '2026-08-25T00:00:00Z'),
('住宅街・東', 'residential', 1, NULL, 960, 610, '2026-08-25T00:00:00Z', '2026-08-25T00:00:00Z'),
('住宅街・南', 'residential', 1, NULL, 630, 760, '2026-08-25T00:00:00Z', '2026-08-25T00:00:00Z');
