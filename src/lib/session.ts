import { cookies } from "next/headers";
import { employeeFromToken } from "./desk/auth";
import type { Employee } from "./desk/types";

export const SESSION_COOKIE = "nexo_session";

export async function currentEmployee(): Promise<Employee | null> {
  return employeeFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const unauthorized = () => json({ error: "Não autenticado." }, 401);
