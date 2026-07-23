import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ChecklistForm from "@/components/ChecklistForm";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import type { ChecklistItem, ChecklistRespuesta } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ChecklistPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: instancia } = await supabase
    .from("checklist_instancias")
    .select(
      "id, plantilla_id, sucursal_id, fecha, checklist_plantillas(nombre, frecuencia)"
    )
    .eq("id", params.id)
    .single();

  if (!instancia) notFound();

  const plantilla = (instancia as any).checklist_plantillas as {
    nombre: string;
  } | null;

  const { data: items } = await supabase
    .from("checklist_items")
    .select(
      "id, plantilla_id, descripcion, tipo, requiere_foto, unidad, critico, orden"
    )
    .eq("plantilla_id", (instancia as any).plantilla_id)
    .order("orden", { ascending: true });

  const { data: respuestas } = await supabase
    .from("checklist_respuestas")
    .select("id, instancia_id, item_id, estado, valor_num, nota, foto_url, fotos")
    .eq("instancia_id", params.id);

  return (
    <div className="min-h-screen">
      <Header profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-toto-red">
          ← Volver
        </Link>
        <h1 className="mb-1 mt-2 text-xl font-semibold">
          {plantilla?.nombre ?? "Checklist"}
        </h1>
        <p className="mb-5 text-sm text-gray-500">{(instancia as any).fecha}</p>

        <ChecklistForm
          instanciaId={params.id}
          sucursalId={(instancia as any).sucursal_id}
          items={(items ?? []) as ChecklistItem[]}
          respuestas={(respuestas ?? []) as ChecklistRespuesta[]}
        />
      </main>
    </div>
  );
}
