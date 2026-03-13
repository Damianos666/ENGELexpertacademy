import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { C, GROUPS, ADMIN_EMAIL } from "./lib/constants";
import { TRAININGS } from "./data/trainings";
import { auth, db, session } from "./lib/supabase";
import { calcProgress } from "./lib/helpers";
import { LangProvider } from "./lib/LangContext";
import { Header } from "./components/SharedUI";
import { LoginScreen } from "./components/Login";
import { TrainingTab } from "./components/TrainingTab";
import { CatalogTab } from "./components/CatalogTab";
import { ScheduleTab } from "./components/ScheduleTab";
import { MessagesTab } from "./components/MessagesTab";
import { ProfileTab } from "./components/ProfileTab";
import { TrainerScheduleTab } from "./components/TrainerScheduleTab";
import { AdminPanel, AdminCodeGen, AdminQuiz } from "./components/AdminPanel";
import { TabBar } from "./components/TabBar";

// Stałe zdefiniowane poza komponentem — nowy obiekt nie powstaje przy każdym renderze
const TRAINER_TABS = [
  ["Terminarz", "📅"],
  ["Kody",       "🔑"],
  ["Wiadomości", "✉"],
  ["Quiz",       "🎯"],
  ["Profil",     "⚙"],
];

export default function App() {
  const [user,         setUserRaw]       = useState(null);
  const [tab,          setTab]           = useState(0);
  const [completed,    setCompleted]     = useState([]);
  const [activeGroups, setActiveGroups]  = useState(["tech","ur","maszyny"]);
  const [notifReminder,setNotifReminder] = useState(true);
  const [notifCert,    setNotifCert]     = useState(true);
  const [dataLoading,  setDataLoading]   = useState(false);
  const [msgCount,     setMsgCount]      = useState(0);
  const lastMsgAt      = useRef(null);
  const pollInterval   = useRef(null);

  function requestNotifPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  const checkMessages = useCallback(async (token) => {
    if (!token) return;
    try {
      const msgs = await db.get(token, "messages", "order=created_at.desc&select=id,created_at,title&limit=20");
      setMsgCount(msgs.length);
      if (!msgs.length) return;
      const newestAt = msgs[0].created_at;
      if (lastMsgAt.current && newestAt > lastMsgAt.current) {
        const newMsgs = msgs.filter(m => m.created_at > lastMsgAt.current);
        if ("Notification" in window && Notification.permission === "granted") {
          newMsgs.forEach(m => {
            new Notification("📬 ENGEL Expert Academy", {
              body: m.title,
              icon: "/pwa-192.png",
              badge: "/pwa-192.png",
              tag: `msg-${m.id}`,
              renotify: true,
            });
          });
        }
      }
      lastMsgAt.current = newestAt;
    } catch { /* cicho ignoruj błędy */ }
  }, []);

  // ── Sprawdza przy logowaniu i raz na dobę ─────────────────────────────────
  useEffect(() => {
    if (!user) {
      if (pollInterval.current) { clearInterval(pollInterval.current); pollInterval.current = null; }
      lastMsgAt.current = null;
      return;
    }
    requestNotifPermission();
    checkMessages(user.accessToken);
    pollInterval.current = setInterval(() => checkMessages(user.accessToken), 24 * 60 * 60_000);
    return () => { if (pollInterval.current) clearInterval(pollInterval.current); };
  }, [user, checkMessages]);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [trainerView,      setTrainerViewRaw]    = useState("client");
  // trainingOverrides trzyma nadpisania z Supabase — NIE mutujemy globalnego TRAININGS
  const [trainingOverrides, setTrainingOverrides] = useState({});

  const setTrainerView = useCallback(async (v) => {
    setTrainerViewRaw(v);
    setTab(0);
    try {
      await db.update(user.accessToken, "profiles", `id=eq.${user.id}`, { trainer_view: v });
    } catch(e) { console.error("[TRAINER VIEW] save error:", e.message); }
  }, [user]);

  // ── Przy starcie: spróbuj odtworzyć sesję z localStorage ──────────────────
  useEffect(() => {
    async function restoreSession() {
      const saved = session.load();
      if (!saved?.refreshToken) {
        setSessionChecked(true);
        return;
      }
      try {
        const refreshed = await auth.refreshSession(saved.refreshToken);
        // Zapisz nowe tokeny (refresh_token rotuje przy każdym odświeżeniu)
        session.save(refreshed.access_token, refreshed.refresh_token, refreshed.user);
        await handleLogin({
          id:          refreshed.user.id,
          accessToken: refreshed.access_token,
          email:       refreshed.user.email,
          _skipSessionSave: true, // już zapisane powyżej
        });
      } catch {
        // Token wygasł lub nieprawidłowy — wyczyść i pokaż ekran logowania
        session.clear();
      } finally {
        setSessionChecked(true);
      }
    }
    restoreSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = useCallback(async (rawUser) => {
    setDataLoading(true);
    try {
      console.log("[LOGIN] user.id =", rawUser.id, "| token preview:", rawUser.accessToken?.slice(0,20));

      let profile = null;
      try {
        const profiles = await db.get(rawUser.accessToken, "profiles", `id=eq.${rawUser.id}&select=*`);
        console.log("[LOGIN] profile from DB:", profiles);
        profile = profiles[0] || null;
      } catch(e) {
        console.error("[LOGIN] ERROR loading profile:", e.message);
      }

      const u = {
        id:           rawUser.id,
        email:        rawUser.email,
        accessToken:  rawUser.accessToken,
        name:         profile?.name         || rawUser.name         || rawUser.email,
        login:        profile?.login        || rawUser.login        || rawUser.email,
        role:         profile?.role         || rawUser.role         || null,
        firma:        profile?.firma        || rawUser.firma        || null,
        active_groups: profile?.active_groups || rawUser.active_groups || ["tech","ur","maszyny"],
        notif_reminder: profile?.notif_reminder ?? rawUser.notif_reminder ?? true,
        notif_cert:     profile?.notif_cert    ?? rawUser.notif_cert    ?? true,
        trainer_id:     profile?.trainer_id    ?? rawUser.trainer_id    ?? null,
        trainer_view:   profile?.trainer_view   ?? "client",
      };
      u.displayName = u.name;
      u.displayRole = u.role || "";

      setUserRaw(u);

      if (Array.isArray(u.active_groups) && u.active_groups.length)
        setActiveGroups(u.active_groups);
      setNotifReminder(u.notif_reminder);
      setNotifCert(u.notif_cert);
      setTrainerViewRaw(u.trainer_view || "client");

      const comps = await db.get(u.accessToken, "completions", `user_id=eq.${u.id}&order=created_at.asc&select=*`);
      console.log("[LOGIN] completions loaded:", comps.length, comps);
      setCompleted(comps.map(c => ({ training:c.training_data, date:c.date, key:c.code_key, trainer:c.trainer||null, trainerNum:parseInt(c.code_key?.slice(-1))||1 })));

      // Overrides trafiają do stanu — NIE mutujemy globalnego modułu TRAININGS,
      // bo mutacja pozostaje między sesjami różnych użytkowników.
      try {
        const overrides = await db.get(u.accessToken, "training_overrides", "select=*");
        const overridesMap = {};
        overrides.forEach(ov => { overridesMap[ov.training_id] = ov; });
        setTrainingOverrides(overridesMap);
      } catch {}

    } catch(e) {
      console.error("[LOGIN] ERROR loading data:", e.message, e);
    }
    finally { setDataLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleComplete = useCallback(async (entry) => {
    setCompleted(p => {
      const filtered = p.filter(c => c.training.id !== entry.training.id);
      return [...filtered, entry];
    });
    try {
      const payload = {
        user_id: user.id,
        training_id: entry.training.id,
        training_data: entry.training,
        date: entry.date,
        code_key: entry.key,
        trainer: entry.trainer || null,
      };
      const existing = await db.get(user.accessToken, "completions", `user_id=eq.${user.id}&training_id=eq.${entry.training.id}&select=id`);
      if (existing && existing.length > 0) {
        const res = await db.update(user.accessToken, "completions", `user_id=eq.${user.id}&training_id=eq.${entry.training.id}`, payload);
        console.log("[COMPLETE] updated:", res);
        if (!res || res.length === 0) {
          alert("⚠️ BŁĄD ZAPISU: UPDATE nie zapisał danych. Sprawdź RLS w Supabase — tabela completions wymaga polityki UPDATE dla zalogowanych użytkowników.");
        }
      } else {
        const res = await db.insert(user.accessToken, "completions", payload);
        console.log("[COMPLETE] inserted:", res);
        if (!res || res.length === 0) {
          alert("⚠️ BŁĄD ZAPISU: INSERT nie zapisał danych. Sprawdź RLS w Supabase — tabela completions wymaga polityki INSERT dla zalogowanych użytkowników.");
        }
      }
    } catch(e) {
      console.error("[COMPLETE] ERROR saving:", e.message, e);
      alert("⚠️ BŁĄD ZAPISU: " + e.message);
    }
  }, [user]);

  const handleLogout = useCallback(async () => {
    try { await auth.signOut(user?.accessToken); } catch {}
    localStorage.removeItem("eea_trainer_view");
    setUserRaw(null); setCompleted([]); setTab(0); setMsgCount(0);
    setTrainerViewRaw("client");
    setTrainingOverrides({});
    setActiveGroups(["tech","ur","maszyny"]); setNotifReminder(true); setNotifCert(true);
  }, [user]);

  const progress = useMemo(
    () => calcProgress(completed, activeGroups),
    [completed, activeGroups]
  );
  const bannerSub = useMemo(
    () => [user?.displayRole, user?.firma].filter(Boolean).join(" · "),
    [user?.displayRole, user?.firma]
  );

  // Jeden LangProvider owijający całe drzewo — nie resetuje stanu języka przy przełączaniu gałęzi
  return (
    <LangProvider>
      <AppContent
        sessionChecked={sessionChecked}
        user={user}
        setUserRaw={setUserRaw}
        tab={tab}
        setTab={setTab}
        completed={completed}
        activeGroups={activeGroups}
        setActiveGroups={setActiveGroups}
        notifReminder={notifReminder}
        notifCert={notifCert}
        setNotifReminder={setNotifReminder}
        setNotifCert={setNotifCert}
        dataLoading={dataLoading}
        msgCount={msgCount}
        trainerView={trainerView}
        setTrainerView={setTrainerView}
        progress={progress}
        bannerSub={bannerSub}
        handleLogin={handleLogin}
        handleComplete={handleComplete}
        handleLogout={handleLogout}
      />
    </LangProvider>
  );
}

function AppContent({
  sessionChecked, user, setUserRaw, tab, setTab,
  completed, activeGroups, setActiveGroups,
  notifReminder, notifCert, setNotifReminder, setNotifCert,
  dataLoading, msgCount, trainerView, setTrainerView,
  progress, bannerSub,
  handleLogin, handleComplete, handleLogout,
}) {
  if (!sessionChecked) return (
    <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:C.greyBg,fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:40,height:40,border:`3px solid ${C.grey}`,borderTopColor:C.green,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 16px"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <span style={{color:C.greyDk,fontSize:14}}>Ładowanie...</span>
      </div>
    </div>
  );

  if (!user) return <LoginScreen onLogin={handleLogin}/>;

  if (user.email === ADMIN_EMAIL) return (
    <AdminPanel user={user} onLogout={handleLogout}/>
  );

  const isTrainer = user.trainer_id != null;
  const inTrainerView = isTrainer && trainerView === "trainer";

  if (inTrainerView) return (
    <div className="app-container" style={{height:"100%",display:"flex",flexDirection:"column",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",background:C.greyBg,overflow:"hidden"}}>
      <Header onLogout={handleLogout}/>
      <div style={{background:C.greyBanner,borderBottom:`1px solid #D0D3D6`,padding:"9px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:13,color:C.greyDk,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginRight:8}}>
          {user.displayName}{bannerSub ? ` · ${bannerSub}` : ""}
        </span>
        <span style={{fontSize:11,fontWeight:700,color:C.green,flexShrink:0,background:C.greenBg,padding:"2px 8px",borderRadius:4}}>TRENER</span>
      </div>
      <div className="app-content" style={{flex:1,minHeight:0,overflowY:"auto",WebkitOverflowScrolling:"touch",display:"flex",flexDirection:"column",paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
        {tab===0 && <TrainerScheduleTab token={user.accessToken} trainerNum={user.trainer_id}/>}
        {tab===1 && <AdminCodeGen defaultTrainer={user.trainer_id}/>}
        {tab===2 && <MessagesTab token={user.accessToken} userEmail={user.email} user={user}/>}
        {tab===3 && <AdminQuiz token={user.accessToken}/>}
        {tab===4 && <ProfileTab user={user} setUser={setUserRaw} completed={completed} activeGroups={activeGroups} setActiveGroups={setActiveGroups} onLogout={handleLogout} trainerView={trainerView} setTrainerView={setTrainerView}/>}
      </div>
      <div className="tabbar" style={{display:"flex",background:C.white,borderTop:`1px solid ${C.grey}`,flexShrink:0}}>
        {TRAINER_TABS.map(([label,icon],i) => (
          <button key={i} onClick={() => setTab(i)}
            style={{flex:1,background:"none",border:"none",borderTop:`3px solid ${tab===i?C.green:"transparent"}`,padding:"8px 2px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",position:"relative"}}>
            {i===2 && msgCount>0 && <div style={{position:"absolute",top:4,right:"calc(50% - 16px)",background:C.red,color:C.white,borderRadius:"50%",width:15,height:15,fontSize:8,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{msgCount}</div>}
            <span style={{fontSize:16,color:tab===i?C.black:C.greyMid}}>{icon}</span>
            <span style={{fontSize:10,fontWeight:600,color:tab===i?C.black:C.greyMid,letterSpacing:.2}}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="app-container" style={{height:"100%",display:"flex",flexDirection:"column",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",background:C.greyBg,overflow:"hidden"}}>
      <Header onLogout={handleLogout}/>
      <div style={{background:C.greyBanner,borderBottom:`1px solid #D0D3D6`,padding:"9px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:13,color:C.greyDk,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginRight:8}}>
          {user.displayName}{bannerSub ? ` · ${bannerSub}` : ""}
        </span>
        {progress.active && <span style={{fontSize:13,fontWeight:700,color:C.green,flexShrink:0}}>{progress.pct}% ukończone</span>}
      </div>
      <div className="app-content" style={{flex:1,minHeight:0,overflowY:"auto",WebkitOverflowScrolling:"touch",display:"flex",flexDirection:"column",paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
        {tab===0 && <TrainingTab user={user} completed={completed} onComplete={handleComplete} activeGroups={activeGroups} loading={dataLoading}/>}
        {tab===1 && <CatalogTab  completed={completed} activeGroups={activeGroups}/>}
        {tab===2 && <ScheduleTab activeGroups={activeGroups} token={user.accessToken} trainerNum={user.trainer_id}/>}
        {tab===3 && <MessagesTab token={user.accessToken} userEmail={user.email} user={user}/>}
        {tab===4 && <ProfileTab  user={user} setUser={setUserRaw} completed={completed} activeGroups={activeGroups} setActiveGroups={setActiveGroups} onLogout={handleLogout} trainerView={trainerView} setTrainerView={setTrainerView}/>}
      </div>
      <TabBar tab={tab} setTab={setTab} completedCount={completed.length} msgCount={msgCount}/>
    </div>
  );
}