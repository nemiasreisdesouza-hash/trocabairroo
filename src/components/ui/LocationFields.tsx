"use client";

import { useState } from "react";
import { Input, Select } from "./Input";
import {
  CIDADES_ES,
  BAIRROS_POR_CIDADE,
  CIDADE_OUTRA,
  BAIRRO_OUTRO,
} from "@/lib/constants";

type FieldProps = {
  /** Valor FINAL (nome selecionado ou digitado) — nunca a sentinela */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
};

/**
 * 🏙️ CIDADE com opção dinâmica "Outra cidade..."
 *
 * O select mostra a lista do Espírito Santo + "Outra cidade..." no fim.
 * Ao escolher "Outra cidade...", um campo de texto aparece na hora.
 * O valor final (selecionado OU digitado) é devolvido via onChange e
 * salvo diretamente na coluna `cidade` do Supabase / estado do app.
 *
 * Para UF fora do ES → campo de texto livre direto.
 * `key` no consumidor pode forçar reset ao trocar a UF.
 */
export function CidadeField({
  value,
  onChange,
  error,
  disabled,
  uf = "ES",
}: FieldProps & { uf?: string }) {
  const [outraAtiva, setOutraAtiva] = useState(false);

  if (uf !== "ES") {
    return (
      <Input
        label="Cidade"
        placeholder="Digite o nome da sua cidade"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        disabled={disabled}
      />
    );
  }

  // Valor fora da lista (ex: cidade custom salva antes) → modo "outra"
  const isOutra =
    outraAtiva || (value !== "" && !CIDADES_ES.includes(value));

  return (
    <>
      <Select
        label="Cidade"
        placeholder="Selecione a cidade"
        error={isOutra ? undefined : error}
        value={isOutra ? CIDADE_OUTRA : value}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          if (v === CIDADE_OUTRA) {
            setOutraAtiva(true);
            onChange(""); // abre o campo de digitação limpo
          } else {
            setOutraAtiva(false);
            onChange(v);
          }
        }}
        options={[
          ...CIDADES_ES.map((c) => ({ value: c, label: c })),
          { value: CIDADE_OUTRA, label: "Outra cidade..." },
        ]}
      />
      {isOutra && (
        <div className="mt-3">
          <Input
            label="Digite o nome da sua cidade"
            placeholder="Ex: Colatina, Fundão, Vila Valério..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            error={error}
            disabled={disabled}
          />
        </div>
      )}
    </>
  );
}

/**
 * 📍 BAIRRO com opção dinâmica "Outro bairro..."
 *
 * • Cidade conhecida (com lista) → select da cidade + "Outro bairro..."
 *   no fim; ao escolher, o campo de texto aparece imediatamente.
 * • Cidade customizada/ainda não escolhida → digitação livre direta.
 *
 * O valor final é salvo na coluna `bairro` do Supabase / estado do app.
 * Dica: use key={cidade} para reiniciar o campo quando a cidade mudar.
 */
export function BairroField({
  value,
  onChange,
  error,
  disabled,
  cidade,
  uf = "ES",
}: FieldProps & { cidade: string; uf?: string }) {
  const [outraAtiva, setOutraAtiva] = useState(false);

  if (uf !== "ES") {
    return (
      <Input
        label="Bairro"
        placeholder="Digite o nome do seu bairro"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        disabled={disabled}
      />
    );
  }

  const lista = cidade ? BAIRROS_POR_CIDADE[cidade] : undefined;

  // Cidade custom (ou não escolhida) → bairro de digitação livre
  if (!lista) {
    return (
      <Input
        label="Bairro"
        placeholder="Digite o nome do seu bairro"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        disabled={disabled}
        hint={cidade ? undefined : "Selecione a cidade primeiro"}
      />
    );
  }

  const isOutra = outraAtiva || (value !== "" && !lista.includes(value));

  return (
    <>
      <Select
        label="Bairro"
        placeholder="Selecione o bairro"
        error={isOutra ? undefined : error}
        value={isOutra ? BAIRRO_OUTRO : value}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          if (v === BAIRRO_OUTRO) {
            setOutraAtiva(true);
            onChange("");
          } else {
            setOutraAtiva(false);
            onChange(v);
          }
        }}
        options={[
          ...lista.map((b) => ({ value: b, label: b })),
          { value: BAIRRO_OUTRO, label: "Outro bairro..." },
        ]}
      />
      {isOutra && (
        <div className="mt-3">
          <Input
            label="Digite o nome do seu bairro"
            placeholder="Ex: Parque Residencial, Bela Vista..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            error={error}
            disabled={disabled}
          />
        </div>
      )}
    </>
  );
}
