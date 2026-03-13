import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../lib/constants";
import { db } from "../lib/supabase";

/* ─── Stałe ─────────────────────────────────────────────────────────────── */
const LEVELS = [
  { id: "amator",  label: "Amator",  time: 15, base: 100, color: "#27AE60" },
  { id: "pro",     label: "PRO",     time: 10, base: 150, color: "#E67E22" },
  { id: "ekspert", label: "EKSPERT", time: 5,  base: 200, color: "#E74C3C" },
];

/* ─── Odliczanie 3-2-1 ───────────────────────────────────────────────────── */
function Countdown({ from = 3, onDone }) {
  const [n, setN] = useState(from);
  useEffect(() => {
    if (n <= 0) { onDone(); return; }
    const t = setTimeout(() => setN(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [n, onDone]);
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,gap:8}}>
      <div key={n} style={{
        fontSize:96,fontWeight:900,color:C.green,lineHeight:1,
        animation:"popIn .35s cubic-bezier(.175,.885,.32,1.275)",
      }}>{n || "GO!"}</div>
      <style>{`@keyframes popIn{from{transform:scale(0.4);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}

/* ─── Pasek timera ───────────────────────────────────────────────────────── */
function TimerBar({ maxTime, onTimeUp, running }) {
  const [left, setLeft] = useState(maxTime);
  const ref = useRef(null);

  useEffect(() => {
    setLeft(maxTime);
  }, [maxTime]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setLeft(p => {
        if (p <= 0.1) { clearInterval(interval); onTimeUp(); return 0; }
        return Math.max(0, p - 0.1);
      });
    }, 100);
    return () => clearInterval(interval);
  }, [running, onTimeUp]);

  const pct = (left / maxTime) * 100;
  const color = pct > 50 ? C.green : pct > 25 ? "#E67E22" : C.red;

  return (
    <div style={{margin:"0 0 12px"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:11,color:C.greyMid}}>Czas</span>
        <span style={{fontSize:13,fontWeight:700,color}}>{left.toFixed(1)}s</span>
      </div>
      <div style={{height:6,background:C.grey,borderRadius:3,overflow:"hidden"}}>
        <div ref={ref} style={{height:"100%",background:color,width:`${pct}%`,transition:"width .1s linear",borderRadius:3}}/>
      </div>
    </div>
  );
}

/* ─── Główny komponent quizu ─────────────────────────────────────────────── */
export function QuizGame({ token, user, onComplete, onClose }) {
  // fazy: category | difficulty | countdown | question | answer | between | result
  const [phase,      setPhase]      = useState("category");
  const [categories, setCategories] = useState([]);
  const [questions,  setQuestions]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  const [selCategory, setSelCategory] = useState(null);   // null = wszystkie
  const [level,       setLevel]       = useState(null);
  const [qIdx,        setQIdx]        = useState(0);
  const [score,       setScore]       = useState(0);
  const [chosen,      setChosen]      = useState(null);   // 'a'|'b'|'c'
  const [wasCorrect,  setWasCorrect]  = useState(null);
  const [timerKey,    setTimerKey]    = useState(0);      // reset timera
  const [timerRunning,setTimerRunning]= useState(false);
  const timeLeftRef   = useRef(0);
  const [countdownFor,setCountdownFor]= useState("question"); // "question"|"between"

  /* ── Załaduj kategorie ── */
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await db.get(token, "quiz_questions", "select=category&order=category.asc");
        const unique = [...new Set(data.map(q => q.category).filter(Boolean))];
        setCategories(unique);
      } catch(e) { setError("Błąd ładowania: " + e.message); }
      finally { setLoading(false); }
    }
    load();
  }, [token]);

  /* ── Załaduj pytania po wyborze kategorii i poziomu ── */
  async function startQuiz() {
    setLoading(true);
    try {
      const query = selCategory
        ? `category=eq.${encodeURIComponent(selCategory)}&order=created_at.asc&select=*`
        : "order=created_at.asc&select=*";
      const data = await db.get(token, "quiz_questions", query);
      if (!data.length) { setError("Brak pytań w tej kategorii."); setLoading(false); return; }
      // Tasuj pytania
      const shuffled = [...data].sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
      setQIdx(0);
      setScore(0);
      setPhase("countdown");
      setCountdownFor("question");
    } catch(e) { setError("Błąd ładowania pytań: " + e.message); }
    finally { setLoading(false); }
  }

  const currentQ = questions[qIdx];

  /* ── Użytkownik wybrał odpowiedź ── */
  function handleAnswer(ans) {
    if (chosen) return; // już odpowiedział
    setTimerRunning(false);
    setChosen(ans);
    const correct = ans === currentQ.correct;
    setWasCorrect(correct);
    if (correct) {
      const gained = Math.round(level.base * (timeLeftRef.current / level.time));
      setScore(p => p + Math.max(gained, 1));
      if (navigator.vibrate) navigator.vibrate([40, 30, 80]);
    } else {
      if (navigator.vibrate) navigator.vibrate(200);
    }
    setPhase("answer");
  }

  /* ── Czas minął bez odpowiedzi ── */
  const handleTimeUp = useCallback(() => {
    if (chosen) return;
    setTimerRunning(false);
    setChosen("__timeout__");
    setWasCorrect(false);
    setPhase("answer");
  }, [chosen]);

  /* ── Następne pytanie / zakończ ── */
  function goNext() {
    if (qIdx + 1 >= questions.length) {
      finishQuiz();
    } else {
      setChosen(null);
      setWasCorrect(null);
      setQIdx(p => p + 1);
      setPhase("countdown");
      setCountdownFor("question");
      setTimerKey(p => p + 1);
    }
  }

  /* ── Zakończ i zapisz ── */
  async function finishQuiz() {
    setPhase("result");
    const quizTitle = selCategory || "Quiz ogólny";
    const entry = {
      training: {
        id:       `QUIZ_${(selCategory || "ALL").replace(/\s+/g,"_")}`,
        title:    quizTitle,
        category: "quiz",
        duration: `${questions.length} pytań`,
        level:    1,
        group:    "tech",
        short:    "QUIZ",
        quizScore: score,
      },
      date:       new Date().toISOString().slice(0,10),
      key:        `QUIZ_${Date.now()}`,
      trainer:    null,
      trainerNum: null,
    };
    onComplete(entry);
  }

  /* ── Gdy odliczanie się skończy ── */
  function onCountdownDone() {
    if (countdownFor === "question") {
      setTimerRunning(true);
      setPhase("question");
    } else {
      goNext();
    }
  }

  /* ── Śledź pozostały czas dla punktacji ── */
  useEffect(() => {
    if (!timerRunning || !level) return;
    timeLeftRef.current = level.time;
    const iv = setInterval(() => {
      timeLeftRef.current = Math.max(0, timeLeftRef.current - 0.1);
    }, 100);
    return () => clearInterval(iv);
  }, [timerRunning, level, timerKey]);

  /* ── UI helpers ── */
  const answerLabels = { a: "A", b: "B", c: "C" };
  const answerKeys   = ["a","b","c"];

  function answerBtnStyle(key) {
    const base = {
      width:"100%", padding:"14px 16px", fontSize:14, fontWeight:600,
      border:"2px solid", borderRadius:8, cursor:"pointer", textAlign:"left",
      transition:"all .15s", marginBottom:10,
    };
    if (!chosen) return { ...base, background:C.white, borderColor:C.grey, color:C.black };
    if (key === currentQ.correct) return { ...base, background:"#EAFAF1", borderColor:C.green, color:"#1a7a40" };
    if (key === chosen && key !== currentQ.correct) return { ...base, background:"#FDEDEC", borderColor:C.red, color:C.red };
    return { ...base, background:C.greyBg, borderColor:C.grey, color:C.greyMid };
  }

  /* ════════════════════════ RENDER ════════════════════════ */

  const wrap = (children) => (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif"}}
      onClick={onClose}>
      <div style={{background:C.greyBg,width:"100%",maxWidth:390,maxHeight:"92dvh",borderRadius:16,boxShadow:"0 24px 64px rgba(0,0,0,.4)",display:"flex",flexDirection:"column",overflow:"hidden"}}
        onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{background:C.black,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,borderRadius:"16px 16px 0 0"}}>
          <span style={{color:C.white,fontWeight:700,fontSize:15}}>🎯 Quiz</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#aaa",fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",padding:18,gap:12}}>
          {children}
        </div>
      </div>
    </div>
  );

  /* Wybór kategorii */
  if (phase === "category") return wrap(
    <>
      <div style={{fontSize:16,fontWeight:700,color:C.black,marginBottom:4}}>Wybierz kategorię</div>
      {loading && <div style={{color:C.greyMid,fontSize:13}}>Ładowanie...</div>}
      {error  && <div style={{color:C.red,fontSize:13}}>{error}</div>}
      {[null, ...categories].map(cat => (
        <button key={cat ?? "__all__"}
          onClick={() => { setSelCategory(cat); setPhase("difficulty"); }}
          style={{padding:"14px 16px",background:C.white,border:`2px solid ${selCategory===cat?C.green:C.grey}`,borderRadius:8,fontSize:14,fontWeight:600,color:C.black,cursor:"pointer",textAlign:"left"}}>
          {cat ?? "🔀 Wszystkie kategorie"}
        </button>
      ))}
    </>
  );

  /* Wybór trudności */
  if (phase === "difficulty") return wrap(
    <>
      <div style={{fontSize:16,fontWeight:700,color:C.black,marginBottom:4}}>Poziom trudności</div>
      <div style={{fontSize:12,color:C.greyMid,marginBottom:8}}>
        Trudność wpływa na dostępny czas na odpowiedź i punkty bazowe.
      </div>
      {LEVELS.map(lv => (
        <button key={lv.id} onClick={() => { setLevel(lv); startQuiz(); }}
          style={{padding:"16px",background:C.white,border:`2px solid ${lv.color}`,borderRadius:8,cursor:"pointer",textAlign:"left",marginBottom:4}}>
          <div style={{fontSize:15,fontWeight:700,color:lv.color}}>{lv.label}</div>
          <div style={{fontSize:12,color:C.greyMid,marginTop:3}}>
            {lv.time}s na odpowiedź · {lv.base} pkt bazowych
          </div>
        </button>
      ))}
      <button onClick={() => setPhase("category")} style={{background:"none",border:"none",color:C.greyMid,fontSize:13,cursor:"pointer",marginTop:4}}>← Wróć</button>
    </>
  );

  /* Odliczanie */
  if (phase === "countdown") return wrap(
    <Countdown from={3} onDone={onCountdownDone}/>
  );

  /* Pytanie */
  if (phase === "question" && currentQ) return wrap(
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <span style={{fontSize:11,color:C.greyMid,fontWeight:600}}>
          Pytanie {qIdx+1}/{questions.length}
        </span>
        <span style={{fontSize:11,fontWeight:700,color:level.color,background:`${level.color}18`,padding:"2px 8px",borderRadius:4}}>
          {level.label}
        </span>
      </div>
      <TimerBar key={timerKey} maxTime={level.time} onTimeUp={handleTimeUp} running={timerRunning}/>
      <div style={{background:C.white,padding:"16px",borderRadius:8,fontSize:14,fontWeight:600,color:C.black,lineHeight:1.5,marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,.07)"}}>
        {currentQ.question}
      </div>
      {answerKeys.map(k => (
        <button key={k} onClick={() => handleAnswer(k)} style={answerBtnStyle(k)}>
          <span style={{color:C.greyMid,marginRight:10}}>{answerLabels[k]}.</span>
          {currentQ[`answer_${k}`]}
        </button>
      ))}
    </>
  );

  /* Wynik odpowiedzi */
  if (phase === "answer" && currentQ) return wrap(
    <>
      <div style={{
        padding:"16px",borderRadius:8,marginBottom:8,
        background: wasCorrect ? "#EAFAF1" : "#FDEDEC",
        border: `2px solid ${wasCorrect ? C.green : C.red}`,
        textAlign:"center",
      }}>
        <div style={{fontSize:32,marginBottom:6}}>{wasCorrect ? "✅" : "❌"}</div>
        <div style={{fontSize:15,fontWeight:700,color: wasCorrect ? "#1a7a40" : C.red}}>
          {wasCorrect ? "Poprawna odpowiedź!" : chosen === "__timeout__" ? "Czas minął!" : "Błędna odpowiedź"}
        </div>
        {!wasCorrect && (
          <div style={{fontSize:13,color:C.greyDk,marginTop:6}}>
            Prawidłowo: <strong>{answerLabels[currentQ.correct]}. {currentQ[`answer_${currentQ.correct}`]}</strong>
          </div>
        )}
      </div>

      <div style={{background:C.white,borderRadius:8,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:13,color:C.greyMid}}>Wynik</span>
        <span style={{fontSize:18,fontWeight:700,color:C.green}}>{score} pkt</span>
      </div>

      {qIdx + 1 < questions.length ? (
        <>
          <div style={{fontSize:13,color:C.greyMid,textAlign:"center",marginBottom:6}}>Gotowy na kolejne pytanie?</div>
          <button onClick={() => { setPhase("countdown"); setCountdownFor("question"); setChosen(null); setWasCorrect(null); setQIdx(p=>p+1); setTimerKey(p=>p+1); }}
            style={{padding:"14px",background:C.green,border:"none",borderRadius:8,color:C.white,fontSize:14,fontWeight:700,cursor:"pointer",width:"100%"}}>
            Następne →
          </button>
        </>
      ) : (
        <button onClick={finishQuiz}
          style={{padding:"14px",background:C.green,border:"none",borderRadius:8,color:C.white,fontSize:14,fontWeight:700,cursor:"pointer",width:"100%"}}>
          Zobacz wynik 🏆
        </button>
      )}
    </>
  );

  /* Wynik końcowy */
  if (phase === "result") return wrap(
    <>
      <div style={{textAlign:"center",padding:"16px 0 8px"}}>
        <div style={{fontSize:48,marginBottom:8}}>🏆</div>
        <div style={{fontSize:20,fontWeight:700,color:C.black}}>Quiz zakończony!</div>
        <div style={{fontSize:13,color:C.greyMid,marginTop:4}}>{selCategory || "Wszystkie kategorie"}</div>
      </div>

      <div style={{background:C.white,borderRadius:8,padding:18,textAlign:"center",boxShadow:"0 1px 3px rgba(0,0,0,.07)"}}>
        <div style={{fontSize:13,color:C.greyMid,marginBottom:4}}>Łączny wynik</div>
        <div style={{fontSize:48,fontWeight:900,color:C.green,lineHeight:1}}>{score}</div>
        <div style={{fontSize:13,color:C.greyMid,marginTop:4}}>punktów</div>
      </div>

      <div style={{background:C.white,borderRadius:8,padding:"12px 18px",display:"flex",justifyContent:"space-between"}}>
        <span style={{fontSize:13,color:C.greyMid}}>Pytania</span>
        <span style={{fontSize:13,fontWeight:700}}>{questions.length}</span>
      </div>
      <div style={{background:C.white,borderRadius:8,padding:"12px 18px",display:"flex",justifyContent:"space-between"}}>
        <span style={{fontSize:13,color:C.greyMid}}>Poziom</span>
        <span style={{fontSize:13,fontWeight:700,color:level.color}}>{level.label}</span>
      </div>

      <div style={{fontSize:11,color:C.greyMid,textAlign:"center"}}>
        Wynik zapisany w historii szkoleń ✓
      </div>

      <button onClick={onClose}
        style={{padding:"14px",background:C.black,border:"none",borderRadius:8,color:C.white,fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",marginTop:4}}>
        Zamknij
      </button>
    </>
  );

  return null;
}
