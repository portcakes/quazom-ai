import { requireAuth } from "@/lib/auth-utils";
import { getCurrentUser } from "@/lib/queries/user";
import { notFound } from "next/navigation";
import { SettingsView } from "@/components/features/settings/settings-view";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  await requireAuth();
  const user = await getCurrentUser();
  if (!user) notFound();

  return (
    <div className="flex min-w-0 flex-col">
      <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-6 md:gap-4 md:py-12">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Settings
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            Update your profile, see your alpha plan usage, and manage your
            account.
          </p>
        </div>
      </section>
      <section className="mx-auto w-full max-w-3xl px-6 py-8">
        <SettingsView
          initialUser={{
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            avatarUrl: user.avatarUrl,
            isAlpha: user.isAlpha,
          }}
        />
      </section>
    </div>
  );
}
