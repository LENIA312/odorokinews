-- 創業年が「未来」になっていた不具合の修正。
-- 世界暦は2026-08-24頃に1900-01-01へリセットされたが（4.1節参照）、種データ(0004マイグレーション)の
-- founded_yearは現実世界の年表記のまま(1958〜2011年)投入されていたため、現在の世界暦(1900年前後)
-- から見るとすべて50〜100年以上先の「未来に創業した会社」になってしまっていた。
-- 元の相対的な新旧順（蒼海重工が最も古く、妖精人材センターが最も新しい）は保ったまま、
-- 世界暦の開始年(1900年)より確実に前になるよう1800年代後半へ作り直す。
UPDATE organizations SET founded_year = 1862 WHERE id = 2; -- 蒼海重工       (旧1958)
UPDATE organizations SET founded_year = 1878 WHERE id = 4; -- ダイナン中央病院 (旧1972)
UPDATE organizations SET founded_year = 1885 WHERE id = 3; -- ムーンライト魔法発電 (旧1991)
UPDATE organizations SET founded_year = 1891 WHERE id = 5; -- 翼竜急便       (旧2003)
UPDATE organizations SET founded_year = 1897 WHERE id = 6; -- 妖精人材センター (旧2011)
