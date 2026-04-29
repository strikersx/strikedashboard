"use client";

import { useState, useCallback } from "react";
import { parseReport } from "@/lib/utils";

// Global in-memory cache persisted on globalThis to survive HMR
const CACHE_KEY = "__yogoApiCache";
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

type CacheEntry = { data: unknown; ts: number };
type CacheMap = Map<string, CacheEntry>;

function getCache(): CacheMap {
  const g = globalThis as unknown as Record<string, CacheMap>;
  if (!g[CACHE_KEY]) g[CACHE_KEY] = new Map();
  return g[CACHE_KEY];
}

export function clearYogoCache() {
  getCache().clear();
  console.log("[Cache] cleared");
}

function getCacheKey(path: string, body?: string): string {
  return body ? `POST:${path}:${body}` : `GET:${path}`;
}

function getFromCache(key: string): unknown | null {
  const cache = getCache();
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    console.log("[Cache] expired:", key.slice(0, 60));
    return null;
  }
  console.log("[Cache] HIT:", key.slice(0, 60));
  return entry.data;
}

function putCache(key: string, data: unknown) {
  getCache().set(key, { data, ts: Date.now() });
  console.log("[Cache] stored:", key.slice(0, 60), `(${getCache().size} entries)`);
}

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useYogoFetch() {
  const fetchYogo = useCallback(async (path: string, options?: RequestInit) => {
    const body = options?.body as string | undefined;
    const key = getCacheKey(path, body);
    const cached = getFromCache(key);
    if (cached) return cached;

    const res = await fetch("/api/yogo/" + path, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    putCache(key, data);
    return data;
  }, []);

  const fetchReport = useCallback(
    async (path: string, body: unknown) => {
      const bodyStr = JSON.stringify(body);
      const key = `REPORT:${path}:${bodyStr}`;
      const cached = getFromCache(key);
      if (cached) return cached as Record<string, unknown>[];

      const res = await fetch("/api/yogo/" + path, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: bodyStr,
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const raw = await res.json();
      const parsed = parseReport(raw);
      putCache(key, parsed);
      return parsed;
    },
    []
  );

  const fetchGraphQL = useCallback(
    async (query: string, variables: unknown) => {
      const bodyStr = JSON.stringify({ query, variables });
      const key = getCacheKey("graphql", bodyStr);
      const cached = getFromCache(key);
      if (cached) return cached;

      const res = await fetch("/api/yogo/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyStr,
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      putCache(key, data);
      return data;
    },
    []
  );

  return { fetchYogo, fetchReport, fetchGraphQL };
}

export function useDataFetch<T>(fetcher: () => Promise<T>): FetchState<T> & { refetch: () => Promise<void> } {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: false, error: null });

  const refetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcher();
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState({ data: null, loading: false, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }, [fetcher]);

  return { ...state, refetch };
}
