"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginCard() {
  const params      = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const error       = params.get("error");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      {/* Left accent stripe */}
      <div className="hidden lg:block fixed left-0 inset-y-0 w-1 bg-blue-600" />

      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl
                            bg-blue-600 shadow-md shadow-blue-200">
              <svg viewBox="0 0 24 24" className="h-8 w-8 text-white" fill="none"
                stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813
                     a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12
                     l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Agent Mesh SRE</h1>
            <p className="mt-1 text-sm text-slate-500">Agentic AI for Kafka operations</p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              <span className="font-bold">✕</span>
              {error === "OAuthAccountNotLinked"
                ? "This email is linked to another sign-in method."
                : "Sign-in failed. Please try again."}
            </div>
          )}

          {/* Divider label */}
          <div className="mb-4 text-xs font-semibold text-slate-400 uppercase tracking-widest text-center">
            Sign in to continue
          </div>

          {/* Google button */}
          <button
            onClick={() => signIn("google", { callbackUrl })}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200
                       bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm
                       transition-all duration-150 hover:border-blue-400 hover:bg-blue-50
                       hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
          >
            {/* Google G */}
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>

          <p className="mt-5 text-center text-xs text-slate-400">
            Any Google account can sign in.
          </p>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-[10px] text-slate-400 uppercase tracking-widest font-medium">
          Agent Mesh SRE · Powered by Anthropic
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  );
}
