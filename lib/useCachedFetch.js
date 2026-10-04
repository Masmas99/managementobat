"use client";

import { useCallback, useEffect, useState } from "react";

const memory = new Map();
const inflight = new Map();
const STORAGE_PREFIX = "medistock:cache:";

function readStorage(url) {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + url);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function writeStorage(url, value) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + url, JSON.stringify(value));
  } catch {
    // Abaikan kuota penuh; cache memori tetap bekerja.
  }
}

function seed(url) {
  if (memory.has(url)) return memory.get(url);
  const stored = readStorage(url);
  if (stored === undefined) return undefined;
  memory.set(url, stored);
  return stored;
}

function store(url, value) {
  memory.set(url, value);
  writeStorage(url, value);
}

function request(url) {
  if (inflight.has(url)) return inflight.get(url);
  const promise = fetch(url, { cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Gagal memuat data.");
      return payload.data;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, promise);
  return promise;
}

export function getCached(url) {
  return seed(url);
}

export function setCached(url, value) {
  store(url, value);
}

export function ensureData(url) {
  return request(url).then((value) => {
    store(url, value);
    return value;
  });
}

export function clearCache() {
  memory.clear();
  if (typeof window === "undefined") return;
  try {
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Abaikan; sesi baru akan menimpa cache lama.
  }
}

export function prefetch(urls) {
  urls.forEach((url) => {
    if (memory.has(url)) return;
    seed(url);
    request(url)
      .then((value) => store(url, value))
      .catch(() => {});
  });
}

export function useCachedFetch(url) {
  const [data, setData] = useState(() => seed(url));
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    return request(url)
      .then((value) => {
        store(url, value);
        setData(value);
        setError(null);
        return value;
      })
      .catch((failure) => {
        setError(failure);
        throw failure;
      });
  }, [url]);

  useEffect(() => {
    let active = true;
    const cached = seed(url);
    if (cached !== undefined) setData(cached);
    request(url)
      .then((value) => {
        store(url, value);
        if (active) {
          setData(value);
          setError(null);
        }
      })
      .catch((failure) => {
        if (active) setError(failure);
      });
    return () => {
      active = false;
    };
  }, [url]);

  return { data, loading: data === undefined && !error, error, refresh };
}
