"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/client";
import type { Employee } from "@/lib/desk/types";

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Employee | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    api<{ employee: Employee | null }>("/api/auth").then(({ employee }) => (employee ? setMe(employee) : router.replace("/")));
  }, [router]);

  return (
    <Shell me={me} active="perfil" title="Meu perfil">
      <div className="mx-auto w-full max-w-xl flex-1 overflow-y-auto px-6 py-12">
        <h1 className="font-serif text-3xl">Meu perfil</h1>
        <p className="mt-1 text-sm text-slate-500">Seus dados de acesso ao service desk de TI.</p>
        <dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm shadow-sm">
          <div className="flex items-center px-5 py-4"><dt className="w-40 text-slate-500">Nome</dt><dd className="font-medium">{me?.name}</dd></div>
          <div className="flex items-center px-5 py-4"><dt className="w-40 text-slate-500">E-mail corporativo</dt><dd className="font-medium">{me?.email}</dd><span className="ml-auto text-xs text-slate-400">Gerenciado pela TI</span></div>
          <div className="flex items-center px-5 py-4"><dt className="w-40 text-slate-500">Departamento</dt><dd className="font-medium">{me?.department}</dd></div>
        </dl>
        <div className="mt-5 rounded-xl border border-slate-200 text-sm shadow-sm">
          <div className="flex items-center justify-between px-5 py-4">
            <div><p className="font-semibold">Senha</p><p className="text-xs text-slate-500">Altere pelo link enviado ao seu e-mail.</p></div>
            <button onClick={() => setSent(true)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50">Redefinir senha</button>
          </div>
          <p className="border-t border-slate-100 bg-slate-50 px-5 py-2.5 text-xs text-slate-500">
            {sent ? `Enviamos um link de redefinição para ${me?.email}.` : `Enviaremos um link de redefinição para ${me?.email}.`}
          </p>
        </div>
      </div>
    </Shell>
  );
}
