"use client";

import { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  icon?: ReactNode;
  hint?: string;
};

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  hint?: string;
  rows?: number;
};

export function Input({ label, error, icon, hint, className = "", ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-semibold text-gray-700">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        <input
          {...props}
          className={`
            w-full border-2 rounded-2xl px-4 py-3 text-gray-900 text-base
            placeholder:text-gray-400
            focus:outline-none focus:border-purple-600
            transition-colors
            ${error ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"}
            ${icon ? "pl-10" : ""}
            ${className}
          `}
        />
      </div>
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, hint, rows = 4, className = "", ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-semibold text-gray-700">{label}</label>
      )}
      <textarea
        {...props}
        rows={rows}
        className={`
          w-full border-2 rounded-2xl px-4 py-3 text-gray-900 text-base
          placeholder:text-gray-400
          focus:outline-none focus:border-purple-600
          transition-colors resize-none
          ${error ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"}
          ${className}
        `}
      />
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
};

export function Select({ label, error, hint, options, placeholder, className = "", ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-semibold text-gray-700">{label}</label>
      )}
      <select
        {...props}
        className={`
          w-full border-2 rounded-2xl px-4 py-3 text-gray-900 text-base
          focus:outline-none focus:border-purple-600
          transition-colors bg-white
          ${error ? "border-red-400 bg-red-50" : "border-gray-200"}
          ${className}
        `}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}
