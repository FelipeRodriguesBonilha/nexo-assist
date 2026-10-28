import crypto from "node:crypto";
import { getDb } from "../db";
import type { Employee } from "./types";

const SESSION_TTL_MS = 12 * 3_600_000;

export const hashPassword = (pw: string) => {
  const salt = crypto.randomBytes(8).toString("hex");
  return `${salt}:${crypto.scryptSync(pw, salt, 32).toString("hex")}`;
};

const verify = (pw: string, stored: string) => {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = crypto.scryptSync(pw, salt, 32);
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

interface EmployeeRow { id: string; email: string; name: string; role: Employee["role"]; department: string; password_hash: string }
const toEmployee = (r: EmployeeRow): Employee => ({ id: r.id, email: r.email, name: r.name, role: r.role, department: r.department });

export function login(email: string, password: string): { token: string; employee: Employee } | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM employees WHERE email = ?").get(email.trim().toLowerCase()) as EmployeeRow | undefined;
  if (!row || !verify(password, row.password_hash)) return null;
  db.prepare("DELETE FROM sessions WHERE created_at < ?").run(new Date(Date.now() - SESSION_TTL_MS).toISOString());
  const token = crypto.randomBytes(24).toString("hex");
  db.prepare("INSERT INTO sessions (token, employee_id, created_at) VALUES (?, ?, ?)").run(token, row.id, new Date().toISOString());
  return { token, employee: toEmployee(row) };
}

export function employeeFromToken(token: string | undefined): Employee | null {
  if (!token) return null;
  const row = getDb()
    .prepare("SELECT e.* FROM sessions s JOIN employees e ON e.id = s.employee_id WHERE s.token = ? AND s.created_at >= ?")
    .get(token, new Date(Date.now() - SESSION_TTL_MS).toISOString()) as EmployeeRow | undefined;
  return row ? toEmployee(row) : null;
}

export const logout = (token: string) => void getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
