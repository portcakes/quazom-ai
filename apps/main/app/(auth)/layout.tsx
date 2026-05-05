import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

const quazomUrl = process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 sm:p-6">
        <Link
          href={quazomUrl}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          <span>Back to Quazom.ai</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-20 sm:py-24">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
