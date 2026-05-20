"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyleKit } from "@tiptap/extension-text-style";

// Extended Link mark that carries two extra attributes so the "Insert
// source" picker can flag a link as a badge-style chip pointing at a
// specific learner-owned curriculum / lesson / resource. The editor's CSS
// styles `a[data-source-badge="true"]` as a pill rather than an inline link.
const SourceLink = Link.extend({
  inclusive: false,
  addAttributes() {
    const parent = this.parent?.() ?? {};
    return {
      ...parent,
      "data-source-type": {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-source-type"),
        renderHTML: (attrs) => {
          const value = attrs["data-source-type"];
          if (!value) return {};
          return { "data-source-type": value };
        },
      },
      "data-source-badge": {
        default: null,
        parseHTML: (el) =>
          (el as HTMLElement).getAttribute("data-source-badge"),
        renderHTML: (attrs) => {
          const value = attrs["data-source-badge"];
          if (!value) return {};
          return { "data-source-badge": value };
        },
      },
    };
  },
});
import {
  BoldIcon,
  CodeIcon,
  Code2Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  HighlighterIcon,
  ItalicIcon,
  LinkIcon,
  Link2OffIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PaletteIcon,
  PilcrowIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  TypeIcon,
  UnderlineIcon,
  Undo2Icon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@quazom-ai/ui/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@quazom-ai/ui/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@quazom-ai/ui/components/ui/select";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { InsertSourceLinkPopover } from "./insert-source-link-popover";

// Editor-only Tailwind classes applied to the contenteditable. Using inline
// modifiers keeps us from having to drag @tailwindcss/typography in just for
// the editor body. Mirrors the look of our prose `<Markdown>` renderer.
const PROSE_CLASSES =
  "min-h-full focus:outline-none " +
  "text-base leading-relaxed " +
  "[&_p]:my-3 " +
  "[&_h1]:font-heading [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 " +
  "[&_h2]:font-heading [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3 " +
  "[&_h3]:font-heading [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 " +
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 " +
  "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 " +
  "[&_li]:my-1 " +
  "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground " +
  "[&_hr]:my-6 [&_hr]:border-border " +
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm [&_code]:font-mono " +
  "[&_pre]:my-4 [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:text-sm [&_pre]:font-mono [&_pre]:overflow-x-auto " +
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 " +
  // Source-link badges — links the user inserted via the Insert Source picker.
  // Rendered as inline chips so they stand out from regular text links.
  "[&_a[data-source-badge='true']]:no-underline " +
  "[&_a[data-source-badge='true']]:inline-flex " +
  "[&_a[data-source-badge='true']]:items-center " +
  "[&_a[data-source-badge='true']]:gap-1 " +
  "[&_a[data-source-badge='true']]:rounded-full " +
  "[&_a[data-source-badge='true']]:border " +
  "[&_a[data-source-badge='true']]:border-border " +
  "[&_a[data-source-badge='true']]:bg-muted/60 " +
  "[&_a[data-source-badge='true']]:px-2 " +
  "[&_a[data-source-badge='true']]:py-0.5 " +
  "[&_a[data-source-badge='true']]:text-sm " +
  "[&_a[data-source-badge='true']]:text-foreground " +
  "[&_a[data-source-badge='true']]:font-medium " +
  "[&_a[data-source-badge='true']:hover]:bg-muted " +
  // ProseMirror placeholder styling for empty editors.
  "[&_.is-editor-empty]:before:content-[attr(data-placeholder)] [&_.is-editor-empty]:before:text-muted-foreground/60 [&_.is-editor-empty]:before:float-left [&_.is-editor-empty]:before:pointer-events-none [&_.is-editor-empty]:before:h-0";

// Eight text colours + a "default" sentinel. Picked from the project's
// accent palette so swatches feel intentional rather than randomly bright.
const TEXT_COLORS: { label: string; value: string }[] = [
  { label: "Default", value: "DEFAULT" },
  { label: "Slate", value: "#475569" },
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Amber", value: "#d97706" },
  { label: "Green", value: "#16a34a" },
  { label: "Blue", value: "#2563eb" },
  { label: "Purple", value: "#9333ea" },
  { label: "Pink", value: "#db2777" },
];

const HIGHLIGHT_COLORS: { label: string; value: string }[] = [
  { label: "None", value: "NONE" },
  { label: "Yellow", value: "#fef08a" },
  { label: "Pink", value: "#fbcfe8" },
  { label: "Blue", value: "#bfdbfe" },
  { label: "Orange", value: "#fed7aa" },
  { label: "Green", value: "#bbf7d0" },
  { label: "Purple", value: "#e9d5ff" },
];

const FONT_SIZES: { label: string; value: string }[] = [
  { label: "XS", value: "12px" },
  { label: "S", value: "14px" },
  { label: "M", value: "16px" },
  { label: "L", value: "18px" },
  { label: "XL", value: "22px" },
  { label: "XXL", value: "28px" },
];

type Props = {
  value: string;
  onChange: (next: string) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  onEditorReady?: (editor: Editor) => void;
};

/**
 * Rich-text editor for Continuity Notes. Wraps TipTap with our toolbar +
 * the project's UI primitives. Stores its value as HTML — the parent is
 * responsible for persistence; we only emit on each transaction.
 */
export function RichTextEditor({
  value,
  onChange,
  editable = true,
  placeholder = "Start writing your note…",
  className,
  onEditorReady,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Use our extended SourceLink mark instead of the default link so
        // the Insert Source picker can attach badge metadata.
        link: false,
      }),
      SourceLink.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyleKit,
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: PROSE_CLASSES,
        spellcheck: "true",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  // Keep editor content in sync when the active note changes (e.g. user
  // switches notes via the sidebar). We compare against the editor's own
  // HTML so onUpdate-driven local edits don't trigger a reset.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  // Notify parent once the editor instance is available so external triggers
  // (e.g. the panel's PDF-export button) can call commands on it.
  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  if (!editor) {
    return (
      <div className={cn("flex flex-1 flex-col gap-2", className)}>
        <Toolbar editor={null} />
        <div className="flex-1 rounded-lg border border-border bg-card/40" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-1 min-h-0 flex-col gap-2", className)}>
      <Toolbar editor={editor} />
      <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-border bg-card/40 px-4 py-3">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const disabled = !editor;
  // Force a re-render on every editor selection/transaction so the active
  // state of toolbar buttons (bold / heading / list / etc.) stays in sync.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const update = () => setTick((t) => t + 1);
    editor.on("transaction", update);
    editor.on("selectionUpdate", update);
    return () => {
      editor.off("transaction", update);
      editor.off("selectionUpdate", update);
    };
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
      <ToolbarIconButton
        icon={Undo2Icon}
        label="Undo"
        onClick={() => editor?.chain().focus().undo().run()}
        disabled={disabled || !editor?.can().undo()}
      />
      <ToolbarIconButton
        icon={Redo2Icon}
        label="Redo"
        onClick={() => editor?.chain().focus().redo().run()}
        disabled={disabled || !editor?.can().redo()}
      />
      <Divider />
      <HeadingSelect editor={editor} />
      <FontSizeSelect editor={editor} />
      <Divider />
      <ToolbarIconButton
        icon={BoldIcon}
        label="Bold"
        onClick={() => editor?.chain().focus().toggleBold().run()}
        active={editor?.isActive("bold")}
        disabled={disabled}
      />
      <ToolbarIconButton
        icon={ItalicIcon}
        label="Italic"
        onClick={() => editor?.chain().focus().toggleItalic().run()}
        active={editor?.isActive("italic")}
        disabled={disabled}
      />
      <ToolbarIconButton
        icon={UnderlineIcon}
        label="Underline"
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
        active={editor?.isActive("underline")}
        disabled={disabled}
      />
      <ToolbarIconButton
        icon={StrikethroughIcon}
        label="Strikethrough"
        onClick={() => editor?.chain().focus().toggleStrike().run()}
        active={editor?.isActive("strike")}
        disabled={disabled}
      />
      <Divider />
      <ColorPopover
        editor={editor}
        kind="text"
        icon={PaletteIcon}
        label="Text colour"
      />
      <ColorPopover
        editor={editor}
        kind="highlight"
        icon={HighlighterIcon}
        label="Highlight"
      />
      <Divider />
      <ToolbarIconButton
        icon={ListIcon}
        label="Bulleted list"
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
        active={editor?.isActive("bulletList")}
        disabled={disabled}
      />
      <ToolbarIconButton
        icon={ListOrderedIcon}
        label="Numbered list"
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        active={editor?.isActive("orderedList")}
        disabled={disabled}
      />
      <ToolbarIconButton
        icon={QuoteIcon}
        label="Quote"
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        active={editor?.isActive("blockquote")}
        disabled={disabled}
      />
      <ToolbarIconButton
        icon={CodeIcon}
        label="Inline code"
        onClick={() => editor?.chain().focus().toggleCode().run()}
        active={editor?.isActive("code")}
        disabled={disabled}
      />
      <ToolbarIconButton
        icon={Code2Icon}
        label="Code block"
        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        active={editor?.isActive("codeBlock")}
        disabled={disabled}
      />
      <ToolbarIconButton
        icon={MinusIcon}
        label="Horizontal line"
        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        disabled={disabled}
      />
      <Divider />
      <LinkPopover editor={editor} />
      <InsertSourceLinkPopover editor={editor} />
    </div>
  );
}

function ToolbarIconButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
        active && "bg-background text-foreground shadow-sm",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border/80" />;
}

function HeadingSelect({ editor }: { editor: Editor | null }) {
  const current = (() => {
    if (!editor) return "p";
    if (editor.isActive("heading", { level: 1 })) return "h1";
    if (editor.isActive("heading", { level: 2 })) return "h2";
    if (editor.isActive("heading", { level: 3 })) return "h3";
    return "p";
  })();

  const handleChange = (value: string) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (value === "p") {
      chain.setParagraph().run();
    } else if (value === "h1") {
      chain.toggleHeading({ level: 1 }).run();
    } else if (value === "h2") {
      chain.toggleHeading({ level: 2 }).run();
    } else if (value === "h3") {
      chain.toggleHeading({ level: 3 }).run();
    }
  };

  return (
    <Select value={current} onValueChange={handleChange} disabled={!editor}>
      <SelectTrigger
        size="sm"
        className="h-8 w-[110px] gap-1 bg-transparent text-xs"
        aria-label="Text style"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="p">
          <span className="inline-flex items-center gap-2">
            <PilcrowIcon className="size-3.5" /> Paragraph
          </span>
        </SelectItem>
        <SelectItem value="h1">
          <span className="inline-flex items-center gap-2">
            <Heading1Icon className="size-3.5" /> Heading 1
          </span>
        </SelectItem>
        <SelectItem value="h2">
          <span className="inline-flex items-center gap-2">
            <Heading2Icon className="size-3.5" /> Heading 2
          </span>
        </SelectItem>
        <SelectItem value="h3">
          <span className="inline-flex items-center gap-2">
            <Heading3Icon className="size-3.5" /> Heading 3
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

function FontSizeSelect({ editor }: { editor: Editor | null }) {
  const current = (editor?.getAttributes("textStyle")?.fontSize as string) || "";

  const handleChange = (value: string) => {
    if (!editor) return;
    if (value === "RESET") {
      editor.chain().focus().unsetFontSize().run();
    } else {
      editor.chain().focus().setFontSize(value).run();
    }
  };

  return (
    <Select
      value={current || ""}
      onValueChange={handleChange}
      disabled={!editor}
    >
      <SelectTrigger
        size="sm"
        className="h-8 w-[80px] gap-1 bg-transparent text-xs"
        aria-label="Font size"
      >
        <span className="inline-flex items-center gap-1">
          <TypeIcon className="size-3.5" />
          <SelectValue placeholder="Size" />
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="RESET">Default</SelectItem>
        {FONT_SIZES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label} · {s.value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ColorPopover({
  editor,
  kind,
  icon: Icon,
  label,
}: {
  editor: Editor | null;
  kind: "text" | "highlight";
  icon: LucideIcon;
  label: string;
}) {
  const palette = kind === "text" ? TEXT_COLORS : HIGHLIGHT_COLORS;

  const handlePick = (value: string) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (kind === "text") {
      if (value === "DEFAULT") chain.unsetColor().run();
      else chain.setColor(value).run();
    } else {
      if (value === "NONE") chain.unsetHighlight().run();
      else chain.toggleHighlight({ color: value }).run();
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          disabled={!editor}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-3 gap-1.5">
          {palette.map((c) => {
            const isReset = c.value === "DEFAULT" || c.value === "NONE";
            return (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => handlePick(c.value)}
                className={cn(
                  "flex h-8 w-12 items-center justify-center rounded-md border border-border text-xs transition-colors hover:bg-accent",
                  isReset && "text-muted-foreground",
                )}
                style={
                  isReset
                    ? undefined
                    : kind === "text"
                      ? { color: c.value, fontWeight: 600 }
                      : { backgroundColor: c.value }
                }
              >
                {isReset ? "None" : "A"}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LinkPopover({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  // Track which `open` transition we've already seeded the input on, so we
  // can re-prime the field every time the popover opens without doing it
  // inside a useEffect (the new lint rule forbids that). When the user
  // closes & reopens for a different selection, the flag resets.
  const [seededForOpen, setSeededForOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isActive = editor?.isActive("link") ?? false;
  const existingHref = (editor?.getAttributes("link")?.href as string) || "";

  if (open && !seededForOpen) {
    setSeededForOpen(true);
    setUrl(existingHref);
  } else if (!open && seededForOpen) {
    setSeededForOpen(false);
  }

  // Focus the URL input on a real DOM frame after the popover mounts. The
  // setState part of "seeding" runs during render above; this effect only
  // does DOM side effects, so the set-state-in-effect rule is satisfied.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [open]);

  const apply = () => {
    if (!editor) return;
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
    } else {
      const withProtocol = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;
      editor.chain().focus().setLink({ href: withProtocol }).run();
    }
    setOpen(false);
  };

  const clear = () => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
    setUrl("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Add link"
          title="Add link"
          disabled={!editor}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
            isActive && "bg-background text-foreground shadow-sm",
          )}
        >
          <LinkIcon className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Link
        </p>
        <Input
          ref={inputRef}
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={!isActive}
            className="gap-1"
          >
            <Link2OffIcon className="size-3.5" /> Remove
          </Button>
          <Button type="button" size="sm" onClick={apply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
