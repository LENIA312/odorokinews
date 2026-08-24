-- 管理画面から自動配信時刻を変更できるようにするための列。
-- auto_publish_times: JSON配列の "HH:MM" (JST)。例: ["10:00","22:00"]
-- last_auto_publish_slot: 直近に実行した枠 "YYYY-MM-DD HH:MM" (JST)。二重実行防止用。
ALTER TABLE world ADD COLUMN auto_publish_times TEXT NOT NULL DEFAULT '["10:00","22:00"]';
ALTER TABLE world ADD COLUMN last_auto_publish_slot TEXT;
