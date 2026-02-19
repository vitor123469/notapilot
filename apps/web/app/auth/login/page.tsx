"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSession } from "../../../src/lib/auth/useSession";
import { createBrowserSupabaseClient } from "../../../src/lib/supabase/browserClient";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const { session, isLoading: isLoadingSession } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isLoadingSession && session) {
      router.replace("/app");
    }
  }, [isLoadingSession, router, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Informe e-mail e senha.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.replace("/app");
  }

  return (
    <main style={{ maxWidth: 420, margin: "48px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 16 }}>Entrar</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@exemplo.com"
            autoComplete="email"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Senha
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>

        {errorMessage ? <p style={{ color: "crimson" }}>{errorMessage}</p> : null}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        Ainda não tem conta? <Link href="/auth/signup">Criar conta</Link>
      </p>
    </main>
  );
}
