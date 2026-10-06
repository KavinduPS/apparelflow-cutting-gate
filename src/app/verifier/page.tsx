import { redirect } from "next/navigation";
import { getSessionUser, getRoleLandingPath } from "@/lib/auth";
import { Role } from "@/generated/prisma/enums";
import { LogoutButton } from "@/app/logout-button";
import { VerifierWorkspace } from "./verifier-workspace";

export default async function VerifierPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.cutting_verifier) {
    redirect(getRoleLandingPath(user.role));
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Cutting Verification Terminal
            </h1>

            <p className="mt-1 text-sm text-gray-600">
              Logged in as{" "}
              <span className="font-semibold text-gray-900">
                {user.fullName}
              </span>
            </p>

            <p className="mt-0.5 text-xs text-gray-500">Role: {user.role}</p>
          </div>

          <LogoutButton />
        </header>

        <VerifierWorkspace />
      </div>
    </main>
  );
}
