-- 都市管理: Active/Draftのステータスと、地図上の位置を追加する。
-- Active な都市は今後のシミュレーション生成対象になりうる（draftはならない）。
ALTER TABLE cities ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE cities ADD COLUMN map_x REAL;
ALTER TABLE cities ADD COLUMN map_y REAL;

-- 既存の首都ダイナン市は常にActiveとして扱い、既存の地図上の中心座標を割り当てる。
UPDATE cities SET status = 'active', map_x = 650, map_y = 430 WHERE id = 1;
