import { redirect } from "next/navigation";
import { getSessionUser, getRoleLandingPath } from "@/lib/auth";
import { Role } from "@/generated/prisma/enums";
import { SupervisorWorkspace } from "./supervisor-workspace";
import RolePageHeader from "@/components/role-page-header";

export default async function SupervisorPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.cutting_supervisor) {
    redirect(getRoleLandingPath(user.role));
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <RolePageHeader
          title={"Cutting Supervisor Terminal"}
          fullName={user.fullName}
        />
        <SupervisorWorkspace />
      </div>
    </main>
  );
}
