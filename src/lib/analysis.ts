import "server-only";
import { ApiError } from "./auth";

const BASE = process.env.ANALYSIS_URL ?? "http://127.0.0.1:8000";

function headers(extra?: Record<string, string>) {
  return { "x-analysis-secret": process.env.ANALYSIS_SECRET ?? "", ...extra };
}

async function unwrap(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof body?.detail === "string" ? body.detail : "분석 서버에서 오류가 났어요.";
    throw new ApiError(res.status >= 500 ? 502 : res.status, detail);
  }
  return body;
}

async function call(path: string, init: RequestInit) {
  try {
    return await unwrap(await fetch(`${BASE}${path}`, { ...init, cache: "no-store" }));
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(503, "분석 서버에 연결할 수 없어요. 선생님께 알려 주세요.");
  }
}

export function analysisPost(path: string, body: unknown) {
  return call(path, {
    method: "POST",
    headers: headers({ "content-type": "application/json" }),
    body: JSON.stringify(body),
  });
}

export function analysisGet(path: string) {
  return call(path, { headers: headers() });
}

export function analysisExtract(file: File) {
  const form = new FormData();
  form.append("file", file, file.name);
  return call("/extract", { method: "POST", headers: headers(), body: form });
}
