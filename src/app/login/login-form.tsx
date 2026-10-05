"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getRoleLandingPath } from "@/lib/auth";
import type { Role } from "@/generated/prisma/enums";

interface DemoPersona {
  role: Role;
  label: string;
  email: string;
}

const DEMO_PERSONAS: DemoPersona[] = [
  {
    role: "cutting_supervisor",
    label: "Cutting Supervisor",
    email: "supervisor@apparelflow.test",
  },
  {
    role: "cutting_verifier",
    label: "Cutting Verifier",
    email: "verifier@apparelflow.test",
  },
  {
    role: "sewing_supervisor",
    label: "Sewing Supervisor",
    email: "sewing@apparelflow.test",
  },
];

const DEMO_PASSWORD = "Demo@1234";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function executeLogin(loginEmail: string, loginPass: string) {
    setLoading(true);
    setGeneralError(null);
    setFieldErrors({});

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422 && data.details) {
          const emailErr = data.details.email?.[0];
          const passErr = data.details.password?.[0];
          setFieldErrors({ email: emailErr, password: passErr });
          setGeneralError("Please fix the validation errors below.");
        } else {
          setGeneralError(data.error || "Invalid email or password");
        }
        setLoading(false);
        return;
      }

      const destination = getRoleLandingPath(data.role as Role);
      router.push(destination);
      router.refresh();
    } catch {
      setGeneralError("Network error. Please try again.");
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Invalid email format";
    }

    if (!password) {
      errors.password = "Password is required";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    executeLogin(email.trim(), password);
  }

  function handleDemoClick(persona: DemoPersona) {
    setEmail(persona.email);
    setPassword(DEMO_PASSWORD);
    executeLogin(persona.email, DEMO_PASSWORD);
  }

  return (
    <div
      style={{ colorScheme: "light" }}
      className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-gray-900"
    >
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <h1 className="text-center text-3xl font-extrabold text-gray-900 tracking-tight">
          ApparelFlow
        </h1>
        <p className="mt-1 text-center text-sm font-medium text-gray-600">
          Cutting Gatekeeper Verification Terminal & Sewing Queue
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow border border-gray-200 rounded-lg sm:px-10 flex flex-col gap-6">
          {/* Demo Credentials Panel */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h2 className="text-sm font-bold text-blue-900">
              Role Switcher & Demo Credentials
            </h2>
            <p className="text-xs text-blue-800 mt-1">
              Shared password: <span className="font-mono font-semibold text-blue-950">Demo@1234</span>
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {DEMO_PERSONAS.map((persona) => (
                <div
                  key={persona.role}
                  className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-blue-200 rounded p-2 text-xs gap-2"
                >
                  <div>
                    <span className="font-bold text-gray-900">{persona.label}</span>
                    <span className="block text-gray-500 font-mono">{persona.email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDemoClick(persona)}
                    disabled={loading}
                    className="inline-flex items-center justify-center px-2.5 py-1.5 border border-transparent text-xs font-semibold rounded text-white bg-blue-700 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-600 disabled:opacity-50 cursor-pointer"
                  >
                    Sign in
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Standard Login Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-900"
              >
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-500 bg-white text-gray-900 focus:outline-none sm:text-sm ${
                    fieldErrors.email
                      ? "border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  }`}
                  placeholder="name@apparelflow.test"
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-700 font-medium">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-900"
              >
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-500 bg-white text-gray-900 focus:outline-none sm:text-sm ${
                    fieldErrors.password
                      ? "border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  }`}
                  placeholder="••••••••"
                />
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-700 font-medium">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {generalError && (
              <div
                role="alert"
                className="p-3 rounded-md bg-red-50 border border-red-200 text-xs font-semibold text-red-800"
              >
                {generalError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
