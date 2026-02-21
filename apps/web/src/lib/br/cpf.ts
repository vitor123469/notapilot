export function normalizeCpf(input: string): string {
  return input.replace(/\D/g, "").slice(0, 11);
}

export function formatCpf(input: string): string {
  const digits = normalizeCpf(input);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function calculateVerifier(baseDigits: string, initialWeight: number): string {
  const sum = baseDigits.split("").reduce((acc, digit, index) => {
    const weight = initialWeight - index;
    return acc + Number(digit) * weight;
  }, 0);
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? "0" : String(remainder);
}

export function isValidCpf(input: string): boolean {
  const digits = normalizeCpf(input);

  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const baseNine = digits.slice(0, 9);
  const firstVerifier = calculateVerifier(baseNine, 10);
  const secondVerifier = calculateVerifier(baseNine + firstVerifier, 11);

  return digits === baseNine + firstVerifier + secondVerifier;
}
