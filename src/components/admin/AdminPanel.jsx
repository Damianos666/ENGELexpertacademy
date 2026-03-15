import { useState } from "react";
import { C } from "../../lib/constants";
import { AdminMessages } from "./AdminMessages";
import { AdminTrainings } from "./AdminTrainings";
import { AdminSchedule } from "./AdminSchedule";
import { useUser } from "../../lib/UserContext";

const LOGO_URL = "/logo.png";
const ADMIN_TABS = [["Terminarz","📅"],["Wiadomości","✉"],["Edytor szkoleń","📋"]];

// Style poza komponentem — nie tworzą się co render
const tabStyles = {
  container: { height: "100%", display: "flex", flexDirection: "column", fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif", background: "#EFEFEF", overflow: "hidden" },
  header:    { background: "#2C2C2C", paddingTop: "calc(12px + env(safe-area-inset-top, 0px))", paddingBottom: "12px", paddingLeft: "16px", paddingRight: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, boxSizing: "border-box" },
  greenBar:  { height: 3, background: "#8AB73E", flexShrink: 0 },
  tabBar:    { display: "flex", background: "#FFFFFF", borderBottom: "1px solid #E8E8E8", flexShrink: 0 },
  content:   { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", WebkitOverflowScrolling: "touch", paddingBottom: "env(safe-area-inset-bottom,0px)", position: "relative" },
  // Zakładka widoczna — scrolluje się wewnętrznie
  tabVisible: { display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch" },
  // Zakładka ukryta — display:none zamiast conditional render
  // NAPRAWA: W oryginalnym AdminPanel było {tab===0 && <AdminSchedule/>} co niszczyło
  // stan (formularze, filtry, zaznaczenia) przy każdym przejściu między zakładkami.
  // display:none zachowuje DOM i stan, dokładnie jak w widoku klienta.
  tabHidden:  { display: "none",  flexDirection: "column", height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch" },
};

export function AdminPanel({ onLogout }) {
  const [tab, setTab] = useState(0);
  const { user } = useUser();  // token z kontekstu — nie przez props

  return (
    <div className="app-container" style={tabStyles.container}>
      {/* HEADER */}
      <div style={tabStyles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={LOGO_URL} alt="ENGEL" style={{ height: 22, mixBlendMode: "screen" }}/>
          <span style={{ color: "#8AB73E", fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>ADMIN</span>
        </div>
        <button onClick={onLogout} style={{ background: "none", border: "1px solid rgba(255,255,255,.3)", color: "#ccc", padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          Wyloguj
        </button>
      </div>
      <div style={tabStyles.greenBar}/>

      {/* TAB BAR */}
      <div style={tabStyles.tabBar}>
        {ADMIN_TABS.map(([label, icon], i) => (
          <button key={i} onClick={() => setTab(i)}
            style={{ flex: 1, background: "none", border: "none", borderBottom: `3px solid ${tab === i ? "#8AB73E" : "transparent"}`, padding: "10px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer" }}>
            <span style={{ fontSize: 16, color: tab === i ? "#1A1A1A" : "#A0A0A0" }}>{icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: tab === i ? "#1A1A1A" : "#A0A0A0", letterSpacing: .5, textTransform: "uppercase" }}>{label}</span>
          </button>
        ))}
      </div>

      {/* TREŚĆ ZAKŁADEK — display:none zamiast conditional render */}
      <div style={tabStyles.content}>
        <div style={tab === 0 ? tabStyles.tabVisible : tabStyles.tabHidden}>
          <AdminSchedule/>
        </div>
        <div style={tab === 1 ? tabStyles.tabVisible : tabStyles.tabHidden}>
          <AdminMessages/>
        </div>
        <div style={tab === 2 ? tabStyles.tabVisible : tabStyles.tabHidden}>
          <AdminTrainings/>
        </div>
      </div>
    </div>
  );
}
