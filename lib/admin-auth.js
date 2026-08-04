import crypto from "node:crypto";
import { jsonResponse, readJson } from "./well-core.js";

const COOKIE_NAME = "lw_admin_access";
const DEFAULT_ADMIN_EMAIL = "altifygenerator@gmail.com";

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
}

function secretKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function adminEmails() {
  const configured = String(process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL)
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  return new Set(configured.length ? configured : [DEFAULT_ADMIN_EMAIL]);
}

export function primaryAdminEmail() {
  return [...adminEmails()][0] || DEFAULT_ADMIN_EMAIL;
}

function secureEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function validSetupToken(value) {
  const expected = process.env.ADMIN_SETUP_TOKEN || "";
  return Boolean(expected && secureEqual(value, expected));
}

async function authRequest(path, { method = "GET", body, accessToken, admin = false } = {}) {
  const url = supabaseUrl();
  const key = secretKey();
  if (!url || !key) throw new Error("Supabase is not configured");
  const response = await fetch(`${url}/auth/v1/${path.replace(/^\//, "")}`, {
    method,
    headers: {
      apikey: key,
      ...(accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : key.split(".").length === 3 ? { Authorization: `Bearer ${key}` } : {}),
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!response.ok) {
    const error = new Error(data?.msg || data?.message || data?.error_description || `Supabase Auth failed: ${response.status}`);
    error.status = response.status;
    error.data = data;
    error.admin = admin;
    throw error;
  }
  return data;
}

async function findAuthUserByEmail(email) {
  const target = String(email || "").toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const data = await authRequest(`admin/users?page=${page}&per_page=100`, { admin: true });
    const users = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
    const found = users.find(user => String(user.email || "").toLowerCase() === target);
    if (found) return found;
    if (users.length < 100) break;
  }
  return null;
}

export async function createOrResetAdmin(email, password) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!adminEmails().has(normalized)) throw new Error("That email is not on the admin allowlist");
  if (String(password || "").length < 12) throw new Error("Use an admin password with at least 12 characters");

  const existing = await findAuthUserByEmail(normalized);
  const attributes = {
    email: normalized,
    password,
    email_confirm: true,
    app_metadata: { ...(existing?.app_metadata || {}), role: "admin", listening_well_admin: true },
    user_metadata: { ...(existing?.user_metadata || {}), display_name: "Listening Well Admin" }
  };

  if (existing?.id) {
    return authRequest(`admin/users/${encodeURIComponent(existing.id)}`, {
      method: "PUT",
      body: attributes,
      admin: true
    });
  }

  return authRequest("admin/users", { method: "POST", body: attributes, admin: true });
}

export async function signInAdmin(email, password) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!adminEmails().has(normalized)) throw new Error("This account is not authorized for the admin panel");
  const data = await authRequest("token?grant_type=password", {
    method: "POST",
    body: { email: normalized, password }
  });
  if (!data?.access_token) throw new Error("Supabase did not return an admin session");
  return data;
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "")
    .split(";")
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const index = item.indexOf("=");
      return index < 0 ? [item, ""] : [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
    }));
}

export function setAdminCookie(res, accessToken, expiresIn = 3600) {
  const secure = process.env.NODE_ENV === "production" || /^https:\/\//i.test(process.env.APP_URL || "");
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(accessToken)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.max(60, Number(expiresIn || 3600))}`
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearAdminCookie(res) {
  const secure = process.env.NODE_ENV === "production" || /^https:\/\//i.test(process.env.APP_URL || "");
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`);
}

export async function getAdminUser(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return null;
  try {
    const data = await authRequest("user", { accessToken: token });
    const user = data?.user || data;
    const email = String(user?.email || "").toLowerCase();
    const role = user?.app_metadata?.role;
    if (!adminEmails().has(email) || (role && role !== "admin")) return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireAdmin(req, res) {
  const user = await getAdminUser(req);
  if (!user) {
    jsonResponse(res, 401, { error: "Admin sign-in required", code: "ADMIN_AUTH_REQUIRED" });
    return null;
  }
  return user;
}

export async function readAdminCredentials(req) {
  const body = await readJson(req);
  return {
    email: String(body.email || "").trim().toLowerCase(),
    password: String(body.password || ""),
    setupToken: String(body.setupToken || "")
  };
}
