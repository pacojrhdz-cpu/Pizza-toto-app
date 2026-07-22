import type { Frecuencia } from "./types";

// Devuelve la fecha (YYYY-MM-DD) de inicio de periodo para una frecuencia.
export function fechaPeriodo(frecuencia: Frecuencia, ref = new Date()): string {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  if (frecuencia === "diario") {
    return iso(d);
  }
  if (frecuencia === "semanal") {
    // Lunes de la semana actual (ISO)
    const day = (d.getDay() + 6) % 7; // 0 = lunes
    d.setDate(d.getDate() - day);
    return iso(d);
  }
  // mensual: primer día del mes
  return iso(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const FRECUENCIAS: Frecuencia[] = ["diario", "semanal", "mensual"];

export const frecuenciaLabel: Record<Frecuencia, string> = {
  diario: "Diarios",
  semanal: "Semanales",
  mensual: "Mensuales",
};
