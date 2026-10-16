import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { api } from "../lib/api";
import type { AuthResponse } from "../lib/types";
import { useAuthStore } from "../store/auth-store";
import { Button, Input } from "../components/ui";

const schema = z.object({ email: z.email(), password: z.string().min(1) });
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const currentUser = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });
  if (currentUser) return <Navigate to="/dashboard" replace />;
  const submit = async (values: FormValues) => {
    try {
      const auth = await api<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      if (!auth.user.permissions.includes("admin:read"))
        throw new Error("This account does not have administrator access.");
      setAuth(auth);
      navigate("/dashboard");
    } catch (error) {
      setError("root", {
        message: error instanceof Error ? error.message : "Unable to sign in",
      });
    }
  };
  return (
    <main className="grid min-h-screen bg-stone-50 lg:grid-cols-2">
      <section className="hidden flex-col justify-between overflow-hidden bg-[#123d31] p-12 text-white lg:flex">
        <div className="flex items-center gap-3 text-lg font-bold">
          <span className="grid size-10 place-items-center rounded-xl rounded-bl-sm bg-lime-300 text-emerald-950">
            S
          </span>
          SocialRecipe
        </div>
        <div className="max-w-xl">
          <p className="mb-4 text-xs font-bold tracking-[.2em] text-lime-300">
            COMMUNITY OPERATIONS
          </p>
          <h1 className="text-5xl font-bold leading-tight">
            Keep every recipe community healthy.
          </h1>
          <p className="mt-5 text-lg text-emerald-50/70">
            Review reports, manage people, tune moderation, and watch platform
            health from one calm workspace.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-emerald-50/70">
          <ShieldCheck className="text-lime-300" />
          Protected by role-based access control
        </div>
      </section>
      <section className="grid place-items-center p-6">
        <form
          onSubmit={handleSubmit(submit)}
          className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 shadow-xl shadow-stone-200/60"
        >
          <p className="text-xs font-bold tracking-[.18em] text-emerald-700">
            ADMIN CONSOLE
          </p>
          <h2 className="mt-3 text-3xl font-bold">Welcome back</h2>
          <p className="mt-2 text-stone-500">
            Sign in with your administrator account.
          </p>
          <div className="mt-8 grid gap-5">
            <label className="grid gap-2 text-sm font-semibold">
              Email address
              <Input type="email" autoComplete="email" {...register("email")} />
              <span className="text-xs text-red-600">
                {errors.email?.message}
              </span>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Password
              <Input
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
              <span className="text-xs text-red-600">
                {errors.password?.message}
              </span>
            </label>
            {errors.root && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {errors.root.message}
              </p>
            )}
            <Button disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Signing in…" : "Sign in"}
              <ArrowRight size={17} />
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
