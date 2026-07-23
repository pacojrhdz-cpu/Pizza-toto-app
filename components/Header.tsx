import Link from "next/link";
import LogoutButton from "./LogoutButton";
import type { Profile } from "@/lib/types";

const rolLabel: Record<Profile["rol"], string> = {
  gerente: "Gerente",
  encargado: "Encargado",
  colaborador: "Colaborador",
};

export default function Header({ profile }: { profile: Profile }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="font-bold text-toto-red">
          Pizza &amp; Totó
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/capacitaciones" className="text-gray-600 hover:text-toto-red">
            Capacitaciones
          </Link>
          <Link href="/constancias" className="text-gray-600 hover:text-toto-red">
            Constancias
          </Link>
          {profile.rol === "gerente" && (
            <Link href="/panel" className="text-gray-600 hover:text-toto-red">
              Panel
            </Link>
          )}
          <span className="hidden text-gray-500 sm:inline">
            {profile.nombre} · {rolLabel[profile.rol]}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
