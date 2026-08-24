-- 「天気・気候」の概念を追加する。管理画面から手動で設定する世界共通の値。
ALTER TABLE world ADD COLUMN weather TEXT NOT NULL DEFAULT '晴れ';
