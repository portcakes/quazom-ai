"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";

// Persist the currently-open note id across hard reloads. The panel is
// driven entirely from component state (we intentionally don't put it
// in the URL — see provider doc comment), so without this localStorage
// hook the editor closes on every refresh even though navigations
// within the SPA preserve it.
const ACTIVE_NOTE_STORAGE_KEY = "quazom.continuity-notes.active-id";

type ActiveNoteUpdater =
  | string
  | null
  | ((prev: string | null) => string | null);

// Mirrors the JSON shape the listContinuityNotes tRPC procedure produces —
// Date columns become ISO strings on the wire because the client has no
// transformer configured. We pin the type here so the sidebar list can be
// hydrated from server-rendered initialData without a runtime cast.
export type ContinuityNoteSummary = {
  id: string;
  title: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type ContinuityNoteContextValue = {
  notes: ContinuityNoteSummary[];
  isLoading: boolean;
  activeNoteId: string | null;
  isOpen: boolean;
  openNote: (id: string) => void;
  closeEditor: () => void;
  createAndOpen: () => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
};

const ContinuityNoteContext =
  createContext<ContinuityNoteContextValue | null>(null);

type Props = {
  initialNotes: ContinuityNoteSummary[];
  children: React.ReactNode;
};

/**
 * Shared state for the Continuity Notes feature. Lives at the app layout
 * level so the sidebar (which lists notes + a Create button) and the
 * split-screen editor panel (which renders the active note) both read
 * from the same source of truth.
 *
 * The active note id is held in component state — not the URL — because
 * opening a note shouldn't change the route the rest of the page is
 * rendering. The user can keep navigating curricula/lessons while a note
 * stays pinned in the right pane.
 */
export function ContinuityNoteProvider({ initialNotes, children }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // Raw setter is kept private; every caller goes through `setActiveNoteId`
  // below so the localStorage mirror stays in lockstep.
  const [activeNoteId, _setActiveNoteId] = useState<string | null>(null);

  const setActiveNoteId = useCallback((updater: ActiveNoteUpdater) => {
    _setActiveNoteId((prev) => {
      const next =
        typeof updater === "function" ? updater(prev) : updater;
      if (typeof window !== "undefined") {
        try {
          if (next) {
            window.localStorage.setItem(ACTIVE_NOTE_STORAGE_KEY, next);
          } else {
            window.localStorage.removeItem(ACTIVE_NOTE_STORAGE_KEY);
          }
        } catch {
          // Privacy mode / quota — non-fatal. The panel simply won't
          // auto-reopen on the next reload.
        }
      }
      return next;
    });
  }, []);

  // Restore the last-open note on mount. We deliberately don't seed
  // useState via a lazy initializer because that would hydration-
  // mismatch: the server has no localStorage and would render the panel
  // closed, while the client's first render would already have read the
  // saved id and rendered it open. Doing the read in an effect means
  // the panel pops in one render after hydration, which is invisible.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(ACTIVE_NOTE_STORAGE_KEY);
      if (stored) _setActiveNoteId(stored);
    } catch {
      // Privacy mode — the editor just won't auto-reopen.
    }
  }, []);

  const notesQuery = useQuery(
    trpc.listContinuityNotes.queryOptions(undefined, {
      initialData: initialNotes,
      staleTime: 30_000,
    }),
  );

  // Guard against a stale persisted id that points at a note the user
  // can no longer see (deleted on another device, or the wrong user
  // signed in). Once the notes list lands, clear the active id if it
  // isn't in the list — the wrapped setter also flushes localStorage.
  //
  // Skip during an in-flight refetch: createMutation.onSuccess sets the
  // active id alongside invalidateQueries, and during the window before
  // the refetch returns, `notesQuery.data` still holds the old list.
  // Without this check the guard would clobber the freshly-set id on the
  // very render that opens the new note's editor.
  useEffect(() => {
    if (!activeNoteId) return;
    if (notesQuery.isLoading) return;
    if (notesQuery.isFetching) return;
    if (!notesQuery.data) return;
    if (notesQuery.data.some((note) => note.id === activeNoteId)) return;
    setActiveNoteId(null);
  }, [
    activeNoteId,
    notesQuery.data,
    notesQuery.isLoading,
    notesQuery.isFetching,
    setActiveNoteId,
  ]);

  const createMutation = useMutation(
    trpc.createContinuityNote.mutationOptions({
      onSuccess: (created) => {
        // Optimistically insert the new note into the list cache *before*
        // setting it as the active note. Without this, the stale-id guard
        // effect above would briefly see the new id missing from
        // `notesQuery.data` (the refetch from `invalidateQueries` is async)
        // and snap `activeNoteId` back to null — closing the editor we
        // just tried to open. The subsequent invalidate refetch reconciles
        // anything we might be missing.
        queryClient.setQueryData(
          trpc.listContinuityNotes.queryKey(),
          (old) => {
            const summary = {
              id: created.id,
              title: created.title ?? null,
              tags: created.tags ?? [],
              createdAt: created.createdAt,
              updatedAt: created.updatedAt,
            };
            if (!old) return [summary];
            if (old.some((n) => n.id === summary.id)) return old;
            return [summary, ...old];
          },
        );
        queryClient.invalidateQueries({
          queryKey: trpc.listContinuityNotes.queryKey(),
        });
        setActiveNoteId(created.id);
      },
      onError: (err) => {
        toast.error(err.message ?? "Couldn't create note");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.deleteContinuityNote.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.listContinuityNotes.queryKey(),
        });
        setActiveNoteId((current) =>
          current === variables.id ? null : current,
        );
      },
      onError: (err) => {
        toast.error(err.message ?? "Couldn't delete note");
      },
    }),
  );

  const openNote = useCallback((id: string) => {
    setActiveNoteId(id);
  }, []);

  const closeEditor = useCallback(() => {
    setActiveNoteId(null);
  }, []);

  const createAndOpen = useCallback(async () => {
    await createMutation.mutateAsync({});
  }, [createMutation]);

  const deleteNote = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync({ id });
    },
    [deleteMutation],
  );

  const notes = useMemo<ContinuityNoteSummary[]>(
    () => notesQuery.data ?? [],
    [notesQuery.data],
  );

  const value = useMemo<ContinuityNoteContextValue>(
    () => ({
      notes,
      isLoading: notesQuery.isLoading,
      activeNoteId,
      isOpen: activeNoteId !== null,
      openNote,
      closeEditor,
      createAndOpen,
      deleteNote,
    }),
    [
      notes,
      notesQuery.isLoading,
      activeNoteId,
      openNote,
      closeEditor,
      createAndOpen,
      deleteNote,
    ],
  );

  return (
    <ContinuityNoteContext.Provider value={value}>
      {children}
    </ContinuityNoteContext.Provider>
  );
}

export function useContinuityNotes() {
  const ctx = useContext(ContinuityNoteContext);
  if (!ctx) {
    throw new Error(
      "useContinuityNotes must be used inside <ContinuityNoteProvider>",
    );
  }
  return ctx;
}
