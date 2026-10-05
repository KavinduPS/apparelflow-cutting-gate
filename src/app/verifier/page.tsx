import { redirect } from "next/navigation";
import { getSessionUser, getRoleLandingPath } from "@/lib/auth";
import { LogoutButton } from "@/app/logout-button";

export default async function VerifierPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "cutting_verifier") {
    redirect(getRoleLandingPath(user.role));
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-gray-900">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg p-6 shadow-sm flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cutting Verifier Terminal</h1>
          <p className="text-sm text-gray-600 mt-1">
            Logged in as <span className="font-semibold text-gray-900">{user.fullName}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Role: {user.role}</p>
        </div>
        <div className="pt-2 border-t border-gray-200 flex justify-end">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
