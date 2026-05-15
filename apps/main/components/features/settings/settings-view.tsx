"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@quazom-ai/ui/components/ui/avatar";
import { Button } from "@quazom-ai/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@quazom-ai/ui/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@quazom-ai/ui/components/ui/form";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Label } from "@quazom-ai/ui/components/ui/label";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { useTRPC } from "@/trpc/client";
import { DisableAccountDialog } from "./disable-account-dialog";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { UsageMeter } from "./usage-meter";
import { SubscriptionCard } from "./subscription-card";
import { TitlePicker } from "./title-picker";
import { ThemePicker } from "@/components/shared/theme-picker";
import { TimezonePicker } from "@/components/shared/timezone-picker";

const profileSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(120, "Name must be 120 characters or fewer"),
  image: z
    .string()
    .max(2048, "URL is too long")
    .refine((v) => v === "" || z.url().safeParse(v).success, {
      message: "Avatar must be a valid URL",
    }),
});

type ProfileValues = z.infer<typeof profileSchema>;

type Props = {
  initialUser: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    isAlpha: boolean;
    timezone: string;
  };
};

export function SettingsView({ initialUser }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [disableOpen, setDisableOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const profileQuery = useQuery({
    ...trpc.getProfile.queryOptions(),
    initialData: {
      id: initialUser.id,
      name: initialUser.fullName,
      email: initialUser.email,
      image: initialUser.avatarUrl,
      isAlpha: initialUser.isAlpha,
      subscriptionPlan: null,
      subscriptionInterval: null,
      earnedTitles: [],
      selectedTitle: null,
      isDisabled: false,
      timezone: initialUser.timezone,
    },
  });
  const profile = profileQuery.data;

  // Auto-set the user's timezone the first time they hit Settings if they're
  // still on the UTC default — saves them the trouble of finding their own
  // zone in the list. The detection runs on the client (`Intl.DateTimeFormat`
  // resolved zone) so it matches what their browser thinks they're in.
  const updateTimezone = useMutation(
    trpc.updateTimezone.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(trpc.getProfile.queryKey(), (prev) =>
          prev ? { ...prev, timezone: data.timezone } : prev,
        );
      },
      onError: (err) =>
        toast.error(err.message ?? "Failed to update timezone"),
    }),
  );
  useEffect(() => {
    if (profile.timezone && profile.timezone !== "UTC") return;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!detected || detected === "UTC") return;
    if (detected === profile.timezone) return;
    // Optimistically update the UI so the user sees their detected zone
    // before the round trip completes.
    queryClient.setQueryData(trpc.getProfile.queryKey(), (prev) =>
      prev ? { ...prev, timezone: detected } : prev,
    );
    updateTimezone.mutate({ timezone: detected });
    // Intentionally only runs once per profile load — the dependency list
    // pins to the timezone we just observed so this effect doesn't re-fire
    // after the optimistic update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.timezone]);

  const handleTimezoneChange = (tz: string) => {
    if (tz === profile.timezone) return;
    queryClient.setQueryData(trpc.getProfile.queryKey(), (prev) =>
      prev ? { ...prev, timezone: tz } : prev,
    );
    updateTimezone.mutate(
      { timezone: tz },
      {
        onSuccess: () => toast.success("Timezone updated"),
      },
    );
  };

  const usageQuery = useQuery(trpc.getAlphaUsage.queryOptions());

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      name: profile.name ?? "",
      image: profile.image ?? "",
    },
    mode: "onTouched",
  });

  const update = useMutation(
    trpc.updateProfile.mutationOptions({
      onSuccess: (data) => {
        toast.success("Profile updated");
        queryClient.setQueryData(
          trpc.getProfile.queryKey(),
          (prev) => (prev ? { ...prev, name: data.name, image: data.image } : prev),
        );
      },
      onError: (err) => toast.error(err.message ?? "Failed to update profile"),
    }),
  );

  const initials = useMemo(() => {
    return (
      (profile.name ?? "")
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "?"
    );
  }, [profile.name]);

  const previewImage = form.watch("image");
  const previewName = form.watch("name");

  const onSubmit = (values: ProfileValues) => {
    update.mutate({ name: values.name.trim(), image: values.image.trim() });
  };

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your name and avatar are visible across the app. Email isn&apos;t
            editable yet — reach out to <a href="mailto:support@quazom.ai">support@quazom.ai</a> if you need to change it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-6"
            >
              <div className="flex items-center gap-4">
                <Avatar size="lg">
                  {previewImage ? (
                    <AvatarImage src={previewImage} alt={previewName || "avatar"} />
                  ) : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-medium">{profile.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Signed in
                  </p>
                </div>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your full name"
                        autoComplete="name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="image"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Avatar URL</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://example.com/avatar.png"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Paste a link to a hosted image. Leave blank to use your
                      initials.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="cursor-pointer"
                  disabled={update.isPending || !form.formState.isDirty}
                >
                  {update.isPending ? <Spinner /> : "Save profile"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Pick a theme and tell us where you live so streaks and daily
            check-ins follow your calendar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <Label className="text-sm font-medium">Appearance</Label>
              <p className="text-xs text-muted-foreground">
                Choose how Quazom looks. The change fades in across the app —
                no reload required.
              </p>
              <ThemePicker idPrefix="settings-theme" />
            </div>

            <div className="flex flex-col gap-3">
              <Label htmlFor="timezone-input" className="text-sm font-medium">
                Timezone
              </Label>
              <p className="text-xs text-muted-foreground">
                Daily check-ins unlock at midnight in your timezone. We try to
                detect this from your browser; override it if we got it wrong.
              </p>
              <TimezonePicker
                value={profile.timezone ?? "UTC"}
                onChange={handleTimezoneChange}
                disabled={updateTimezone.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Current: <span className="font-mono">{profile.timezone ?? "UTC"}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan usage</CardTitle>
          <CardDescription>
            Generation caps apply per plan. Monthly counters reset on the 1st;
            Scholar removes the caps entirely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsageMeter usage={usageQuery.data} isLoading={usageQuery.isLoading} />
        </CardContent>
      </Card>

      <SubscriptionCard />

      <TitlePicker />

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            Disabling locks your account but keeps your data so you can come
            back later. Deleting permanently removes your account and every
            curriculum, lesson, and note tied to it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setDisableOpen(true)}
            >
              Disable account
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              onClick={() => setDeleteOpen(true)}
            >
              Delete account
            </Button>
          </div>
        </CardContent>
      </Card>

      <DisableAccountDialog open={disableOpen} onOpenChange={setDisableOpen} />
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
