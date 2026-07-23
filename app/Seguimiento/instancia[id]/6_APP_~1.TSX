import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import Header from "@/components/Header";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const estadoInfo: Record<string, { label: string; clase: string }> = {
  cumple: { label: "Cumple", clase: "bg-green-100 text-green-700" },
  no_cumple: { label: "No cumple", clase: "bg-red-100 text-red-700" },
  na: { label: "N/A", clase: "bg-gray-100 text-gray-600" },
  pendiente: { label: "Pendiente", clase: "bg-amber-100 text-amber-700" },
};

interface Item { id: string; descripcion: string; unidad: string | null; critico: boolean; orden: number; }
interface Resp { item_id: string; estado: string; valor_num: number | null; nota: string | null; foto_url: string | null; }

export default async function SeguimientoInstancia({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  if (profile.rol !== "gerente") redirect("/dashboard");
  const supabase = createClient();

  const { data: inst } = await supabase
    .from("checklist_instancias")
    .select("id, plantilla_id, sucursal_id, fecha, completada_en, checklist_plantillas(nombre)")
    .eq("id", params.id).single();
  if (!inst) notFound();

  const { data: items } = await supabase
    .from("checklist_items")
    .select("id, descripcion, unidad, critico, orden")
    .eq("plantilla_id", (inst as any).plantilla_id)
    .order("orden");

  const { data: resps } = await supabase
    .from("checklist_respuestas")
    .select("item_id, estado, valor_num, nota, foto_url")
    .eq("instancia_id", params.id);

  const respMap = new Map<string, Resp>();
  for (const r of (resps ?? []) as Resp[]) respMap.set(r.item_id, r);

  const paths = ((resps ?? []) as Resp[]).map((r) => r.foto_url).filter(Boolean) as string[];
  const urlMap = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("evidencias").createSignedUrls(paths, 3600);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl);
    }
  }

  const lista = (items ?? []) as Item[];
  const plantilla = (inst as any).checklist_plantillas as { nombre: string } | null;

  return (
    <div className="min-h-screen">
      <Header profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link href={`/seguimiento/sucursal/${(inst as any).sucursal_id}`} className="text-sm text-gray-500 hover:text-toto-red">← Volver</Link>
        <h1 className="mb-1 mt-2 text-xl font-semibold">{plantilla?.nombre ?? "Checklist"}</h1>
        <p className="mb-5 text-sm text-gray-500">
          {(inst as any).fecha}
          {(inst as any).completada_en ? ` · completado ${new Date((inst as any).completada_en).toLocaleString("es-MX")}` : ""}
        </p>

        <ul className="space-y-3">
          {lista.map((it) => {
            const r = respMap.get(it.id);
            const est = estadoInfo[r?.estado ?? "pendiente"];
            const foto = r?.foto_url ? urlMap.get(r.foto_url) : null;
            const alerta = it.critico && r?.estado === "no_cumple";
            return (
              <li key={it.id} className={`rounded-xl border p-4 ${alerta ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">
                    {it.descripcion}
                    {it.critico && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600">crítico</span>}
                  </p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${est.clase}`}>{est.label}</span>
                </div>
                {r?.valor_num != null && (
                  <p className="mt-1 text-sm text-gray-600">Valor: {r.valor_num}{it.unidad ? ` ${it.unidad}` : ""}</p>
                )}
                {r?.nota && <p className="mt-1 text-sm text-gray-600">Nota: {r.nota}</p>}
                {foto && (
                  <a href={foto} target="_blank" rel="noopener noreferrer">
                    <img src={foto} alt="evidencia" className="mt-2 h-32 rounded-lg object-cover" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
        {lista.length === 0 && <p className="text-gray-500">Este checklist no tiene ítems.</p>}
      </main>
    </div>
  );
}
