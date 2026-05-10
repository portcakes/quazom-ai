import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth-utils";
import { getNoteForCurrentUser } from "@/lib/queries/notes";
import { NoteView } from "@/components/features/notes/note-view";

type Params = Promise<{ id: string }>;

export const metadata = {
  title: "Note",
};

export default async function NotePage({ params }: { params: Params }) {
  // requireAuth runs first so unauthenticated visitors land on /login rather
  // than seeing a notFound for someone else's note id.
  await requireAuth();
  const { id } = await params;

  const note = await getNoteForCurrentUser(id);
  if (!note) {
    // Either the note doesn't exist, or it belongs to another user. We treat
    // both as 404 so we don't leak existence to non-owners.
    notFound();
  }

  return <NoteView initialNote={note} />;
}
