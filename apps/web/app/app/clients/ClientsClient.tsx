"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "../../../src/lib/auth/useSession";
import { isValidCnpj } from "../../../src/lib/br/cnpj";
import { isValidCpf } from "../../../src/lib/br/cpf";
import { formatCpfCnpj, normalizeCpfCnpj } from "../../../src/lib/br/cpfCnpj";
import type { Database } from "../../../src/lib/supabase/db.types";
import { getSupabaseBrowser } from "../../../src/lib/supabase/browserClient";
import { getActiveTenantId } from "../../../src/lib/tenancy/activeTenant";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type ClientListRow = Pick<ClientRow, "id" | "name" | "cpf_cnpj" | "email" | "phone" | "created_at">;

function getFriendlyClientError(error: { code?: string; message: string; details?: string | null }): string {
  if (error.code === "23505") {
    return "Já existe um cliente com esses dados únicos para o tenant ativo.";
  }
  return error.message;
}

export function ClientsClient() {
  const router = useRouter();
  const { session, isLoading } = useSession();
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientListRow[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const [name, setName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const cpfCnpjDigits = useMemo(() => normalizeCpfCnpj(cpfCnpj), [cpfCnpj]);
  const documentError =
    cpfCnpjDigits.length > 0 && cpfCnpjDigits.length !== 11 && cpfCnpjDigits.length !== 14
      ? "Documento incompleto"
      : cpfCnpjDigits.length === 11 && !isValidCpf(cpfCnpjDigits)
        ? "CPF inválido"
        : cpfCnpjDigits.length === 14 && !isValidCnpj(cpfCnpjDigits)
          ? "CNPJ inválido"
          : "";
  const isFormInvalid = !name.trim() || Boolean(documentError);

  const resetForm = useCallback(() => {
    setName("");
    setCpfCnpj("");
    setEmail("");
    setPhone("");
    setEditingClientId(null);
    setSubmitError("");
  }, []);

  const loadClients = useCallback(async () => {
    if (!activeTenantId) return;

    const supabase = getSupabaseBrowser();
    setLoadError("");
    setIsLoadingData(true);

    const { data, error } = await supabase
      .from("clients")
      .select("id, name, cpf_cnpj, email, phone, created_at")
      .eq("tenant_id", activeTenantId)
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError(error.message);
      setIsLoadingData(false);
      return;
    }

    setClients(data ?? []);
    setIsLoadingData(false);
  }, [activeTenantId]);

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/auth/login");
      return;
    }

    if (isLoading || !session) return;

    const tenantId = getActiveTenantId();
    if (!tenantId) {
      router.replace("/app/onboarding");
      return;
    }

    setActiveTenantIdState(tenantId);
  }, [isLoading, router, session]);

  useEffect(() => {
    if (!session || !activeTenantId) return;

    loadClients().catch((error) => {
      setLoadError(error instanceof Error ? error.message : String(error));
      setIsLoadingData(false);
    });
  }, [activeTenantId, loadClients, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    if (!activeTenantId) {
      setSubmitError("Tenant ativo não encontrado.");
      return;
    }

    if (isFormInvalid) {
      setSubmitError(documentError || "Preencha os campos obrigatórios.");
      return;
    }

    const payload = {
      name: name.trim(),
      cpf_cnpj: cpfCnpjDigits || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
    };

    setIsSubmitting(true);
    const supabase = getSupabaseBrowser();

    const result = editingClientId
      ? await supabase.from("clients").update(payload).eq("id", editingClientId).eq("tenant_id", activeTenantId)
      : await supabase.from("clients").insert({ ...payload, tenant_id: activeTenantId });

    setIsSubmitting(false);

    if (result.error) {
      setSubmitError(getFriendlyClientError(result.error));
      return;
    }

    resetForm();
    await loadClients();
  }

  function handleEdit(client: ClientListRow) {
    setSubmitError("");
    setDeleteError("");
    setEditingClientId(client.id);
    setName(client.name);
    setCpfCnpj(client.cpf_cnpj ? formatCpfCnpj(client.cpf_cnpj) : "");
    setEmail(client.email ?? "");
    setPhone(client.phone ?? "");
  }

  async function handleDelete(client: ClientListRow) {
    if (!activeTenantId) {
      setDeleteError("Tenant ativo não encontrado.");
      return;
    }

    const confirmed = window.confirm(`Tem certeza que deseja excluir "${client.name}"?`);
    if (!confirmed) return;

    setDeleteError("");
    setDeletingClientId(client.id);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.from("clients").delete().eq("id", client.id).eq("tenant_id", activeTenantId);
    setDeletingClientId(null);

    if (error) {
      setDeleteError(error.message);
      return;
    }

    if (editingClientId === client.id) {
      resetForm();
    }

    await loadClients();
  }

  return (
    <main style={{ display: "grid", gap: 20 }}>
      <h1>Clientes</h1>

      <section style={{ display: "grid", gap: 10, maxWidth: 520 }}>
        <h2>{editingClientId ? "Editar cliente" : "Criar cliente"}</h2>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8 }}>
          <label style={{ display: "grid", gap: 4 }}>
            Nome *
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do cliente" />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            CPF/CNPJ
            <input
              value={cpfCnpj}
              onChange={(event) => {
                const digits = normalizeCpfCnpj(event.target.value);
                setCpfCnpj(formatCpfCnpj(digits));
              }}
              placeholder="000.000.000-00 ou 00.000.000/0001-00"
            />
          </label>
          {documentError ? <p style={{ color: "crimson", margin: 0 }}>{documentError}</p> : null}

          <label style={{ display: "grid", gap: 4 }}>
            E-mail
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="cliente@exemplo.com" />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Telefone
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(11) 99999-9999" />
          </label>

          {submitError ? <p style={{ color: "crimson", margin: 0 }}>{submitError}</p> : null}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={isSubmitting || isFormInvalid}>
              {isSubmitting
                ? editingClientId
                  ? "Salvando..."
                  : "Criando..."
                : editingClientId
                  ? "Salvar alterações"
                  : "Criar cliente"}
            </button>

            {editingClientId ? (
              <button type="button" onClick={resetForm} disabled={isSubmitting}>
                Cancelar edição
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <h2>Lista de clientes</h2>
        {isLoadingData ? <p>Carregando clientes...</p> : null}
        {loadError ? <p style={{ color: "crimson" }}>{loadError}</p> : null}
        {deleteError ? <p style={{ color: "crimson" }}>{deleteError}</p> : null}

        {!isLoadingData && !loadError && clients.length === 0 ? <p>Nenhum cliente cadastrado.</p> : null}

        {!isLoadingData && !loadError && clients.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Nome</th>
                <th style={{ textAlign: "left" }}>CPF/CNPJ</th>
                <th style={{ textAlign: "left" }}>E-mail</th>
                <th style={{ textAlign: "left" }}>Telefone</th>
                <th style={{ textAlign: "left" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>{client.name}</td>
                  <td>{client.cpf_cnpj ? formatCpfCnpj(client.cpf_cnpj) : "-"}</td>
                  <td>{client.email || "-"}</td>
                  <td>{client.phone || "-"}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => handleEdit(client)} disabled={isSubmitting}>
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(client)}
                      disabled={Boolean(deletingClientId) || isSubmitting}
                    >
                      {deletingClientId === client.id ? "Excluindo..." : "Excluir"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
