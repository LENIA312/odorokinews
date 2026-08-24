-- 世界暦を「ニュース配信のたび」ではなく「現実1時間ごと」に独立して進めるための変更。
-- あわせて、AI呼び出しの履歴（管理画面のAI履歴タブ用）を記録するテーブルを追加する。

-- 現実時間ベースのティッカーが最後に世界暦を進めた時刻。
ALTER TABLE world ADD COLUMN last_date_tick_at TEXT;
UPDATE world SET last_date_tick_at = updated_at WHERE id = 1;

-- simulation_runs.world_date のUNIQUE制約を撤廃する。
-- 配信と世界暦の進行が独立した結果、同じ世界暦の日に複数回ニュースが生成されうるようになった
-- （以前は「配信1回=世界暦+1日」で1:1だったため世界暦の二重処理防止に使っていたが、
-- 今後は正当な状態になる）。SQLiteはALTER TABLEでUNIQUE制約を直接外せないため、
-- テーブルを再作成して移行する。
CREATE TABLE simulation_runs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  world_date TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  ai_calls_used INTEGER NOT NULL DEFAULT 0,
  event_id INTEGER REFERENCES events(id),
  news_id INTEGER REFERENCES news(id),
  error TEXT
);
INSERT INTO simulation_runs_new (id, world_date, started_at, finished_at, status, ai_calls_used, event_id, news_id, error)
  SELECT id, world_date, started_at, finished_at, status, ai_calls_used, event_id, news_id, error FROM simulation_runs;
DROP TABLE simulation_runs;
ALTER TABLE simulation_runs_new RENAME TO simulation_runs;
CREATE INDEX idx_simulation_runs_world_date ON simulation_runs(world_date);

-- 管理画面の「AI履歴」タブ用。イベントAI/記者AI/日次まとめ投稿AI等、個々のAI呼び出しを
-- 1件ずつ記録する（event+newsのペアをまとめず、呼び出し単位でそのまま残す）。
CREATE TABLE ai_call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  call_type TEXT NOT NULL, -- daily_event / daily_news / admin_event / admin_news / tweet_digest
  model TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt TEXT NOT NULL,
  raw_response TEXT,
  success INTEGER NOT NULL, -- 0 or 1
  error TEXT,
  changes_summary TEXT -- JSON。結果として何が変わったかの構造化サマリ（表示用）
);
CREATE INDEX idx_ai_call_logs_created_at ON ai_call_logs(created_at DESC);
