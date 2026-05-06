"use client";
import { authClient } from "@/lib/auth-client";

export default function Home() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-3xl font-bold">Loading...</h1>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      {session ? (
        <h1 className="text-3xl font-bold">Hello Main!</h1>
      ) : (
        <h1 className="text-3xl font-bold">Hello Guest!</h1>
      )}
    </div>
  );
}
