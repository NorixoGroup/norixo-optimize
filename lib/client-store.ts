"use client";

import type { Audit, Listing } from "@/types/domain";

const LISTINGS_KEY = "lco-listings-v1";
const AUDITS_KEY = "lco_audits";

function readArrayFromLocalStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    console.error(`Failed to read ${key} from localStorage`, error);
    return [];
  }
}

function writeArrayToLocalStorage<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to write ${key} to localStorage`, error);
  }
}

export function saveListingToClientStore(listing: Listing): void {
  const listings = readArrayFromLocalStorage<Listing>(LISTINGS_KEY);
  const existingIndex = listings.findIndex((l) => l.id === listing.id);
  if (existingIndex >= 0) {
    listings[existingIndex] = listing;
  } else {
    listings.unshift(listing);
  }
  writeArrayToLocalStorage(LISTINGS_KEY, listings);
}

export function getStoredAudits(): Audit[] {
  return readArrayFromLocalStorage<Audit>(AUDITS_KEY);
}

export function saveStoredAudit(audit: Audit): void {
  const audits = readArrayFromLocalStorage<Audit>(AUDITS_KEY);
  const existingIndex = audits.findIndex((a) => a.id === audit.id);
  if (existingIndex >= 0) {
    audits[existingIndex] = audit;
  } else {
    audits.unshift(audit);
  }
  writeArrayToLocalStorage(AUDITS_KEY, audits);
}

export function getStoredAuditById(id: string): Audit | null {
  const audits = readArrayFromLocalStorage<Audit>(AUDITS_KEY);
  const audit = audits.find((a) => a.id === id) ?? null;
  return audit;
}
