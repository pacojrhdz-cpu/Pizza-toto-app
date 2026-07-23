"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

export async function enviarExamen(
  examenId: string,
  respuestas: { pregunta_id: string; opcion_id: string }[]
): Promise<{ ok: boolean; error?: string; aprobado?: boolean; calificacion?: number }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: examen } = await supabase
    .from("examenes")
    .select("id, calif_minima, max_intentos, competencia, vigencia_meses")
    .eq("id", examenId)
    .single();
  if (!examen) return { ok: false, error: "Examen no encontrado" };

  const periodo = new Date().toISOString().slice(0, 7);

  const { data: prev } = await supabase
    .from("intentos_examen")
    .select("id, estado")
    .eq("examen_id", examenId)
    .eq("usuario_id", user.id)
    .eq("periodo", periodo);
  const prevList = prev ?? [];
  if (prevList.some((i: any) => i.estado === "aprobado"))
    return { ok: false, error: "Ya aprobaste este mes." };
  if (prevList.length >= (examen as any).max_intentos)
    return { ok: false, error: "Sin intentos restantes este mes." };

  const { data: preguntas } = await supabase
    .from("preguntas")
    .select("id, puntos, opciones(id, es_correcta)")
    .eq("examen_id", examenId);
  const listaP = (preguntas ?? []) as any[];

  let total = 0;
  let obtenidos = 0;
  const correcta = new Map<string, string>();
  for (const p of listaP) {
    total += p.puntos ?? 1;
    const c = (p.opciones ?? []).find((o: any) => o.es_correcta);
    if (c) correcta.set(p.id, c.id);
  }
  for (const r of respuestas) {
    if (correcta.get(r.pregunta_id) === r.opcion_id) {
      const p = listaP.find((x) => x.id === r.pregunta_id);
      obtenidos += p?.puntos ?? 1;
    }
  }
  const calificacion = total > 0 ? Math.round((obtenidos / total) * 100) : 0;
  const aprobado = calificacion >= (examen as any).calif_minima;

  const { data: intento, error: eInt } = await supabase
    .from("intentos_examen")
    .insert({
      examen_id: examenId,
      usuario_id: user.id,
      periodo,
      estado: aprobado ? "aprobado" : "reprobado",
      calificacion,
      finalizado_en: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (eInt) return { ok: false, error: eInt.message };

  const filas = respuestas.map((r) => ({
    intento_id: intento.id,
    pregunta_id: r.pregunta_id,
    opcion_id: r.opcion_id,
    correcta: correcta.get(r.pregunta_id) === r.opcion_id,
  }));
  await supabase.from("respuestas_examen").insert(filas);

  if (aprobado && (examen as any).competencia) {
    const folio = "PT-" + periodo.replace("-", "") + "-" + String(intento.id).slice(0, 8);
    const vence = new Date();
    vence.setMonth(vence.getMonth() + ((examen as any).vigencia_meses ?? 12));
    await supabase.from("constancias").insert({
      usuario_id: user.id,
      examen_id: examenId,
      competencia: (examen as any).competencia,
      folio,
      calificacion,
      vence_en: vence.toISOString().slice(0, 10),
      intento_id: intento.id,
    });
  }

  revalidatePath("/constancias");
  revalidatePath("/capacitaciones");
  return { ok: true, aprobado, calificacion };
}
