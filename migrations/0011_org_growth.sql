-- 企業の従業員数・売上を実数として持たせ、時間とともに伸びていく仕組みの土台。
-- 従来はemployee_scaleがテキスト("数百人"等)のみで、数値として成長させる先が無かった。

ALTER TABLE organizations ADD COLUMN employee_count INTEGER;
ALTER TABLE organizations ADD COLUMN annual_revenue INTEGER;

-- 既存の企業・行政・学校へ、employee_scaleのテキストからおおよその初期値を機械的に割り当てる。
UPDATE organizations
SET employee_count = CASE
  WHEN employee_scale LIKE '%千人%' THEN 3000 + CAST(ABS(RANDOM() % 5000) AS INTEGER)
  WHEN employee_scale LIKE '%百人%' THEN 200 + CAST(ABS(RANDOM() % 600) AS INTEGER)
  WHEN employee_scale LIKE '%十人%' THEN 20 + CAST(ABS(RANDOM() % 60) AS INTEGER)
  ELSE 10 + CAST(ABS(RANDOM() % 40) AS INTEGER)
END
WHERE employee_count IS NULL AND kind IN ('company', 'government', 'school');

-- 倒産済みの企業は従業員0人に揃える。
UPDATE organizations SET employee_count = 0 WHERE status = 'bankrupt';

-- 売上は「従業員数 × 1人あたり300万〜1000万円」程度で初期化する（企業のみ。行政・学校は売上概念が薄いため対象外）。
UPDATE organizations
SET annual_revenue = employee_count * (3000000 + CAST(ABS(RANDOM() % 7000000) AS INTEGER))
WHERE annual_revenue IS NULL AND kind = 'company' AND employee_count IS NOT NULL AND employee_count > 0;
