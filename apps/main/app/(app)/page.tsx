import { requireAuth } from "@/lib/auth-utils";

export default async function Home() {
  const session = await requireAuth();
  const firstName = session.user.name?.split(" ")[0];
  if (!firstName) {
    return <div>No name found</div>;
  }
  return ( 
  <div className="flex flex-col items-center justify-center h-screen">
    <h1 className="text-2xl font-bold">Hello {firstName}</h1>
    </div>
  );
};
