import type { Env } from "../types";

export interface AiCallResult {
  ok: boolean;
  raw?: string;
  json?: unknown;
  error?: string;
}

/**
 * Workers AIのチャットモデルを呼び出し、レスポンス本文の文字列を取り出す。
 * モデル名はコードにハードコードせず env から渡す（docs.md 3章）。
 */
async function callChatModel(
  env: Env,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const ai = env.AI as unknown as { run: (model: string, input: unknown) => Promise<unknown> };
  const result = await ai.run(model, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
  });

  const anyResult = result as any;
  if (typeof anyResult === "string") return anyResult;
  if (typeof anyResult?.response === "string") return anyResult.response;
  throw new Error("Workers AIから予期しない形式のレスポンスが返された");
}

/**
 * AIに自由文での出力を依頼する（JSON構造を要求しない版）。
 * X投稿の日次まとめのように、短い自然文だけが欲しい用途向け。
 */
export async function callAiForText(
  env: Env,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 200
): Promise<AiCallResult> {
  try {
    const raw = await callChatModel(env, model, systemPrompt, userPrompt, maxTokens);
    return { ok: true, raw: raw.trim() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** レスポンス文字列から最初のJSONオブジェクトを抽出してパースする。 */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("JSONオブジェクトが見つからない");
  }
  const candidate = text.slice(start, end + 1);
  return JSON.parse(candidate);
}

/**
 * AIにJSON構造での出力を依頼し、パースまで行う。
 * 失敗時は例外を投げず ok:false を返す（呼び出し側でフォールバックへ切り替えるため）。
 */
export async function callAiForJson(
  env: Env,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 900
): Promise<AiCallResult> {
  try {
    const raw = await callChatModel(env, model, systemPrompt, userPrompt, maxTokens);
    const json = extractJson(raw);
    return { ok: true, raw, json };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
