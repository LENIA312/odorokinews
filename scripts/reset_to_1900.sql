-- 世界の時間とニュースを1900年1月1日からやり直す。
-- 外部キー制約の都合上、simulation_runs -> timeline -> news -> events の順に削除する。
DELETE FROM simulation_runs;
DELETE FROM timeline;
DELETE FROM news;
DELETE FROM events;
DELETE FROM economic_data;

INSERT INTO economic_data (world_date, organization_id, metric, value, created_at) VALUES
  ('1900-01-01', 2,    'stock_price',  4820.0, '1900-01-01T00:00:00Z'),
  ('1900-01-01', 3,    'stock_price',  1360.0, '1900-01-01T00:00:00Z'),
  ('1900-01-01', 5,    'stock_price',   980.0, '1900-01-01T00:00:00Z'),
  ('1900-01-01', NULL, 'price_index',   102.4, '1900-01-01T00:00:00Z');

UPDATE world SET current_date = '1900-01-01', updated_at = '1900-01-01T00:00:00Z' WHERE id = 1;

-- 企業の状態(調査中/拡大中など)や人物の状態(負傷/入院中など)、
-- お金の増減もニュースの結果として変化したものなので、あわせて初期値へ戻す。
UPDATE organizations SET status = 'active', updated_at = '1900-01-01T00:00:00Z';
UPDATE people SET status = 'alive', updated_at = '1900-01-01T00:00:00Z' WHERE status != 'alive';
