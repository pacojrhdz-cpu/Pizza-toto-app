import type { SupabaseClient } from "@supabase/supabase-js";
import { fechaPeriodo, FRECUENCIAS } from "./periodos";
import type { Frecuencia } from "./types";

interface Plantilla {
  id: string;
  frecuencia: Frecuencia;
}

// Asegura que existan las instancias de checklist del periodo actual para una sucursal.
// Se apoya en la constraint única (plantilla_id, sucursal_id, fecha) para no duplicar.
export async function asegurarInstancias(
  supabase: SupabaseClient,
  sucursalId: string
) {
  const { data: plantillas } = await supabase
    .from("checklist_plantillas")
    .select("id, frecuencia")
    .eq("activa", true);

  if (!plantillas?.length) return;

  const filas = (plantillas as Plantilla[]).map((p) => ({
    plantilla_id: p.id,
    sucursal_id: sucursalId,
    fecha: fechaPeriodo(p.frecuencia),
  }));

  await supabase
    .from("checklist_instancias")
    .upsert(filas, {
      onConflict: "plantilla_id,sucursal_id,fecha",
      ignoreDuplicates: true,
    });
}

// Fechas de periodo activas hoy (para filtrar las instancias vigentes).
export function fechasVigentes(): string[] {
  return FRECUENCIAS.map((f) => fechaPeriodo(f));
}
