import Header from "@/components/Header";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface Constancia { id: string; competencia: string; folio: string; calificacion: number | null; emitida_en: string; vence_en: string | null; }

export default async function ConstanciasPage() {
  const profile = await requireProfile();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("constancias")
    .select("id, competencia, folio, calificacion, emitida_en, vence_en")
    .eq("usuario_id", user?.id ?? "")
    .order("emitida_en", { ascending: false });

  const lista = (data ?? []) as Constancia[];
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen">
      <Header profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-1 text-xl font-semibold">Mis constancias</h1>
        <p className="mb-6 text-sm text-gray-500">Competencias que has certificado</p>
        {lista.length === 0 && (
          <p className="text-gray-500">
            Aún no tienes constancias. Aprueba un examen para obtener la primera.
          </p>
        )}
        <ul className="space-y-3">
          {lista.map((c) => {
            const vencida = c.vence_en != null && c.vence_en < hoy;
            return (
              <li key={c.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{c.competencia}</p>
                    <p className="mt-1 text-xs text-gray-500">Folio: {c.folio}</p>
                    <p className="text-xs text-gray-500">
                      Emitida: {c.emitida_en}
                      {c.vence_en ? ` · Vence: ${c.vence_en}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    {c.calificacion != null && (
                      <p className="text-lg font-bold text-toto-red">{c.calificacion}%</p>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${vencida ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {vencida ? "Vencida" : "Vigente"}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
