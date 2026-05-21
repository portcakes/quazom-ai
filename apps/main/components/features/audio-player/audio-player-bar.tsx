"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  HeadphonesIcon,
  ListMusicIcon,
  ListPlusIcon,
  ListXIcon,
  Loader2Icon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SquareIcon,
  Trash2Icon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Slider } from "@quazom-ai/ui/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@quazom-ai/ui/components/ui/popover";
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

const SKIP_SECONDS = 15;

/**
 * Sticky audio player bar that lives directly under the app navbar.
 *
 * Renders nothing while the user has no current track + has dismissed
 * the bar — we want it discoverable but never intrusive. Any time a
 * "Speak text" call lands, the provider undismisses + sets the current
 * track, so the bar slides back in automatically.
 */
export function AudioPlayerBar() {
  const player = useAudioPlayer();
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    muted,
    dismissed,
    library,
    playlist,
  } = player;

  const barRef = useRef<HTMLDivElement>(null);

  // Publish the bar's measured height as a CSS variable on <html>, so
  // every other page-level sticky element on the app (the lesson hero
  // compact bar, curriculum tabs strip, continuity notes panel header,
  // …) can shift its `top` offset down by this amount. The effect runs
  // on mount and the cleanup fires on unmount — and because the bar
  // returns `null` when dismissed or when there's no track, "unmount"
  // is exactly when we want the offset cleared. ResizeObserver then
  // keeps the variable in sync as the bar's row count changes between
  // mobile (3 rows) and desktop (2 rows).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = barRef.current;
    if (!el) return;
    const root = document.documentElement;
    const setOffset = (height: number) => {
      root.style.setProperty("--audio-bar-offset", `${Math.ceil(height)}px`);
    };
    setOffset(el.getBoundingClientRect().height);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setOffset(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--audio-bar-offset");
    };
  }, []);

  // Hide entirely when there's nothing to do. The provider re-shows the
  // bar on the next play() call, so this also doubles as the "dismiss"
  // off-state.
  if (dismissed) return null;
  if (!currentTrack) return null;

  const knownDuration = Number.isFinite(duration) && duration > 0
    ? duration
    : (currentTrack.durationSeconds ?? 0);

  return (
    <div
      ref={barRef}
      // On mobile, the navbar is fixed at top-0 (h-12), so the bar
      // sticks just below it at top-12. On desktop there is no navbar
      // (the sidebar handles nav) so the bar docks to the very top of
      // the content area. z-50 keeps it above every other sticky page
      // element so it never gets painted over by lesson/curriculum
      // chrome — those elements respond to `--audio-bar-offset`
      // (published by the effect above) to slot in below the bar.
      className="sticky top-12 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:top-0"
      role="region"
      aria-label="Audio player"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-3 py-2 sm:px-6">
        {/* Top row: title + transport controls + secondary menus */}
        <div className="flex items-center gap-2">
          <HeadphonesIcon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {audioDisplayTitle(currentTrack)}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {sourceKindLabel(currentTrack.sourceKind)}
              {currentTrack.truncated ? " · truncated excerpt" : ""}
            </p>
          </div>

          <TransportControls
            disabled={isLoading}
            isPlaying={isPlaying}
            isLoading={isLoading}
            onSkipBack={() => player.skipBackward(SKIP_SECONDS)}
            onTogglePlay={player.togglePlay}
            onStop={player.stop}
            onSkipForward={() => player.skipForward(SKIP_SECONDS)}
            onPrev={player.prev}
            onNext={player.next}
          />

          <div className="hidden items-center gap-2 md:flex">
            <VolumeControl
              volume={volume}
              muted={muted}
              onVolume={player.setVolume}
              onToggleMute={player.toggleMute}
            />
            <LibraryMenu
              library={library}
              currentTrackId={currentTrack.id}
              onPlay={player.playFromLibrary}
              onAddToPlaylist={player.addToPlaylist}
              onDelete={player.deleteAudio}
            />
            <PlaylistMenu
              playlist={playlist}
              currentTrackId={currentTrack.id}
              currentTrack={currentTrack}
              onAddCurrent={async () => {
                await player.addToPlaylist(currentTrack.id);
              }}
              onPlayItem={(track) =>
                player.play(track, { origin: "playlist" })
              }
              onStartPlaylist={() => player.startPlaylist(0)}
              onRemove={player.removeFromPlaylist}
              onMove={async (audioId, direction) => {
                const ids = playlist.map((p) => p.audio.id);
                const i = ids.indexOf(audioId);
                if (i < 0) return;
                const j = direction === "up" ? i - 1 : i + 1;
                if (j < 0 || j >= ids.length) return;
                const next = ids.slice();
                [next[i], next[j]] = [next[j]!, next[i]!];
                await player.reorderPlaylist(next);
              }}
              onClear={player.clearPlaylist}
            />
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="cursor-pointer"
                onClick={player.dismiss}
                aria-label="Hide audio bar"
              >
                <XIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Hide audio bar</TooltipContent>
          </Tooltip>
        </div>

        {/* Progress row */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatSeconds(currentTime)}
          </span>
          <ProgressScrubber
            currentTime={currentTime}
            duration={knownDuration}
            onSeek={player.seek}
          />
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatSeconds(knownDuration)}
          </span>
        </div>

        {/* Mobile-only: condensed secondary controls */}
        <div className="flex items-center gap-2 md:hidden">
          <VolumeControl
            volume={volume}
            muted={muted}
            onVolume={player.setVolume}
            onToggleMute={player.toggleMute}
          />
          <LibraryMenu
            library={library}
            currentTrackId={currentTrack.id}
            onPlay={player.playFromLibrary}
            onAddToPlaylist={player.addToPlaylist}
            onDelete={player.deleteAudio}
          />
          <PlaylistMenu
            playlist={playlist}
            currentTrackId={currentTrack.id}
            currentTrack={currentTrack}
            onAddCurrent={async () => {
              await player.addToPlaylist(currentTrack.id);
            }}
            onPlayItem={(track) =>
              player.play(track, { origin: "playlist" })
            }
            onStartPlaylist={() => player.startPlaylist(0)}
            onRemove={player.removeFromPlaylist}
            onMove={async (audioId, direction) => {
              const ids = playlist.map((p) => p.audio.id);
              const i = ids.indexOf(audioId);
              if (i < 0) return;
              const j = direction === "up" ? i - 1 : i + 1;
              if (j < 0 || j >= ids.length) return;
              const next = ids.slice();
              [next[i], next[j]] = [next[j]!, next[i]!];
              await player.reorderPlaylist(next);
            }}
            onClear={player.clearPlaylist}
          />
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Subcomponents
// --------------------------------------------------------------------

function TransportControls({
  isPlaying,
  isLoading,
  disabled,
  onSkipBack,
  onTogglePlay,
  onStop,
  onSkipForward,
  onPrev,
  onNext,
}: {
  isPlaying: boolean;
  isLoading: boolean;
  disabled: boolean;
  onSkipBack: () => void;
  onTogglePlay: () => void;
  onStop: () => void;
  onSkipForward: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <IconAction
        ariaLabel={`Skip back ${SKIP_SECONDS} seconds`}
        tooltip={`Back ${SKIP_SECONDS}s`}
        onClick={onSkipBack}
        disabled={disabled}
      >
        <SkipBackIcon className="size-4" />
      </IconAction>
      <IconAction
        ariaLabel="Previous in playlist"
        tooltip="Previous"
        onClick={onPrev}
        disabled={disabled}
      >
        <ChevronDownIcon className="size-4 -rotate-90" />
      </IconAction>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="default"
            className="cursor-pointer"
            onClick={onTogglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            disabled={disabled && !isPlaying}
          >
            {isLoading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : isPlaying ? (
              <PauseIcon className="size-4" />
            ) : (
              <PlayIcon className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isPlaying ? "Pause" : "Play"}</TooltipContent>
      </Tooltip>
      <IconAction
        ariaLabel="Stop"
        tooltip="Stop"
        onClick={onStop}
        disabled={disabled}
      >
        <SquareIcon className="size-4" />
      </IconAction>
      <IconAction
        ariaLabel="Next in playlist"
        tooltip="Next"
        onClick={onNext}
        disabled={disabled}
      >
        <ChevronDownIcon className="size-4 rotate-90" />
      </IconAction>
      <IconAction
        ariaLabel={`Skip forward ${SKIP_SECONDS} seconds`}
        tooltip={`Forward ${SKIP_SECONDS}s`}
        onClick={onSkipForward}
        disabled={disabled}
      >
        <SkipForwardIcon className="size-4" />
      </IconAction>
    </div>
  );
}

function IconAction({
  ariaLabel,
  tooltip,
  onClick,
  disabled,
  children,
}: {
  ariaLabel: string;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="cursor-pointer"
          onClick={onClick}
          disabled={disabled}
          aria-label={ariaLabel}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function ProgressScrubber({
  currentTime,
  duration,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
}) {
  const max = duration > 0 ? duration : 0;
  const value = Math.min(currentTime, max);

  return (
    <Slider
      // We treat this as a controlled slider while the user isn't
      // dragging. Radix's Slider already handles the drag transition
      // internally, so we just listen to onValueChange and write to the
      // audio element via the provider.
      value={[value]}
      max={max || 1}
      step={0.25}
      onValueChange={(v) => {
        const next = v[0] ?? 0;
        onSeek(next);
      }}
      aria-label="Audio progress"
      className="flex-1"
    />
  );
}

function VolumeControl({
  volume,
  muted,
  onVolume,
  onToggleMute,
}: {
  volume: number;
  muted: boolean;
  onVolume: (v: number) => void;
  onToggleMute: () => void;
}) {
  const VolumeIcon = muted || volume === 0
    ? VolumeXIcon
    : volume < 0.5
      ? Volume1Icon
      : Volume2Icon;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="cursor-pointer"
          aria-label="Volume"
        >
          <VolumeIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="flex w-44 flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium">Volume</span>
          <button
            type="button"
            onClick={onToggleMute}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            {muted ? "Unmute" : "Mute"}
          </button>
        </div>
        <Slider
          value={[muted ? 0 : volume]}
          max={1}
          step={0.01}
          onValueChange={(v) => onVolume(v[0] ?? 0)}
          aria-label="Volume"
        />
      </PopoverContent>
    </Popover>
  );
}

function LibraryMenu({
  library,
  currentTrackId,
  onPlay,
  onAddToPlaylist,
  onDelete,
}: {
  library: AudioTrack[];
  currentTrackId: string;
  onPlay: (track: AudioTrack) => void;
  onAddToPlaylist: (audioId: string) => Promise<void>;
  onDelete: (audioId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="cursor-pointer"
          aria-label="Audio library"
        >
          <HeadphonesIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-80 max-w-[calc(100vw-1rem)]"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Audio library</p>
          <span className="text-[11px] text-muted-foreground">
            {library.length} clip{library.length === 1 ? "" : "s"}
          </span>
        </div>
        {library.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            No audio yet. Click &ldquo;Speak text&rdquo; anywhere in the app to
            generate one.
          </p>
        ) : (
          <ul className="-mx-1 max-h-72 overflow-y-auto py-1">
            {library.map((track) => (
              <li
                key={track.id}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5",
                  track.id === currentTrackId && "bg-muted",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onPlay(track);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <PlayIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {audioDisplayTitle(track)}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {sourceKindLabel(track.sourceKind)}
                      {track.durationSeconds
                        ? ` · ${formatSeconds(track.durationSeconds)}`
                        : ""}
                    </span>
                  </span>
                </button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      className="cursor-pointer"
                      aria-label="Add to playlist"
                      onClick={() => onAddToPlaylist(track.id)}
                    >
                      <ListPlusIcon className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add to playlist</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      className="cursor-pointer text-destructive hover:text-destructive"
                      aria-label="Delete audio"
                      onClick={() => onDelete(track.id)}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function PlaylistMenu({
  playlist,
  currentTrackId,
  currentTrack,
  onAddCurrent,
  onPlayItem,
  onStartPlaylist,
  onRemove,
  onMove,
  onClear,
}: {
  playlist: { id: string; position: number; audio: AudioTrack }[];
  currentTrackId: string;
  currentTrack: AudioTrack;
  onAddCurrent: () => Promise<void>;
  onPlayItem: (track: AudioTrack) => void;
  onStartPlaylist: () => void;
  onRemove: (audioId: string) => Promise<void>;
  onMove: (audioId: string, direction: "up" | "down") => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const currentInPlaylist = useMemo(
    () => playlist.some((item) => item.audio.id === currentTrackId),
    [playlist, currentTrackId],
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="relative cursor-pointer"
          aria-label="Playlist"
        >
          <ListMusicIcon className="size-4" />
          {playlist.length > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {playlist.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-80 max-w-[calc(100vw-1rem)]"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Up next</p>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="cursor-pointer"
                  aria-label="Add current audio to playlist"
                  disabled={currentInPlaylist}
                  onClick={() => {
                    void onAddCurrent();
                  }}
                >
                  <PlusIcon className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {currentInPlaylist
                  ? "Already in playlist"
                  : `Add "${audioDisplayTitle(currentTrack)}"`}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="cursor-pointer"
                  aria-label="Play playlist from start"
                  disabled={playlist.length === 0}
                  onClick={() => {
                    setOpen(false);
                    onStartPlaylist();
                  }}
                >
                  <PlayIcon className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Play playlist</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="cursor-pointer text-destructive hover:text-destructive"
                  aria-label="Clear playlist"
                  disabled={playlist.length === 0}
                  onClick={() => {
                    void onClear();
                  }}
                >
                  <ListXIcon className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear playlist</TooltipContent>
            </Tooltip>
          </div>
        </div>
        {playlist.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            Add audios to build a queue. Click the <ListPlusIcon className="size-3.5 inline-block" /> icon next to any
            generated audio in your library to add it here.
          </p>
        ) : (
          <ul className="-mx-1 max-h-72 overflow-y-auto py-1">
            {playlist.map((item, index) => (
              <li
                key={item.id}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1.5",
                  item.audio.id === currentTrackId && "bg-muted",
                )}
              >
                <span className="w-5 shrink-0 text-center font-mono text-[10px] text-muted-foreground">
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onPlayItem(item.audio);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {audioDisplayTitle(item.audio)}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {item.audio.durationSeconds
                        ? formatSeconds(item.audio.durationSeconds)
                        : sourceKindLabel(item.audio.sourceKind)}
                    </span>
                  </span>
                </button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="cursor-pointer"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => {
                    void onMove(item.audio.id, "up");
                  }}
                >
                  <ArrowUpIcon className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="cursor-pointer"
                  aria-label="Move down"
                  disabled={index === playlist.length - 1}
                  onClick={() => {
                    void onMove(item.audio.id, "down");
                  }}
                >
                  <ArrowDownIcon className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="cursor-pointer text-destructive hover:text-destructive"
                  aria-label="Remove from playlist"
                  onClick={() => {
                    void onRemove(item.audio.id);
                  }}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

// --------------------------------------------------------------------
// Display helpers
// --------------------------------------------------------------------

function formatSeconds(secs: number | null | undefined): string {
  if (!secs || !Number.isFinite(secs) || secs <= 0) return "0:00";
  const total = Math.round(secs);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function sourceKindLabel(kind: string): string {
  switch (kind) {
    case "LESSON_OVERVIEW":
      return "Lesson overview";
    case "LESSON_READING":
      return "Lesson reading";
    case "LESSON_VIDEO_OVERVIEW":
      return "Video overview";
    case "LESSON_QUIZ_OVERVIEW":
      return "Assessment overview";
    case "LESSON_QUIZ_READING":
      return "Assessment reading";
    case "RESOURCE_READER":
      return "Resource";
    case "CURRICULUM_OVERVIEW":
      return "Curriculum overview";
    case "COURSE_OBJECTIVES":
      return "Course objectives";
    default:
      return "Audio";
  }
}
