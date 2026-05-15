"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@quazom-ai/ui/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@quazom-ai/ui/components/ui/select";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { useTRPC } from "@/trpc/client";

// Sentinel value used for the "no title" choice. Radix Select rejects
// empty-string values, so we map between this string and the API's
// `null` payload at the boundary.
const NO_TITLE_VALUE = "__none";

export function TitlePicker() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const titlesQuery = useQuery(trpc.listTitles.queryOptions());

  const setSelected = useMutation(
    trpc.setSelectedTitle.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          data.selectedTitle ? "Title updated" : "Title cleared",
        );
        // Refresh the list so the displayed value lines up with what the
        // server now thinks is selected, and bust the profile cache so the
        // sidebar re-renders with the new label.
        queryClient.invalidateQueries({
          queryKey: trpc.listTitles.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.getProfile.queryKey(),
        });
      },
      onError: (err) => {
        toast.error(err.message ?? "Couldn't update title");
      },
    }),
  );

  const earnedTitles = useMemo(
    () => (titlesQuery.data?.titles ?? []).filter((t) => t.isEarned),
    [titlesQuery.data?.titles],
  );
  const lockedTitles = useMemo(
    () => (titlesQuery.data?.titles ?? []).filter((t) => !t.isEarned),
    [titlesQuery.data?.titles],
  );

  const isLoading = titlesQuery.isLoading;
  const selectedSlug = titlesQuery.data?.selected ?? null;
  const value = selectedSlug ?? NO_TITLE_VALUE;

  const handleChange = (next: string) => {
    const slug = next === NO_TITLE_VALUE ? null : next;
    if (slug === selectedSlug) return;
    setSelected.mutate({ slug });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Title</CardTitle>
        <CardDescription>
          Pick a title to show next to your name in the sidebar. Titles are
          earned by upgrading your plan; new ones will join this list as the
          rewards system grows.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Select
          value={value}
          onValueChange={handleChange}
          disabled={isLoading || setSelected.isPending}
        >
          <SelectTrigger className="w-full sm:w-[320px]">
            <SelectValue
              placeholder={isLoading ? "Loading…" : "No title selected"}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_TITLE_VALUE}>No title</SelectItem>
            {earnedTitles.map((title) => (
              <SelectItem key={title.slug} value={title.slug}>
                <span className="flex items-center gap-2">
                  <SparklesIcon className="size-3.5 text-primary" />
                  {title.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {lockedTitles.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <LockIcon className="size-3.5" />
              Available to earn
            </div>
            <ul className="flex flex-col gap-2">
              {lockedTitles.map((title) => (
                <li key={title.slug} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{title.label}</span>
                    {title.isGrantable ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {title.requiresPlan === "EXPLORER"
                          ? "Subscribe to Explorer"
                          : title.requiresPlan === "SCHOLAR"
                            ? "Subscribe to Scholar"
                            : "Available"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Window closed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {title.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
