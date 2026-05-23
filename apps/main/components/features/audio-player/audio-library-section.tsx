"use client";

import { useMemo, useState } from "react";
import {
  HeadphonesIcon,
  ListMinusIcon,
  ListPlusIcon,
  Loader2Icon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@quazom-ai/ui/components/ui/alert-dialog";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { Button } from "@quazom-ai/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@quazom-ai/ui/components/ui/tooltip";
import { cn } from "@quazom-ai/ui/lib/utils";
import {
  audioDisplayTitle,
  useAudioPlayer,
  type AudioTrack,
} from "./audio-player-provider";
import { formatSeconds, sourceKindLabel } from "./audio-track-display";

/**
 * Inline grid of the user's generated TTS audio clips, surfaced on the
 * /resources page below the file/link resources.
 *
 * Mirrors the controls already available in the audio-player bar's
 * library popover so the user has a primary surface to browse their
 * library without scrolling through a dropdown. All actions delegate to
 * the shared <AudioPlayerProvider>, so playback uses the same persistent
 * <audio> element and the bar automatically un-dismisses when the user
 * hits Play.
 */
export function AudioLibrarySection() {
  const {
    library,
    isLibraryLoading,
    playlist,
    currentTrack,
    play,
    addToPlaylist,
    removeFromPlaylist,
    deleteAudio,
  } = useAudioPlayer();

  const queuedIds = useMemo(
    () => new Set(playlist.map((item) => item.audio.id)),
    [playlist],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Generated audio
          </h2>
          <p className="text-sm text-muted-foreground">
            Every spoken passage you&apos;ve generated with &ldquo;Speak
            text&rdquo;. Play them straight from here or queue them up in
            the audio bar.
          </p>
        </div>
        {library.length > 0 ? (
          <Badge variant="outline" className="shrink-0">
            {library.length} clip{library.length === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </div>

      {isLibraryLoading ? (
        <AudioLibrarySkeleton />
      ) : library.length === 0 ? (
        <AudioLibraryEmptyState />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {library.map((track) => (
            <li key={track.id} className="min-w-0">
              <AudioCard
                track={track}
                isCurrent={track.id === currentTrack?.id}
                isQueued={queuedIds.has(track.id)}
                onPlay={() => play(track, { origin: "ad-hoc" })}
                onAddToPlaylist={() => addToPlaylist(track.id)}
                onRemoveFromPlaylist={() => removeFromPlaylist(track.id)}
                onDelete={() => deleteAudio(track.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AudioCard({
  track,
  isCurrent,
  isQueued,
  onPlay,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onDelete,
}: {
  track: AudioTrack;
  isCurrent: boolean;
  isQueued: boolean;
  onPlay: () => void;
  onAddToPlaylist: () => Promise<void>;
  onRemoveFromPlaylist: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  return (
    <div
      className={cn(
        "flex h-full min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors",
        isCurrent && "border-primary/60 bg-sidebar-accent/30",
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <HeadphonesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-semibold">
            {audioDisplayTitle(track)}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {sourceKindLabel(track.sourceKind)}
            {track.durationSeconds
              ? ` · ${formatSeconds(track.durationSeconds)}`
              : ""}
            {track.truncated ? " · truncated" : ""}
          </p>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant={isCurrent ? "secondary" : "default"}
          className="cursor-pointer flex-1"
          onClick={onPlay}
        >
          <PlayIcon className="size-3.5" />
          {isCurrent ? "Now playing" : "Play"}
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="cursor-pointer"
              aria-label={
                isQueued ? "Remove from playlist" : "Add to playlist"
              }
              onClick={() => {
                void (isQueued ? onRemoveFromPlaylist() : onAddToPlaylist());
              }}
            >
              {isQueued ? (
                <ListMinusIcon className="size-3.5" />
              ) : (
                <ListPlusIcon className="size-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isQueued ? "Remove from playlist" : "Add to playlist"}
          </TooltipContent>
        </Tooltip>
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="cursor-pointer text-destructive hover:text-destructive"
                  aria-label="Delete audio"
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this audio?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes &ldquo;{audioDisplayTitle(track)}&rdquo; from
                your library and any playlist it&apos;s in. Re-generating
                the same passage will create a fresh clip.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                onClick={async (event) => {
                  event.preventDefault();
                  setDeleting(true);
                  try {
                    await onDelete();
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function AudioLibraryEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
      <HeadphonesIcon className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="font-heading text-base font-medium">
          No audio yet
        </p>
        <p className="text-sm text-muted-foreground">
          Click &ldquo;Speak text&rdquo; on any lesson, reading, or
          resource to generate your first clip — it&apos;ll show up here
          automatically.
        </p>
      </div>
    </div>
  );
}

function AudioLibrarySkeleton() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="h-28 animate-pulse rounded-xl border border-border bg-card/60"
        />
      ))}
    </ul>
  );
}
