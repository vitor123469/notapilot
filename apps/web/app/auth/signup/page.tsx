"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSession } from "../../../src/lib/auth/useSession";
import { getSupabaseBrowser } from "../../../src/lib/supabase/browserClient";

export default function SignupPage() {
  const router = useRouter();
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

    if (password.length < 6) {
      setErrorMessage("A senha precisa ter no mínimo 6 caracteres.");
      return;
    }

    setIsSubmitting(true);
    const supabase = getSupabaseBrowser();

    const normalizedEmail = email.trim();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (signUpError) {
      setIsSubmitting(false);
      setErrorMessage(signUpError.message);
      return;
    }

    if (!signUpData.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (signInError) {
        setIsSubmitting(false);
        setErrorMessage(signInError.message);
        return;
      }
    }

    setIsSubmitting(false);
    router.push("/app/onboarding");
  }

  return (
    <main style={{ maxWidth: 420, margin: "48px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 16 }}>Criar conta</h1>
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
            autoComplete="new-password"
          />
        </label>

        {errorMessage ? <p style={{ color: "crimson" }}>{errorMessage}</p> : null}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Criando..." : "Criar conta"}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        Já tem conta? <Link href="/auth/login">Entrar</Link>
      </p>
    </main>
  );
}
