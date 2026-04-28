"use client";

import { useState, useCallback } from "react";
import { parseReport } from "@/lib/utils";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useYogoFetch() {
  const fetchYogo = useCallback(async (path: string, options?: RequestInit) => {
    const res = await fetch("/api/yogo/" + path, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }, []);

  const fetchReport = useCallback(
    async (path: string, body: unknown) => {
      const raw = await fetchYogo(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return parseReport(raw);
    },
    [fetchYogo]
  );

  const fetchGraphQL = useCallback(
    async (query: string, variables: unknown) => {
      const res = await fetch("/api/yogo/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
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
