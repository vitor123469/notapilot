import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 600, margin: "48px auto", padding: 16, display: "grid", gap: 16 }}>
      <h1>NotaPilot</h1>
      <p>Fluxo mínimo de autenticação + tenancy para validar RLS multi-tenant.</p>
      <div style={{ display: "flex", gap: 12 }}>
        <Link href="/auth/login">Entrar</Link>
        <Link href="/auth/signup">Criar conta</Link>
        <Link href="/app">Ir para app</Link>
      </div>
    </main>
  );
}
