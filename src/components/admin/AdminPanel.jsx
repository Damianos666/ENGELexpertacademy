import { useState } from "react";
import { C } from "../../lib/constants";
import { AdminMessages } from "./AdminMessages";
import { AdminTrainings } from "./AdminTrainings";
import { AdminSchedule } from "./AdminSchedule";

const LOGO_URL = "/logo.png";
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
