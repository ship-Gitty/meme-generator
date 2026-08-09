import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Meme Generator
        </h1>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="rounded-md border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
}
