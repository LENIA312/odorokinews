-- 人物の詳細情報（年収・役職・生年月日・生まれ）を追加する。
-- 就職先はすでに organizations との紐付け(organization_id)で表現済みのため対象外。
ALTER TABLE people ADD COLUMN annual_income INTEGER;
ALTER TABLE people ADD COLUMN job_title TEXT;
ALTER TABLE people ADD COLUMN birth_date TEXT; -- 世界暦 YYYY-MM-DD
ALTER TABLE people ADD COLUMN birthplace TEXT;
