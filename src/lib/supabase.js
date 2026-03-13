export const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Guard: jeśli zmienne nie są ustawione (np. brak env vars w Vercel) — rzuć czytelny błąd
if (!SB_URL || !SB_ANON) {
  console.error(
    "[Supabase] BŁĄD KONFIGURACJI: Brakuje zmiennych środowiskowych!\n" +
    "Ustaw VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY w Vercel → Project Settings → Environment Variables.\n" +
    `SB_URL: ${SB_URL ?? "BRAK"}, SB_ANON: ${SB_ANON ? "OK" : "BRAK"}`
  );
}

export const authHeaders = (token) => ({
  "apikey": SB_ANON,
  "Authorization": `Bearer ${token || SB_ANON}`,
  "Content-Type": "application/json",
});

/* ─── SESSION STORAGE ────────────────────────────────────────────────────── */
const SESSION_KEY = "eea_session";

export const session = {
  save: (accessToken, refreshToken, user) => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken, refreshToken, user }));
    } catch {}
  },
  load: () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  clear: () => {
    try { localStorage.removeItem(SESSION_KEY); } catch {}
  },
};

/* ─── AUTH ───────────────────────────────────────────────────────────────── */
export const auth = {
  signUp: async (email, password) => {
    const r = await fetch(`${SB_URL}/auth/v1/signup`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.msg || d.error_description || "Błąd rejestracji");
    return d;
  },

  signIn: async (email, password) => {
    if (!SB_URL) throw new Error("Błąd konfiguracji aplikacji — skontaktuj się z administratorem.");
    let r;
    try {
      r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ email, password }),
      });
    } catch (networkErr) {
      throw new Error("Brak połączenia z serwerem. Sprawdź internet lub spróbuj ponownie.");
    }
    const d = await r.json();
    if (!r.ok) throw new Error(d.error_description || d.msg || "Nieprawidłowy e-mail lub hasło");
    return d;
  },

  // Odśwież access_token używając refresh_token
  refreshSession: async (refreshToken) => {
    const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error_description || d.msg || "Sesja wygasła");
    return d; // { access_token, refresh_token, user, ... }
  },

  signOut: async (token) => {
    session.clear();
    await fetch(`${SB_URL}/auth/v1/logout`, {
      method: "POST", headers: authHeaders(token),
    });
  },

  recover: async (email) => {
    const r = await fetch(`${SB_URL}/auth/v1/recover`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ email }),
    });
    if (!r.ok) { const d = await r.json(); throw new Error(d.msg || "Błąd"); }
  },
};

/* ─── DB ─────────────────────────────────────────────────────────────────── */
export const db = {
  get: async (token, table, query = "") => {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, { headers: authHeaders(token) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  insert: async (token, table, data) => {
    const h = { ...authHeaders(token), "Prefer": "return=representation" };
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, { method: "POST", headers: h, body: JSON.stringify(data) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  update: async (token, table, match, data) => {
    const h = { ...authHeaders(token), "Prefer": "return=representation" };
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${match}`, { method: "PATCH", headers: h, body: JSON.stringify(data) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  remove: async (token, table, match) => {
    const h = { ...authHeaders(token), "Prefer": "return=representation" };
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${match}`, { method: "DELETE", headers: h });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
};
