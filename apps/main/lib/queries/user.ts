import "server-only";

// import { headers } from "next/headers";
// import { auth } from "@/lib/auth";
// import prisma from "@/lib/db";

export type CurrentUser = {
  firstName: string;
  fullName: string;
  avatarUrl: string | null;
};

// TODO: replace the hard-coded stub below once auth + DB are wired up.
//
// export async function getCurrentUser(): Promise<CurrentUser | null> {
//   const session = await auth.api.getSession({ headers: await headers() });
//   if (!session) return null;
//
//   const user = await prisma.user.findUnique({
//     where: { id: session.user.id },
//     select: { name: true, image: true },
//   });
//   if (!user) return null;
//
//   const fullName = user.name ?? "User";
//   return {
//     firstName: fullName.split(" ")[0] ?? fullName,
//     fullName,
//     avatarUrl: user.image,
//   };
// }

export async function getCurrentUser(): Promise<CurrentUser> {
  return {
    firstName: "Nova",
    fullName: "Nova Quinn",
    avatarUrl: null,
  };
}
