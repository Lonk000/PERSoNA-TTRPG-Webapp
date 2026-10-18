import { useCallback, useEffect, useRef, useState, type ChangeEvent, type MouseEvent, type ReactNode } from "react";
import { addPlayer, getCampaign, patchPlayer, removePlayer, saveCampaign, uploadImage } from "./api";

type Mode = "combat" | "roam" | "map";
type Role = "gm" | "player";
type Player = { id: string; name: string; role: string; hp: number; sp: number; initial: string; art?: string; personaArt?: string };
type ShadowData = { id: string; name: string; hp: number; threat: number; status: string; sprite?: string; x?: number; y?: number; width?: number; height?: number };
type Point = { title: string; detail: string };
type Pin = { id: string; x: number; y: number; label: string; tooltip: string };
type Campaign = {
  calendar: { month: number; season: number; selectedDay: number; weekStart: number };
  players: Player[];
  shadows: ShadowData[];
  battle: { background: string; objective: string; round: number };
  roam: { background: string; location: string; details: string; points: Point[] };
  map: { background: string; pins: Pin[] };
};

const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];

function Login({ onReady }: { onReady: (selectedRole: Role) => void }) {
  const [selectedRole, setSelectedRole] = useState<Role>("player");
  return (
    <main className="login-screen">
      <div className="noise" />
      <section className="login-card">
        <div className="login-mark">RP</div>
        <span>SHARED CAMPAIGN TABLE</span>
        <strong>CHOOSE YOUR ROLE</strong>
        <p>Select whether you are joining as the Game Master (GM) or a Player Character (PC).</p>
        <div className="role-selector-options" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", margin: "20px 0" }}>
          <button type="button" onClick={() => setSelectedRole("gm")} style={{ padding: "16px", border: "3px solid var(--ink)", background: selectedRole === "gm" ? "var(--mint)" : "var(--paper)", color: "var(--ink)", fontFamily: "Bebas Neue", fontSize: "20px", cursor: "pointer", boxShadow: selectedRole === "gm" ? "4px 4px 0 var(--ink)" : "none" }}>GM (GAME MASTER)</button>
          <button type="button" onClick={() => setSelectedRole("player")} style={{ padding: "16px", border: "3px solid var(--ink)", background: selectedRole === "player" ? "var(--mint)" : "var(--paper)", color: "var(--ink)", fontFamily: "Bebas Neue", fontSize: "20px", cursor: "pointer", boxShadow: selectedRole === "player" ? "4px 4px 0 var(--ink)" : "none" }}>PC (PLAYER)</button>
        </div>
        <button type="button" onClick={() => onReady(selectedRole)}>ENTER CAMPAIGN</button>
      </section>
    </main>
  );
}

function StepControl({ label, value, disabled, previous, next }: { label: string; value: string; disabled: boolean; previous: () => void; next: () => void }) {
  return <div className="step-control"><button disabled={disabled} onClick={previous}>‹</button><div><span>{label}</span><strong>{value}</strong></div><button disabled={disabled} onClick={next}>›</button></div>;
}

function Mark({ children }: { children: React.ReactNode }) {
  return <span className="mark">{children}</span>;
}

// Photoshop-style interactive transform box for moving and resizing elements
function TransformBox({ x = 10, y = 10, width = 160, height = 200, disabled, onUpdate, children }: { x?: number; y?: number; width?: number; height?: number; disabled: boolean; onUpdate: (box: { x: number; y: number; width: number; height: number }) => void; children: ReactNode }) {
  const [pos, setPos] = useState({ x, y, width, height });
  const isDragging = useRef(false);
  const resizeHandle = useRef<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setPos({ x, y, width, height });
  }, [x, y, width, height]);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>, handle: string | null = null) => {
    if (disabled) return;
    e.stopPropagation();
    isDragging.current = true;
    resizeHandle.current = handle;
    dragStart.current = { x: e.clientX, y: e.clientY };

    const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
      if (!isDragging.current) return;
      const dx = moveEvent.clientX - dragStart.current.x;
      const dy = moveEvent.clientY - dragStart.current.y;
      dragStart.current = { x: moveEvent.clientX, y: moveEvent.clientY };

      setPos((prev) => {
        let next = { ...prev };
        if (!resizeHandle.current) {
          next.x += dx;
          next.y += dy;
        } else {
          if (resizeHandle.current.includes("right")) next.width = Math.max(60, next.width + dx);
          if (resizeHandle.current.includes("bottom")) next.height = Math.max(60, next.height + dy);
          if (resizeHandle.current.includes("left")) {
            next.width = Math.max(60, next.width - dx);
            next.x += dx;
          }
          if (resizeHandle.current.includes("top")) {
            next.height = Math.max(60, next.height - dy);
            next.y += dy;
          }
        }
        return next;
      });
    };

    const onMouseUp = () => {
      isDragging.current = false;
      resizeHandle.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      setPos((p) => {
        onUpdate(p);
        return p;
      });
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div style={{ position: "absolute", left: `${pos.x}px`, top: `${pos.y}px`, width: `${pos.width}px`, height: `${pos.height}px`, cursor: disabled ? "default" : "move" }} onMouseDown={(e) => handleMouseDown(e, null)}>
      {children}
      {!disabled && (
        <div className="transform-overlay" style={{ position: "absolute", inset: "-4px", border: "2px dashed var(--mint)", pointerEvents: "none", zIndex: 10 }}>
          <div onMouseDown={(e) => handleMouseDown(e, "top-left")} style={{ position: "absolute", top: -5, left: -5, width: 10, height: 10, background: "var(--ink)", border: "2px solid var(--mint)", pointerEvents: "auto", cursor: "nwse-resize" }} />
          <div onMouseDown={(e) => handleMouseDown(e, "top-right")} style={{ position: "absolute", top: -5, right: -5, width: 10, height: 10, background: "var(--ink)", border: "2px solid var(--mint)", pointerEvents: "auto", cursor: "nesw-resize" }} />
          <div onMouseDown={(e) => handleMouseDown(e, "bottom-left")} style={{ position: "absolute", bottom: -5, left: -5, width: 10, height: 10, background: "var(--ink)", border: "2px solid var(--mint)", pointerEvents: "auto", cursor: "nesw-resize" }} />
          <div onMouseDown={(e) => handleMouseDown(e, "bottom-right")} style={{ position: "absolute", bottom: -5, right: -5, width: 10, height: 10, background: "var(--ink)", border: "2px solid var(--mint)", pointerEvents: "auto", cursor: "nwse-resize" }} />
        </div>
      )}
    </div>
  );
}

function App() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [role, setRole] = useState<Role>("player");
  const [mode, setMode] = useState<Mode>("combat");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [notice, setNotice] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const isGm = role === "gm";

  const load = useCallback(async (forcedRole?: Role) => {
    try {
      const result = await getCampaign();
      setCampaign(result.campaign);
      if (forcedRole) setRole(forcedRole);
      else if (result.role) setRole(result.role);
      setAuthenticated(true);
    } catch {
      setAuthenticated(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!authenticated) return;
    const timer = setInterval(() => { if (!dirty.current) load(); }, 4000);
    return () => clearInterval(timer);
  }, [authenticated, load]);

  const updateGm = (mutate: (next: Campaign) => void) => {
    if (!campaign || !isGm) return;
    const next = structuredClone(campaign);
    mutate(next);
    setCampaign(next);
    dirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveCampaign(next);
        setNotice("SAVED");
      } catch (reason) {
        setNotice(reason instanceof Error ? reason.message : "SAVE FAILED");
      } finally {
        dirty.current = false;
      }
    }, 450);
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>, scope: "gm" | "player", apply: (url: string) => void | Promise<void>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setNotice("UPLOADING");
    try {
      const result = await uploadImage(file, scope);
      await apply(result.url);
      setNotice("SAVED");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "UPLOAD FAILED");
    }
  };

  const moveShadow = (index: number, direction: "left" | "right") => {
    updateGm((next) => {
      const targetIndex = direction === "left" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.shadows.length) return;
      const temp = next.shadows[index];
      next.shadows[index] = next.shadows[targetIndex];
      next.shadows[targetIndex] = temp;
    });
  };

  const addShadow = () => {
    updateGm((next) => {
      next.shadows.push({ id: crypto.randomUUID(), name: `Shadow ${next.shadows.length + 1}`, hp: 100, threat: 1, status: "Normal", x: 40 + next.shadows.length * 20, y: 30, width: 140, height: 180 });
    });
  };

  if (authenticated === null) return <main className="loading-screen">LOADING CAMPAIGN…</main>;
  if (!authenticated) return <Login onReady={(chosenRole) => { setRole(chosenRole); setAuthenticated(true); load(chosenRole); }} />;
  if (!campaign) return <main className="loading-screen">SYNCING SHARED STATE…</main>;

  const c = campaign;

  return (
    <main className="app-shell">
      <div className="noise" />
      <header className="calendar-bar">
        <StepControl label="SEASON" value={seasons[c.calendar.season]} disabled={!isGm} previous={() => updateGm((next) => { next.calendar.season = (next.calendar.season + 3) % 4; })} next={() => updateGm((next) => { next.calendar.season = (next.calendar.season + 1) % 4; })} />
        <StepControl label="MONTH" value={months[c.calendar.month]} disabled={!isGm} previous={() => updateGm((next) => { next.calendar.month = (next.calendar.month + 11) % 12; next.calendar.weekStart = 1; next.calendar.selectedDay = 0; })} next={() => updateGm((next) => { next.calendar.month = (next.calendar.month + 1) % 12; next.calendar.weekStart = 1; next.calendar.selectedDay = 0; })} />
        <div className="week-shell">
          <button className="week-arrow" disabled={!isGm} onClick={() => updateGm((next) => next.calendar.weekStart = Math.max(1, next.calendar.weekStart - 7))}>‹</button>
          <div className="week-strip">
            {weekdays.map((day, index) => {
              const dayNum = c.calendar.weekStart + index;
              const isValidDay = dayNum <= 31;
              return <button disabled={!isGm || !isValidDay} className={`day ${c.calendar.selectedDay === index ? "active" : ""}`} onClick={() => updateGm((next) => next.calendar.selectedDay = index)} key={day}><span>{day}</span><strong>{isValidDay ? dayNum : ""}</strong></button>;
            })}
          </div>
          <button className="week-arrow" disabled={!isGm} onClick={() => updateGm((next) => next.calendar.weekStart = Math.min(22, next.calendar.weekStart + 7))}>›</button>
        </div>
        <div className="session-chip"><span>{role.toUpperCase()}</span><strong>{notice || "LIVE"}</strong><button onClick={() => setAuthenticated(false)}>SWITCH ROLE</button></div>
      </header>

      <div className="content">
        <section className="map-panel">
          <div className="encounter-toolbar">
            <div className="panel-kicker"><span>01</span><div><small>SHARED SCENE</small><strong>{mode === "combat" ? "ENCOUNTER" : mode === "roam" ? c.roam.location : "CAMPAIGN MAP"}</strong></div></div>
            <div className="mode-switcher">{(["combat", "roam", "map"] as Mode[]).map((item) => <button className={mode === item ? "active" : ""} onClick={() => setMode(item)} key={item}>{item === "roam" ? "FREE ROAM" : item.toUpperCase()}</button>)}</div>
          </div>

          <div className={`map-frame mode-${mode}`}>
            {mode === "combat" && <div className={`dungeon-scene ${c.battle.background ? "custom-bg" : ""}`} style={c.battle.background ? { backgroundImage: `url(${c.battle.background})` } : undefined}>
              {!c.battle.background && <><div className="ceiling-lines" /><div className="corridor-end"><span /><span /></div><div className="floor-grid" /></>}
              {c.shadows.map((shadow, index) => (
                <TransformBox key={shadow.id} x={shadow.x ?? (50 + index * 120)} y={shadow.y ?? 100} width={shadow.width ?? 140} height={shadow.height ?? 190} disabled={!isGm} onUpdate={(box) => updateGm((next) => { next.shadows[index].x = box.x; next.shadows[index].y = box.y; next.shadows[index].width = box.width; next.shadows[index].height = box.height; })}>
                  <div className="enemy-unit" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
                    <div className="enemy-name"><input disabled={!isGm} value={shadow.name} onChange={(event) => updateGm((next) => next.shadows[index].name = event.target.value)} /><div className="enemy-hp"><i style={{ width: `${shadow.hp}%` }} /><span>{shadow.hp} HP</span></div></div>
                    <div className={`shadow-figure ${shadow.sprite ? "has-sprite" : ""}`} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                      {shadow.sprite ? <img src={shadow.sprite} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <><i className="horn left" /><i className="horn right" /><span className="shadow-head"><b /><b /></span><span className="shadow-body" /><i className="shadow-arm left" /><i className="shadow-arm right" /><i className="shadow-leg left" /><i className="shadow-leg right" /></>}
                    </div>
                    {isGm && <label className="background-upload change-sprite-btn" style={{ padding: "4px", fontSize: "10px", textAlign: "center", cursor: "pointer", background: "var(--mint)", color: "var(--ink)", border: "2px solid var(--ink)" }}><strong>CHANGE IMAGE</strong><input type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => upload(event, "gm", (url) => updateGm((next) => next.shadows[index].sprite = url))} /></label>}
                    <div className="enemy-status"><span>TL</span><input disabled={!isGm} type="number" value={shadow.threat} onChange={(event) => updateGm((next) => next.shadows[index].threat = Number(event.target.value))} /><input disabled={!isGm} value={shadow.status} onChange={(event) => updateGm((next) => next.shadows[index].status = event.target.value)} /></div>
                    {isGm && <div className="shadow-controls" style={{ display: "flex", gap: "4px", marginTop: "4px" }}><button type="button" onClick={() => moveShadow(index, "left")} disabled={index === 0}>‹</button><button type="button" onClick={() => updateGm((next) => next.shadows.splice(index, 1))}>×</button><button type="button" onClick={() => moveShadow(index, "right")} disabled={index === c.shadows.length - 1}>›</button></div>}
                  </div>
                </TransformBox>
              ))}
              {isGm && <button className="add-shadow-btn" onClick={addShadow}>+ ADD SHADOW</button>}
              {isGm && <label className="background-upload"><strong>SWAP BACKGROUND</strong><span>JPG, PNG, WEBP</span><input type="file" accept="image/*" onChange={(event) => upload(event, "gm", (url) => updateGm((next) => next.battle.background = url))} /></label>}
              <div className="objective-tag"><span>OBJECTIVE</span><input disabled={!isGm} value={c.battle.objective} onChange={(event) => updateGm((next) => next.battle.objective = event.target.value)} /></div>
              <div className="turn-tag"><span>ROUND</span><input disabled={!isGm} type="number" value={c.battle.round} onChange={(event) => updateGm((next) => next.battle.round = Number(event.target.value))} /></div>
            </div>}

            {mode === "roam" && <div className={`roam-scene ${c.roam.background ? "custom-bg" : ""}`} style={c.roam.background ? { backgroundImage: `url(${c.roam.background})` } : undefined}>
              {!c.roam.background && <><div className="roam-sky"><span /><span /><span /></div><div className="roam-city"><i /><i /><i /><i /><i /><i /></div><div className="roam-road" /></>}
              {isGm && <label className="background-upload"><strong>SWAP FREE ROAM IMAGE</strong><input type="file" accept="image/*" onChange={(event) => upload(event, "gm", (url) => updateGm((next) => next.roam.background = url))} /></label>}
              <div className="location-card"><span>CURRENT LOCATION</span><input disabled={!isGm} value={c.roam.location} onChange={(event) => updateGm((next) => next.roam.location = event.target.value)} /><textarea disabled={!isGm} value={c.roam.details} onChange={(event) => updateGm((next) => next.roam.details = event.target.value)} /></div>
            </div>}

            {mode === "map" && <div className={`world-map ${c.map.background ? "custom-bg" : ""}`} style={c.map.background ? { backgroundImage: `url(${c.map.background})` } : undefined}>
              {isGm && <label className="background-upload"><strong>SWAP MAP IMAGE</strong><input type="file" accept="image/*" onChange={(event) => upload(event, "gm", (url) => updateGm((next) => next.map.background = url))} /></label>}
              {isGm && <button type="button" className="clear-pins" onClick={(e) => { e.stopPropagation(); updateGm((next) => next.map.pins = []); }}>CLEAR ALL PINS</button>}
            </div>}
          </div>
          <div className="map-footer"><div><Mark>1</Mark> {isGm ? "GM EDIT MODE" : "PLAYER VIEW"}</div><div className="gm-note">SYNC: <strong>{notice || "LIVE"}</strong></div></div>
        </section>
      </div>
    </main>
  );
}

export default App;