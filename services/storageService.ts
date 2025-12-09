import { StoredSession } from '../types';

// NOTE: In a production environment, this would be replaced by Firebase Firestore SDK calls.
// Since we cannot provision a real Firebase project for this demo, we use LocalStorage.

const STORAGE_KEY = 'solarcast_history_v1';

export const saveSession = (session: Omit<StoredSession, 'id' | 'date'>): StoredSession => {
  const newSession: StoredSession = {
    ...session,
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
  };

  const existingData = getHistory();
  const updatedData = [newSession, ...existingData];
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
  } catch (e) {
    console.error("Failed to save session to local storage", e);
  }

  return newSession;
};

export const getHistory = (): StoredSession[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredSession[];
  } catch (e) {
    console.error("Failed to parse history", e);
    return [];
  }
};

export const clearHistory = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};