"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AudioSourceKind } from "@quazom-ai/db/enums";
import { useTRPC } from "@/trpc/client";

/**
 * Shape mirrored from `trpc.listGeneratedAudios` and the `/api/tts`
 * response. Anything the global player needs to render or play a clip
 * lives here — and *only* here — so the bar can stay agnostic about
 * where the audio came from (just-generated vs. saved library entry).
 */
export type AudioTrack = {
  id: string;
  title: string;
  section: string | null;
  sourceKind: AudioSourceKind;
  lessonId: string | null;
  curriculumId: string | null;
  resourceId: string | null;
  durationSeconds: number | null;
  voice: string;
  truncated: boolean;
  characterCount: number;
};

export type PlaylistItem = {
  id: string;
  position: number;
  audio: AudioTrack;
};

type PlaybackOrigin = "playlist" | "ad-hoc";

type AudioPlayerContextValue = {
  // Playback state
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  dismissed: boolean;

  // Library + queue
  library: AudioTrack[];
  isLibraryLoading: boolean;
  playlist: PlaylistItem[];
  isPlaylistLoading: boolean;

  // Playback actions
  play: (track: AudioTrack, opts?: { origin?: PlaybackOrigin }) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  skipForward: (seconds?: number) => void;
  skipBackward: (seconds?: number) => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;

  // Library + queue actions
  playFromLibrary: (track: AudioTrack) => void;
  startPlaylist: (startIndex?: number) => void;
  addToPlaylist: (audioId: string) => Promise<void>;
  removeFromPlaylist: (audioId: string) => Promise<void>;
  reorderPlaylist: (audioIds: string[]) => Promise<void>;
  clearPlaylist: () => Promise<void>;
  deleteAudio: (audioId: string) => Promise<void>;

  // Visibility
  dismiss: () => void;
  show: () => void;
};

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

const VOLUME_STORAGE_KEY = "quazom.audio-player.volume";
const LAST_TRACK_STORAGE_KEY = "quazom.audio-player.last-track-id";
const SKIP_SECONDS_DEFAULT = 15;

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // The single, persistent <audio> element. We keep it mounted via a
  // hidden <audio> tag at the bottom of this provider so React never
  // unmounts it (which would tear down playback) when navigating
  // between pages within the (app) layout.
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [origin, setOrigin] = useState<PlaybackOrigin>("ad-hoc");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // Volume is read from localStorage at first client render via the lazy
  // initializer — a documented React pattern for reading external state
  // without a setState-in-effect. The SSR pass uses 1.0 as the default;
  // the bar isn't rendered until `currentTrack` is set (also async), so
  // the volume slider doesn't end up in the SSR HTML at all.
  const [volume, setVolumeState] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    try {
      const stored = window.localStorage.getItem(VOLUME_STORAGE_KEY);
      if (stored) {
        const parsed = Number(stored);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
          return parsed;
        }
      }
    } catch {
      // SSR / privacy-mode / quota — fall through to default.
    }
    return 1;
  });
  const [muted, setMuted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Tracks whether we've already attempted the "restore last-played
  // track from localStorage" hydration. Must run *after* the library
  // query lands, so we use the React-recommended tracked-prop pattern
  // (setState during render guarded by a flag) instead of an effect.
  const [libraryHydration, setLibraryHydration] = useState<
    "pending" | "done"
  >("pending");

  // ----- Server-backed library + queue --------------------------------
  const libraryQuery = useQuery(
    trpc.listGeneratedAudios.queryOptions(undefined, {
      // Library entries don't change unless the user generates / deletes;
      // a 30s stale window is plenty for the bar's dropdown.
      staleTime: 30_000,
    }),
  );

  const playlistQuery = useQuery(
    trpc.getAudioPlaylist.queryOptions(undefined, { staleTime: 30_000 }),
  );

  const library: AudioTrack[] = useMemo(
    () => (libraryQuery.data ?? []).map(toTrack),
    [libraryQuery.data],
  );

  const playlist: PlaylistItem[] = useMemo(
    () =>
      (playlistQuery.data ?? []).map((item) => ({
        id: item.id,
        position: item.position,
        audio: toTrack(item.audio),
      })),
    [playlistQuery.data],
  );

  const invalidateLibraryQueries = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.listGeneratedAudios.queryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: trpc.getAudioPlaylist.queryKey(),
    });
  }, [queryClient, trpc]);

  // ----- localStorage hydration --------------------------------------
  // The library landed (or returned empty) — try to restore the last
  // played track *during render* using React's tracked-prop pattern.
  // Setting state during render is the documented escape hatch for
  // initialising state derived from a prop or async data source without
  // an effect; the guard flag makes sure we only run this once.
  if (
    libraryHydration === "pending" &&
    !libraryQuery.isLoading &&
    !currentTrack
  ) {
    setLibraryHydration("done");
    let lastId: string | null = null;
    try {
      lastId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(LAST_TRACK_STORAGE_KEY)
          : null;
    } catch {
      lastId = null;
    }
    if (lastId) {
      const restored = library.find((track) => track.id === lastId);
      if (restored) {
        // Mark it as the current track but don't auto-play; we never
        // want a refresh to start audio without a user gesture.
        setCurrentTrack(restored);
        setOrigin("ad-hoc");
      }
    }
  }

  // ----- <audio> element wiring --------------------------------------
  // Keep the imperative <audio> element in sync with React state. We
  // listen on the element directly (cleaner than mirroring every event
  // through React) and only push state in via discrete actions below.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onPlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => setIsLoading(false);
    const onError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      toast.error("Couldn't play this audio.");
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("durationchange", onLoaded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("error", onError);
    };
  }, []);

  // ----- Mutations for the queue + library --------------------------
  const addMutation = useMutation(
    trpc.addToAudioPlaylist.mutationOptions({
      onSuccess: () => invalidateLibraryQueries(),
      onError: (err) =>
        toast.error(err.message ?? "Couldn't add to playlist"),
    }),
  );
  const removeMutation = useMutation(
    trpc.removeFromAudioPlaylist.mutationOptions({
      onSuccess: () => invalidateLibraryQueries(),
      onError: (err) =>
        toast.error(err.message ?? "Couldn't remove from playlist"),
    }),
  );
  const reorderMutation = useMutation(
    trpc.reorderAudioPlaylist.mutationOptions({
      onSuccess: () => invalidateLibraryQueries(),
      onError: (err) =>
        toast.error(err.message ?? "Couldn't reorder playlist"),
    }),
  );
  const clearMutation = useMutation(
    trpc.clearAudioPlaylist.mutationOptions({
      onSuccess: () => invalidateLibraryQueries(),
      onError: (err) =>
        toast.error(err.message ?? "Couldn't clear playlist"),
    }),
  );
  const deleteMutation = useMutation(
    trpc.deleteGeneratedAudio.mutationOptions({
      onSuccess: () => invalidateLibraryQueries(),
      onError: (err) => toast.error(err.message ?? "Couldn't delete audio"),
    }),
  );

  // ----- Imperative actions ------------------------------------------
  const persistLastTrackId = useCallback((id: string | null) => {
    try {
      if (id) {
        localStorage.setItem(LAST_TRACK_STORAGE_KEY, id);
      } else {
        localStorage.removeItem(LAST_TRACK_STORAGE_KEY);
      }
    } catch {
      // Privacy-mode / quota — non-fatal.
    }
  }, []);

  const loadAndPlay = useCallback(
    (track: AudioTrack) => {
      const audio = audioRef.current;
      if (!audio) return;
      // Always re-set the src — even if the URL hasn't changed, calling
      // .load() resets the playback head + flushes the previous error.
      const nextSrc = `/api/audio/${track.id}/stream`;
      if (audio.src !== makeAbsolute(nextSrc)) {
        audio.src = nextSrc;
      } else {
        audio.currentTime = 0;
      }
      audio.volume = muted ? 0 : volume;
      setIsLoading(true);
      audio.play().catch((err) => {
        setIsLoading(false);
        // play() rejects on autoplay-policy errors. We don't toast here
        // because the user explicitly clicked something to land in this
        // function — Chromium's user-gesture rule is satisfied.
        console.warn("[audio-player] play() rejected", err);
      });
    },
    [muted, volume],
  );

  const play = useCallback(
    (track: AudioTrack, opts?: { origin?: PlaybackOrigin }) => {
      setDismissed(false);
      setOrigin(opts?.origin ?? "ad-hoc");
      setCurrentTrack(track);
      persistLastTrackId(track.id);
      // The <audio> element is in this same render — it'll exist by the
      // time React flushes. We schedule play() in a microtask so the
      // ref reflects the new src after the upcoming render.
      queueMicrotask(() => loadAndPlay(track));
    },
    [loadAndPlay, persistLastTrackId],
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.src) {
      audio.play().catch((err) => {
        console.warn("[audio-player] resume play() rejected", err);
      });
    } else if (currentTrack) {
      // Edge case: track is set but src cleared (e.g. after navigation
      // dropped the buffer). Re-load and start from saved position.
      loadAndPlay(currentTrack);
    }
  }, [currentTrack, loadAndPlay]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
  }, []);

  const togglePlay = useCallback(() => {
    if (!currentTrack) return;
    if (isPlaying) pause();
    else resume();
  }, [currentTrack, isPlaying, pause, resume]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!Number.isFinite(seconds)) return;
    const safe = Math.max(0, Math.min(audio.duration || seconds, seconds));
    audio.currentTime = safe;
    setCurrentTime(safe);
  }, []);

  const skipForward = useCallback(
    (seconds?: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const delta = seconds ?? SKIP_SECONDS_DEFAULT;
      seek((audio.currentTime ?? 0) + delta);
    },
    [seek],
  );

  const skipBackward = useCallback(
    (seconds?: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const delta = seconds ?? SKIP_SECONDS_DEFAULT;
      seek((audio.currentTime ?? 0) - delta);
    },
    [seek],
  );

  // ----- Queue navigation --------------------------------------------
  const queueIds = useMemo(
    () => playlist.map((item) => item.audio.id),
    [playlist],
  );

  const playlistIndex = useMemo(() => {
    if (origin !== "playlist" || !currentTrack) return -1;
    return queueIds.indexOf(currentTrack.id);
  }, [origin, currentTrack, queueIds]);

  const next = useCallback(() => {
    if (origin !== "playlist") return;
    if (playlist.length === 0) return;
    const nextIdx = playlistIndex + 1;
    const target = playlist[nextIdx];
    if (!target) return;
    play(target.audio, { origin: "playlist" });
  }, [origin, playlist, playlistIndex, play]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // If we're more than 3 seconds in, "prev" rewinds the current track
    // first — a normal media-player convention.
    if (audio.currentTime > 3) {
      seek(0);
      return;
    }
    if (origin !== "playlist") {
      seek(0);
      return;
    }
    const prevIdx = playlistIndex - 1;
    const target = playlist[prevIdx];
    if (!target) {
      seek(0);
      return;
    }
    play(target.audio, { origin: "playlist" });
  }, [origin, playlist, playlistIndex, play, seek]);

  // Auto-advance on track end (only when playing through the playlist).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      setIsPlaying(false);
      if (origin === "playlist") {
        next();
      }
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [origin, next]);

  // ----- Volume + visibility -----------------------------------------
  const setVolume = useCallback((v: number) => {
    const safe = Math.max(0, Math.min(1, v));
    setVolumeState(safe);
    if (safe > 0 && muted) setMuted(false);
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(safe));
    } catch {
      // Quota / privacy mode — fine.
    }
  }, [muted]);

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  const dismiss = useCallback(() => {
    pause();
    setDismissed(true);
  }, [pause]);

  const show = useCallback(() => setDismissed(false), []);

  // ----- Library + queue actions -------------------------------------
  const addToPlaylist = useCallback(
    async (audioId: string) => {
      await addMutation.mutateAsync({ audioId });
    },
    [addMutation],
  );

  const removeFromPlaylist = useCallback(
    async (audioId: string) => {
      await removeMutation.mutateAsync({ audioId });
    },
    [removeMutation],
  );

  const reorderPlaylist = useCallback(
    async (audioIds: string[]) => {
      await reorderMutation.mutateAsync({ audioIds });
    },
    [reorderMutation],
  );

  const clearPlaylist = useCallback(async () => {
    await clearMutation.mutateAsync();
  }, [clearMutation]);

  const deleteAudio = useCallback(
    async (audioId: string) => {
      // If the user deletes the currently-playing audio, pause + clear
      // it from the bar so the dropdown doesn't show a missing entry.
      if (currentTrack?.id === audioId) {
        pause();
        setCurrentTrack(null);
        persistLastTrackId(null);
      }
      await deleteMutation.mutateAsync({ id: audioId });
    },
    [currentTrack, deleteMutation, pause, persistLastTrackId],
  );

  const playFromLibrary = useCallback(
    (track: AudioTrack) => {
      play(track, { origin: "ad-hoc" });
    },
    [play],
  );

  const startPlaylist = useCallback(
    (startIndex = 0) => {
      const target = playlist[startIndex];
      if (!target) {
        toast.info("Your playlist is empty.");
        return;
      }
      play(target.audio, { origin: "playlist" });
    },
    [playlist, play],
  );

  // ----- Context value -----------------------------------------------
  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      currentTrack,
      isPlaying,
      isPaused: !isPlaying && currentTrack !== null,
      isLoading,
      currentTime,
      duration: Number.isFinite(duration)
        ? duration
        : (currentTrack?.durationSeconds ?? 0),
      volume,
      muted,
      dismissed,
      library,
      isLibraryLoading: libraryQuery.isLoading,
      playlist,
      isPlaylistLoading: playlistQuery.isLoading,
      play,
      pause,
      resume,
      stop,
      togglePlay,
      seek,
      skipForward,
      skipBackward,
      next,
      prev,
      setVolume,
      toggleMute,
      playFromLibrary,
      startPlaylist,
      addToPlaylist,
      removeFromPlaylist,
      reorderPlaylist,
      clearPlaylist,
      deleteAudio,
      dismiss,
      show,
    }),
    [
      currentTrack,
      isPlaying,
      isLoading,
      currentTime,
      duration,
      volume,
      muted,
      dismissed,
      library,
      libraryQuery.isLoading,
      playlist,
      playlistQuery.isLoading,
      play,
      pause,
      resume,
      stop,
      togglePlay,
      seek,
      skipForward,
      skipBackward,
      next,
      prev,
      setVolume,
      toggleMute,
      playFromLibrary,
      startPlaylist,
      addToPlaylist,
      removeFromPlaylist,
      reorderPlaylist,
      clearPlaylist,
      deleteAudio,
      dismiss,
      show,
    ],
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
      {/*
        Persistent <audio> element. Rendered at the provider's tail so
        it's always in the DOM regardless of the bar's dismissed state —
        a hidden bar should still keep the buffer warm. `preload="none"`
        avoids the browser pre-fetching audio bytes before the user
        actually presses play.
      */}
      <audio ref={audioRef} preload="none" hidden aria-hidden="true" />
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer(): AudioPlayerContextValue {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) {
    throw new Error(
      "useAudioPlayer must be used inside <AudioPlayerProvider>",
    );
  }
  return ctx;
}

/** Compose the human-readable display title for a track. */
export function audioDisplayTitle(track: {
  title: string;
  section: string | null;
}): string {
  const trimmedTitle = track.title?.trim() || "Untitled audio";
  if (track.section?.trim()) {
    return `${trimmedTitle} - ${track.section.trim()}`;
  }
  return trimmedTitle;
}

// ----- Helpers ---------------------------------------------------------

type LibraryRow = {
  id: string;
  title: string;
  section: string | null;
  sourceKind: AudioSourceKind;
  lessonId: string | null;
  curriculumId: string | null;
  resourceId: string | null;
  durationSeconds: number | null;
  characterCount: number;
  truncated: boolean;
  voice: string;
};

function toTrack(row: LibraryRow): AudioTrack {
  return {
    id: row.id,
    title: row.title,
    section: row.section,
    sourceKind: row.sourceKind,
    lessonId: row.lessonId,
    curriculumId: row.curriculumId,
    resourceId: row.resourceId,
    durationSeconds: row.durationSeconds,
    voice: row.voice,
    truncated: row.truncated,
    characterCount: row.characterCount,
  };
}

function makeAbsolute(path: string): string {
  if (typeof window === "undefined") return path;
  if (path.startsWith("http")) return path;
  return new URL(path, window.location.origin).toString();
}
