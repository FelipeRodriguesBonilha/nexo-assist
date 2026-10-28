import { cookies } from "next/headers";
import { z } from "zod";
import { login, logout } from "@/lib/desk/auth";
import { rateLimited, resetRateLimit } from "@/lib/rate-limit";
import { SESSION_COOKIE, currentEmployee, json } from "@/lib/session";

export const runtime = "nodejs";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function GET() {
  const employee = await currentEmployee();
  return json({ employee });
}

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Informe e-mail e senha válidos." }, 400);
  const key = `login:${body.data.email.toLowerCase()}`;
  if (rateLimited(key, 5, 10 * 60_000)) return json({ error: "Muitas tentativas. Aguarde alguns minutos." }, 429);
  const result = login(body.data.email, body.data.password);
  if (result) resetRateLimit(key);
  if (!result) return json({ error: "E-mail ou senha incorretos." }, 401);
  (await cookies()).set(SESSION_COOKIE, result.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12, secure: process.env.NODE_ENV === "production" });
  return json({ employee: result.employee });
}

export async function DELETE() {
  const jar = await cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (t) logout(t);
  jar.delete(SESSION_COOKIE);
  return json({ ok: true });
}
