import { useState, useEffect, memo } from "react";
import { C, MSG_TYPES, ADMIN_EMAIL } from "../lib/constants";
import { db } from "../lib/supabase";
import { formatDate } from "../lib/helpers";
import { Spinner, Toggle } from "./SharedUI";
import { useToast } from "../lib/ToastContext";
import { useT } from "../lib/LangContext";
import { useUser } from "../lib/UserContext";  // OPTYMALIZACJA: token z kontekstu

const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || "";
const CONTACT_PHONE = import.meta.env.VITE_CONTACT_PHONE || "";

// OPTYMALIZACJA: memo — komponent nie re-renderuje się gdy rodzic się odświeży,
// dopóki jego props się nie zmienią. MessagesTab nie przyjmuje już token/user przez props.
export const MessagesTab = memo(function MessagesTab() {
  const T = useT();
  const { addToast } = useToast();
  const { user, token } = useUser();  // token z UserContext — brak prop drilling

  const isAdmin  = user?.role === "admin" || user?.email === ADMIN_EMAIL;
  const userName = user?.displayName || user?.name  || "";
  const userMail = user?.email       || "";
  const userRole = user?.role        || "";
  const userFirma= user?.firma       || "";

  const [messages,    setMessages]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState("");
  const [showForm,    setShowForm]    = useState(false);
  const [fTitle,      setFTitle]      = useState("");
  const [fBody,       setFBody]       = useState("");
  const [fType,       setFType]       = useState("info");
  const [fPinned,     setFPinned]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [formErr,     setFormErr]     = useState("");
  const [deleting,    setDeleting]    = useState(null);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    if (!token) return;

    // OPTYMALIZACJA: AbortController — jeśli komponent odmontuje się podczas
    // ładowania, fetch zostanie anulowany i nie nastąpi setState na odmontowanym
    // komponencie (eliminuje memory leak i warning w konsoli).
    const ctrl = new AbortController();

    async function loadMessages() {
      try {
        const data = await db.get(token, "messages", "order=pinned.desc,created_at.desc&select=*", { signal: ctrl.signal });
        setMessages(data);
      } catch(e) {
        if (e.name === "AbortError") return;  // Normalne — komponent odmontowany
        setErr(T.cannot_load);
      } finally {
        setLoading(false);
      }
    }

    loadMessages();
    return () => ctrl.abort();
  }, [token, T.cannot_load]);  // FIX: token w deps — wcześniej brakowało (eslint-disable)

  async function sendMessage() {
    if (!fTitle.trim()) { setFormErr("Tytuł jest wymagany"); return; }
    if (!fBody.trim())  { setFormErr("Treść jest wymagana"); return; }
    setSaving(true); setFormErr("");
    try {
      await db.insert(token, "messages", {
        title:  fTitle.trim(),
        body:   fBody.trim(),
        type:   fType,
        pinned: fPinned,
      });
      setFTitle(""); setFBody(""); setFType("info"); setFPinned(false);
      setShowForm(false);
      // Odśwież listę po wysłaniu
      const ctrl2 = new AbortController();
      const data = await db.get(token, "messages", "order=pinned.desc,created_at.desc&select=*", { signal: ctrl2.signal });
      setMessages(data);
    } catch(e) { setFormErr("Błąd wysyłania: " + e.message); }
    finally { setSaving(false); }
  }

  async function deleteMessage(id) {
    setDeleting(id);
    try {
      await db.remove(token, "messages", `id=eq.${id}`);
      setMessages(p => p.filter(m => m.id !== id));
    } catch(e) { addToast("Błąd usuwania: " + e.message); }
    finally { setDeleting(null); }
  }

  if (loading) return (
    <div style={{ background: C.greyBg, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner/>
    </div>
  );

  return (
    <div style={{ background: C.greyBg, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "12px 12px 80px" }}>

        {err && (
          <div style={{ background: "#FDEDEC", border: `1px solid ${C.red}`, marginBottom: 12, padding: "12px 16px", borderRadius: 8, fontSize: 13, color: C.red }}>
            {err}
          </div>
        )}

        {/* PANEL ADMINA — formularz dodawania wiadomości */}
        {isAdmin && (
          <div style={{ marginBottom: 16 }}>
            {!showForm ? (
              <button onClick={() => setShowForm(true)}
                style={{ width: "100%", background: C.green, color: C.white, border: "none", borderRadius: 8, padding: "12px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                + Nowa wiadomość
              </button>
            ) : (
              <div style={{ background: C.white, borderRadius: 8, padding: 16, border: `1px solid ${C.grey}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: C.black }}>Nowa wiadomość</div>

                <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Tytuł"
                  style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.grey}`, borderRadius: 6, padding: "8px 10px", fontSize: 13, marginBottom: 8, outline: "none" }}/>

                <textarea value={fBody} onChange={e => setFBody(e.target.value)} placeholder="Treść wiadomości..." rows={4}
                  style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.grey}`, borderRadius: 6, padding: "8px 10px", fontSize: 13, marginBottom: 8, outline: "none", resize: "vertical" }}/>

                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  {Object.entries(MSG_TYPES).map(([key, val]) => (
                    <button key={key} onClick={() => setFType(key)}
                      style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        background: fType === key ? val.bg : C.greyBg,
                        border: `1px solid ${fType === key ? val.color : C.grey}`,
                        color: fType === key ? val.color : C.greyMid }}>
                      {val.icon} {key}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Toggle checked={fPinned} onChange={setFPinned}/>
                  <span style={{ fontSize: 13, color: C.greyDk }}>Przypnij na górze</span>
                </div>

                {formErr && <div style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>{formErr}</div>}

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={sendMessage} disabled={saving}
                    style={{ flex: 1, background: C.green, color: C.white, border: "none", borderRadius: 6, padding: "10px", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                    {saving ? "Wysyłanie..." : "Wyślij"}
                  </button>
                  <button onClick={() => { setShowForm(false); setFormErr(""); }}
                    style={{ background: C.greyBg, color: C.greyDk, border: `1px solid ${C.grey}`, borderRadius: 6, padding: "10px 16px", fontSize: 13, cursor: "pointer" }}>
                    Anuluj
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LISTA WIADOMOŚCI */}
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.greyMid }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{T.no_messages}</div>
            <div style={{ fontSize: 13 }}>{T.no_messages_sub}</div>
          </div>
        ) : (
          messages.map(msg => {
            const mt = MSG_TYPES[msg.type] || MSG_TYPES.info;
            return (
              <div key={msg.id} style={{ background: mt.bg, border: `1px solid ${mt.color}22`, borderRadius: 8, padding: "12px 14px", marginBottom: 10, position: "relative" }}>
                {msg.pinned && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: mt.color, marginBottom: 4, letterSpacing: 0.5 }}>
                    📌 {T.pinned}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.black, marginBottom: 4 }}>
                      {mt.icon} {msg.title}
                    </div>
                    <div style={{ fontSize: 13, color: C.greyDk, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                      {msg.body}
                    </div>
                    <div style={{ fontSize: 11, color: C.greyMid, marginTop: 8 }}>
                      {formatDate(msg.created_at)}
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => deleteMessage(msg.id)} disabled={deleting === msg.id}
                      style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 12, padding: "2px 6px", opacity: deleting === msg.id ? 0.5 : 1, flexShrink: 0 }}>
                      {T.delete}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* KONTAKT */}
        {(CONTACT_EMAIL || CONTACT_PHONE) && (
          <div style={{ marginTop: 16 }}>
            <button onClick={() => setContactOpen(p => !p)}
              style={{ width: "100%", background: C.white, border: `1px solid ${C.grey}`, borderRadius: 8, padding: "12px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: C.greyDk, textAlign: "left" }}>
              📞 Kontakt z organizatorem {contactOpen ? "▲" : "▼"}
            </button>
            {contactOpen && (
              <div style={{ background: C.white, border: `1px solid ${C.grey}`, borderTop: "none", borderRadius: "0 0 8px 8px", padding: "12px 16px" }}>
                {userName && <div style={{ fontSize: 13, color: C.greyDk, marginBottom: 4 }}>👤 {userName}{userFirma ? ` · ${userFirma}` : ""}</div>}
                {CONTACT_EMAIL && (
                  <a href={`mailto:${CONTACT_EMAIL}?subject=ENGEL Expert Academy — ${userRole || "Uczestnik"}: ${userName}&body=Imię i nazwisko: ${userName}%0AFirma: ${userFirma}%0AE-mail: ${userMail}`}
                    style={{ display: "block", fontSize: 13, color: C.green, textDecoration: "none", marginBottom: 4 }}>
                    ✉️ {CONTACT_EMAIL}
                  </a>
                )}
                {CONTACT_PHONE && (
                  <a href={`tel:${CONTACT_PHONE}`} style={{ display: "block", fontSize: 13, color: C.green, textDecoration: "none" }}>
                    📱 {CONTACT_PHONE}
                  </a>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
});
