import { redirect } from "next/navigation";
import { getSessionUser, getRoleLandingPath } from "@/lib/auth";
import { LogoutButton } from "@/app/logout-button";
import { SewingWorkspace } from "./sewing-workspace";

export default async function SewingPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "sewing_supervisor") {
    redirect(getRoleLandingPath(user.role));
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex items-center justify-between bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Sewing Supervisor
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Logged in as{" "}
              <span className="font-semibold text-gray-900">
                {user.fullName}
              </span>
            </p>
          </div>

          <LogoutButton />
        </div>

        <SewingWorkspace />
      </div>
    </main>
  );
}
