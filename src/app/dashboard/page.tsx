import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { memes } from "@/lib/db/schema";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userMemes = await db.query.memes.findMany({
    where: eq(memes.userId, session.user.id),
  });

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/15">
        <span className="text-sm font-medium">{session.user.email}</span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="text-sm text-black/60 transition-colors hover:text-black dark:text-white/60 dark:hover:text-white"
          >
            Sign out
          </button>
        </form>
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        {userMemes.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            You haven&apos;t created any memes yet.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {userMemes.map((meme) => (
              <li key={meme.id} className="text-sm">
                {meme.prompt}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
