import { formatCnpj, isValidCnpj, normalizeCnpj } from "./cnpj";
import { formatCpf, isValidCpf, normalizeCpf } from "./cpf";

export function normalizeCpfCnpj(input: string): string {
  return input.replace(/\D/g, "").slice(0, 14);
}

export function formatCpfCnpj(input: string): string {
  const digits = normalizeCpfCnpj(input);
  return digits.length <= 11 ? formatCpf(digits) : formatCnpj(digits);
}

export function isValidCpfCnpj(input: string): boolean {
  const digits = normalizeCpfCnpj(input);

  if (digits.length === 0) return false;
  if (digits.length === 11) return isValidCpf(normalizeCpf(digits));
  if (digits.length === 14) return isValidCnpj(normalizeCnpj(digits));

  return false;
}
