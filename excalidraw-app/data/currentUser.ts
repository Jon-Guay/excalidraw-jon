import { atom } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";

const readStoredUserId = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_CURRENT_USER) ?? "";
  } catch {
    return "";
  }
};

export const currentUserIdAtom = atom(readStoredUserId());

export const persistCurrentUserId = (userId: string) => {
  try {
    if (userId) {
      localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_CURRENT_USER, userId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_CURRENT_USER);
    }
  } catch {
    // ignore storage failures
  }
};

export const activeDrawingIdAtom = atom<string | null>(null);
