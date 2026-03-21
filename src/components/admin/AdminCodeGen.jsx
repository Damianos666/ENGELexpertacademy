import { useState, useRef } from "react";
import { C, GROUPS, TRAINERS } from "../../lib/constants";
import { TRAININGS } from "../../data/trainings";
import { edge } from "../../lib/supabase";
import { useUser } from "../../lib/UserContext";

/**
 * AdminCodeGen — generator kodów QR dla trenerów i adminów.
 * Wymaga: npm install qrcode
 *
 * Zmienne środowiskowe Vercel (opcjonalne):
 *   VITE_APP_URL — URL aplikacji, domyślnie https://engel-eea.vercel.app
 *                  (musi zgadzać się z APP_URL w Supabase Edge Function Settings)
 */

export function AdminCodeGen({ defaultTrainer }) {
  const { token } = useUser();
  const [mode,        setMode]        = useState("normal");
  const [selGroup,    setSelGroup]    = useState(GROUPS[0].id);
  const [selTraining, setSelTraining] = useState(TRAININGS.find(t => t.group === GROUPS[0].id)?.id || TRAININGS[0].id);
  const [selTrainer,  setSelTrainer]  = useState(defaultTrainer ? Number(defaultTrainer) : 1);

  const [loading,   setLoading]   = useState(false);
  const [err,       setErr]       = useState("");
  const [result,    setResult]    = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [copied,    setCopied]    = useState(false);

  function handleGroupChange(gid) {
    setSelGroup(gid);
    const first = TRAININGS.find(t => t.group === gid);
    if (first) setSelTraining(first.id);
  }

  async function generateCode() {
    setLoading(true); setErr(""); setResult(null); setQrDataUrl(null);
    try {
      const training = TRAININGS.find(t => t.id === selTraining);
      const short    = mode === "special" ? "ST" : (training?.short || selTraining);

      const data = await edge.generateCode(token, short, selTrainer, mode === "special");
      setResult(data);

      // Generuj QR kod z URL weryfikacyjnego (lazy import)
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.default.toDataURL(data.verifyUrl, {
        width: 320, margin: 2,
        color: { dark: "#1A1A1A", light: "#FFFFFF" },
      });
      setQrDataUrl(dataUrl);
    } catch (e) {
      setErr(e.message || "Błąd generowania kodu");
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    if (!result?.code) return;
    navigator.clipboard.writeText(result.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const groupTrainings   = TRAININGS.filter(t => t.group === selGroup);
  const selectedTraining = TRAININGS.find(t => t.id === selTraining);
  const today = new Date().toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: C.white, padding: 18, borderTop: `3px solid ${C.green}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.greyDk, marginBottom: 14, textTransform: "uppercase" }}>
          Generator kodów QR
        </div>

        {/* Tryb */}
        <div style={{ display: "flex", gap: 0, marginBottom: 18, border: `1px solid ${C.grey}`, overflow: "hidden" }}>
          {[["normal", "📋 Standardowe"], ["special", "⭐ Specjalne (ST)"]].map(([val, label]) => (
            <button key={val} onClick={() => { setMode(val); setResult(null); setQrDataUrl(null); }}
              style={{ flex: 1, padding: "9px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none",
                background: mode === val ? C.black : C.white, color: mode === val ? C.white : C.greyDk }}>
              {label}
            </button>
          ))}
        </div>

        {mode === "normal" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.greyDk, marginBottom: 8, letterSpacing: .5 }}>KROK 1 — KATEGORIA</label>
              <select value={selGroup} onChange={e => handleGroupChange(e.target.value)}
                style={{ width: "100%", padding: "11px 14px", fontSize: 13, border: `1.5px solid ${C.green}`, background: C.white, color: C.black, cursor: "pointer" }}>
                {GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.greyDk, marginBottom: 8, letterSpacing: .5 }}>KROK 2 — SZKOLENIE</label>
              <select value={selTraining} onChange={e => setSelTraining(e.target.value)}
                style={{ width: "100%", padding: "11px 14px", fontSize: 13, border: `1.5px solid ${C.green}`, background: C.white, color: C.black, cursor: "pointer" }}>
                {groupTrainings.map(t => <option key={t.id} value={t.id}>{t.short} — {t.title}</option>)}
              </select>
            </div>
          </>
        )}

        {mode === "special" && (
          <div style={{ marginBottom: 14, background: "#FEF3E2", border: `1px solid ${C.amber}`, padding: "10px 14px", fontSize: 11, color: C.greyDk, lineHeight: 1.6 }}>
            ⭐ Kod ST — uczestnik sam wpisze nazwę szkolenia po zeskanowaniu.
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.greyDk, marginBottom: 8, letterSpacing: .5 }}>
            {mode === "normal" ? "KROK 3" : "KROK 2"} — TRENER
          </label>
          <select value={selTrainer} onChange={e => setSelTrainer(Number(e.target.value))}
            style={{ width: "100%", padding: "11px 14px", fontSize: 13, border: `1.5px solid ${C.green}`, background: C.white, color: C.black, cursor: "pointer" }}>
            {Object.entries(TRAINERS).map(([num, name]) => <option key={num} value={num}>{name}</option>)}
          </select>
        </div>

        <button onClick={generateCode} disabled={loading}
          style={{ width: "100%", background: loading ? C.greyDk : C.black, border: "none", color: C.white,
            padding: 14, fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", marginBottom: 8 }}>
          {loading ? "Generuję..." : "🔑 Generuj kod QR"}
        </button>

        {err && <div style={{ color: C.red, fontSize: 12, paddingTop: 8 }}>{err}</div>}
      </div>

      {/* Wynik — QR + kod tekstowy */}
      {result && qrDataUrl && (
        <div style={{ background: C.white, border: `3px solid ${C.green}`, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.greyDk, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>
            {mode === "special" ? "Szkolenie specjalne (ST)" : selectedTraining?.title}
          </div>
          <div style={{ fontSize: 11, color: C.greyMid, marginBottom: 16 }}>
            📅 {today} · 👤 {TRAINERS[selTrainer]}
          </div>

          {/* QR — duży, czytelny na projektorze */}
          <img src={qrDataUrl} alt="QR kod szkolenia"
            style={{ width: 280, height: 280, display: "block", margin: "0 auto 20px", imageRendering: "pixelated" }}/>

          {/* Separator */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, background: C.grey }}/>
            <span style={{ fontSize: 11, color: C.greyMid, whiteSpace: "nowrap" }}>lub wpisz kod ręcznie</span>
            <div style={{ flex: 1, height: 1, background: C.grey }}/>
          </div>

          {/* Kod tekstowy */}
          <div style={{ fontFamily: "monospace", fontSize: 26, fontWeight: 700, letterSpacing: 4, color: C.black, marginBottom: 12, wordBreak: "break-all" }}>
            {result.code}
          </div>

          <button onClick={copyCode} style={{
            background: copied ? C.green : C.greyBg, color: copied ? C.white : C.greyDk,
            border: `1px solid ${copied ? C.green : C.grey}`, padding: "8px 20px",
            fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .2s",
          }}>
            {copied ? "✓ Skopiowano" : "Kopiuj kod"}
          </button>

          <div style={{ fontSize: 11, color: C.greyMid, marginTop: 14, lineHeight: 1.6 }}>
            ⏱ Ważny tylko dziś (±1 dzień na strefy czasowe)<br/>
            🔒 Podpisany kryptograficznie — nie do podrobienia
          </div>
        </div>
      )}

      <div style={{ background: "#EBF5FB", border: `1px solid ${C.blue}`, padding: "10px 14px", fontSize: 11, color: C.greyDk, lineHeight: 1.6 }}>
        ℹ️ URL w QR: <strong>engel-eea.vercel.app</strong> — aby zmienić, ustaw <code>VITE_APP_URL</code> w Vercel
        oraz <code>APP_URL</code> w Supabase → Edge Functions → Settings.
      </div>
    </div>
  );
}

  const [mode,        setMode]        = useState("normal");
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

  function getCode() {
    const enc = getEnc();
    const short = mode === "special"
      ? "ST"
      : (TRAININGS.find(t => t.id === selTraining)?.short || selTraining.replace(/-/g,""));
    return `${short}${enc}${selTrainer}`;
  }

  function decodeForDisplay() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
  }

  const code  = getCode();
  const groupTrainings = TRAININGS.filter(t => t.group===selGroup);
  const short = mode === "special" ? "ST" : (TRAININGS.find(t => t.id === selTraining)?.short || selTraining.replace(/-/g,""));

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{background:C.white,padding:18,borderTop:`3px solid ${C.green}`}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:C.greyDk,marginBottom:14,textTransform:"uppercase"}}>Generator kodów szkoleniowych</div>

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

        <div style={{background:C.greyBg,border:`2px solid ${C.green}`,padding:16,marginBottom:8}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:C.greyMid,marginBottom:8}}>WYGENEROWANY KOD</div>
          <div style={{fontFamily:"monospace",fontSize:26,fontWeight:700,color:C.black,letterSpacing:4,marginBottom:10,wordBreak:"break-all"}}>{code}</div>
          <div style={{fontSize:11,color:C.greyMid,display:"flex",flexDirection:"column",gap:3}}>
            <span>📅 Data: <strong>{decodeForDisplay()}</strong> (ważny tylko dziś)</span>
            <span>🎓 Prefix: <strong>{short}</strong></span>
            <span>👤 Trener: <strong>{TRAINERS[selTrainer]}</strong></span>
          </div>
        </div>
        <button onClick={copyCode}
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
