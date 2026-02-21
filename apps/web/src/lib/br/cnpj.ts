export function normalizeCnpj(input: string): string {
  return input.replace(/\D/g, "").slice(0, 14);
}

export function formatCnpj(input: string): string {
  const digits = normalizeCnpj(input);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function calculateVerifier(baseDigits: string, weights: number[]): string {
  const sum = baseDigits
    .split("")
    .reduce((acc, digit, index) => {
      const weight = weights[index] ?? 0;
      return acc + Number(digit) * weight;
    }, 0);
  const remainder = sum % 11;

  return remainder < 2 ? "0" : String(11 - remainder);
}

export function isValidCnpj(input: string): boolean {
  const digits = normalizeCnpj(input);

  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const baseTwelve = digits.slice(0, 12);
  const firstVerifier = calculateVerifier(baseTwelve, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondVerifier = calculateVerifier(baseTwelve + firstVerifier, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return digits === baseTwelve + firstVerifier + secondVerifier;
}
