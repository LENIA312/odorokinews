-- backfill_life_details.sql の生年月日計算が、wrangler d1 execute経由のサブクエリで
-- world.current_date を正しく読めず(古いキャッシュ値を参照してしまい)誤った年で
-- 計算されていたための訂正スクリプト。基準日はライブAPI(/api/health)で確認した
-- 実際の世界暦をリテラルで直接指定する(サブクエリに頼らない)。
UPDATE people
SET birth_date = date(
  '1900-01-07',
  '-' || age || ' years',
  '-' || CAST(ABS(RANDOM() % 300) AS TEXT) || ' days'
)
WHERE age IS NOT NULL;
