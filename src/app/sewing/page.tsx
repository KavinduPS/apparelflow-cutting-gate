import { redirect } from "next/navigation";
import { getSessionUser, getRoleLandingPath } from "@/lib/auth";
import { SewingWorkspace } from "./sewing-workspace";
import RolePageHeader from "@/components/role-page-header";

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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <RolePageHeader
          title={"Sewing Supervisor Terminal"}
          fullName={user.fullName}
        />

        <SewingWorkspace />
      </div>
    </main>
  );
}
