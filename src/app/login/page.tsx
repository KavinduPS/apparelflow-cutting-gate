import { redirect } from "next/navigation";
import { getSessionUser, getRoleLandingPath } from "@/lib/auth";
import { LoginForm } from "@/app/login/login-form";

export default async function LoginPage() {
  const user = await getSessionUser();

  if (user) {
    redirect(getRoleLandingPath(user.role));
  }

  return <LoginForm />;
}
