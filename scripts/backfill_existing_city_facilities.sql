-- 施設(facilities)機能を追加する前にユーザーが作成していた既存都市「ハノシダ」(id=2)には
-- 施設が1つも無いため、新規都市作成時と同じルール(住宅街+商店街を自動生成)で
-- 一度だけ補完する。座標はアプリ内のassignZonePositionForCity/assignNewOrgPositionと
-- 同じアルゴリズムを手計算した結果（拠点(1730,490)から順に220px, 330px間隔で配置）。
INSERT INTO facilities (name, kind, city_id, description, map_x, map_y, created_at, updated_at) VALUES
('ハノシダ住宅街', 'residential', 2, NULL, 1950, 490, '2026-08-25T00:00:00Z', '2026-08-25T00:00:00Z'),
('ハノシダ商店街', 'shopping_street', 2, NULL, 2170, 490, '2026-08-25T00:00:00Z', '2026-08-25T00:00:00Z');
