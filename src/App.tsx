import { useCallback, useEffect, useRef, useState, type ChangeEvent, type MouseEvent, type ReactNode, type WheelEvent } from "react";
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

type Toast = { id: string; message: string; type: "success" | "error" | "info" };

const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];

function StepControl({ label, value, disabled, previous, next }: { label: string; value: string; disabled: boolean; previous: () => void; next: () => void }) {
  return (
    <div className="step-control">
      <button disabled={disabled} onClick={previous}>‹</button>
      <div><span>{label}</span><strong>{value}</strong></div>
      <button disabled={disabled} onClick={next}>›</button>
    </div>
  );
}

function Mark({ children }: { children: React.ReactNode }) {
  return <span className="mark">{children}</span>;
}

function TransformBox({ x = 40, y = 40, width = 240, height = 320, disabled, onUpdate, children }: { x?: number; y?: number; width?: number; height?: number; disabled: boolean; onUpdate: (box: { x: number; y: number; width: number; height: number }) => void; children: ReactNode }) {
  const [pos, setPos] = useState({ x, y, width, height });
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    setPos({ x, y, width, height });
  }, [x, y, width, height]);

  const startDrag = (e: MouseEvent<HTMLDivElement>, handle: string | null = null) => {
    if (disabled) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialPos = { ...pos };

    const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      setPos(() => {
        let next = { ...initialPos };
        if (!handle) {
          next.x = initialPos.x + dx;
          next.y = initialPos.y + dy;
        } else {
          if (handle.includes("right")) next.width = Math.max(160, initialPos.width + dx);
          if (handle.includes("bottom")) next.height = Math.max(180, initialPos.height + dy);
          if (handle.includes("left")) {
            const newW = initialPos.width - dx;
            if (newW >= 160) {
              next.width = newW;
              next.x = initialPos.x + dx;
            }
          }
          if (handle.includes("top")) {
            const newH = initialPos.height - dy;
            if (newH >= 180) {
              next.height = newH;
              next.y = initialPos.y + dy;
            }
          }
        }
        return next;
      });
    };

    const onMouseUp = () => {
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
    <div 
      onMouseEnter={() => setHovered(true)} 
      onMouseLeave={() => setHovered(false)} 
      style={{ position: "absolute", left: `${pos.x}px`, top: `${pos.y}px`, width: `${pos.width}px`, height: `${pos.height}px`, cursor: disabled ? "default" : "move", zIndex: 10 }} 
      onMouseDown={(e) => startDrag(e, null)}
    >
      {children}
      {!disabled && hovered && (
        <div style={{ position: "absolute", inset: "-4px", border: "2px dashed var(--mint)", pointerEvents: "none" }}>
          <div onMouseDown={(e) => startDrag(e, "top-left")} style={{ position: "absolute", top: -6, left: -6, width: 12, height: 12, background: "var(--ink)", border: "2px solid var(--mint)", pointerEvents: "auto", cursor: "nwse-resize" }} />
          <div onMouseDown={(e) => startDrag(e, "top-right")} style={{ position: "absolute", top: -6, right: -6, width: 12, height: 12, background: "var(--ink)", border: "2px solid var(--mint)", pointerEvents: "auto", cursor: "nesw-resize" }} />
          <div onMouseDown={(e) => startDrag(e, "bottom-left")} style={{ position: "absolute", bottom: -6, left: -6, width: 12, height: 12, background: "var(--ink)", border: "2px solid var(--mint)", pointerEvents: "auto", cursor: "nesw-resize" }} />
          <div onMouseDown={(e) => startDrag(e, "bottom-right")} style={{ position: "absolute", bottom: -6, right: -6, width: 12, height: 12, background: "var(--ink)", border: "2px solid var(--mint)", pointerEvents: "auto", cursor: "nwse-resize" }} />
        </div>
      )}
    </div>
  );
}

function App() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [role, setRole] = useState<Role>(() => (sessionStorage.getItem("persona_role") as Role) || "gm");
  const [mode, setMode] = useState<Mode>("combat");
  const [authenticated, setAuthenticated] = useState<boolean>(() => sessionStorage.getItem("persona_auth") === "true");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [placingPin, setPlacingPin] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const isGm = role === "gm";

  const addToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const load = useCallback(async (forcedRole?: Role) => {
    try {
      const result = await getCampaign();
      setCampaign(result.campaign);
      const activeRole = forcedRole || (sessionStorage.getItem("persona_role") as Role) || result.role || "gm";
      setRole(activeRole);
      sessionStorage.setItem("persona_role", activeRole);
      setAuthenticated(true);
      sessionStorage.setItem("persona_auth", "true");
    } catch {
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!authenticated) return;
    const timer = setInterval(() => { if (!dirty.current) load(); }, 6000);
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
        addToast("CHANGES SAVED", "success");
      } catch (reason) {
        addToast(reason instanceof Error ? reason.message : "SAVE FAILED", "error");
      } finally {
        dirty.current = false;
      }
    }, 450);
  };

  const updatePlayerLocal = (id: string, patch: Partial<Player>) => {
    dirty.current = true;
    setCampaign((current) => current ? { ...current, players: current.players.map((p) => p.id === id ? { ...p, ...patch } : p) } : current);
  };

  const persistPlayer = async (id: string, patch: Partial<Player>) => {
    try {
      const result = await patchPlayer(id, patch);
      if (result && result.campaign) setCampaign(result.campaign);
      addToast("PLAYER SAVED", "success");
    } catch {
      updateGm((next) => {
        next.players = next.players.map((p) => p.id === id ? { ...p, ...patch } : p);
      });
      addToast("PLAYER SAVED (LOCAL)", "info");
    } finally {
      dirty.current = false;
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>, scope: "gm" | "player", apply: (url: string) => void | Promise<void>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    addToast("UPLOADING IMAGE...", "info");
    try {
      const result = await uploadImage(file, scope);
      if (result && result.url) {
        await apply(result.url);
        addToast("UPLOAD SUCCESSFUL", "success");
      } else {
        throw new Error("Invalid upload response");
      }
    } catch (reason) {
      addToast(reason instanceof Error ? reason.message : "UPLOAD FAILED", "error");
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
      next.shadows.push({ id: crypto.randomUUID(), name: `Shadow ${next.shadows.length + 1}`, hp: 100, threat: 1, status: "Normal", x: 40 + next.shadows.length * 180, y: 60, width: 240, height: 320 });
    });
  };

  const handleAddNewPlayer = async () => {
    try {
      const res = await addPlayer();
      if (res && res.campaign) {
        setCampaign(res.campaign);
        addToast("PLAYER ADDED", "success");
        return;
      }
    } catch {
      // Fallback local addition
    }
    updateGm((next) => {
      next.players.push({
        id: crypto.randomUUID(),
        name: `PC ${next.players.length + 1}`,
        role: "Attacker",
        hp: 100,
        sp: 50,
        initial: "P",
      });
    });
    addToast("PLAYER ADDED", "success");
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (mode !== "map") return;
    e.preventDefault();
    setZoom((prev) => Math.max(1, Math.min(3, prev - e.deltaY * 0.002)));
  };

  const handleMapMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (mode !== "map") return;

    if (placingPin) {
      const bounds = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - bounds.left) / bounds.width) * 100;
      const y = ((e.clientY - bounds.top) / bounds.height) * 100;
      updateGm((next) => {
        next.map.pins.push({
          id: crypto.randomUUID(),
          x,
          y,
          label: String(next.map.pins.length + 1).padStart(2, "0"),
          tooltip: "New location"
        });
      });
      setPlacingPin(false);
      addToast("PIN DROPPED", "success");
      return;
    }

    if ((e.target as HTMLElement).closest("input,button,label,textarea,.campaign-pin")) return;
    const startX = e.clientX - pan.x;
    const startY = e.clientY - pan.y;

    const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
      setPan({ x: moveEvent.clientX - startX, y: moveEvent.clientY - startY });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (mode !== "map" || !placingPin) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    setCursorPos({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top
    });
  };

  if (!authenticated || !campaign) return <main className="loading-screen">SYNCING SHARED STATE…</main>;

  const c = campaign;

  return (
    <main className="app-shell">
      <div className="noise" />

      {/* PC-Style Toast Notifications Container */}
      <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, display: "flex", flexDirection: "column", gap: "10px", pointerEvents: "none" }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              pointerEvents: "auto",
              background: toast.type === "error" ? "var(--ink)" : "var(--paper)",
              color: toast.type === "error" ? "var(--paper)" : "var(--ink)",
              border: "3px solid var(--ink)",
              padding: "12px 18px",
              fontFamily: "Bebas Neue, sans-serif",
              fontSize: "16px",
              boxShadow: "4px 4px 0 var(--ink)",
              minWidth: "220px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <span>{toast.message}</span>
            <span style={{ marginLeft: "12px", fontSize: "14px", color: toast.type === "error" ? "var(--mint)" : "var(--ink)" }}>
              {toast.type === "error" ? "✕" : toast.type === "success" ? "✓" : "ℹ"}
            </span>
          </div>
        ))}
      </div>

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
        <div className="session-chip"><span>{role.toUpperCase()}</span><strong>LIVE</strong><button onClick={() => { sessionStorage.clear(); setAuthenticated(false); }}>SWITCH ROLE</button></div>
      </header>

      <div className="content">
        <section className="map-panel">
          <div className="encounter-toolbar">
            <div className="panel-kicker"><span>01</span><div><small>SHARED SCENE</small><strong>{mode === "combat" ? "ENCOUNTER" : mode === "roam" ? c.roam.location : "CAMPAIGN MAP"}</strong></div></div>
            <div className="mode-switcher">{(["combat", "roam", "map"] as Mode[]).map((item) => <button className={mode === item ? "active" : ""} onClick={() => setMode(item)} key={item}>{item === "roam" ? "FREE ROAM" : item.toUpperCase()}</button>)}</div>
          </div>

          <div className="map-frame" onWheel={handleWheel} onMouseDown={handleMapMouseDown} onMouseMove={handleMouseMove} style={{ overflow: "hidden", position: "relative" }}>
            <div style={{ transform: mode === "map" ? `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` : "none", transformOrigin: "center", width: "100%", height: "100%", position: "absolute", inset: 0 }}>
              
              {mode === "combat" && <div className={`dungeon-scene ${c.battle.background ? "custom-bg" : ""}`} style={{ width: "100%", height: "100%", position: "relative", ...(c.battle.background ? { backgroundImage: `url(${c.battle.background})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
                {!c.battle.background && <><div className="ceiling-lines" /><div className="corridor-end"><span /><span /></div><div className="floor-grid" /></>}
                {c.shadows.map((shadow, index) => (
                  <TransformBox key={shadow.id} x={shadow.x ?? (40 + index * 180)} y={shadow.y ?? 50} width={shadow.width ?? 240} height={shadow.height ?? 320} disabled={!isGm} onUpdate={(box) => updateGm((next) => { next.shadows[index].x = box.x; next.shadows[index].y = box.y; next.shadows[index].width = box.width; next.shadows[index].height = box.height; })}>
                    <div className="enemy-unit" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--paper)", border: "2px solid var(--ink)", padding: "8px", boxSizing: "border-box" }}>
                      <div className="enemy-name" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                        <input disabled={!isGm} value={shadow.name} onChange={(event) => updateGm((next) => next.shadows[index].name = event.target.value)} style={{ flex: 1, minWidth: 0 }} />
                        <div className="enemy-hp" style={{ flex: 1 }}><i style={{ width: `${shadow.hp}%` }} /><span>{shadow.hp} HP</span></div>
                      </div>
                      <div className={`shadow-figure ${shadow.sprite ? "has-sprite" : ""}`} style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "6px", minHeight: "120px" }}>
                        {shadow.sprite ? <img src={shadow.sprite} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <><i className="horn left" /><i className="horn right" /><span className="shadow-head"><b /><b /></span><span className="shadow-body" /><i className="shadow-arm left" /><i className="shadow-arm right" /><i className="shadow-leg left" /><i className="shadow-leg right" /></>}
                      </div>
                      {isGm && <label style={{ padding: "6px", fontSize: "11px", textAlign: "center", cursor: "pointer", background: "var(--mint)", color: "var(--ink)", border: "2px solid var(--ink)", display: "block", marginTop: "6px" }}><strong>CHANGE IMAGE</strong><input type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => upload(event, "gm", (url) => updateGm((next) => next.shadows[index].sprite = url))} /></label>}
                      <div className="enemy-status" style={{ marginTop: "6px" }}><span>TL</span><input disabled={!isGm} type="number" value={shadow.threat} onChange={(event) => updateGm((next) => next.shadows[index].threat = Number(event.target.value))} /><input disabled={!isGm} value={shadow.status} onChange={(event) => updateGm((next) => next.shadows[index].status = event.target.value)} /></div>
                      {isGm && <div className="shadow-controls" style={{ display: "flex", gap: "4px", marginTop: "6px" }}><button type="button" onClick={() => moveShadow(index, "left")} disabled={index === 0}>‹</button><button type="button" onClick={() => updateGm((next) => next.shadows.splice(index, 1))}>×</button><button type="button" onClick={() => moveShadow(index, "right")} disabled={index === c.shadows.length - 1}>›</button></div>}
                    </div>
                  </TransformBox>
                ))}
                {isGm && <button className="add-shadow-btn" onClick={addShadow} style={{ position: "absolute", bottom: "24px", right: "24px", zIndex: 20 }}>+ ADD SHADOW</button>}
                {isGm && <label className="background-upload"><strong>SWAP BACKGROUND</strong><span>JPG, PNG, WEBP</span><input type="file" accept="image/*" onChange={(event) => upload(event, "gm", (url) => updateGm((next) => next.battle.background = url))} /></label>}
                <div className="objective-tag"><span>OBJECTIVE</span><input disabled={!isGm} value={c.battle.objective} onChange={(event) => updateGm((next) => next.battle.objective = event.target.value)} /></div>
                <div className="turn-tag"><span>ROUND</span><input disabled={!isGm} type="number" value={c.battle.round} onChange={(event) => updateGm((next) => next.battle.round = Number(event.target.value))} /></div>
              </div>}

              {mode === "roam" && <div className={`roam-scene ${c.roam.background ? "custom-bg" : ""}`} style={{ width: "100%", height: "100%", position: "relative", ...(c.roam.background ? { backgroundImage: `url(${c.roam.background})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
                {!c.roam.background && <><div className="roam-sky"><span /><span /><span /></div><div className="roam-city"><i /><i /><i /><i /><i /><i /></div><div className="roam-road" /></>}
                {isGm && <label className="background-upload"><strong>SWAP FREE ROAM IMAGE</strong><input type="file" accept="image/*" onChange={(event) => upload(event, "gm", (url) => updateGm((next) => next.roam.background = url))} /></label>}
                <div className="location-card"><span>CURRENT LOCATION</span><input disabled={!isGm} value={c.roam.location} onChange={(event) => updateGm((next) => next.roam.location = event.target.value)} /><textarea disabled={!isGm} value={c.roam.details} onChange={(event) => updateGm((next) => next.roam.details = event.target.value)} /></div>
              </div>}

              {mode === "map" && <div className={`world-map ${c.map.background ? "custom-bg" : ""}`} style={{ width: "100%", height: "100%", position: "relative", ...(c.map.background ? { backgroundImage: `url(${c.map.background})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" } : {}) }}>
                {!c.map.background && <><div className="map-water" /><div className="district north"><span>NORTH WARD</span></div><div className="district central"><span>CENTRAL</span></div><div className="district docks"><span>DOCKS</span></div><div className="district old-town"><span>OLD TOWN</span></div></>}
                
                {c.map.pins.map((pin, index) => <div className="campaign-pin" style={{ left: `${pin.x}%`, top: `${pin.y}%`, position: "absolute" }} key={pin.id}><i /><span>{pin.label}</span><div className="pin-tooltip">{isGm ? <><input value={pin.tooltip} onChange={(event) => updateGm((next) => next.map.pins[index].tooltip = event.target.value)} /><button onClick={() => updateGm((next) => next.map.pins.splice(index, 1))}>×</button></> : pin.tooltip}</div></div>)}

                {placingPin && <div style={{ position: "absolute", left: cursorPos.x, top: cursorPos.y, pointerEvents: "none", transform: "translate(-50%, -100%)", zIndex: 100 }}><span className="campaign-pin"><i /><strong>📍</strong></span></div>}

                {isGm && <div style={{ position: "absolute", bottom: 16, right: 16, display: "flex", gap: "8px", zIndex: 20 }}>
                  <button type="button" className="clear-pins" onClick={() => setPlacingPin(!placingPin)} style={{ background: placingPin ? "var(--mint)" : "var(--paper)", color: "var(--ink)" }}>{placingPin ? "CANCEL PLACEMENT" : "+ DROP PIN"}</button>
                  <button type="button" className="clear-pins" onClick={() => updateGm((next) => next.map.pins = [])}>CLEAR ALL PINS</button>
                </div>}

                {isGm && <label className="background-upload"><strong>SWAP MAP IMAGE</strong><input type="file" accept="image/*" onChange={(event) => upload(event, "gm", (url) => updateGm((next) => next.map.background = url))} /></label>}
              </div>}

            </div>
          </div>
          <div className="map-footer"><div><Mark>1</Mark> {isGm ? "GM EDIT MODE" : "PLAYER VIEW"}</div><div className="gm-note">SYNC: <strong>LIVE</strong></div></div>
        </section>

        <aside className="rules-panel">
          <div className="rules-title"><span>QUICK</span><strong>RULES</strong><i>PTTRPG</i></div>
          <div className="rule-card hot"><div className="rule-number">01</div><div><strong>CORE CHECK</strong><p>Roll <b>2d6 + stat</b>: 10+ complete, 7–9 mixed, 6− failure.</p></div></div>
          <div className="rule-card"><div className="rule-number">02</div><div><strong>ATTACK</strong><p>Basic Strike uses STR/AGI. Basic Spell uses MAG. Roll damage after a hit.</p></div></div>
          <div className="rule-card"><div className="rule-number">03</div><div><strong>AFFINITY</strong><p>Weak: +2 to hit and WP/TL damage. Resist: half damage.</p></div></div>
          <div className="rule-card"><div className="rule-number">04</div><div><strong>ONE-MORE</strong><p>Critical or weakness + complete success Downs the target and grants another action.</p></div></div>
          <div className="basic-moves"><span>BASIC MOVES</span><div>STRIKE</div><div>SPELL</div><div>DEFEND</div><div>ASSIST</div><div>ITEM</div><div>FLEE</div></div>
          <div className="status-box"><span className="eyebrow">GENERAL PLAY</span><p><b>Initiative:</b> 2d6 + AGI/TL</p><p><b>Critical:</b> natural 11–12</p><p><b>Reaction:</b> one per round</p><p><b>Baton Pass:</b> pass a One-More to an ally</p></div>
        </aside>
      </div>

      <footer className="party-bar">
        <div className="party-label"><span>ACTIVE</span><strong>CREW</strong><i>{String(c.players.length).padStart(2, "0")} PCS</i>{isGm && <button onClick={handleAddNewPlayer}>+ ADD PC</button>}</div>
        <div className="party-members">{c.players.map((player, index) => <div className={`hero-card ${index % 2 ? "white" : "mint"}`} key={player.id}>
          
          {/* Hero Name Header with Flex Layout & Protection */}
          <div className="hero-name" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <input
              disabled={!isGm}
              value={player.name}
              onChange={(event) => updatePlayerLocal(player.id, { name: event.target.value })}
              onBlur={(event) => persistPlayer(player.id, { name: event.target.value })}
              placeholder="PC Name"
              style={{ flex: 1, minWidth: 0 }}
            />
            <input
              disabled={!isGm}
              value={player.role}
              onChange={(event) => updatePlayerLocal(player.id, { role: event.target.value })}
              onBlur={(event) => persistPlayer(player.id, { role: event.target.value })}
              placeholder="Role"
              style={{ width: "70px" }}
            />
          </div>

          <div className="art-pair">
            <label className={`portrait ${player.art ? "has-art" : ""}`}>{player.art ? <img src={player.art} alt="" /> : <span>{player.initial}</span>}<small>CHARACTER</small><input type="file" accept="image/*" onChange={(event) => upload(event, "player", async (url) => persistPlayer(player.id, { art: url }))} /></label>
            <label className={`portrait persona-art ${player.personaArt ? "has-art" : ""}`}>{player.personaArt ? <img src={player.personaArt} alt="" /> : <span>P</span>}<small>PERSONA</small><input type="file" accept="image/*" onChange={(event) => upload(event, "player", async (url) => persistPlayer(player.id, { personaArt: url }))} /></label>
          </div>
          <div className="meters">{(["hp", "sp"] as const).map((resource) => <label className={`number-resource ${resource}`} key={resource}><span>{resource.toUpperCase()}</span><input type="number" min="0" value={player[resource]} onChange={(event) => updatePlayerLocal(player.id, { [resource]: Number(event.target.value) })} onBlur={(event) => persistPlayer(player.id, { [resource]: Number(event.target.value) })} /></label>)}</div>
          {isGm && <button className="remove-player" onClick={async () => {
            try {
              const res = await removePlayer(player.id);
              if (res && res.campaign) setCampaign(res.campaign);
            } catch {
              updateGm((next) => { next.players = next.players.filter((p) => p.id !== player.id); });
            }
          }}>REMOVE</button>}
        </div>)}</div>
        <div className="phase"><span>ACCESS</span><strong>{role.toUpperCase()}</strong><small>GLOBAL</small></div>
      </footer>
    </main>
  );
}

export default App;