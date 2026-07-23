import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ChecklistForm from "@/components/ChecklistForm";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import type { ChecklistItem, ChecklistRespuesta } from "@/lib/types";

export const dynamic = "force-dynamic";

const estadoInfo: Record<string, { label: string; clase: string }> = {
  cumple: { label: "Cumple", clase: "bg-green-100 text-green-700" },
  no_cumple: { label: "No cumple", clase: "bg-red-100 text-red-700" },
  na: { label: "N/A", clase: "bg-gray-100 text-gray-600" },
  pendiente: { label: "Pendiente", clase: "bg-amber-100 text-amber-700" },
};

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
      "id, plantilla_id, sucursal_id, fecha, completada, checklist_plantillas(nombre, frecuencia)"
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

  const bloqueado =
    (instancia as any).completada && profile.rol !== "gerente";

  const cabecera = (
    <>
      <Link href="/dashboard" className="text-sm text-gray-500 hover:text-toto-red">
        ← Volver
      </Link>
      <h1 className="mb-1 mt-2 text-xl font-semibold">
        {plantilla?.nombre ?? "Checklist"}
      </h1>
      <p className="mb-5 text-sm text-gray-500">{(instancia as any).fecha}</p>
    </>
  );

  if (bloqueado) {
    const resps = (respuestas ?? []) as ChecklistRespuesta[];
    const respMap = new Map(resps.map((r) => [r.item_id, r]));

    const paths: string[] = [];
    for (const r of resps) {
      const l = r.fotos && r.fotos.length ? r.fotos : r.foto_url ? [r.foto_url] : [];
      for (const p of l) paths.push(p);
    }
    const urlMap = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from("evidencias")
        .createSignedUrls(paths, 3600);
      for (const s of signed ?? []) {
        if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl);
      }
    }

    const lista = (items ?? []) as ChecklistItem[];

    return (
      <div className="min-h-screen">
        <Header profile={profile} />
        <main className="mx-auto max-w-3xl px-4 py-6">
          {cabecera}
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
            ✓ Checklist completado. Ya no se puede editar.
          </div>
          <ul className="space-y-3">
            {lista.map((it) => {
              const r = respMap.get(it.id);
              const est = estadoInfo[r?.estado ?? "pendiente"];
              const fotoPaths =
                r?.fotos && r.fotos.length ? r.fotos : r?.foto_url ? [r.foto_url] : [];
              return (
                <li key={it.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">
                      {it.descripcion}
                      {it.critico && (
                        <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600">
                          crítico
                        </span>
                      )}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${est.clase}`}
                    >
                      {est.label}
                    </span>
                  </div>
                  {r?.valor_num != null && (
                    <p className="mt-1 text-sm text-gray-600">
                      Valor: {r.valor_num}
                      {it.unidad ? ` ${it.unidad}` : ""}
                    </p>
                  )}
                  {r?.nota && (
                    <p className="mt-1 text-sm text-gray-600">Nota: {r.nota}</p>
                  )}
                  {fotoPaths.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {fotoPaths.map((p) => {
                        const url = urlMap.get(p);
                        if (!url) return null;
                        return (
                          <a key={p} href={url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={url}
                              alt="evidencia"
                              className="h-28 w-28 rounded-lg object-cover"
                            />
                          </a>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        {cabecera}
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
