import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { randomId } from '../lib/ids.js';
import { createStore } from './storage.js';
import { lessonContentHash, reconcile, sanitizeProgress } from './progress.js';

const ACTIVE_KEY = 'chess-academy:activeProfile';
export const AVATARS = ['🦊', '🐼', '🦉', '🐙', '🦄', '🐢', '🦁', '🐸', '🐝', '🦖'];

// localStorage throws when storage is blocked outright (private mode / disabled); the provider must
// still boot into the non-persistent path — same degrade-don't-crash rule as ./storage.js.
function readActiveId() {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function writeActiveId(id) {
  try {
    if (id === null) localStorage.removeItem(ACTIVE_KEY);
    else localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* storage unavailable — the selection just won't survive a reload */
  }
}

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [store, setStore] = useState(null);
  const [persistent, setPersistent] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [progressCache, setProgressCache] = useState({});
  const [ready, setReady] = useState(false);

  // Open the store and restore the previously active profile on first mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await createStore();
      const list = await s.listProfiles();
      if (cancelled) return;
      const savedId = readActiveId();
      const active = list.find((p) => p.id === savedId) ? savedId : null;
      setStore(s);
      setPersistent(s.persistent);
      setProfiles(list);
      setActiveProfileId(active);
      if (active) setProgressCache(await s.listProgress(active));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectProfile = useCallback(
    async (id) => {
      writeActiveId(id);
      setActiveProfileId(id);
      if (store) setProgressCache(await store.listProgress(id));
    },
    [store],
  );

  const createProfile = useCallback(
    async (name, avatar) => {
      const profile = { id: randomId(), name: name.trim() || 'Player', avatar, createdAt: Date.now() };
      await store.putProfile(profile);
      setProfiles((prev) => [...prev, profile]);
      await selectProfile(profile.id);
      return profile;
    },
    [store, selectProfile],
  );

  const switchProfile = useCallback(() => {
    writeActiveId(null);
    setActiveProfileId(null);
    setProgressCache({});
  }, []);

  // Mirror the cache into a ref so recordLessonProgress can read the latest progress without
  // depending on it — otherwise its identity would change on every write and re-trigger the
  // recording effect in LessonView.
  const progressCacheRef = useRef(progressCache);
  useEffect(() => {
    progressCacheRef.current = progressCache;
  }, [progressCache]);

  const getLessonProgress = useCallback(
    (lesson) => reconcile(progressCache[lesson.id], lessonContentHash(lesson)),
    [progressCache],
  );

  const recordLessonProgress = useCallback(
    (lesson, updater) => {
      if (!activeProfileId || !store) return;
      const hash = lessonContentHash(lesson);
      const current = reconcile(progressCacheRef.current[lesson.id], hash);
      const next = updater(current, Date.now());
      if (next === current) return;
      setProgressCache((prev) => ({ ...prev, [lesson.id]: next }));
      store.putProgress(activeProfileId, lesson.id, next);
    },
    [activeProfileId, store],
  );

  const exportActiveProfile = useCallback(async () => {
    const profile = profiles.find((p) => p.id === activeProfileId);
    if (!profile || !store) return;
    const progress = await store.listProgress(activeProfileId);
    const payload = { format: 'chess-academy-profile', version: 1, profile, progress };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.name.replace(/\s+/g, '-').toLowerCase() || 'profile'}-chess-academy.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [profiles, activeProfileId, store]);

  const importProfile = useCallback(
    async (file) => {
      const data = JSON.parse(await file.text());
      if (data.format !== 'chess-academy-profile' || !data.profile || typeof data.profile !== 'object') {
        throw new Error('That file is not a Chess Academy profile.');
      }
      // Normalize untrusted fields to the same invariants as the create path, and give the
      // imported profile a fresh id so it can't clobber an existing one.
      const profile = {
        id: randomId(),
        name: String(data.profile.name ?? 'Player').slice(0, 20) || 'Player',
        avatar: AVATARS.includes(data.profile.avatar) ? data.profile.avatar : AVATARS[0],
        createdAt: Number.isFinite(data.profile.createdAt) ? data.profile.createdAt : Date.now(),
      };
      await store.putProfile(profile);
      for (const [lessonId, value] of Object.entries(data.progress ?? {})) {
        const clean = sanitizeProgress(value);
        if (clean) await store.putProgress(profile.id, lessonId, clean);
      }
      setProfiles((prev) => [...prev, profile]);
      await selectProfile(profile.id);
      return profile;
    },
    [store, selectProfile],
  );

  const value = useMemo(
    () => ({
      ready,
      persistent,
      profiles,
      activeProfile: profiles.find((p) => p.id === activeProfileId) ?? null,
      createProfile,
      selectProfile,
      switchProfile,
      getLessonProgress,
      recordLessonProgress,
      exportActiveProfile,
      importProfile,
    }),
    [
      ready,
      persistent,
      profiles,
      activeProfileId,
      createProfile,
      selectProfile,
      switchProfile,
      getLessonProgress,
      recordLessonProgress,
      exportActiveProfile,
      importProfile,
    ],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}
