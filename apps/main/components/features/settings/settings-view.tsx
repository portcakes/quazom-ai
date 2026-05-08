"use client";

import { useMemo, useState } from "react";
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
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { useTRPC } from "@/trpc/client";
import { DisableAccountDialog } from "./disable-account-dialog";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { UsageMeter } from "./usage-meter";

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
      isDisabled: false,
    },
  });
  const profile = profileQuery.data;

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
            editable yet — reach out if you need to change it.
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
          <CardTitle>Alpha plan usage</CardTitle>
          <CardDescription>
            Alpha accounts have generation caps so we can keep things free
            during the early access period. Lesson and discussion caps reset on
            the 1st of each month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsageMeter usage={usageQuery.data} isLoading={usageQuery.isLoading} />
        </CardContent>
      </Card>

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
