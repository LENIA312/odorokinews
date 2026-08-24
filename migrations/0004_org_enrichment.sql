-- 企業の詳細情報と地図座標、および「最後に実際に配信した時刻」を追加する。
ALTER TABLE organizations ADD COLUMN industry TEXT;
ALTER TABLE organizations ADD COLUMN employee_scale TEXT;
ALTER TABLE organizations ADD COLUMN founded_year INTEGER;
ALTER TABLE organizations ADD COLUMN map_x REAL;
ALTER TABLE organizations ADD COLUMN map_y REAL;

ALTER TABLE world ADD COLUMN last_published_at TEXT;

-- 既存6社（seed.sql由来）に、これまでmapZones.tsにハードコードしていた
-- 座標と、業種などの詳細情報を補完する。
UPDATE organizations SET map_x = 650,  map_y = 430, industry = '行政',       employee_scale = '数千人',   founded_year = NULL WHERE id = 1;
UPDATE organizations SET map_x = 1180, map_y = 400, industry = '製造・造船', employee_scale = '数千人',   founded_year = 1958 WHERE id = 2;
UPDATE organizations SET map_x = 1060, map_y = 760, industry = 'エネルギー', employee_scale = '数百人',   founded_year = 1991 WHERE id = 3;
UPDATE organizations SET map_x = 560,  map_y = 260, industry = '医療',       employee_scale = '数百人',   founded_year = 1972 WHERE id = 4;
UPDATE organizations SET map_x = 1230, map_y = 610, industry = '物流',       employee_scale = '数百人',   founded_year = 2003 WHERE id = 5;
UPDATE organizations SET map_x = 700,  map_y = 260, industry = '人材サービス', employee_scale = '数十人', founded_year = 2011 WHERE id = 6;
