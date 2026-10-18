import { useCallback, useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import { addPlayer, getCampaign, patchPlayer, removePlayer, saveCampaign, uploadImage } from "./api";

type Mode = "combat" | "roam" | "map";
type Role = "gm" | "player";
type Player = { id: string; name: string; role: string; hp: number; sp: number; initial: string; art?: string; personaArt?: string };
type ShadowData = { id: string; name: string; hp: number; threat: number; status: string; sprite?: string };
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

  const submit = () => {
    onReady(selectedRole);
  };

  return (
    <main className="login-screen">
      <div className="noise" />
      <section className="login-card">
        <div className="login-mark">RP</div>
        <span>SHARED CAMPAIGN TABLE</span>
        <strong>CHOOSE YOUR ROLE</strong>
        <p>Select whether you are joining as the Game Master (GM) or a Player Character (PC).</p>
        
        <div className="role-selector-options" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", margin: "20px 0" }}>
          <button
            type="button"
            onClick={() => setSelectedRole("gm")}
            style={{
              padding: "16px",
              border: "3px solid var(--ink)",
              background: selectedRole === "gm" ? "var(--mint)" : "var(--paper)",
              color: "var(--ink)",
              fontFamily: "Bebas Neue",
              fontSize: "20px",
              cursor: "pointer",
              boxShadow: selectedRole === "gm" ? "4px 4px 0 var(--ink)" : "none"
            }}
          >
            GM (GAME MASTER)
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole("player")}
            style={{
              padding: "16px",
              border: "3px solid var(--ink)",
              background: selectedRole === "player" ? "var(--mint)" : "var(--paper)",
              color: "var(--ink)",
              fontFamily: "Bebas Neue",
              fontSize: "20px",
              cursor: "pointer",
              boxShadow: selectedRole === "player" ? "4px 4px 0 var(--ink)" : "none"
            }}
          >
            PC (PLAYER)
          </button>
        </div>

        <button type="button" onClick={submit}>ENTER CAMPAIGN</button>
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
      if (forcedRole) {
        setRole(forcedRole);
      } else if (result.role) {
        setRole(result.role);
      }
      setAuthenticated(true);
    } catch {
      setAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const updatePlayerLocal = (id: string, patch: Partial<Player>) => {
    dirty.current = true;
    setCampaign((current) => current ? { ...current, players: current.players.map((player) => player.id === id ? { ...player, ...patch } : player) } : current);
  };

  const persistPlayer = async (id: string, patch: Partial<Player>) => {
    try {
      const result = await patchPlayer(id, patch);
      setCampaign(result.campaign);
      setNotice("SAVED");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "SAVE FAILED");
      load();
    } finally {
      dirty.current = false;
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>, scope: "gm" | "player", apply: (url: string) => void | Promise<void>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setNotice("UPLOADING");
    try {
      const result = await uploadImage(file, scope);
      await apply(result.url);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "UPLOAD FAILED");
    }
  };

  const handleSignOut = () => {
    setAuthenticated(false);
  };

  // Shadow controls
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
      next.shadows.push({
        id: crypto.randomUUID(),
        name: `Shadow ${next.shadows.length + 1}`,
        hp: 100,
        threat: 1,
        status: "Normal"
      });
    });
  };

  const removeShadow = (index: number) => {
    updateGm((next) => {
      next.shadows.splice(index, 1);
    });
  };

  // Clear map pins button handler
  const clearMapPins = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    updateGm((next) => {
      next.map.pins = [];
    });
  };

  if (authenticated === null) return <main className="loading-screen">LOADING CAMPAIGN…</main>;
  if (!authenticated) return <Login onReady={(chosenRole) => { setRole(chosenRole); setAuthenticated(true); load(chosenRole); }} />;
  if (!campaign) return <main className="loading-screen">SYNCING SHARED STATE…</main>;

  const c = campaign;

  const addMapPin = (event: MouseEvent<HTMLDivElement>) => {
    if (!isGm || (event.target as HTMLElement).closest("input,button,label")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    updateGm((next) => next.map.pins.push({
      id: crypto.randomUUID(),
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
      label: String(next.map.pins.length + 1).padStart(2, "0"),
      tooltip: "New location",
    }));
  };

  return (
    <main className="app-shell">
      <div className="noise" />
      <header className="calendar-bar">
        <StepControl label="SEASON" value={seasons[c.calendar.season]} disabled={!isGm} previous={() => updateGm((next) => next.calendar.season = (next.calendar.season + 3) % 4)} next={() => updateGm((next) => next.calendar.season = (next.calendar.season + 1) % 4)} />
        <StepControl label="MONTH" value={months[c.calendar.month]} disabled={!isGm} previous={() => updateGm((next) => next.calendar.month = (next.calendar.month + 11) % 12)} next={() => updateGm((next) => next.calendar.month = (next.calendar.month + 1) % 12)} />
        <div className="week-shell">
          <button className="week-arrow" disabled={!isGm} onClick={() => updateGm((next) => next.calendar.weekStart = Math.max(1, next.calendar.weekStart - 7))}>‹</button>
          <div className="week-strip">{weekdays.map((day, index) => <button disabled={!isGm} className={`day ${c.calendar.selectedDay === index ? "active" : ""}`} onClick={() => updateGm((next) => next.calendar.selectedDay = index)} key={day}><span>{day}</span><strong>{c.calendar.weekStart + index}</strong></button>)}</div>
          <button className="week-arrow" disabled={!isGm} onClick={() => updateGm((next) => next.calendar.weekStart = Math.min(25, next.calendar.weekStart + 7))}>›</button>
        </div>
        <div className="session-chip"><span>{role.toUpperCase()}</span><strong>{notice || "LIVE"}</strong><button onClick={handleSignOut}>SWITCH ROLE</button></div>
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
              {c.shadows.map((shadow, index) => <div className={`enemy-unit ${index === 0 ? "left-enemy" : index === 1 ? "boss" : "right-enemy"}`} key={shadow.id}>
                <div className="enemy-name"><input disabled={!isGm} value={shadow.name} onChange={(event) => updateGm((next) => next.shadows[index].name = event.target.value)} /><div className="enemy-hp"><i style={{ width: `${shadow.hp}%` }} /><span>{shadow.hp} HP</span></div></div>
                <label className={`shadow-figure ${shadow.sprite ? "has-sprite" : ""}`}>
                  {shadow.sprite ? <img src={shadow.sprite} alt="" /> : <><i className="horn left" /><i className="horn right" /><span className="shadow-head"><b /><b /></span><span className="shadow-body" /><i className="shadow-arm left" /><i className="shadow-arm right" /><i className="shadow-leg left" /><i className="shadow-leg right" /></>}
                  {isGm && <><small>REPLACE SPRITE</small><input type="file" accept="image/*" onChange={(event) => upload(event, "gm", (url) => updateGm((next) => next.shadows[index].sprite = url))} /></>}
                </label>
                <div className="enemy-status"><span>TL</span><input disabled={!isGm} type="number" value={shadow.threat} onChange={(event) => updateGm((next) => next.shadows[index].threat = Number(event.target.value))} /><input disabled={!isGm} value={shadow.status} onChange={(event) => updateGm((next) => next.shadows[index].status = event.target.value)} /></div>
                {isGm && <input className="enemy-hp-control" type="number" min="0" max="100" value={shadow.hp} onChange={(event) => updateGm((next) => next.shadows[index].hp = Number(event.target.value))} />}
                
                {/* Shadow controls for GM */}
                {isGm && <div className="shadow-controls">
                  <button onClick={() => moveShadow(index, "left")} disabled={index === 0}>‹</button>
                  <button onClick={() => removeShadow(index)}>×</button>
                  <button onClick={() => moveShadow(index, "right")} disabled={index === c.shadows.length - 1}>›</button>
                </div>}
              </div>)}
              {isGm && <button className="add-shadow-btn" onClick={addShadow}>+ ADD SHADOW</button>}
              {isGm && <label className="background-upload"><strong>SWAP BACKGROUND</strong><span>JPG, PNG, WEBP</span><input type="file" accept="image/*" onChange={(event) => upload(event, "gm", (url) => updateGm((next) => next.battle.background = url))} /></label>}
              <div className="objective-tag"><span>OBJECTIVE</span><input disabled={!isGm} value={c.battle.objective} onChange={(event) => updateGm((next) => next.battle.objective = event.target.value)} /></div>
              <div className="turn-tag"><span>ROUND</span><input disabled={!isGm} type="number" value={c.battle.round} onChange={(event) => updateGm((next) => next.battle.round = Number(event.target.value))} /></div>
            </div>}

            {mode === "roam" && <div className={`roam-scene ${c.roam.background ? "custom-bg" : ""}`} style={c.roam.background ? { backgroundImage: `url(${c.roam.background})` } : undefined}>
              {!c.roam.background && <><div className="roam-sky"><span /><span /><span /></div><div className="roam-city"><i /><i /><i /><i /><i /><i /></div><div className="roam-road" /></>}
              {isGm && <label className="background-upload"><strong>SWAP FREE ROAM IMAGE</strong><input type="file" accept="image/*" onChange={(event) => upload(event, "gm", (url) => updateGm((next) => next.roam.background = url))} /></label>}
              <div className="location-card"><span>CURRENT LOCATION</span><input disabled={!isGm} value={c.roam.location} onChange={(event) => updateGm((next) => next.roam.location = event.target.value)} /><textarea disabled={!isGm} value={c.roam.details} onChange={(event) => updateGm((next) => next.roam.details = event.target.value)} /></div>
              <div className="roam-prompts">{c.roam.points.map((point, index) => <div key={index}><Mark>{String(index + 1).padStart(2, "0")}</Mark><span><input disabled={!isGm} value={point.title} onChange={(event) => updateGm((next) => next.roam.points[index].title = event.target.value)} /><input disabled={!isGm} value={point.detail} onChange={(event) => updateGm((next) => next.roam.points[index].detail = event.target.value)} /></span>{isGm && <button onClick={() => updateGm((next) => next.roam.points.splice(index, 1))}>×</button>}</div>)}{isGm && <button className="add-point" onClick={() => updateGm((next) => next.roam.points.push({ title: "NEW POINT", detail: "Add details" }))}>+ ADD POINT OF INTEREST</button>}</div>
            </div>}

            {mode === "map" && <div className={`world-map ${c.map.background ? "custom-bg" : ""}`} style={c.map.background ? { backgroundImage: `url(${c.map.background})` } : undefined} onClick={addMapPin}>
              {!c.map.background && <><div className="map-water" /><div className="district north"><span>NORTH WARD</span></div><div className="district central"><span>CENTRAL</span></div><div className="district docks"><span>DOCKS</span></div><div className="district old-town"><span>OLD TOWN</span></div></>}
              {isGm && <label className="background-upload"><strong>SWAP MAP IMAGE</strong><input type="file" accept="image/*" onChange={(event) => upload(event, "gm", (url) => updateGm((next) => next.map.background = url))} /></label>}
              {c.map.pins.map((pin, index) => <div className="campaign-pin" style={{ left: `${pin.x}%`, top: `${pin.y}%` }} key={pin.id}><i /><span>{pin.label}</span><div className="pin-tooltip">{isGm ? <><input value={pin.tooltip} onChange={(event) => updateGm((next) => next.map.pins[index].tooltip = event.target.value)} /><button onClick={() => updateGm((next) => next.map.pins.splice(index, 1))}>×</button></> : pin.tooltip}</div></div>)}
              <div className="map-help"><strong>{isGm ? "CLICK TO DROP PIN" : "CAMPAIGN MAP"}</strong><span>{c.map.pins.length} locations marked</span></div>
              {isGm && <button className="clear-pins" onClick={clearMapPins}>CLEAR ALL PINS</button>}
            </div>}
          </div>
          <div className="map-footer"><div><Mark>1</Mark> {isGm ? "GM EDIT MODE" : "PLAYER VIEW"}</div><div className="gm-note">SYNC: <strong>{notice || "LIVE"}</strong></div></div>
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
        <div className="party-label"><span>ACTIVE</span><strong>CREW</strong><i>{String(c.players.length).padStart(2, "0")} PCS</i>{isGm && <button onClick={async () => setCampaign((await addPlayer()).campaign)}>+ ADD PC</button>}</div>
        <div className="party-members">{c.players.map((player, index) => <div className={`hero-card ${index % 2 ? "white" : "mint"}`} key={player.id}>
          <div className="hero-name"><span>{String(index + 1).padStart(2, "0")}</span><input disabled={!isGm} value={player.name} onChange={(event) => updatePlayerLocal(player.id, { name: event.target.value })} onBlur={(event) => persistPlayer(player.id, { name: event.target.value })} /><input disabled={!isGm} value={player.role} onChange={(event) => updatePlayerLocal(player.id, { role: event.target.value })} onBlur={(event) => persistPlayer(player.id, { role: event.target.value })} /></div>
          <div className="art-pair">
            <label className={`portrait ${player.art ? "has-art" : ""}`}>{player.art ? <img src={player.art} alt="" /> : <span>{player.initial}</span>}<small>CHARACTER</small><input type="file" accept="image/*" onChange={(event) => upload(event, "player", async (url) => setCampaign((await patchPlayer(player.id, { art: url })).campaign))} /></label>
            <label className={`portrait persona-art ${player.personaArt ? "has-art" : ""}`}>{player.personaArt ? <img src={player.personaArt} alt="" /> : <span>P</span>}<small>PERSONA</small><input type="file" accept="image/*" onChange={(event) => upload(event, "player", async (url) => setCampaign((await patchPlayer(player.id, { personaArt: url })).campaign))} /></label>
          </div>
          <div className="meters">{(["hp", "sp"] as const).map((resource) => <label className={`number-resource ${resource}`} key={resource}><span>{resource.toUpperCase()}</span><input type="number" min="0" value={player[resource]} onChange={(event) => updatePlayerLocal(player.id, { [resource]: Number(event.target.value) })} onBlur={(event) => persistPlayer(player.id, { [resource]: Number(event.target.value) })} /></label>)}</div>
          {isGm && <button className="remove-player" onClick={async () => setCampaign((await removePlayer(player.id)).campaign)}>REMOVE</button>}
        </div>)}</div>
        <div className="phase"><span>ACCESS</span><strong>{role.toUpperCase()}</strong><small>GLOBAL</small></div>
      </footer>
    </main>
  );
}

export default App;