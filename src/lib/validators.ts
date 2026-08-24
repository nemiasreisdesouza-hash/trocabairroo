// ═══════════════════════════════════════════════════════════
// Validadores e máscaras (CPF com algoritmo matemático, phone)
// ═══════════════════════════════════════════════════════════

/** Máscara de telefone: (00) 00000-0000 */
export function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length > 0 ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Telefone brasileiro válido? (DDD 11-99 + 8 ou 9 dígitos) */
export function isValidPhone(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length < 10 || d.length > 11) return false;
  const ddd = Number(d.slice(0, 2));
  return ddd >= 11 && ddd <= 99;
}

/** Máscara de CPF: 000.000.000-00 */
export function maskCPF(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/**
 * Validação matemática do CPF (algoritmo oficial dos dígitos
 * verificadores — módulo 11). Rejeita sequências repetidas.
 */
export function isValidCPF(value: string): boolean {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // 111.111.111-11 etc.

  const calcCheckDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(cpf[i]) * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcCheckDigit(9);
  if (d1 !== Number(cpf[9])) return false;
  const d2 = calcCheckDigit(10);
  return d2 === Number(cpf[10]);
}

/** Só dígitos (útil antes de gravar no banco) */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Formata CPF para exibição a partir dos dígitos puros */
export function formatCPFForDisplay(cpf: string | null): string {
  if (!cpf) return "";
  return maskCPF(cpf);
}
