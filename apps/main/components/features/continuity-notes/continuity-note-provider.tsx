"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";

// Mirrors the JSON shape the listContinuityNotes tRPC procedure produces —
// Date columns become ISO strings on the wire because the client has no
// transformer configured. We pin the type here so the sidebar list can be
// hydrated from server-rendered initialData without a runtime cast.
export type ContinuityNoteSummary = {
  id: string;
  title: string | null;
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
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  const notesQuery = useQuery(
    trpc.listContinuityNotes.queryOptions(undefined, {
      initialData: initialNotes,
      staleTime: 30_000,
    }),
  );

  const createMutation = useMutation(
    trpc.createContinuityNote.mutationOptions({
      onSuccess: (created) => {
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
