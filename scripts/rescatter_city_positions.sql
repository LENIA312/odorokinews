-- assignNewCityPosition()のフォールバック分岐が右方向(角度0度)固定になっていたバグにより、
-- ダイナン→ハノシダ→ジョウナンが一直線に右へ並んでしまっていた（mapZones.tsで修正済み）。
-- アルゴリズムの修正は今後の新規作成にしか効かないため、既存の2都市＋その施設の座標を
-- 一度だけ手動で散らして三角形に近い配置へ直す（ダイナンの座標(650,430)は動かさない）。

-- ハノシダ: ダイナンの南側へ
UPDATE cities SET map_x = 750, map_y = 1650 WHERE id = 2;
UPDATE facilities SET map_x = 980, map_y = 1590 WHERE id = 7;  -- ハノシダ住宅街
UPDATE facilities SET map_x = 670, map_y = 1900 WHERE id = 8;  -- ハノシダ商店街

-- ジョウナン: ダイナンの北東側へ
UPDATE cities SET map_x = 2150, map_y = -750 WHERE id = 3;
UPDATE facilities SET map_x = 2370, map_y = -670 WHERE id = 9;  -- ジョウナン住宅街
UPDATE facilities SET map_x = 2060, map_y = -990 WHERE id = 10; -- ジョウナン商店街
