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

  // Reszta JSX bez zmian — tylko usunięto token/user z props
  return (
    <div style={{ background: C.greyBg, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {err && (
          <div style={{ background: "#FDEDEC", border: `1px solid ${C.red}`, margin: 12, padding: "12px 16px", fontSize: 13, color: C.red }}>
            {err}
          </div>
        )}
        {/* PANEL ADMINA — tu wklej oryginalny JSX od isAdmin && ... do końca */}
        {/* Jedyną zmianą jest brak props token/user — pobieramy je z useUser() */}
      </div>
    </div>
  );
});
