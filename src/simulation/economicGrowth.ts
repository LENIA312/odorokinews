// 企業の従業員数・売上を実数として時間とともに伸ばし、無所属の住民が自動的に
// 就職していく背景処理。イベントAIの物語とは独立して、日次シミュレーションのたびに
// 全都市・全企業に対して機械的に適用する（放置していても世界がゆっくり成長していくように）。

import type { Env } from "../types";

const now = () => new Date().toISOString();

// 従業員数が未設定(null)の企業は、新設企業とみなしこの範囲で初期値を与える。
const SEED_EMPLOYEE_MIN = 10;
const SEED_EMPLOYEE_MAX = 60;
// 1人あたりの年間売上の目安（円）。新規に売上を初期化する際に使う。
const REVENUE_PER_EMPLOYEE_MIN = 3_000_000;
const REVENUE_PER_EMPLOYEE_MAX = 10_000_000;

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * 稼働中(active/expanding/recovering/celebrating/under_investigation)の企業すべてに、
 * 小さな自動成長を与える。倒産(bankrupt)企業は対象外（0のまま据え置き）。
 * 従業員数: -1%〜+4%程度のゆるい右肩上がりのランダムウォーク。
 * 売上: 従業員数とは別に、-2%〜+6%程度の独立したランダムウォークで変動させる。
 */
async function growExistingCompanies(env: Env): Promise<void> {
  const orgs = await env.DB.prepare(
    "SELECT id, employee_count, annual_revenue FROM organizations WHERE kind = 'company' AND status != 'bankrupt'"
  ).all<{ id: number; employee_count: number | null; annual_revenue: number | null }>();

  for (const org of orgs.results ?? []) {
    const currentEmployees = org.employee_count ?? randomInt(SEED_EMPLOYEE_MIN, SEED_EMPLOYEE_MAX);
    const employeeDelta = 1 + (Math.random() * 0.05 - 0.01); // -1%〜+4%
    const nextEmployees = Math.max(1, Math.round(currentEmployees * employeeDelta));

    const currentRevenue =
      org.annual_revenue ?? currentEmployees * randomInt(REVENUE_PER_EMPLOYEE_MIN, REVENUE_PER_EMPLOYEE_MAX);
    const revenueDelta = 1 + (Math.random() * 0.08 - 0.02); // -2%〜+6%
    const nextRevenue = Math.max(0, Math.round(currentRevenue * revenueDelta));

    await env.DB.prepare("UPDATE organizations SET employee_count = ?, annual_revenue = ?, updated_at = ? WHERE id = ?")
      .bind(nextEmployees, nextRevenue, now(), org.id)
      .run();
  }
}

// 1回の日次シミュレーションで、都市ごとに何人まで新規就職させるか（無尽蔵に増やさないための上限）。
const MAX_HIRES_PER_CITY = 2;
// 無所属の人物1人あたりが今回就職する確率。
const HIRE_PROBABILITY = 0.15;
// これらの職業は「そもそも企業に勤める対象ではない」とみなし自動就職の対象から除外する。
const NON_EMPLOYABLE_OCCUPATIONS = new Set(["学生", "児童", "主婦", "主夫", "無職"]);

/**
 * 無所属(organization_id IS NULL)の住民を、その都市の稼働中企業へランダムに配属する。
 * AIのnew_people/related_peopleとは無関係な、完全に機械的な背景プロセス
 * （「就職者なども自動で増える」という要望への対応）。
 */
async function autoHireUnaffiliatedPeople(env: Env): Promise<void> {
  const cities = await env.DB.prepare("SELECT id FROM cities WHERE status = 'active'").all<{ id: number }>();

  for (const city of cities.results ?? []) {
    const [jobless, companies] = await Promise.all([
      env.DB.prepare(
        "SELECT id, occupation FROM people WHERE city_id = ? AND organization_id IS NULL AND status = 'alive' AND (age IS NULL OR age >= 18)"
      )
        .bind(city.id)
        .all<{ id: number; occupation: string | null }>(),
      env.DB.prepare("SELECT id FROM organizations WHERE city_id = ? AND kind = 'company' AND status != 'bankrupt'")
        .bind(city.id)
        .all<{ id: number }>(),
    ]);

    const companyList = companies.results ?? [];
    if (!companyList.length) continue;

    const candidates = (jobless.results ?? []).filter(
      (p) => !p.occupation || !NON_EMPLOYABLE_OCCUPATIONS.has(p.occupation)
    );

    let hired = 0;
    for (const person of candidates) {
      if (hired >= MAX_HIRES_PER_CITY) break;
      if (Math.random() > HIRE_PROBABILITY) continue;
      const company = companyList[Math.floor(Math.random() * companyList.length)];
      await env.DB.prepare("UPDATE people SET organization_id = ?, updated_at = ? WHERE id = ?")
        .bind(company.id, now(), person.id)
        .run();
      await env.DB.prepare(
        "UPDATE organizations SET employee_count = COALESCE(employee_count, 0) + 1, updated_at = ? WHERE id = ?"
      )
        .bind(now(), company.id)
        .run();
      hired++;
    }
  }
}

/** 日次シミュレーション1回につき1度呼び出す、経済成長の背景処理まとめ役。 */
export async function applyEconomicGrowth(env: Env): Promise<void> {
  await growExistingCompanies(env);
  await autoHireUnaffiliatedPeople(env);
}
