import { useState, useEffect, useMemo, useRef } from "react";
import { C, GROUPS, LVL_COLOR, LVL_LABEL, MSG_TYPES, TRAINERS } from "../lib/constants";
import { TRAININGS } from "../data/trainings";
import { db, authHeaders, SB_URL } from "../lib/supabase";
import { formatDate } from "../lib/helpers";
import { Spinner, SecTitle, Toggle } from "./SharedUI";

const LOGO_URL = "/logo.png";

// Stała poza komponentem — nie tworzy nowej tablicy przy każdym renderze
const ADMIN_TABS = [["Terminarz","📅"],["Wiadomości","✉"],["Edytor szkoleń","📋"]];

export function AdminPanel({ user, onLogout }) {
  const [tab, setTab] = useState(0);

  return (
    <div className="app-container" style={{height:"100%",display:"flex",flexDirection:"column",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",background:C.greyBg,overflow:"hidden"}}>
      <div style={{background:C.darkHdr,paddingTop:"calc(12px + env(safe-area-inset-top, 0px))",paddingBottom:"12px",paddingLeft:"16px",paddingRight:"16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,boxSizing:"border-box"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <img src={LOGO_URL} alt="ENGEL" style={{height:22,mixBlendMode:"screen"}}/>
          <span style={{color:C.green,fontSize:11,fontWeight:700,letterSpacing:2}}>ADMIN</span>
        </div>
        <button onClick={onLogout} style={{background:"none",border:`1px solid rgba(255,255,255,.3)`,color:"#ccc",padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Wyloguj</button>
      </div>
      <div style={{height:3,background:C.green,flexShrink:0}}/>

      <div style={{display:"flex",background:C.white,borderBottom:`1px solid ${C.grey}`,flexShrink:0}}>
        {ADMIN_TABS.map(([label,icon],i) => (
          <button key={i} onClick={() => setTab(i)}
            style={{flex:1,background:"none",border:"none",borderBottom:`3px solid ${tab===i?C.green:"transparent"}`,padding:"10px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer"}}>
            <span style={{fontSize:16,color:tab===i?C.black:C.greyMid}}>{icon}</span>
            <span style={{fontSize:9,fontWeight:700,color:tab===i?C.black:C.greyMid,letterSpacing:.5,textTransform:"uppercase"}}>{label}</span>
          </button>
        ))}
      </div>

      <div style={{flex:1,minHeight:0,overflowY:"auto",display:"flex",flexDirection:"column",WebkitOverflowScrolling:"touch",paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
        {tab===0 && <AdminSchedule token={user.accessToken}/>}
        {tab===1 && <AdminMessages token={user.accessToken}/>}
        {tab===2 && <AdminTrainings token={user.accessToken}/>}
      </div>
    </div>
  );
}

/* ── Admin: Generator kodów ── */
export function AdminCodeGen({ defaultTrainer }) {
  const [mode,        setMode]        = useState("normal"); // "normal" | "special"
  const [selGroup,    setSelGroup]    = useState(GROUPS[0].id);
  const [selTraining, setSelTraining] = useState(TRAININGS.find(t=>t.group===GROUPS[0].id)?.id || TRAININGS[0].id);
  const [selTrainer,  setSelTrainer]  = useState(defaultTrainer ? Number(defaultTrainer) : 1);
  const [copied,      setCopied]      = useState(false);

  function handleGroupChange(gid) {
    setSelGroup(gid);
    const first = TRAININGS.find(t => t.group===gid);
    if (first) setSelTraining(first.id);
  }

  function getEnc() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yy = String(d.getFullYear()).slice(2);
    return (dd+mm+yy).split("").map(c => String((parseInt(c)+3)%10)).join("");
  }

  function getCode(prefix) {
    const enc = getEnc();
    const short = mode === "special"
      ? "ST"
      : (TRAININGS.find(t => t.id === selTraining)?.short || selTraining.replace(/-/g,""));
    return `${prefix||""}${short}${enc}${selTrainer}`;
  }

  function decodeForDisplay() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
  }

  const code  = getCode();
  const groupTrainings = TRAININGS.filter(t => t.group===selGroup);
  const short = mode === "special" ? "ST" : (TRAININGS.find(t => t.id === selTraining)?.short || selTraining.replace(/-/g,""));

  function copyCode(val, setCb) {
    navigator.clipboard.writeText(val).then(() => { setCb(true); setTimeout(() => setCb(false), 2000); });
  }

  return (
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{background:C.white,padding:18,borderTop:`3px solid ${C.green}`}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:C.greyDk,marginBottom:14,textTransform:"uppercase"}}>Generator kodów szkoleniowych</div>

        {/* Przełącznik trybu */}
        <div style={{display:"flex",gap:0,marginBottom:18,border:`1px solid ${C.grey}`,overflow:"hidden"}}>
          {[["normal","📋 Standardowe"],["special","⭐ Specjalne (ST)"]].map(([val,label]) => (
            <button key={val} onClick={() => setMode(val)}
              style={{flex:1,padding:"9px 0",fontSize:11,fontWeight:700,cursor:"pointer",border:"none",
                background:mode===val?C.black:C.white, color:mode===val?C.white:C.greyDk}}>
              {label}
            </button>
          ))}
        </div>

        {mode === "normal" && (
          <>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:8,letterSpacing:.5}}>KROK 1 — KATEGORIA</label>
              <select value={selGroup} onChange={e => handleGroupChange(e.target.value)}
                style={{width:"100%",padding:"11px 14px",fontSize:13,border:`1.5px solid ${C.green}`,background:C.white,color:C.black,cursor:"pointer"}}>
                {GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:8,letterSpacing:.5}}>KROK 2 — SZKOLENIE</label>
              <select value={selTraining} onChange={e => setSelTraining(e.target.value)}
                style={{width:"100%",padding:"11px 14px",fontSize:13,border:`1.5px solid ${C.green}`,background:C.white,color:C.black,cursor:"pointer"}}>
                {groupTrainings.map(t => (
                  <option key={t.id} value={t.id}>{t.short} — {t.title}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {mode === "special" && (
          <div style={{marginBottom:14,background:"#FEF3E2",border:`1px solid ${C.amber}`,padding:"10px 14px",fontSize:11,color:C.greyDk,lineHeight:1.6}}>
            ⭐ Kod ST — uczestnik sam wpisze nazwę szkolenia po zeskanowaniu kodu.
          </div>
        )}

        <div style={{marginBottom:18}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:8,letterSpacing:.5}}>{mode==="normal"?"KROK 3":"KROK 2"} — TRENER</label>
          <select value={selTrainer} onChange={e => setSelTrainer(Number(e.target.value))}
            style={{width:"100%",padding:"11px 14px",fontSize:13,border:`1.5px solid ${C.green}`,background:C.white,color:C.black,cursor:"pointer"}}>
            {Object.entries(TRAINERS).map(([num, name]) => (
              <option key={num} value={num}>{name}</option>
            ))}
          </select>
        </div>

        {/* Kod dzienny */}
        <div style={{background:C.greyBg,border:`2px solid ${C.green}`,padding:16,marginBottom:8}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:C.greyMid,marginBottom:8}}>WYGENEROWANY KOD</div>
          <div style={{fontFamily:"monospace",fontSize:26,fontWeight:700,color:C.black,letterSpacing:4,marginBottom:10,wordBreak:"break-all"}}>{code}</div>
          <div style={{fontSize:11,color:C.greyMid,display:"flex",flexDirection:"column",gap:3}}>
            <span>📅 Data: <strong>{decodeForDisplay()}</strong> (ważny tylko dziś)</span>
            <span>🎓 Prefix: <strong>{short}</strong></span>
            <span>👤 Trener: <strong>{TRAINERS[selTrainer]}</strong></span>
          </div>
        </div>
        <button onClick={() => copyCode(code, setCopied)}
          style={{width:"100%",background:copied?C.greenDk:C.black,border:"none",color:C.white,padding:12,fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:12}}>
          {copied ? "✓ Skopiowano!" : "Kopiuj kod"}
        </button>

        <div style={{background:"#EBF5FB",border:`1px solid ${C.blue}`,padding:"10px 14px",fontSize:11,color:C.greyDk,lineHeight:1.6}}>
          ℹ️ Każdy trener ma unikalną cyfrę zakodowaną w kodzie. Dodaj <strong>D</strong> na początku aby pominąć weryfikację daty.
        </div>
      </div>
    </div>
  );
}

/* ── Admin: Wiadomości ── */
export function AdminMessages({ token }) {
  const [messages, setMessages] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fTitle,   setFTitle]   = useState("");
  const [fBody,    setFBody]    = useState("");
  const [fType,    setFType]    = useState("info");
  const [fPinned,  setFPinned]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState("");
  const [deleting, setDeleting] = useState(null);

  async function loadMessages() {
    setLoading(true);
    try {
      const data = await db.get(token, "messages", "order=pinned.desc,created_at.desc&select=*");
      setMessages(data);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { loadMessages(); }, []);

  async function sendMessage() {
    if (!fTitle.trim()) { setFormErr("Tytuł jest wymagany"); return; }
    if (!fBody.trim())  { setFormErr("Treść jest wymagana"); return; }
    setSaving(true); setFormErr("");
    try {
      await db.insert(token, "messages", { title:fTitle.trim(), body:fBody.trim(), type:fType, pinned:fPinned });
      setFTitle(""); setFBody(""); setFType("info"); setFPinned(false); setShowForm(false);
      await loadMessages();
    } catch(e) { setFormErr("Błąd wysyłania: " + e.message); }
    finally { setSaving(false); }
  }

  async function deleteMessage(id) {
    if (!window.confirm("Usunąć tę wiadomość?")) return;
    setDeleting(id);
    try {
      await db.remove(token, "messages", `id=eq.${id}`);
      setMessages(p => p.filter(m => m.id !== id));
    } catch(e) { alert("Błąd usuwania: " + e.message); }
    finally { setDeleting(null); }
  }

  if (loading) return <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div>;

  return (
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{background:C.white,padding:18,borderTop:`3px solid ${C.green}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showForm?16:0}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:C.greyDk,textTransform:"uppercase"}}>Wyślij wiadomość</div>
          <button onClick={() => { setShowForm(p=>!p); setFormErr(""); }}
            style={{background:showForm?"none":C.black,border:`1px solid ${showForm?C.grey:C.black}`,color:showForm?C.greyDk:C.white,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            {showForm ? "Anuluj" : "+ Nowa"}
          </button>
        </div>
        {showForm && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:5,letterSpacing:.5}}>TYTUŁ *</label>
              <input style={{width:"100%",border:`1.5px solid ${C.grey}`,padding:"9px 12px",fontSize:14,color:C.black,outline:"none",boxSizing:"border-box"}}
                value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Tytuł wiadomości"/>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:5,letterSpacing:.5}}>TREŚĆ *</label>
              <textarea style={{width:"100%",border:`1.5px solid ${C.grey}`,padding:"9px 12px",fontSize:13,color:C.black,outline:"none",boxSizing:"border-box",minHeight:90,resize:"vertical",fontFamily:"inherit"}}
                value={fBody} onChange={e => setFBody(e.target.value)} placeholder="Treść wiadomości..."/>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:8,letterSpacing:.5}}>TYP</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {Object.entries(MSG_TYPES).map(([key,mt]) => (
                  <button key={key} onClick={() => setFType(key)}
                    style={{padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",border:`2px solid ${fType===key?mt.color:C.grey}`,background:fType===key?mt.bg:C.white,color:fType===key?mt.color:C.greyDk}}>
                    {mt.icon} {key.charAt(0).toUpperCase()+key.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <Toggle value={fPinned} color={C.green} onChange={() => setFPinned(p=>!p)}/>
              <span style={{fontSize:13,color:C.black}}>Przypnij wiadomość na górze</span>
            </div>
            {(fTitle||fBody) && (
              <div>
                <div style={{fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:6,letterSpacing:.5}}>PODGLĄD</div>
                <div style={{background:fPinned?(MSG_TYPES[fType]||MSG_TYPES.info).bg:C.greyBg,border:`1px solid ${(MSG_TYPES[fType]||MSG_TYPES.info).color+"44"}`,padding:14}}>
                  <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <span style={{fontSize:18}}>{(MSG_TYPES[fType]||MSG_TYPES.info).icon}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:C.black,marginBottom:4}}>{fTitle||"(brak tytułu)"}</div>
                      <div style={{fontSize:12,color:C.greyDk,lineHeight:1.6}}>{fBody||"(brak treści)"}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {formErr && <div style={{color:C.red,fontSize:12}}>{formErr}</div>}
            <button onClick={sendMessage} disabled={saving}
              style={{background:saving?C.greyDk:C.black,border:"none",color:C.white,padding:12,fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
              {saving ? "Wysyłanie..." : "Wyślij wiadomość"}
            </button>
          </div>
        )}
      </div>

      <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:C.greyDk,textTransform:"uppercase",padding:"4px 2px"}}>Wszystkie wiadomości ({messages.length})</div>
      {messages.length === 0 && <div style={{background:C.white,padding:24,textAlign:"center",color:C.greyMid,fontSize:13}}>Brak wiadomości</div>}
      {messages.map(m => {
        const mt = MSG_TYPES[m.type] || MSG_TYPES.info;
        return (
          <div key={m.id} style={{background:m.pinned?mt.bg:C.white,border:`1px solid ${m.pinned?mt.color+"44":"rgba(0,0,0,.06)"}`,padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>{mt.icon}</span>
                <span style={{fontSize:13,fontWeight:700,color:C.black}}>{m.title}</span>
                {m.pinned && <span style={{fontSize:9,fontWeight:700,color:mt.color,background:`${mt.color}22`,padding:"2px 6px",letterSpacing:1}}>PRZYPIĘTE</span>}
              </div>
              <button onClick={() => deleteMessage(m.id)} disabled={deleting===m.id}
                style={{background:"none",border:`1px solid ${C.red}`,color:C.red,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",flexShrink:0}}>
                {deleting===m.id ? "..." : "🗑 Usuń"}
              </button>
            </div>
            <div style={{fontSize:12,color:C.greyDk,lineHeight:1.6,marginBottom:6}}>{m.body}</div>
            <div style={{fontSize:10,color:C.greyMid}}>{formatDate(m.created_at)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Admin: Edytor szkoleń ── */
export function AdminTrainings({ token }) {
  const [trainings, setTrainings] = useState(() => JSON.parse(JSON.stringify(TRAININGS)));
  const [editId,    setEditId]    = useState(null);
  const [editData,  setEditData]  = useState({});
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("all");

  useEffect(() => {
    db.get(token, "training_overrides", "select=*")
      .then(overrides => {
        if (overrides.length) {
          setTrainings(TRAININGS.map(t => {
            const ov = overrides.find(o => o.training_id === t.id);
            return ov ? { ...t, title:ov.title||t.title, desc:ov.description||t.desc, duration:ov.duration||t.duration, level:ov.level||t.level } : t;
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function startEdit(t) {
    setEditId(t.id);
    setEditData({ title:t.title, desc:t.desc, duration:t.duration, level:t.level });
  }

  async function saveEdit(id) {
    setSaving(true);
    try {
      const h = { ...authHeaders(token), "Prefer":"resolution=merge-duplicates,return=representation" };
      const r = await fetch(`${SB_URL}/rest/v1/training_overrides`, {
        method: "POST", headers: h,
        body: JSON.stringify({ training_id:id, title:editData.title, description:editData.desc, duration:editData.duration, level:editData.level, updated_at: new Date().toISOString() })
      });
      if (!r.ok) throw new Error(await r.text());
      setTrainings(p => p.map(t => t.id===id ? {...t, ...editData} : t));
      const globalT = TRAININGS.find(t => t.id===id);
      if (globalT) { globalT.title=editData.title; globalT.desc=editData.desc; globalT.duration=editData.duration; globalT.level=editData.level; }
      setEditId(null); setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch(e) {
      alert("Błąd zapisu: " + e.message);
    } finally { setSaving(false); }
  }

  function cancelEdit() { setEditId(null); setEditData({}); }

  const list = filter==="all" ? trainings : trainings.filter(t => t.group===filter);

  if (loading) return <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div>;

  return (
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{background:C.white,padding:"12px 16px",borderTop:`3px solid ${C.green}`}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:C.greyDk,marginBottom:12,textTransform:"uppercase"}}>Edytor szkoleń</div>
        {saved && <div style={{color:C.greenDk,fontSize:12,marginBottom:8,fontWeight:600}}>✓ Zmiany zapisane — widoczne dla wszystkich użytkowników</div>}
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[["all","Wszystkie"],...GROUPS.map(g=>[g.id,g.label])].map(([id,label]) => (
            <button key={id} onClick={() => setFilter(id)}
              style={{padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${filter===id?C.black:C.grey}`,background:filter===id?C.black:C.white,color:filter===id?C.white:C.greyDk}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {list.map(t => {
        const grp = GROUPS.find(g => g.id===t.group);
        const isEditing = editId === t.id;
        const orig = TRAININGS.find(o => o.id===t.id);
        const isModified = orig && (orig.title !== t.title || orig.desc !== t.desc);
        return (
          <div key={t.id} style={{background:C.white,border:`1px solid ${isEditing?C.green:"rgba(0,0,0,.06)"}`,boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}>
            <div style={{borderLeft:`4px solid ${grp?.color||C.grey}`,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                    <span style={{fontSize:10,fontWeight:700,color:C.greyMid,letterSpacing:1}}>{t.id} · {grp?.label}</span>
                    {isModified && <span style={{fontSize:9,fontWeight:700,color:C.amber,background:"#FEF3E2",padding:"1px 6px"}}>EDYTOWANE</span>}
                  </div>
                  {isEditing ? (
                    <input style={{width:"100%",border:`1.5px solid ${C.green}`,padding:"6px 10px",fontSize:14,fontWeight:700,color:C.black,outline:"none",boxSizing:"border-box",marginBottom:8}}
                      value={editData.title} onChange={e => setEditData(p=>({...p,title:e.target.value}))}/>
                  ) : (
                    <div style={{fontSize:13,fontWeight:700,color:C.black,lineHeight:1.3,marginBottom:4}}>{t.title}</div>
                  )}
                  <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                    {isEditing ? (
                      <>
                        <select value={editData.level} onChange={e => setEditData(p=>({...p,level:Number(e.target.value)}))}
                          style={{border:`1px solid ${C.grey}`,padding:"4px 8px",fontSize:11,color:C.black,background:C.white}}>
                          {[1,2,3].map(l => <option key={l} value={l}>{LVL_LABEL[l]}</option>)}
                        </select>
                        <input value={editData.duration} onChange={e => setEditData(p=>({...p,duration:e.target.value}))}
                          placeholder="czas trwania"
                          style={{border:`1px solid ${C.grey}`,padding:"4px 8px",fontSize:11,color:C.black,width:90}}/>
                      </>
                    ) : (
                      <>
                        <span style={{fontSize:11,color:LVL_COLOR[t.level],fontWeight:600}}>{LVL_LABEL[t.level]}</span>
                        <span style={{fontSize:11,color:C.greyMid}}>📅 {t.duration}</span>
                      </>
                    )}
                  </div>
                </div>
                {!isEditing && (
                  <button onClick={() => startEdit(t)}
                    style={{background:"none",border:`1px solid ${C.grey}`,color:C.greyDk,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer",flexShrink:0}}>
                    ✏️ Edytuj
                  </button>
                )}
              </div>

              {isEditing && (
                <div style={{marginTop:8}}>
                  <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:5,letterSpacing:.5}}>OPIS SZKOLENIA</label>
                  <textarea value={editData.desc} onChange={e => setEditData(p=>({...p,desc:e.target.value}))}
                    style={{width:"100%",border:`1.5px solid ${C.grey}`,padding:"9px 12px",fontSize:12,color:C.black,outline:"none",boxSizing:"border-box",minHeight:110,resize:"vertical",fontFamily:"inherit",lineHeight:1.6}}/>
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button onClick={() => saveEdit(t.id)} disabled={saving}
                      style={{flex:1,background:saving?C.greyDk:C.greenDk,border:"none",color:C.white,padding:10,fontSize:12,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
                      {saving?"Zapisywanie...":"✓ Zapisz dla wszystkich"}
                    </button>
                    <button onClick={cancelEdit}
                      style={{flex:1,background:"none",border:`1px solid ${C.grey}`,color:C.greyDk,padding:10,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                      Anuluj
                    </button>
                  </div>
                </div>
              )}

              {!isEditing && (
                <div style={{fontSize:12,color:C.greyDk,lineHeight:1.6,marginTop:4}}>{t.desc.length>120?t.desc.slice(0,120)+"…":t.desc}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Admin: Terminarz (Planer) ── */
const MONTHS_PL = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec",
                   "Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
const TIMELINE_TRAINERS = [1,2,3,4,5];

// Helpery nieskończonego timeline
const _EPOCH = new Date("2020-01-01T12:00:00");
function _pad(n) { return String(n).padStart(2,"0"); }
function _absDay(iso) { return Math.round((new Date(iso+"T12:00:00") - _EPOCH) / 86400000); }
function _daysInMon(y, m) { return new Date(y, m+1, 0).getDate(); }
function _shiftMonth({ year, month }, delta) {
  let m = month + delta, y = year;
  while (m > 11) { m -= 12; y++; }
  while (m < 0)  { m += 12; y--; }
  return { year: y, month: m };
}

function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function parseDays(durationStr) {
  const m = String(durationStr || "1").match(/(\d+)/);
  return m ? parseInt(m[1]) : 1;
}

function addDays(isoDate, n) {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function AdminSchedule({ token }) {
  const now = new Date();
  const [scheduled,    setScheduled]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState(null);

  // formMode: null | 'new' | 'edit'
  const [formMode,     setFormMode]     = useState(null);
  const [editingId,    setEditingId]    = useState(null);

  // Pola formularza (wspólne dla nowy/edycja)
  const [selDate,      setSelDate]      = useState(toISO(now));
  const [selTrainer,   setSelTrainer]   = useState(null);
  const [trainingMode, setTrainingMode] = useState("normal");
  const [selGroup,     setSelGroup]     = useState(GROUPS[0].id);
  const [selTraining,  setSelTraining]  = useState(TRAININGS.find(t=>t.group===GROUPS[0].id)?.id || TRAININGS[0].id);
  const [stName,       setStName]       = useState("");
  const [stDays,       setStDays]       = useState(2);
  const [isHidden,     setIsHidden]     = useState(false);
  const [isOutgoing,   setIsOutgoing]   = useState(false);
  const [notes,        setNotes]        = useState("");
  const [partCount,    setPartCount]    = useState("");

  // ── Nieskończony timeline ──
  // Zamiast jednego miesiąca, renderujemy ciągłą wstążkę wielu miesięcy.
  // Tablica months rozrasta się dynamicznie podczas scrollowania.
  const [months, setMonths] = useState(() => {
    const cur = { year: now.getFullYear(), month: now.getMonth() };
    return [_shiftMonth(cur,-1), cur, _shiftMonth(cur,1)];
  });
  const [visibleLabel,   setVisibleLabel]   = useState({ year: now.getFullYear(), month: now.getMonth() });

  // Refs do obsługi long-press i double-tap na paskach
  const pressTimers        = useRef({});
  const tapCounts          = useRef({});
  const tapTimers          = useRef({});
  const timelineRef        = useRef(null);
  const pendingScrollAdjust = useRef(0);   // korekta po dodaniu miesiąca z lewej
  const initialScrollDone  = useRef(false);
  const isExtending        = useRef(false);

  // Liczba dni widocznych w oknie bez scrollowania — zmień 12 na inną wartość aby dostosować szerokość komórek
  const [cellW, setCellW] = useState(28); // wartość zastępcza — ResizeObserver natychmiast ją poprawi

  // Oblicza offsety pikselowe każdego miesiąca
  const { monthOffsets, totalWidth, originAbsDay: tlOrigin } = useMemo(() => {
    if (!months.length) return { monthOffsets: [], totalWidth: 0, originAbsDay: 0 };
    const origin = _absDay(`${months[0].year}-${_pad(months[0].month+1)}-01`);
    const offsets = [];
    let off = 0;
    for (const m of months) { offsets.push(off); off += _daysInMon(m.year, m.month) * cellW; }
    return { monthOffsets: offsets, totalWidth: off, originAbsDay: origin };
  }, [months, cellW]);

  useEffect(() => {
    if (!timelineRef.current) return;
    function recalc() {
      if (!timelineRef.current) return;
      const available = timelineRef.current.clientWidth - 46;
      // Liczba dni widocznych w oknie bez scrollowania — zmień 12 na inną wartość aby dostosować szerokość komórek
      setCellW(available / 12);
    }
    const ro = new ResizeObserver(recalc);
    ro.observe(timelineRef.current);
    function onOrient() { setTimeout(recalc, 150); }
    window.addEventListener("orientationchange", onOrient);
    recalc();
    return () => { ro.disconnect(); window.removeEventListener("orientationchange", onOrient); };
  }, []);

  useEffect(() => { loadScheduled(); }, []);

  // Jednorazowe przewinięcie do dzisiaj
  useEffect(() => {
    if (!timelineRef.current || loading || cellW === 0 || initialScrollDone.current) return;
    initialScrollDone.current = true;
    const left = 46 + (_absDay(todayISO) - tlOrigin) * cellW;
    timelineRef.current.scrollLeft = Math.max(0, left - timelineRef.current.clientWidth / 4);
  }, [loading, cellW, tlOrigin]);

  // Korekta scrollLeft po dodaniu miesiąca z lewej strony
  useEffect(() => {
    if (pendingScrollAdjust.current !== 0 && timelineRef.current) {
      timelineRef.current.scrollLeft += pendingScrollAdjust.current;
      pendingScrollAdjust.current = 0;
    }
    isExtending.current = false;
  }, [months]);

  // Scroll handler: rozszerza wstążkę i aktualizuje etykietę
  function onTimelineScroll() {
    const el = timelineRef.current;
    if (!el || cellW === 0 || isExtending.current) return;
    const sl = el.scrollLeft, vw = el.clientWidth, maxSl = el.scrollWidth - vw;
    const centerX = sl + vw / 2;
    for (let i = monthOffsets.length - 1; i >= 0; i--) {
      if (centerX >= monthOffsets[i]) {
        const m = months[i];
        setVisibleLabel(prev => (prev.year===m.year&&prev.month===m.month)?prev:m);
        break;
      }
    }
    if (sl > maxSl - vw * 2) {
      isExtending.current = true;
      setMonths(prev => [...prev, _shiftMonth(prev[prev.length-1], 1)]);
    }
    if (sl < vw && sl > 0) {
      isExtending.current = true;
      setMonths(prev => {
        const nm = _shiftMonth(prev[0], -1);
        pendingScrollAdjust.current = _daysInMon(nm.year, nm.month) * cellW;
        return [nm, ...prev];
      });
    }
  }

  async function loadScheduled() {
    setLoading(true);
    try {
      const data = await db.get(token, "scheduled_trainings", "order=date.asc&select=*");
      setScheduled(Array.isArray(data) ? data : []);
    } catch { setScheduled([]); }
    setLoading(false);
  }

  function resetFormFields() {
    setTrainingMode("normal");
    const firstGroup = GROUPS[0].id;
    setSelGroup(firstGroup);
    setSelTraining(TRAININGS.find(t=>t.group===firstGroup)?.id || TRAININGS[0].id);
    setStName(""); setStDays(2);
    setIsHidden(false); setIsOutgoing(false); setNotes(""); setPartCount("");
  }

  function openNewForm(date, trainerId) {
    setFormMode("new"); setEditingId(null);
    setSelDate(date); setSelTrainer(trainerId);
    resetFormFields(); setMsg(null);
    setTimeout(() => window.scrollTo?.({top:9999,behavior:"smooth"}), 60);
  }

  function openEditForm(entry) {
    const isST = entry.training_id === "ST";
    const training = isST ? null : TRAININGS.find(t=>t.id===entry.training_id);
    setFormMode("edit"); setEditingId(entry.id);
    setSelDate(entry.date || ""); setSelTrainer(Number(entry.trainer_id) || null);
    setTrainingMode(isST ? "ST" : "normal");
    setSelGroup(training?.group || GROUPS[0].id);
    setSelTraining(isST ? (TRAININGS.find(t=>t.group===GROUPS[0].id)?.id || TRAININGS[0].id) : entry.training_id);
    setStName(entry.custom_name || ""); setStDays(entry.duration_days || 2);
    setIsHidden(entry.is_hidden || false);
    setIsOutgoing(entry.is_outgoing || false);
    setNotes(entry.notes || "");
    setPartCount(entry.participants_count != null ? String(entry.participants_count) : "");
    setMsg(null);
    setTimeout(() => window.scrollTo?.({top:9999,behavior:"smooth"}), 60);
  }

  function closeForm() { setFormMode(null); setEditingId(null); setMsg(null); }

  // ── Obsługa gestów paska: long-press = usuń, single-tap = edytuj, double-tap = toggle status ──
  function handleBarPressStart(barId, e) {
    if (e.type === "touchstart") e.preventDefault();
    pressTimers.current[barId] = setTimeout(() => {
      delete pressTimers.current[barId];
      if (tapTimers.current[barId]) { clearTimeout(tapTimers.current[barId]); delete tapTimers.current[barId]; }
      tapCounts.current[barId] = 0;
      if (window.confirm("Usunąć to szkolenie z terminarza?")) deleteEntry(barId);
    }, 650);
  }

  function handleBarPressEnd(bar, e) {
    if (e.type === "touchend") e.preventDefault();
    const barId = bar.id;
    if (!pressTimers.current[barId]) return;
    clearTimeout(pressTimers.current[barId]); delete pressTimers.current[barId];
    tapCounts.current[barId] = (tapCounts.current[barId] || 0) + 1;
    if (tapCounts.current[barId] === 1) {
      tapTimers.current[barId] = setTimeout(() => {
        tapCounts.current[barId] = 0; delete tapTimers.current[barId];
        openEditForm(bar.entry);
      }, 280);
    } else {
      clearTimeout(tapTimers.current[barId]); delete tapTimers.current[barId];
      tapCounts.current[barId] = 0;
      toggleBarStatus(bar.entry);
    }
  }

  function handleBarPressCancel(barId) {
    if (pressTimers.current[barId]) { clearTimeout(pressTimers.current[barId]); delete pressTimers.current[barId]; }
  }

  async function toggleBarStatus(entry) {
    const newStatus = (entry.status || "active") === "active" ? "planned" : "active";
    // Optymistyczna aktualizacja UI
    setScheduled(s => s.map(x => x.id === entry.id ? {...x, status: newStatus} : x));
    try {
      const result = await db.update(token, "scheduled_trainings", `id=eq.${entry.id}`, {status: newStatus});
      if (Array.isArray(result) && result.length === 0) {
        throw new Error("0 wierszy zaktualizowanych — sprawdź uprawnienia lub uruchom migrację SQL");
      }
    } catch(e) {
      // Cofnij optymistyczną zmianę
      setScheduled(s => s.map(x => x.id === entry.id ? {...x, status: entry.status || "active"} : x));
      setMsg({ok:false, text:"Błąd zapisu statusu: " + e.message});
    }
  }

  const groupTrainings = TRAININGS.filter(t => t.group === selGroup);
  useEffect(() => {
    const first = TRAININGS.find(t => t.group === selGroup);
    if (first) setSelTraining(first.id);
  }, [selGroup]);

  const previewDays = trainingMode === "ST" ? stDays : parseDays(TRAININGS.find(t=>t.id===selTraining)?.duration);
  const previewEndDate = selDate ? addDays(selDate, previewDays - 1) : "";

  async function addEntry() {
    if (!selDate || !selTrainer) { setMsg({ok:false,text:"Wybierz trenera i datę"}); return; }
    if (trainingMode === "ST" && !stName.trim()) { setMsg({ok:false,text:"Wpisz nazwę szkolenia ST"}); return; }
    setSaving(true); setMsg(null);
    try {
      const days = trainingMode === "ST" ? stDays : parseDays(TRAININGS.find(t=>t.id===selTraining)?.duration);
      const payload = {
        date: selDate, room: "-",
        training_id: trainingMode === "ST" ? "ST" : selTraining,
        trainer_id: selTrainer,
        end_date: addDays(selDate, days - 1),
        custom_name: trainingMode === "ST" ? stName.trim() : null,
        duration_days: days,
        is_hidden: isHidden,
        is_outgoing: isOutgoing,
        notes: notes.trim(),
      };
      await db.insert(token, "scheduled_trainings", payload);
      setMsg({ok:true,text:"✓ Dodano szkolenie do planerza!"});
      closeForm(); await loadScheduled();
    } catch(e) { setMsg({ok:false,text:"Błąd zapisu: "+e.message}); }
    setSaving(false);
  }

  async function updateEntry() {
    if (!editingId || !selDate || !selTrainer) { setMsg({ok:false,text:"Brak danych"}); return; }
    if (trainingMode === "ST" && !stName.trim()) { setMsg({ok:false,text:"Wpisz nazwę szkolenia ST"}); return; }
    setSaving(true); setMsg(null);
    try {
      const days = trainingMode === "ST" ? stDays : parseDays(TRAININGS.find(t=>t.id===selTraining)?.duration);
      const partVal = partCount !== "" ? parseInt(partCount) : null;
      const payload = {
        training_id: trainingMode === "ST" ? "ST" : selTraining,
        trainer_id: selTrainer,
        end_date: addDays(selDate, days - 1),
        custom_name: trainingMode === "ST" ? stName.trim() : null,
        duration_days: days,
        is_hidden: isHidden,
        is_outgoing: isOutgoing,
        notes: notes.trim(),
        participants_count: partVal,
      };
      const result = await db.update(token, "scheduled_trainings", `id=eq.${editingId}`, payload);
      if (Array.isArray(result) && result.length === 0) {
        throw new Error("0 wierszy zaktualizowanych — sprawdź uprawnienia RLS lub uruchom migrację SQL");
      }
      // Aktualizuj lokalny stan od razu (bez czekania na reload)
      setScheduled(s => s.map(x => x.id === editingId ? {
        ...x, ...payload,
        participants_count: partVal,
        is_hidden: isHidden,
        is_outgoing: isOutgoing,
      } : x));
      setSaving(false);
      closeForm();
      setMsg({ok:true,text:"✓ Zmiany zapisane!"});
      await loadScheduled();
    } catch(e) {
      setMsg({ok:false,text:"Błąd zapisu: "+e.message});
      setSaving(false);
    }
  }

  async function deleteEntry(id) {
    try {
      await db.remove(token, "scheduled_trainings", `id=eq.${id}`);
      setScheduled(s => s.filter(x => x.id !== id));
      if (editingId === id) closeForm();
    } catch(e) { alert("Błąd usuwania: "+e.message); }
  }

  // ── Timeline ──
  const todayISO = toISO(now);

  // ── Buduje paski z absolutnymi pozycjami pikselowymi ──
  const timelineData = useMemo(() => {
    if (!months.length) return TIMELINE_TRAINERS.map(tid => ({ trainerId: tid, bars: [] }));
    const firstISO = `${months[0].year}-${_pad(months[0].month+1)}-01`;
    const lastMon  = months[months.length-1];
    const lastISO  = `${lastMon.year}-${_pad(lastMon.month+1)}-${_pad(_daysInMon(lastMon.year, lastMon.month))}`;
    const origin   = _absDay(firstISO);

    // Dołącz podgląd nowego wpisu
    const allEntries = [...scheduled];
    if (formMode === "new" && selDate && selTrainer) {
      const isST = trainingMode === "ST";
      const training = isST ? null : TRAININGS.find(t=>t.id===selTraining);
      const grp = GROUPS.find(g=>g.id===training?.group);
      allEntries.push({
        id: "__preview__", date: selDate, end_date: previewEndDate,
        training_id: isST ? "ST" : selTraining, trainer_id: selTrainer,
        custom_name: isST ? (stName||"ST") : null,
        __preview: true, __color: isST ? "#8E44AD" : (grp?.color || "#2980B9"),
        __title: isST ? (stName||"ST") : (training?.short||"?"), status: "active",
      });
    }

    return TIMELINE_TRAINERS.map(trainerId => {
      const bars = allEntries
        .filter(s => Number(s.trainer_id) === trainerId)
        .map(s => {
          const startISO = s.date || "", endISO = s.end_date || s.date || "";
          if (!startISO || endISO < firstISO || startISO > lastISO) return null;
          const isST      = s.training_id === "ST";
          const training  = isST ? null : TRAININGS.find(t => t.id === s.training_id);
          const grp       = GROUPS.find(g => g.id === training?.group);
          const baseColor = s.__color || (isST ? "#8E44AD" : (grp?.color || "#2980B9"));
          const isPlanned = (s.status || "active") === "planned";
          const color     = isPlanned ? "#BBBBBB" : baseColor;
          const title     = s.__title || (isST ? (s.custom_name||"ST") : (training?.short || s.training_id));
          const cs   = startISO < firstISO ? firstISO : startISO;
          const ce   = endISO   > lastISO  ? lastISO  : endISO;
          const left  = (_absDay(cs) - origin) * cellW;
          const width = Math.max(cellW - 2, (_absDay(ce) - _absDay(cs) + 1) * cellW - 2);
          return { left, width, color, title, trainerId: s.trainer_id, id: s.id,
            isPreview: !!s.__preview, isPlanned, isHidden: s.is_hidden||false,
            isOutgoing: s.is_outgoing||false, participantsCount: s.participants_count, entry: s };
        })
        .filter(Boolean);
      return { trainerId, bars };
    });
  }, [scheduled, months, cellW, formMode, selDate, selTraining, trainingMode, stName, previewEndDate, selTrainer]);

  const listToShow = scheduled.filter(s => (s.end_date||s.date) >= todayISO).slice(0, 20);

  // ── Helper: pasek szkolenia z gestami ──
  function BarItem({ bar }) {
    if (bar.isPreview) {
      return (
        <div style={{position:"absolute",left:bar.left,top:4,height:22,width:bar.width,zIndex:2,
          background:bar.color+"99",borderRadius:3,display:"flex",alignItems:"center",
          padding:"0 3px",overflow:"hidden",boxSizing:"border-box",
          border:`1px dashed ${bar.color}`,cursor:"default"}}>
          <span style={{fontSize:8,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:1,fontStyle:"italic"}}>{bar.title}</span>
        </div>
      );
    }
    const badgeVal = bar.participantsCount != null ? bar.participantsCount : null;
    return (
      <div
        onMouseDown={e => handleBarPressStart(bar.id, e)}
        onMouseUp={e => handleBarPressEnd(bar, e)}
        onMouseLeave={() => handleBarPressCancel(bar.id)}
        onTouchStart={e => handleBarPressStart(bar.id, e)}
        onTouchEnd={e => handleBarPressEnd(bar, e)}
        onTouchMove={() => handleBarPressCancel(bar.id)}
        onContextMenu={e => e.preventDefault()}
        title={`${bar.title}${bar.isPlanned?" [planowane]":""}${bar.isHidden?" [ukryte]":""}${bar.isOutgoing?" [wyjazdowe]":""}\nTap=edytuj · 2×tap=planned · przytrzymaj=usuń`}
        style={{
          position:"absolute",left:bar.left,top:4,height:22,width:bar.width,zIndex:2,
          background:bar.color,borderRadius:3,display:"flex",alignItems:"center",
          padding:"0 3px",gap:2,cursor:"pointer",overflow:"hidden",boxSizing:"border-box",
          opacity: bar.isPlanned ? 0.75 : 1,
          border: bar.isHidden ? "1px solid rgba(0,0,0,.35)" : "none",
        }}>
        {bar.isHidden && <span style={{flexShrink:0,fontSize:7,color:"rgba(255,255,255,.85)",lineHeight:1}}>🔒</span>}
        {bar.isOutgoing && !bar.isHidden && <span style={{flexShrink:0,fontSize:7,color:"rgba(255,255,255,.85)",lineHeight:1}}>✈️</span>}
        <span style={{fontSize:8,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:1}}>
          {bar.title}{bar.isPlanned?" ···":""}
        </span>
        {badgeVal !== null && (
          <span style={{flexShrink:0,background:"rgba(0,0,0,.35)",borderRadius:"50%",width:12,height:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#fff",lineHeight:"12px",fontWeight:700}}>
            {badgeVal > 99 ? "99+" : badgeVal}
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{background:C.greyBg,padding:"12px",display:"flex",flexDirection:"column",gap:12}}>

      {/* ── Timeline ── */}
      <div style={{background:C.white,borderRadius:8,boxShadow:"0 1px 4px rgba(0,0,0,.1)"}}>

        {/* Etykieta widocznego miesiąca — aktualizuje się przy scrollu */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"8px 10px",borderBottom:`1px solid ${C.grey}`}}>
          <span style={{fontSize:13,fontWeight:700,color:C.black}}>{MONTHS_PL[visibleLabel.month]} {visibleLabel.year}</span>
        </div>

        <div ref={timelineRef} onScroll={onTimelineScroll} style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <div style={{display:"inline-block",minWidth:"100%",verticalAlign:"top"}}>

            {/* Nagłówek dni — ciągły przez wszystkie miesiące */}
            <div style={{display:"flex",borderBottom:`2px solid ${C.grey}`}}>
              <div style={{width:46,minWidth:46,flexShrink:0,background:"#f7f7f7",borderRight:`1px solid ${C.grey}`,fontSize:9,fontWeight:700,color:C.greyMid,display:"flex",alignItems:"center",justifyContent:"center",height:22}}>T</div>
              <div style={{display:"flex"}}>
                {months.map((mon,mi)=>{
                  const days=_daysInMon(mon.year,mon.month);
                  return (
                    <div key={`${mon.year}-${mon.month}`} style={{display:"flex",position:"relative",borderLeft:mi>0?`2px solid ${C.grey}`:"none"}}>
                      <div style={{position:"absolute",top:1,left:3,fontSize:7,fontWeight:700,color:C.green,letterSpacing:.3,pointerEvents:"none",lineHeight:"9px"}}>
                        {MONTHS_PL[mon.month].slice(0,3).toUpperCase()}
                      </div>
                      {Array.from({length:days},(_,i)=>i+1).map(d=>{
                        const iso=`${mon.year}-${_pad(mon.month+1)}-${_pad(d)}`;
                        const isToday=iso===todayISO;
                        const isWe=new Date(iso+"T12:00:00").getDay()%6===0;
                        return <div key={d} style={{width:cellW,minWidth:cellW,flexShrink:0,height:22,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:2,fontSize:9,fontWeight:isToday?700:400,color:isToday?C.greenDk:isWe?"#aaa":C.greyMid,background:isToday?C.greenBg:isWe?"#e8e8e8":"transparent",borderRight:"1px solid #efefef",boxSizing:"border-box"}}>{d}</div>;
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Wiersze trenerów */}
            {TIMELINE_TRAINERS.map(tid=>{
              const roomBars=(timelineData.find(r=>r.trainerId===tid)||{bars:[]}).bars;
              return (
                <div key={tid} style={{display:"flex",borderBottom:`1px solid ${C.grey}`}}>
                  <div style={{width:46,minWidth:46,flexShrink:0,background:"#f7f7f7",borderRight:`1px solid ${C.grey}`,fontSize:9,fontWeight:700,color:C.greyDk,display:"flex",alignItems:"center",justifyContent:"center",height:30}}>T{tid}</div>
                  <div style={{position:"relative",height:30,width:totalWidth,flexShrink:0}}>
                    {/* Klikalne komórki tła */}
                    {months.map((mon,mi)=>Array.from({length:_daysInMon(mon.year,mon.month)},(_,i)=>i+1).map(d=>{
                      const iso=`${mon.year}-${_pad(mon.month+1)}-${_pad(d)}`;
                      const isToday=iso===todayISO;
                      const isWe=new Date(iso+"T12:00:00").getDay()%6===0;
                      return <div key={`${mi}-${d}`} onClick={()=>openNewForm(iso,tid)} style={{position:"absolute",left:monthOffsets[mi]+(d-1)*cellW,top:0,width:cellW,height:"100%",background:isToday?"rgba(138,183,62,.12)":isWe?"rgba(0,0,0,.05)":"transparent",cursor:"pointer",zIndex:0}}/>;
                    }))}
                    {/* Linie pionowe */}
                    {months.map((mon,mi)=>Array.from({length:_daysInMon(mon.year,mon.month)},(_,i)=>i+1).map(d=>(
                      <div key={`${mi}-${d}`} style={{position:"absolute",left:monthOffsets[mi]+d*cellW,top:0,width:1,height:"100%",background:"#efefef",pointerEvents:"none",zIndex:0}}/>
                    )))}
                    {/* Separatory miesięcy */}
                    {monthOffsets.slice(1).map((off,i)=>(
                      <div key={i} style={{position:"absolute",left:off,top:0,width:2,height:"100%",background:C.grey,pointerEvents:"none",zIndex:1}}/>
                    ))}
                    {/* Paski szkoleń */}
                    {roomBars.map((bar,bi)=><BarItem key={bi} bar={bar}/>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Anuluj / formularz ── */}
      {formMode && (
        <button onClick={closeForm}
          style={{background:C.greyDk,color:C.white,border:"none",padding:"13px 0",fontSize:13,fontWeight:700,cursor:"pointer",borderRadius:6}}>
          ✕ Anuluj
        </button>
      )}

      {msg && (
        <div style={{padding:"10px 14px",borderRadius:6,background:msg.ok?"#E8F8E8":"#FDEDEC",color:msg.ok?C.greenDk:C.red,fontSize:13,fontWeight:600}}>
          {msg.text}
        </div>
      )}

      {formMode && (
        <div style={{background:C.white,borderRadius:8,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,.1)",display:"flex",flexDirection:"column",gap:14}}>

          {/* Nagłówek z info o dacie i trenerze */}
          <div style={{background:C.greyBg,borderRadius:6,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontSize:12,fontWeight:700,color:C.black}}>
              {formMode==="edit" ? "✏️ Edycja szkolenia" : "➕ Nowe szkolenie"}
            </span>
            <span style={{fontSize:12,color:C.greyDk}}>
              📅 {selDate} &nbsp;·&nbsp; T{selTrainer} {selTrainer ? TRAINERS[selTrainer] : ""}
            </span>
          </div>

          {/* RODZAJ SZKOLENIA */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.greyMid,letterSpacing:1,marginBottom:8,textTransform:"uppercase"}}>Rodzaj szkolenia</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {GROUPS.map(g=>(
                <button key={g.id} onClick={()=>{ setTrainingMode("normal"); setSelGroup(g.id); }}
                  style={{padding:"7px 14px",background:trainingMode==="normal"&&selGroup===g.id?g.color:"transparent",color:trainingMode==="normal"&&selGroup===g.id?C.white:g.color,border:`1.5px solid ${g.color}`,borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  {g.label}
                </button>
              ))}
              <button onClick={()=>setTrainingMode("ST")}
                style={{padding:"7px 14px",background:trainingMode==="ST"?"#8E44AD":"transparent",color:trainingMode==="ST"?C.white:"#8E44AD",border:"1.5px solid #8E44AD",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                ⭐ ST
              </button>
            </div>
          </div>

          {/* SZKOLENIE — normalne */}
          {trainingMode === "normal" && (
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.greyMid,letterSpacing:1,marginBottom:8,textTransform:"uppercase"}}>Szkolenie</div>
              <select value={selTraining} onChange={e=>setSelTraining(e.target.value)}
                style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${C.grey}`,borderRadius:6,fontSize:13,color:C.black,background:C.white,boxSizing:"border-box"}}>
                {groupTrainings.map(t=>(
                  <option key={t.id} value={t.id}>{t.short} — {t.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* SZKOLENIE — ST */}
          {trainingMode === "ST" && (
            <div style={{display:"flex",flexDirection:"column",gap:12,background:"#F9F0FF",border:"1px solid rgba(142,68,173,.25)",borderRadius:8,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"#8E44AD",letterSpacing:1}}>⭐ SZKOLENIE SPECJALNE (ST)</div>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:6,textTransform:"uppercase"}}>Nazwa szkolenia</label>
                <input value={stName} onChange={e=>setStName(e.target.value)} placeholder="Wpisz nazwę…"
                  style={{width:"100%",padding:"10px 12px",border:"1.5px solid #8E44AD",borderRadius:6,fontSize:13,color:C.black,background:C.white,boxSizing:"border-box"}}/>
              </div>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:C.greyDk,marginBottom:6,textTransform:"uppercase"}}>Czas trwania (dni)</label>
                <div style={{display:"flex",gap:8}}>
                  {[1,2,3,4,5].map(d=>(
                    <button key={d} onClick={()=>setStDays(d)}
                      style={{flex:1,padding:"10px 0",background:stDays===d?"#8E44AD":C.white,color:stDays===d?C.white:C.greyDk,border:`1.5px solid ${stDays===d?"#8E44AD":C.grey}`,borderRadius:6,fontSize:15,fontWeight:700,cursor:"pointer"}}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* NOTATKI */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.greyMid,letterSpacing:1,marginBottom:8,textTransform:"uppercase"}}>Notatki</div>
            <textarea
              value={notes} onChange={e=>setNotes(e.target.value)}
              rows={10}
              placeholder="Dodatkowe informacje o szkoleniu…"
              style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${C.grey}`,borderRadius:6,fontSize:12,color:C.black,background:C.white,boxSizing:"border-box",resize:"vertical",fontFamily:"inherit",lineHeight:1.55,outline:"none"}}
            />
          </div>

          {/* HIDDEN + WYJAZDOWE + LICZBA UCZESTNIKÓW — jeden wiersz */}
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}
              title="Ukryte — niewidoczne dla klientów">
              <input type="checkbox" checked={isHidden}
                onChange={e => { setIsHidden(e.target.checked); if (e.target.checked) setIsOutgoing(false); }}
                style={{width:16,height:16,cursor:"pointer",accentColor:C.amber}}/>
              <span style={{fontSize:16}}>🔒</span>
            </label>
            <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}
              title="Wyjazdowe — widoczne tylko dla trenerów">
              <input type="checkbox" checked={isOutgoing}
                onChange={e => { setIsOutgoing(e.target.checked); if (e.target.checked) setIsHidden(false); }}
                style={{width:16,height:16,cursor:"pointer",accentColor:"#2980B9"}}/>
              <span style={{fontSize:16}}>✈️</span>
            </label>
            <div style={{flex:1}}/>
            <span style={{fontSize:11,fontWeight:700,color:C.greyMid,letterSpacing:1,textTransform:"uppercase"}}>Liczba uczest.</span>
            <input
              type="number" min="0" max="999" value={partCount}
              onChange={e=>setPartCount(e.target.value)}
              placeholder="—"
              style={{width:64,padding:"8px 10px",border:`1.5px solid ${C.grey}`,borderRadius:6,fontSize:14,fontWeight:700,color:C.black,background:C.white,textAlign:"center",outline:"none"}}
            />
          </div>

          {/* PRZYCISKI AKCJI */}
          {formMode === "new" ? (
            <button onClick={addEntry} disabled={saving}
              style={{width:"100%",background:saving?C.greyDk:C.black,color:C.white,border:"none",padding:14,fontSize:13,fontWeight:700,borderRadius:6,cursor:saving?"not-allowed":"pointer"}}>
              {saving ? "Zapisywanie…" : "✓ Dodaj do planerza"}
            </button>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <button onClick={updateEntry} disabled={saving}
                style={{width:"100%",background:saving?C.greyDk:C.greenDk,color:C.white,border:"none",padding:14,fontSize:13,fontWeight:700,borderRadius:6,cursor:saving?"not-allowed":"pointer"}}>
                {saving ? "Zapisywanie…" : "✓ Zapisz zmiany"}
              </button>
              <button
                onClick={()=>{ if(window.confirm("Usunąć to szkolenie z terminarza?")) { deleteEntry(editingId); closeForm(); } }}
                style={{width:"100%",background:"none",color:C.red,border:`1.5px solid ${C.red}`,padding:12,fontSize:13,fontWeight:600,borderRadius:6,cursor:"pointer"}}>
                🗑 Usuń szkolenie
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Lista nadchodzących ── */}
      {!loading && (
        <div style={{background:C.white,borderRadius:8,padding:14,boxShadow:"0 1px 3px rgba(0,0,0,.07)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
            <div style={{fontSize:11,fontWeight:700,color:C.greyMid,letterSpacing:1,textTransform:"uppercase"}}>
              Nadchodzące ({listToShow.length})
            </div>
            {scheduled.length > 0 && (
              <button onClick={() => {
                const nowStr = new Date().toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z";
                const events = scheduled.map(s => {
                  const isST = s.training_id === "ST";
                  const t = isST ? null : TRAININGS.find(x=>x.id===s.training_id);
                  const title = isST ? (s.custom_name||"ST") : (t?.title||s.training_id);
                  const sd = (s.date||"").replace(/-/g,"");
                  const ed = ((s.end_date||s.date)||"").replace(/-/g,"");
                  return ["BEGIN:VEVENT",`UID:${s.id}-${sd}@engel`,`DTSTAMP:${nowStr}`,`DTSTART;VALUE=DATE:${sd}`,`DTEND;VALUE=DATE:${ed}`,`SUMMARY:${title}`,"END:VEVENT"].join("\r\n");
                }).join("\r\n");
                const ics=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ENGEL Expert Academy//PL\r\n${events}\r\nEND:VCALENDAR`;
                const blob=new Blob([ics],{type:"text/calendar;charset=utf-8"});
                const url=URL.createObjectURL(blob);
                const a=document.createElement("a");
                a.href=url; a.download="terminarz-engel.ics"; a.click(); URL.revokeObjectURL(url);
              }} style={{fontSize:11,fontWeight:700,padding:"5px 10px",background:C.black,color:C.white,border:"none",borderRadius:4,cursor:"pointer"}}>
                📅 Eksportuj .ics
              </button>
            )}
          </div>
          {listToShow.length===0 && (
            <div style={{textAlign:"center",padding:20,color:C.greyMid,fontSize:13}}>Brak nadchodzących szkoleń</div>
          )}
          {listToShow.map(s => {
            const isST = s.training_id === "ST";
            const t = isST ? null : TRAININGS.find(x=>x.id===s.training_id);
            const grp = GROUPS.find(g=>g.id===t?.group);
            const barColor = isST ? "#8E44AD" : (grp?.color || C.grey);
            const isPlanned = (s.status||"active") === "planned";
            return (
              <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.grey}`,opacity:isPlanned?0.6:1}}>
                <div style={{width:4,alignSelf:"stretch",background:isPlanned?"#BBBBBB":barColor,borderRadius:2,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.black,marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {isST?(s.custom_name||"ST"):(t?.title||s.training_id)}
                    {isPlanned && <span style={{fontSize:10,fontWeight:400,color:C.greyMid}}> · planowane</span>}
                    {s.is_hidden && <span style={{fontSize:10,color:C.amber}}> 🔒</span>}
                  </div>
                  <div style={{fontSize:11,color:C.greyMid,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                    <span>{s.date}{s.end_date&&s.end_date!==s.date?` → ${s.end_date}`:""}</span>
                    {s.trainer_id&&<span>· T{s.trainer_id} {TRAINERS[s.trainer_id]}</span>}
                    {s.participants_count!=null&&<span>· 👥 {s.participants_count}</span>}
                  </div>
                </div>
                <button onClick={()=>openEditForm(s)}
                  style={{background:"none",border:`1px solid ${C.grey}`,color:C.greyDk,fontSize:11,padding:"4px 10px",borderRadius:4,cursor:"pointer",flexShrink:0}}>
                  ✏️
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
/* ── Admin: Zarządzanie quizem ─────────────────────────────────────────── */

export function AdminQuiz({ token }) {
  const [quizzes,      setQuizzes]      = useState([]);
  const [selQuiz,      setSelQuiz]      = useState(null);
  const [questions,    setQuestions]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(null);
  const [err,          setErr]          = useState("");

  // Formularz nowego quizu
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [qzMode,       setQzMode]       = useState("training");
  const [qzTraining,   setQzTraining]   = useState(TRAININGS[0].id);
  const [qzCustom,     setQzCustom]     = useState("");

  // Formularz pytania
  const [showQForm,    setShowQForm]    = useState(false);
  const [editingQ,     setEditingQ]     = useState(null);
  const [fQ,  setFQ]  = useState("");
  const [fA,  setFA]  = useState("");
  const [fB,  setFB]  = useState("");
  const [fC,  setFC]  = useState("");
  const [fAns,setFAns]= useState("a");

  // Potwierdzenie usunięcia: { type:"quiz"|"question", item }
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Long-press
  const pressTimer = useRef(null);
  const HOLD_MS = 600;

  function startHold(cb) {
    pressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(80);
      cb();
    }, HOLD_MS);
  }
  function cancelHold() {
    clearTimeout(pressTimer.current);
  }

  // ── Załaduj quizy ────────────────────────────────────────────────────────
  async function loadQuizzes() {
    setLoading(true); setErr("");
    try {
      const data = await db.get(token, "quizzes", "order=created_at.asc&select=*");
      const counts = await db.get(token, "quiz_questions", "select=quiz_id");
      const countMap = {};
      counts.forEach(q => { countMap[q.quiz_id] = (countMap[q.quiz_id] || 0) + 1; });
      setQuizzes(data.map(qz => ({ ...qz, questionCount: countMap[qz.id] || 0 })));
    } catch(e) { setErr("Błąd: " + e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadQuizzes(); }, []);

  async function loadQuestions(quizId) {
    setLoading(true);
    try {
      const data = await db.get(token, "quiz_questions", `quiz_id=eq.${quizId}&order=created_at.asc&select=*`);
      setQuestions(data);
    } catch(e) { setErr("Błąd: " + e.message); }
    finally { setLoading(false); }
  }

  function openQuiz(qz) { setSelQuiz(qz); setErr(""); setShowQForm(false); loadQuestions(qz.id); }
  function backToList() { setSelQuiz(null); setShowQForm(false); setEditingQ(null); loadQuizzes(); }

  // ── Utwórz quiz ───────────────────────────────────────────────────────────
  async function createQuiz() {
    const title = qzMode === "training"
      ? (TRAININGS.find(t => t.id === qzTraining)?.title || qzTraining)
      : qzCustom.trim();
    const training_id = qzMode === "training" ? qzTraining : null;
    if (!title) { setErr("Podaj nazwę quizu."); return; }
    setSaving(true); setErr("");
    try {
      const res = await db.insert(token, "quizzes", { title, training_id });
      setShowQuizForm(false); setQzCustom("");
      await loadQuizzes();
      if (res?.[0]) openQuiz({ ...res[0], questionCount: 0 });
    } catch(e) { setErr("Błąd: " + e.message); }
    finally { setSaving(false); }
  }

  // ── Usuń (po potwierdzeniu) ───────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteConfirm) return;
    setDeleting(deleteConfirm.item.id);
    setDeleteConfirm(null);
    try {
      if (deleteConfirm.type === "quiz") {
        await db.remove(token, "quizzes", `id=eq.${deleteConfirm.item.id}`);
        setQuizzes(p => p.filter(q => q.id !== deleteConfirm.item.id));
      } else {
        await db.remove(token, "quiz_questions", `id=eq.${deleteConfirm.item.id}`);
        setQuestions(p => p.filter(q => q.id !== deleteConfirm.item.id));
      }
    } catch(e) { setErr("Błąd: " + e.message); }
    finally { setDeleting(null); }
  }

  // ── Formularz pytania ─────────────────────────────────────────────────────
  function openNewQ() { setEditingQ(null); setFQ(""); setFA(""); setFB(""); setFC(""); setFAns("a"); setShowQForm(true); setErr(""); }
  function openEditQ(q) { setEditingQ(q); setFQ(q.question); setFA(q.answer_a); setFB(q.answer_b); setFC(q.answer_c); setFAns(q.correct); setShowQForm(true); setErr(""); }
  async function saveQ() {
    if (!fQ.trim()||!fA.trim()||!fB.trim()||!fC.trim()) { setErr("Wypełnij wszystkie pola."); return; }
    setSaving(true); setErr("");
    const payload = { question:fQ.trim(), answer_a:fA.trim(), answer_b:fB.trim(), answer_c:fC.trim(), correct:fAns, quiz_id:selQuiz.id };
    try {
      if (editingQ) await db.update(token, "quiz_questions", `id=eq.${editingQ.id}`, payload);
      else          await db.insert(token, "quiz_questions", payload);
      setShowQForm(false);
      await loadQuestions(selQuiz.id);
    } catch(e) { setErr("Błąd zapisu: " + e.message); }
    finally { setSaving(false); }
  }

  const inpStyle = { width:"100%", boxSizing:"border-box", border:`1px solid ${C.grey}`, padding:"9px 12px", fontSize:13, marginBottom:10, borderRadius:4 };

  // ── Modal potwierdzenia usunięcia ─────────────────────────────────────────
  const deleteModal = deleteConfirm && (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16,fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif"}}>
      <div style={{background:C.white,width:"100%",maxWidth:380,borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,.35)",overflow:"hidden"}}>
        <div style={{background:C.darkHdr,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{color:C.white,fontSize:13,fontWeight:700,letterSpacing:1}}>
            {deleteConfirm.type === "quiz" ? "USUŃ QUIZ" : "USUŃ PYTANIE"}
          </span>
          <button onClick={() => setDeleteConfirm(null)} style={{background:"none",border:"none",color:"#fff",fontSize:18,cursor:"pointer",opacity:.7}}>✕</button>
        </div>
        <div style={{height:3,background:C.red}}/>
        <div style={{padding:20,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{fontSize:13,color:C.greyDk}}>
            {deleteConfirm.type === "quiz"
              ? "Czy na pewno chcesz usunąć ten quiz? Wszystkie pytania zostaną usunięte."
              : "Czy na pewno chcesz usunąć to pytanie?"}
          </div>
          <div style={{background:C.greyBg,padding:"10px 14px",borderLeft:`3px solid ${C.red}`,fontSize:13,fontWeight:600,color:C.black}}>
            {deleteConfirm.type === "quiz" ? deleteConfirm.item.title : deleteConfirm.item.question}
          </div>
        </div>
        <div style={{padding:"0 20px 20px",display:"flex",gap:10}}>
          <button onClick={() => setDeleteConfirm(null)}
            style={{flex:1,padding:"12px",border:`1px solid ${C.grey}`,background:C.white,fontSize:13,fontWeight:600,cursor:"pointer",borderRadius:6,color:C.greyDk}}>
            Anuluj
          </button>
          <button onClick={confirmDelete}
            style={{flex:1,padding:"12px",border:"none",background:C.red,fontSize:13,fontWeight:700,cursor:"pointer",borderRadius:6,color:C.white}}>
            Usuń
          </button>
        </div>
      </div>
    </div>
  );

  /* ════ WIDOK LISTY QUIZÓW ════ */
  if (!selQuiz) return (
    <div style={{padding:12,display:"flex",flexDirection:"column",gap:10}}>
      {deleteModal}
      {err && <div style={{background:"#FDEDEC",border:`1px solid ${C.red}`,padding:"10px 14px",fontSize:13,color:C.red,borderRadius:4}}>{err}</div>}

      <button onClick={() => { setShowQuizForm(p => !p); setErr(""); }}
        style={{background:C.green,border:"none",color:C.white,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer",borderRadius:6}}>
        {showQuizForm ? "Anuluj" : "+ Nowy quiz"}
      </button>

      {showQuizForm && (
        <div style={{background:C.white,padding:16,borderRadius:8,boxShadow:"0 2px 8px rgba(0,0,0,.1)"}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Nowy quiz</div>
          <div style={{display:"flex",gap:0,marginBottom:12,border:`1px solid ${C.grey}`,borderRadius:6,overflow:"hidden"}}>
            {[["training","Ze szkolenia"],["custom","Własna nazwa"]].map(([mode,label]) => (
              <button key={mode} onClick={() => setQzMode(mode)}
                style={{flex:1,padding:"9px 4px",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
                  background:qzMode===mode?C.black:C.white, color:qzMode===mode?C.white:C.greyMid}}>
                {label}
              </button>
            ))}
          </div>
          {qzMode === "training" ? (
            <select value={qzTraining} onChange={e => setQzTraining(e.target.value)} style={inpStyle}>
              {TRAININGS.map(t => (
                <option key={t.id} value={t.id}>{t.id} — {t.short}: {t.title.slice(0,50)}{t.title.length>50?"…":""}</option>
              ))}
            </select>
          ) : (
            <input value={qzCustom} onChange={e => setQzCustom(e.target.value)}
              placeholder="Nazwa quizu (np. Bezpieczeństwo pracy)" style={inpStyle}/>
          )}
          {err && <div style={{color:C.red,fontSize:12,marginBottom:8}}>{err}</div>}
          <button onClick={createQuiz} disabled={saving}
            style={{width:"100%",background:C.black,border:"none",color:C.white,padding:11,fontSize:13,fontWeight:700,cursor:"pointer",borderRadius:4}}>
            {saving ? "Tworzę..." : "Utwórz quiz i dodaj pytania →"}
          </button>
        </div>
      )}

      {loading && <div style={{textAlign:"center",padding:32}}><Spinner/></div>}
      {!loading && !quizzes.length && (
        <div style={{textAlign:"center",color:C.greyMid,padding:32,fontSize:13}}>Brak quizów. Utwórz pierwszy.</div>
      )}
      <div style={{fontSize:11,color:C.greyMid,textAlign:"center",padding:"4px 0"}}>Przytrzymaj quiz aby usunąć</div>

      {quizzes.map(qz => (
        <div key={qz.id}
          onMouseDown={() => startHold(() => setDeleteConfirm({ type:"quiz", item:qz }))}
          onMouseUp={cancelHold} onMouseLeave={cancelHold}
          onTouchStart={() => startHold(() => setDeleteConfirm({ type:"quiz", item:qz }))}
          onTouchEnd={cancelHold} onTouchCancel={cancelHold}
          style={{background:deleting===qz.id?"#FDEDEC":C.white,borderRadius:8,padding:"12px 14px",boxShadow:"0 1px 3px rgba(0,0,0,.06)",display:"flex",alignItems:"center",gap:10,userSelect:"none",cursor:"pointer",transition:"background .15s"}}
        >
          <div style={{flex:1,minWidth:0}} onClick={() => openQuiz(qz)}>
            <div style={{fontSize:13,fontWeight:700,color:C.black,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {qz.title}
            </div>
            <div style={{fontSize:11,color:C.greyMid}}>
              {qz.training_id && <span style={{marginRight:8,color:C.green,fontWeight:600}}>{qz.training_id}</span>}
              {qz.questionCount} {qz.questionCount===1?"pytanie":qz.questionCount>=2&&qz.questionCount<=4?"pytania":"pytań"}
            </div>
          </div>
          <button onClick={() => openQuiz(qz)}
            style={{background:C.greyBg,border:`1px solid ${C.grey}`,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",borderRadius:4,flexShrink:0}}>
            Edytuj →
          </button>
        </div>
      ))}
    </div>
  );

  /* ════ WIDOK PYTAŃ ════ */
  return (
    <div style={{padding:12,display:"flex",flexDirection:"column",gap:10}}>
      {deleteModal}
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <button onClick={backToList}
          style={{background:"none",border:`1px solid ${C.grey}`,padding:"6px 10px",fontSize:12,cursor:"pointer",borderRadius:4,flexShrink:0}}>
          ← Lista
        </button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:C.black,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selQuiz.title}</div>
          {selQuiz.training_id && <div style={{fontSize:11,color:C.green,fontWeight:600}}>{selQuiz.training_id}</div>}
        </div>
      </div>

      {err && <div style={{background:"#FDEDEC",border:`1px solid ${C.red}`,padding:"10px 14px",fontSize:13,color:C.red,borderRadius:4}}>{err}</div>}

      <button onClick={openNewQ}
        style={{background:C.green,border:"none",color:C.white,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer",borderRadius:6}}>
        + Dodaj pytanie
      </button>

      {showQForm && (
        <div style={{background:C.white,padding:16,borderRadius:8,boxShadow:"0 2px 8px rgba(0,0,0,.1)"}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>{editingQ?"Edytuj pytanie":"Nowe pytanie"}</div>
          <textarea value={fQ} onChange={e => setFQ(e.target.value)} placeholder="Treść pytania" rows={3}
            style={{...inpStyle,resize:"vertical",fontFamily:"inherit"}}/>
          {["a","b","c"].map(k => (
            <div key={k} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <button onClick={() => setFAns(k)} style={{
                width:28,height:28,borderRadius:"50%",border:"none",flexShrink:0,cursor:"pointer",fontWeight:700,fontSize:12,
                background:fAns===k?C.green:"#eee", color:fAns===k?C.white:C.greyMid,
              }}>{k.toUpperCase()}</button>
              <input value={k==="a"?fA:k==="b"?fB:fC}
                onChange={e=>(k==="a"?setFA:k==="b"?setFB:setFC)(e.target.value)}
                placeholder={`Odpowiedź ${k.toUpperCase()}`}
                style={{...inpStyle,marginBottom:0,flex:1,border:`1px solid ${fAns===k?C.green:C.grey}`}}/>
            </div>
          ))}
          <div style={{fontSize:11,color:C.greyMid,marginBottom:8}}>Kliknij literę aby zaznaczyć poprawną odpowiedź</div>
          {err && <div style={{color:C.red,fontSize:12,marginBottom:8}}>{err}</div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={saveQ} disabled={saving}
              style={{flex:1,background:C.black,border:"none",color:C.white,padding:11,fontSize:13,fontWeight:700,cursor:"pointer",borderRadius:4}}>
              {saving?"Zapisuję...":"Zapisz"}
            </button>
            <button onClick={() => setShowQForm(false)}
              style={{flex:1,background:"none",border:`1px solid ${C.grey}`,color:C.greyDk,padding:11,fontSize:13,cursor:"pointer",borderRadius:4}}>
              Anuluj
            </button>
          </div>
        </div>
      )}

      {loading && <div style={{textAlign:"center",padding:24}}><Spinner/></div>}
      {!loading && !questions.length && !showQForm && (
        <div style={{textAlign:"center",color:C.greyMid,padding:32,fontSize:13}}>Brak pytań. Dodaj pierwsze pytanie.</div>
      )}
      {!loading && questions.length > 0 && (
        <div style={{fontSize:11,color:C.greyMid,textAlign:"center",padding:"4px 0"}}>Przytrzymaj pytanie aby usunąć</div>
      )}

      {questions.map((q, i) => (
        <div key={q.id}
          onMouseDown={() => startHold(() => setDeleteConfirm({ type:"question", item:q }))}
          onMouseUp={cancelHold} onMouseLeave={cancelHold}
          onTouchStart={() => startHold(() => setDeleteConfirm({ type:"question", item:q }))}
          onTouchEnd={cancelHold} onTouchCancel={cancelHold}
          style={{background:deleting===q.id?"#FDEDEC":C.white,borderRadius:8,padding:"12px 14px",boxShadow:"0 1px 3px rgba(0,0,0,.06)",userSelect:"none",transition:"background .15s"}}
        >
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
            <div style={{fontSize:13,fontWeight:600,color:C.black,lineHeight:1.4,flex:1}}>{i+1}. {q.question}</div>
            <button onClick={() => openEditQ(q)} style={{background:"none",border:`1px solid ${C.grey}`,padding:"3px 8px",fontSize:11,cursor:"pointer",borderRadius:3,flexShrink:0}}>✏️</button>
          </div>
          {["a","b","c"].map(k => (
            <div key={k} style={{
              fontSize:12,padding:"4px 8px",marginBottom:3,borderRadius:4,
              background:k===q.correct?"#F0F7E0":C.greyBg,
              color:k===q.correct?C.greenDk:C.greyDk,
              fontWeight:k===q.correct?700:400,
              border:k===q.correct?`1px solid ${C.green}`:"none",
            }}>
              {k.toUpperCase()}. {q[`answer_${k}`]} {k===q.correct&&"✓"}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
