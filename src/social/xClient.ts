// X(旧Twitter) API v2への投稿。POST /2/tweetsはOAuth 1.0aのユーザーコンテキスト認証を要求するため、
// ここでHMAC-SHA1署名を自前で組み立てる（外部OAuthライブラリはWorkers runtimeでは使わず、
// crypto.subtleだけで完結させる）。
// 必要な4つのシークレットは wrangler secret put で設定する（X_API_KEY / X_API_KEY_SECRET /
// X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET）。未設定の場合は投稿をスキップする。

import type { Env } from "../types";

const TWEET_ENDPOINT = "https://api.twitter.com/2/tweets";

function percentEncode(value: string): string {
  // OAuth 1.0aの仕様(RFC 3986)はencodeURIComponentが変換しない !*'() も対象にする。
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha1Base64(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-1" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

interface XCredentials {
  apiKey: string;
  apiKeySecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export function getXCredentials(env: Env): XCredentials | null {
  const { X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET } = env;
  if (!X_API_KEY || !X_API_KEY_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) return null;
  return {
    apiKey: X_API_KEY,
    apiKeySecret: X_API_KEY_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessTokenSecret: X_ACCESS_TOKEN_SECRET,
  };
}

async function buildAuthorizationHeader(creds: XCredentials): Promise<string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: randomNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };

  // POST /2/tweetsのボディはJSON(x-www-form-urlencodedではない)なので、
  // 署名ベース文字列にはOAuthパラメータのみを含める（リクエストボディは対象外）。
  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join("&");
  const baseString = ["POST", percentEncode(TWEET_ENDPOINT), percentEncode(paramString)].join("&");
  const signingKey = `${percentEncode(creds.apiKeySecret)}&${percentEncode(creds.accessTokenSecret)}`;
  const signature = await hmacSha1Base64(signingKey, baseString);

  const withSignature: Record<string, string> = { ...oauthParams, oauth_signature: signature };
  return (
    "OAuth " +
    Object.keys(withSignature)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(withSignature[k])}"`)
      .join(", ")
  );
}

export interface PostTweetResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function postTweet(env: Env, text: string): Promise<PostTweetResult> {
  const creds = getXCredentials(env);
  if (!creds) return { ok: false, error: "X APIの認証情報が未設定（X_API_KEY等をwrangler secretで設定してください）" };

  const authHeader = await buildAuthorizationHeader(creds);
  const res = await fetch(TWEET_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "content-type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: `X API error ${res.status}: ${JSON.stringify(data)}` };
  }
  return { ok: true, id: (data as any)?.data?.id };
}
