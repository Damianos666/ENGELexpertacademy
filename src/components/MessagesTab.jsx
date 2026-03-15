import { useState, useEffect, memo } from "react";
import { C, MSG_TYPES, ADMIN_EMAIL } from "../lib/constants";
import { db } from "../lib/supabase";
import { formatDate } from "../lib/helpers";
import { Spinner, Toggle } from "./SharedUI";
import { useT } from "../lib/LangContext";

const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || "";
const CONTACT_PHONE = import.meta.env.VITE_CONTACT_PHONE || "";

export function MessagesTab({ token, userEmail, user }) {
  const T = useT();
  const isAdmin = userEmail === ADMIN_EMAIL;

  // Dane użytkownika wyciągnięte na poziomie komponentu
  const userName  = user?.displayName || user?.name  || "";
  const userMail  = user?.email       || userEmail   || "";
  const userRole  = user?.role        || "";
  const userFirma = user?.firma       || "";
  const [messages,  setMessages]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState("");
  // formularz nowej wiadomości
  const [showForm,  setShowForm]  = useState(false);
  const [fTitle,    setFTitle]    = useState("");
  const [fBody,     setFBody]     = useState("");
  const [fType,     setFType]     = useState("info");
  const [fPinned,   setFPinned]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [formErr,   setFormErr]   = useState("");
  const [deleting,  setDeleting]  = useState(null);
  const [contactOpen, setContactOpen] = useState(false);

  async function loadMessages() {
    try {
      const data = await db.get(token, "messages", "order=pinned.desc,created_at.desc&select=*");
      setMessages(data);
    } catch { setErr(T.cannot_load); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadMessages(); }, []);

  async function sendMessage() {
    if (!fTitle.trim()) { setFormErr("Tytuł jest wymagany"); return; }
    if (!fBody.trim())  { setFormErr("Treść jest wymagana"); return; }
    setSaving(true); setFormErr("");
    try {
      await db.insert(token, "messages", {
        title:   fTitle.trim(),
        body:    fBody.trim(),
        type:    fType,
        pinned:  fPinned,
      });
      setFTitle(""); setFBody(""); setFType("info"); setFPinned(false);
      setShowForm(false);
      await loadMessages();
    } catch(e) { setFormErr("Błąd wysyłania: " + e.message); }
    finally { setSaving(false); }
  }

  async function deleteMessage(id) {
    setDeleting(id);
    try {
      await db.remove(token, "messages", `id=eq.${id}`);
      setMessages(p => p.filter(m => m.id !== id));
    } catch(e) { alert("Błąd usuwania: " + e.message); }
    finally { setDeleting(null); }
  }

  if (loading) return <div style={{background:C.greyBg,flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div>;

  return (
    <div style={{background:C.greyBg,flex:1,minHeight:0,display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>
    <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
      {err && <div style={{background:"#FDEDEC",border:`1px solid ${C.red}`,margin:12,padding:"12px 16px",fontSize:13,color:C.red}}>{err}</div>}

      {/* PANEL ADMINA */}
      {isAdmin && (
        <div style={{margin:"12px 12px 0",background:C.white,border:`2px solid ${C.green}`,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showForm?16:0}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:C.greenDk,textTransform:"uppercase"}}>⚙ Panel administratora</div>
            <button
              style={{background:showForm?"none":C.black,border:`1px solid ${showForm?C.grey:C.black}`,color:showForm?C.greyDk:C.white,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}
              onClick={() => { setShowForm(p => !p); setFormErr(""); }}>
              {showForm ? "Anuluj" : "+ Nowa wiadomość"}
            </button>
          </div>

          {showForm && (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {/* Tytuł */}
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:5,letterSpacing:.5}}>TYTUŁ *</label>
                <input
                  style={{width:"100%",border:`1.5px solid ${C.grey}`,padding:"9px 12px",fontSize:14,color:C.black,outline:"none",boxSizing:"border-box"}}
                  value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="np. Nowe szkolenie w ofercie"/>
              </div>

              {/* Treść */}
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:5,letterSpacing:.5}}>TREŚĆ *</label>
                <textarea
                  style={{width:"100%",border:`1.5px solid ${C.grey}`,padding:"9px 12px",fontSize:13,color:C.black,outline:"none",boxSizing:"border-box",minHeight:90,resize:"vertical",fontFamily:"inherit"}}
                  value={fBody} onChange={e => setFBody(e.target.value)} placeholder="Treść wiadomości..."/>
              </div>

              {/* Typ */}
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:8,letterSpacing:.5}}>TYP WIADOMOŚCI</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {Object.entries(MSG_TYPES).map(([key, mt]) => (
                    <button key={key} onClick={() => setFType(key)}
                      style={{padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",border:`2px solid ${fType===key?mt.color:C.grey}`,background:fType===key?mt.bg:C.white,color:fType===key?mt.color:C.greyDk}}>
                      {mt.icon} {key.charAt(0).toUpperCase()+key.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Przypnij */}
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <Toggle value={fPinned} color={C.green} onChange={() => setFPinned(p => !p)}/>
                <span style={{fontSize:13,color:C.black}}>Przypnij wiadomość na górze</span>
              </div>

              {/* Podgląd */}
              {(fTitle||fBody) && (
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:6,letterSpacing:.5}}>PODGLĄD</div>
                  <div style={{background:fPinned?(MSG_TYPES[fType]||MSG_TYPES.info).bg:C.greyBg,border:`1px solid ${(MSG_TYPES[fType]||MSG_TYPES.info).color+"44"}`,padding:14}}>
                    <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                      <span style={{fontSize:18}}>{(MSG_TYPES[fType]||MSG_TYPES.info).icon}</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:C.black,marginBottom:4}}>{fTitle||"(brak tytułu)"}</div>
                        <div style={{fontSize:12,color:C.greyDk,lineHeight:1.6}}>{fBody||"(brak treści)"}</div>
                        {fPinned && <span style={{fontSize:9,fontWeight:700,color:(MSG_TYPES[fType]||MSG_TYPES.info).color,letterSpacing:1}}>PRZYPIĘTE</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {formErr && <div style={{color:C.red,fontSize:12}}>{formErr}</div>}

              <button
                style={{background:saving?C.greyDk:C.black,border:"none",color:C.white,padding:"12px",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}
                onClick={sendMessage} disabled={saving}>
                {saving ? "Wysyłanie..." : "Wyślij wiadomość"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* LISTA WIADOMOŚCI */}
      {!messages.length && !err && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60%",padding:32,textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:16}}>📭</div>
          <div style={{fontSize:16,fontWeight:600,color:C.black,marginBottom:8}}>Brak wiadomości</div>
          <div style={{fontSize:13,color:C.greyMid}}>Nowe ogłoszenia pojawią się tutaj.</div>
        </div>
      )}
      <div style={{padding:"8px 12px 32px",display:"flex",flexDirection:"column",gap:8}}>
        {messages.map(m => {
          const mt = MSG_TYPES[m.type] || MSG_TYPES.info;
          return (
            <div key={m.id} style={{background:m.pinned?mt.bg:C.white,border:`1px solid ${m.pinned?mt.color+"44":"rgba(0,0,0,.06)"}`,boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}>
              <div style={{padding:16}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                  <span style={{fontSize:20,flexShrink:0,marginTop:1}}>{mt.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
                      <div style={{fontSize:14,fontWeight:700,color:C.black,lineHeight:1.3}}>{m.title}</div>
                      <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                        {m.pinned && <span style={{fontSize:9,fontWeight:700,color:mt.color,background:`${mt.color}22`,padding:"2px 8px",letterSpacing:1}}>PRZYPIĘTE</span>}
                        {isAdmin && (
                          <button
                            onClick={() => { if(window.confirm("Usunąć tę wiadomość?")) deleteMessage(m.id); }}
                            disabled={deleting===m.id}
                            style={{background:"none",border:`1px solid ${C.red}`,color:C.red,padding:"3px 8px",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                            {deleting===m.id ? "..." : T.delete}
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{fontSize:13,color:C.greyDk,lineHeight:1.6}}>{m.body}</div>
                    <div style={{fontSize:11,color:C.greyMid,marginTop:8}}>{formatDate(m.created_at)}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>{/* end scroll */}

      {/* ── FAB KONTAKT ── */}
      <div className="contact-fab" style={{position:"absolute",bottom:"calc(16px + env(safe-area-inset-bottom, 0px))",right:16,zIndex:900}}>
        {contactOpen && (
          <div style={{position:"absolute",bottom:56,right:0,background:C.white,borderRadius:12,boxShadow:"0 4px 24px rgba(0,0,0,.18)",padding:"8px 0",minWidth:180,overflow:"hidden"}}>
            {/* EMAIL */}
            <a href="#"
              onClick={(e) => {
                e.preventDefault();
                const subject = encodeURIComponent("Zapytanie o szkolenie - " + userName);
                const body = encodeURIComponent(
                  "Dzien dobry,\n\njestem zainteresowany/a szkoleniem.\n\nImie i nazwisko: " + userName +
                  "\nStanowisko: " + userRole +
                  "\nFirma: " + userFirma +
                  "\nAdres e-mail: " + userMail +
                  "\nTelefon kontaktowy: \n\nProsze o kontakt.\n\nZ powazaniem,\n" + userName
                );
                setContactOpen(false);
                window.location.href = "mailto:" + CONTACT_EMAIL + "?subject=" + subject + "&body=" + body;
              }}
              style={{display:"flex",alignItems:"center",gap:12,padding:"13px 18px",textDecoration:"none",color:C.black,borderBottom:`1px solid ${C.grey}`}}>
              <span style={{fontSize:20}}>✉️</span>
              <div>
                <div style={{fontSize:13,fontWeight:700}}>E-mail</div>
                <div style={{fontSize:10,color:C.greyMid}}>{CONTACT_EMAIL}</div>
              </div>
            </a>
            {/* TELEFON */}
            <a href={`tel:${CONTACT_PHONE.replace(/\s/g,"")}`}
              onClick={() => setContactOpen(false)}
              style={{display:"flex",alignItems:"center",gap:12,padding:"13px 18px",textDecoration:"none",color:C.black}}>
              <span style={{fontSize:20}}>📞</span>
              <div>
                <div style={{fontSize:13,fontWeight:700}}>Telefon</div>
                <div style={{fontSize:10,color:C.greyMid}}>{CONTACT_PHONE}</div>
              </div>
            </a>
          </div>
        )}
        <button onClick={() => setContactOpen(o => !o)}
          style={{width:64,height:64,borderRadius:"50%",background:contactOpen?C.greyDk:C.black,border:"none",color:C.white,fontSize:52,cursor:"pointer",boxShadow:"0 2px 16px rgba(0,0,0,.3)",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,paddingBottom:2}}>
          {contactOpen ? "✕" : "✆"}
        </button>
      </div>

      {/* Overlay zamykający menu */}
      {contactOpen && (
        <div onClick={() => setContactOpen(false)}
          style={{position:"absolute",inset:0,zIndex:899}}/>
      )}
    </div>
  );
}
