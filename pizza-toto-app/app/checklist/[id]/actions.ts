"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import type { EstadoRespuesta } from "@/lib/types";

export interface RespuestaInput {
  item_id: string;
  estado: EstadoRespuesta;
  valor_num: number | null;
  nota: string | null;
}

export async function guardarChecklist(
  instanciaId: string,
  respuestas: RespuestaInput[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const filas = respuestas.map((r) => ({
    instancia_id: instanciaId,
    item_id: r.item_id,
    estado: r.estado,
    valor_num: r.valor_num,
    nota: r.nota,
    respondido_por: user.id,
    respondido_en: new Date().toISOString(),
  }));

  const { error: e1 } = await supabase
    .from("checklist_respuestas")
    .upsert(filas, { onConflict: "instancia_id,item_id" });

  if (e1) return { ok: false, error: e1.message };

  // Marca completada si no quedan ítems en 'pendiente'.
  const completada = respuestas.every((r) => r.estado !== "pendiente");

  const { error: e2 } = await supabase
    .from("checklist_instancias")
    .update({
      completada,
      completada_por: completada ? user.id : null,
      completada_en: completada ? new Date().toISOString() : null,
    })
    .eq("id", instanciaId);

  if (e2) return { ok: false, error: e2.message };

  revalidatePath(`/checklist/${instanciaId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
