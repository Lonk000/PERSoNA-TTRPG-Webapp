import { useCallback, useEffect, useRef, useState, type ChangeEvent, type MouseEvent, type ReactNode, type WheelEvent } from "react";
import { addPlayer, getCampaign, patchPlayer, removePlayer, saveCampaign, uploadImage } from "./api";

type Mode = "combat" | "roam" | "map";
type Role = "gm" | "player";
type Player = { id: string; name: string; role: string; hp: number; maxHp?: number; sp: number; maxSp?: number; initial: string; art?: string; personaArt?: string };
type ShadowData = { id: string; name: string; hp: number; maxHp?: number; threat: number; status: string; sprite?: string; x?: number; y?: number };
type Point = { id: string; title: string; detail: string };
type Pin = { id: string; x: number; y: number; label: string; tooltip: string; iconUrl: string };
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

const PIN_ICONS = [
  { name: "Home", url: "https://game-icons.net/icons/ffffff/transparent/1x1/delapouite/house.svg" },
  { name: "Shop", url: "https://game-icons.net/icons/ffffff/transparent/1x1/delapouite/shop.svg" },
  { name: "Point of Interest", url: "https://game-icons.net/icons/ffffff/transparent/1x1/delapouite/position-marker.svg" },
  { name: "Danger", url: "https://game-icons.net/icons/ffffff/transparent/1x1/lorc/hazard-sign.svg" },
  { name: "Portal", url: "https://game-icons.net/icons/ffffff/transparent/1x1/lorc/waves.svg" },
  { name: "Unknown", url: "https://game-icons.net/icons/ffffff/transparent/1x1/lorc/uncertainty.svg" },
];

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

function ImageCropperModal({ imageSrc, onCancel, onCropComplete }: { imageSrc: string; onCancel: () => void; onCropComplete: (croppedUrl: string) => void }) {
  const [crop, setCrop] = useState({ x: 10, y: 10, width: 80, height: 80 });
  const [dragging, setDragging] = useState<string | null>(null);
  const startMouse = useRef({ x: 0, y: 0 });
  const startCrop = useRef({ ...crop });
  const imgRef = useRef<HTMLImageElement | null>(null);

  const handleMouseDown = (e: MouseEvent, type: string) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(type);
    startMouse.current = { x: e.clientX, y: e.clientY };
    startCrop.current = { ...crop };
  };

  const handleMouseMove = (e: globalThis.MouseEvent) => {
    if (!dragging) return;
    const dx = ((e.clientX - startMouse.current.x) / (imgRef.current?.width || 300)) * 100;
    const dy = ((e.clientY - startMouse.current.y) / (imgRef.current?.height || 300)) * 100;

    setCrop(() => {
      let next = { ...startCrop.current };
      if (dragging === "move") {
        next.x = Math.max(0, Math.min(100 - next.width, startCrop.current.x + dx));
        next.y = Math.max(0, Math.min(100 - next.height, startCrop.current.y + dy));
      } else if (dragging === "se") {
        next.width = Math.max(20, Math.min(100 - next.x, startCrop.current.width + dx));
        next.height = Math.max(20, Math.min(100 - next.y, startCrop.current.height + dy));
      }
      return next;
    });
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  const generateCroppedImage = () => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const sX = (crop.x / 100) * img.naturalWidth;
      const sY = (crop.y / 100) * img.naturalHeight;
      const sW = (crop.width / 100) * img.naturalWidth;
      const sH = (crop.height / 100) * img.naturalHeight;

      canvas.width = sW;
      canvas.height = sH;
      ctx.drawImage(img, sX, sY, sW, sH, 0, 0, sW, sH);
      onCropComplete(canvas.toDataURL("image/png"));
    };
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "var(--paper)", border: "4px solid var(--ink)", padding: "20px", boxShadow: "8px 8px 0 var(--mint)", maxWidth: "500px", width: "100%" }}>
        <h3 style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: "24px", marginBottom: "12px", color: "#000" }}>CROP IMAGE AREA</h3>
        <div style={{ position: "relative", display: "inline-block", overflow: "hidden", border: "2px solid var(--ink)", background: "#000", width: "100%", maxHeight: "350px", textAlign: "center" }}>
          <img ref={imgRef} src={imageSrc} alt="" style={{ maxWidth: "100%", maxHeight: "350px", display: "block", margin: "0 auto", objectFit: "contain" }} />
          <div 
            onMouseDown={(e) => handleMouseDown(e, "move")}
            style={{ position: "absolute", left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%`, border: "2px dashed var(--mint)", background: "rgba(110, 255, 180, 0.2)", cursor: "move" }}
          >
            <div onMouseDown={(e) => handleMouseDown(e, "se")} style={{ position: "absolute", right: -6, bottom: -6, width: 14, height: 14, background: "var(--mint)", border: "2px solid var(--ink)", cursor: "se-resize" }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
          <button onClick={onCancel} style={{ padding: "8px 16px", background: "#fff", border: "2px solid var(--ink)", fontFamily: "Bebas Neue, sans-serif", cursor: "pointer", color: "#000" }}>CANCEL</button>
          <button onClick={generateCroppedImage} style={{ padding: "8px 16px", background: "var(--mint)", border: "2px solid var(--ink)", fontFamily: "Bebas Neue, sans-serif", cursor: "pointer", fontWeight: "bold", color: "#000" }}>APPLY CROP</button>
        </div>
      </div>
    </div>
  );
}

function DraggableShadowBox({ x = 20, y = 20, disabled, onUpdate, children }: { x?: number; y?: number; disabled: boolean; onUpdate: (pos: { x: number; y: number }) => void; children: ReactNode }) {
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    setPos({ x, y });
  }, [x, y]);

  const startDrag = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled || (e.target as HTMLElement).closest("input,button,label,textarea,select")) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;

    const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
      setPos({
        x: moveEvent.clientX - startX,
        y: moveEvent.clientY - startY
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
      style={{ 
        position: "absolute", 
        left: `${pos.x}px`, 
        top: `${pos.y}px`, 
        width: "320px",
        cursor: disabled ? "default" : "move", 
        zIndex: 10,
        filter: "drop-shadow(5px 5px 0px var(--ink))"
      }} 
      onMouseDown={startDrag}
    >
      {children}
    </div>
  );
}

export default function App() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [role, setRole] = useState<Role>(() => (sessionStorage.getItem("persona_role") as Role) || "gm");
  const [mode, setMode] = useState<Mode>("combat");
  const [authenticated, setAuthenticated] = useState<boolean>(() => sessionStorage.getItem("persona_auth") === "true");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);

  const [cropData, setCropData] = useState<{ src: string; callback: (url: string) => void } | null>(null);

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
      const activeRole = forcedRole || role;
      setRole(activeRole);
      sessionStorage.setItem("persona_role", activeRole);
      setAuthenticated(true);
      sessionStorage.setItem("persona_auth", "true");
    } catch {
      setAuthenticated(true);
    }
  }, [role]);

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

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>, scope: "gm" | "player", apply: (url: string) => void | Promise<void>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Url = e.target?.result as string;
      setCropData({
        src: base64Url,
        callback: async (croppedUrl) => {
          setCropData(null);
          addToast("UPLOADING CROPPED IMAGE...", "info");
          try {
            const res = await fetch(croppedUrl);
            const blob = await res.blob();
            const croppedFile = new File([blob], file.name, { type: "image/png" });
            const result = await uploadImage(croppedFile, scope);
            if (result && result.url) {
              await apply(result.url);
              addToast("UPLOAD SUCCESSFUL", "success");
            } else {
              throw new Error("Invalid upload response");
            }
          } catch (reason) {
            addToast(reason instanceof Error ? reason.message : "UPLOAD FAILED", "error");
          }
        }
      });
    };
    reader.readAsDataURL(file);
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
      if (!next.shadows) next.shadows = [];
      const offset = (next.shadows.length % 4) * 335 + 15;
      const rowOffset = Math.floor(next.shadows.length / 4) * 20;
      next.shadows.push({ 
        id: crypto.randomUUID(), 
        name: `SHADOW ${next.shadows.length + 1}`, 
        hp: 100, 
        maxHp: 100,
        threat: 1, 
        status: "Normal", 
        x: offset, 
        y: 15 + rowOffset 
      });
    });
    addToast("SHADOW ADDED", "success");
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
        maxHp: 100,
        sp: 50,
        maxSp: 50,
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
    if ((e.target as HTMLElement).closest("input,button,label,textarea,select,.campaign-pin")) return;
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

  const toggleRole = () => {
    const nextRole = role === "gm" ? "player" : "gm";
    setRole(nextRole);
    sessionStorage.setItem("persona_role", nextRole);
    addToast(`SWITCHED TO ${nextRole.toUpperCase()} MODE`, "info");
  };

  if (!authenticated || !campaign) return <main className="loading-screen">SYNCING SHARED STATE…</main>;

  const c = campaign;
  if (!c.roam.points) c.roam.points = [];
  if (!c.map.pins) c.map.pins = [];
  if (!c.shadows) c.shadows = [];

  return (
    <main className="app-shell">
      <div className="noise" />

      {cropData && (
        <ImageCropperModal 
          imageSrc={cropData.src} 
          onCancel={() => setCropData(null)} 
          onCropComplete={cropData.callback} 
        />
      )}

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
        <div className="session-chip">
          <span>{role.toUpperCase()}</span>
          <strong>LIVE</strong>
          <button onClick={toggleRole}>SWITCH ROLE</button>
        </div>
      </header>

      <div className="content">
        <section className="map-panel">
          <div className="encounter-toolbar">
            <div className="panel-kicker"><span>01</span><div><small>SHARED SCENE</small><strong>{mode === "combat" ? "ENCOUNTER" : mode === "roam" ? c.roam.location : "CAMPAIGN MAP"}</strong></div></div>
            <div className="mode-switcher">{(["combat", "roam", "map"] as Mode[]).map((item) => <button className={mode === item ? "active" : ""} onClick={() => setMode(item)} key={item}>{item === "roam" ? "FREE ROAM" : item.toUpperCase()}</button>)}</div>
          </div>

          <div className="map-frame" onWheel={handleWheel} onMouseDown={handleMapMouseDown} style={{ overflow: "hidden", position: "relative" }}>
            <div style={{ transform: mode === "map" ? `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` : "none", transformOrigin: "center", width: "100%", height: "100%", position: "absolute", inset: 0 }}>
              
              {/* COMBAT MODE */}
              {mode === "combat" && <div className={`dungeon-scene ${c.battle.background ? "custom-bg" : ""}`} style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", ...(c.battle.background ? { backgroundImage: `url(${c.battle.background})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
                {!c.battle.background && <><div className="ceiling-lines" /><div className="corridor-end"><span /><span /></div><div className="floor-grid" /></>}
                {c.shadows.map((shadow, index) => (
                  <DraggableShadowBox 
                    key={shadow.id} 
                    x={Math.min(window.innerWidth - 340, Math.max(10, shadow.x ?? (15 + (index % 4) * 335)))} 
                    y={Math.min(400, Math.max(10, shadow.y ?? (15 + Math.floor(index / 4) * 20)))} 
                    disabled={!isGm} 
                    onUpdate={(p) => updateGm((next) => { next.shadows[index].x = p.x; next.shadows[index].y = p.y; })}
                  >
                    <div style={{ width: "100%", background: "var(--paper)", border: "3px solid var(--ink)", padding: "10px", boxShadow: "4px 4px 0 var(--ink)", display: "flex", flexDirection: "column", gap: "8px", boxSizing: "border-box" }}>
                      
                      {isGm && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--ink)", paddingBottom: "3px" }}>
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button type="button" onClick={() => moveShadow(index, "left")} disabled={index === 0} style={{ padding: "2px 6px", background: "var(--ink)", color: "#fff", border: "0", fontFamily: "Bebas Neue", cursor: "pointer", fontSize: "13px" }}>‹</button>
                            <button type="button" onClick={() => moveShadow(index, "right")} disabled={index === c.shadows.length - 1} style={{ padding: "2px 6px", background: "var(--ink)", color: "#fff", border: "0", fontFamily: "Bebas Neue", cursor: "pointer", fontSize: "13px" }}>›</button>
                          </div>
                          <button type="button" onClick={() => updateGm((next) => next.shadows.splice(index, 1))} style={{ padding: "2px 8px", background: "#ff4d4d", color: "#fff", border: "0", fontFamily: "Bebas Neue", cursor: "pointer", fontSize: "12px" }}>REMOVE</button>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <input disabled={!isGm} value={shadow.name} onChange={(event) => updateGm((next) => next.shadows[index].name = event.target.value)} style={{ flex: 1, background: "#fff", border: "2px solid var(--ink)", padding: "4px 8px", fontWeight: "900", fontFamily: "Bebas Neue", fontSize: "16px", color: "#000" }} />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#eee", border: "2px solid var(--ink)", padding: "4px 8px" }}>
                        <span style={{ fontFamily: "Bebas Neue", fontSize: "14px", fontWeight: "bold", color: "#000" }}>HP:</span>
                        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                          <input disabled={!isGm} type="number" value={shadow.hp} onChange={(e) => updateGm((next) => next.shadows[index].hp = Number(e.target.value))} style={{ width: "55px", textAlign: "center", border: "1px solid var(--ink)", background: "#fff", color: "#000", fontWeight: "bold", padding: "3px", fontSize: "13px" }} />
                          <span style={{ color: "#000", fontSize: "13px" }}>/</span>
                          <input disabled={!isGm} type="number" value={shadow.maxHp ?? 100} onChange={(e) => updateGm((next) => next.shadows[index].maxHp = Number(e.target.value))} style={{ width: "55px", textAlign: "center", border: "1px solid var(--ink)", background: "#fff", color: "#000", fontWeight: "bold", padding: "3px", fontSize: "13px" }} />
                        </div>
                      </div>

                      <div style={{ width: "100%", height: "130px", background: "#111", border: "2px solid var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                        {shadow.sprite ? (
                          <img src={shadow.sprite} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        ) : (
                          <span style={{ fontFamily: "Bebas Neue", color: "#555", fontSize: "14px" }}>NO SPRITE</span>
                        )}
                      </div>

                      {isGm && (
                        <label style={{ padding: "6px", textAlign: "center", cursor: "pointer", background: "var(--mint)", color: "var(--ink)", border: "2px solid var(--ink)", fontFamily: "Bebas Neue", fontSize: "14px", fontWeight: "bold", boxShadow: "2px 2px 0 var(--ink)" }}>
                          CHANGE IMAGE
                          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => handleImageUpload(event, "gm", (url) => updateGm((next) => next.shadows[index].sprite = url))} />
                        </label>
                      )}

                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <span style={{ fontFamily: "Bebas Neue", fontSize: "14px", color: "#000" }}>TL</span>
                        <input disabled={!isGm} type="number" value={shadow.threat} onChange={(event) => updateGm((next) => next.shadows[index].threat = Number(event.target.value))} style={{ width: "45px", textAlign: "center", border: "2px solid var(--ink)", background: "#fff", color: "#000", fontWeight: "bold", padding: "3px", fontSize: "13px" }} />
                        <input disabled={!isGm} value={shadow.status} placeholder="Status" onChange={(event) => updateGm((next) => next.shadows[index].status = event.target.value)} style={{ flex: 1, border: "2px solid var(--ink)", background: "#fff", color: "#000", padding: "4px 8px", fontWeight: "bold", fontSize: "13px" }} />
                      </div>

                    </div>
                  </DraggableShadowBox>
                ))}
                
                {isGm && (
                  <button 
                    type="button"
                    onClick={addShadow} 
                    style={{ 
                      position: "absolute", 
                      bottom: "24px", 
                      right: "24px", 
                      zIndex: 20,
                      padding: "10px 18px",
                      border: "3px solid var(--ink)",
                      background: "var(--mint)",
                      color: "var(--ink)",
                      fontFamily: "Bebas Neue, sans-serif",
                      fontSize: "16px",
                      cursor: "pointer",
                      boxShadow: "4px 4px 0 var(--ink)"
                    }}
                  >
                    + ADD SHADOW
                  </button>
                )}
                
                {isGm && <label className="background-upload"><strong>SWAP BACKGROUND</strong><span>JPG, PNG, WEBP</span><input type="file" accept="image/*" onChange={(event) => handleImageUpload(event, "gm", (url) => updateGm((next) => next.battle.background = url))} /></label>}
                <div className="objective-tag"><span>OBJECTIVE</span><input disabled={!isGm} value={c.battle.objective} onChange={(event) => updateGm((next) => next.battle.objective = event.target.value)} /></div>
                <div className="turn-tag"><span>ROUND</span><input disabled={!isGm} type="number" value={c.battle.round} onChange={(event) => updateGm((next) => next.battle.round = Number(event.target.value))} /></div>
              </div>}

              {/* FREE ROAM MODE */}
              {mode === "roam" && <div className={`roam-scene ${c.roam.background ? "custom-bg" : ""}`} style={{ width: "100%", height: "100%", position: "relative", ...(c.roam.background ? { backgroundImage: `url(${c.roam.background})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
                {!c.roam.background && <><div className="roam-sky"><span /><span /><span /></div><div className="roam-city"><i /><i /><i /><i /><i /><i /></div><div className="roam-road" /></>}
                {isGm && <label className="background-upload"><strong>SWAP FREE ROAM IMAGE</strong><input type="file" accept="image/*" onChange={(event) => handleImageUpload(event, "gm", (url) => updateGm((next) => next.roam.background = url))} /></label>}
                
                <div className="location-card"><span>CURRENT LOCATION</span><input disabled={!isGm} value={c.roam.location} onChange={(event) => updateGm((next) => next.roam.location = event.target.value)} /><textarea disabled={!isGm} value={c.roam.details} onChange={(event) => updateGm((next) => next.roam.details = event.target.value)} /></div>

                <div style={{ position: "absolute", top: "20px", right: "20px", width: "320px", background: "#000", color: "#fff", border: "3px solid var(--mint)", padding: "12px", boxShadow: "4px 4px 0 var(--mint)", zIndex: 15 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--mint)", paddingBottom: "6px", marginBottom: "8px" }}>
                    <strong style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: "18px", color: "var(--mint)" }}>POINTS OF INTEREST</strong>
                    {isGm && <button onClick={() => updateGm((next) => { if (!next.roam.points) next.roam.points = []; next.roam.points.push({ id: crypto.randomUUID(), title: "NEW POI", detail: "Notes..." }); })} style={{ background: "var(--mint)", border: "2px solid var(--mint)", color: "#000", padding: "2px 8px", cursor: "pointer", fontWeight: "bold", fontFamily: "Bebas Neue, sans-serif" }}>+ ADD</button>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto" }}>
                    {c.roam.points.map((point, pIdx) => (
                      <div key={point.id || pIdx} style={{ background: "#111", border: "2px solid #333", padding: "8px" }}>
                        <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                          <input disabled={!isGm} value={point.title} onChange={(e) => updateGm((next) => next.roam.points[pIdx].title = e.target.value)} style={{ flex: 1, fontWeight: "bold", border: "none", background: "transparent", color: "#fff", fontFamily: "Bebas Neue, sans-serif", fontSize: "16px" }} />
                          {isGm && <button onClick={() => updateGm((next) => next.roam.points.splice(pIdx, 1))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--mint)", fontWeight: "bold" }}>×</button>}
                        </div>
                        <textarea disabled={!isGm} value={point.detail} onChange={(e) => updateGm((next) => next.roam.points[pIdx].detail = e.target.value)} style={{ width: "100%", height: "40px", border: "1px solid #441", background: "#222", color: "#fff", fontSize: "12px", resize: "none" }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>}

              {/* MAP MODE */}
              {mode === "map" && <div className={`world-map ${c.map.background ? "custom-bg" : ""}`} style={{ width: "100%", height: "100%", position: "relative", ...(c.map.background ? { backgroundImage: `url(${c.map.background})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" } : {}) }}>
                {!c.map.background && <><div className="map-water" /><div className="district north"><span>NORTH WARD</span></div><div className="district central"><span>CENTRAL</span></div><div className="district docks"><span>DOCKS</span></div><div className="district old-town"><span>OLD TOWN</span></div></>}
                
                {c.map.pins.map((pin, index) => (
                  <div 
                    className="campaign-pin" 
                    style={{ left: `${pin.x}%`, top: `${pin.y}%`, position: "absolute", zIndex: 15 }} 
                    key={pin.id}
                    onMouseEnter={() => setHoveredPinId(pin.id)}
                    onMouseLeave={() => setHoveredPinId(null)}
                  >
                    <div style={{ display: "flex", alignItems: "center", background: "#000", color: "#fff", border: "2px solid var(--mint)", padding: "4px 8px", gap: "6px", boxShadow: "3px 3px 0 var(--mint)", cursor: "pointer" }}>
                      <img src={pin.iconUrl || PIN_ICONS[2].url} alt="" style={{ width: "20px", height: "20px", filter: "invert(1)" }} />
                      <input 
                        disabled={!isGm}
                        value={pin.label} 
                        onChange={(e) => updateGm((next) => next.map.pins[index].label = e.target.value)}
                        style={{ fontWeight: "bold", fontFamily: "Bebas Neue, sans-serif", fontSize: "15px", color: "var(--mint)", background: "transparent", border: "none", width: "90px" }} 
                      />
                      {isGm && <button onClick={() => updateGm((next) => next.map.pins.splice(index, 1))} style={{ background: "transparent", border: "none", color: "#ff4d4d", cursor: "pointer", fontWeight: "bold" }}>×</button>}
                    </div>
                    
                    {hoveredPinId === pin.id && (
                      <div style={{ position: "absolute", left: "105%", top: "0", background: "#000", color: "#fff", border: "2px solid var(--mint)", padding: "10px", boxShadow: "4px 4px 0 var(--mint)", minWidth: "180px", zIndex: 50 }}>
                        {isGm ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <span style={{ fontSize: "10px", color: "var(--mint)", fontFamily: "Bebas Neue" }}>TOOLTIP NOTES:</span>
                            <textarea 
                              value={pin.tooltip} 
                              onChange={(event) => updateGm((next) => next.map.pins[index].tooltip = event.target.value)} 
                              style={{ width: "100%", height: "55px", fontSize: "12px", border: "1px solid #444", background: "#111", color: "#fff", padding: "4px", resize: "none" }} 
                            />
                          </div>
                        ) : (
                          <div>
                            <strong style={{ color: "var(--mint)", fontFamily: "Bebas Neue", fontSize: "16px" }}>{pin.label}</strong>
                            <p style={{ margin: "4px 0 0 0", fontSize: "12px" }}>{pin.tooltip}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {isGm && <label className="background-upload"><strong>SWAP MAP IMAGE</strong><input type="file" accept="image/*" onChange={(event) => handleImageUpload(event, "gm", (url) => updateGm((next) => next.map.background = url))} /></label>}
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

      {/* FOOTER PARTY BAR */}
      <footer className="party-bar" style={{ display: "grid", gridTemplateColumns: "120px 1fr 110px", alignItems: "stretch", overflow: "hidden" }}>
        <div className="party-label">
          <span>ACTIVE</span><strong>CREW</strong>
          <i>{String(c.players.length).padStart(2, "0")} PCS</i>
          {isGm && <button onClick={handleAddNewPlayer}>+ ADD PC</button>}
        </div>

        <div className="party-members" style={{ display: "flex", gap: "8px", padding: "6px 10px", overflowX: "hidden", width: "100%", alignItems: "center" }}>
          {c.players.map((player, index) => (
            <div 
              className={`hero-card ${index % 2 ? "white" : "mint"}`} 
              key={player.id} 
              style={{ 
                display: "grid", 
                gridTemplateColumns: "1fr 1fr", 
                gridTemplateRows: "auto 1fr auto", 
                padding: "5px", 
                gap: "3px", 
                flex: "1 1 0px", 
                minWidth: "0", 
                maxWidth: "260px",
                height: "100%",
                background: "var(--paper)", 
                border: "3px solid var(--ink)", 
                boxShadow: "3px 3px 0 var(--ink)",
                overflow: "hidden" 
              }}
            >
              
              <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "3px", background: "var(--paper)", border: "2px solid var(--ink)", padding: "1px 3px", minWidth: 0 }}>
                <span style={{ background: "var(--ink)", color: "var(--paper)", fontFamily: "Bebas Neue", fontSize: "13px", padding: "0 4px", whiteSpace: "nowrap" }}>PC {index + 1}</span>
                <input
                  disabled={!isGm}
                  value={player.name}
                  onChange={(event) => updatePlayerLocal(player.id, { name: event.target.value })}
                  onBlur={(event) => persistPlayer(player.id, { name: event.target.value })}
                  placeholder="Name"
                  style={{ flex: 1, minWidth: 0, fontWeight: "bold", border: "1px solid var(--ink)", background: "#fff", padding: "1px 3px", fontFamily: "Bebas Neue", fontSize: "14px" }}
                />
                <input
                  disabled={!isGm}
                  value={player.role}
                  onChange={(event) => updatePlayerLocal(player.id, { role: event.target.value })}
                  onBlur={(event) => persistPlayer(player.id, { role: event.target.value })}
                  placeholder="Role"
                  style={{ width: "45px", minWidth: 0, border: "1px solid var(--ink)", background: "#fff", padding: "1px 2px", fontFamily: "Bebas Neue", fontSize: "12px" }}
                />
                {isGm && (
                  <button 
                    onClick={async () => {
                      try {
                        const res = await removePlayer(player.id);
                        if (res && res.campaign) setCampaign(res.campaign);
                      } catch {
                        updateGm((next) => { next.players = next.players.filter((p) => p.id !== player.id); });
                      }
                    }}
                    style={{ background: "#ff4d4d", color: "#fff", border: "1px solid var(--ink)", width: "16px", height: "16px", fontSize: "9px", cursor: "pointer", fontWeight: "bold", display: "grid", placeItems: "center", flexShrink: 0 }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <label className={`portrait ${player.art ? "has-art" : ""}`} style={{ gridColumn: "1", gridRow: "2", height: "100%", minHeight: "45px", width: "100%", border: "2px solid var(--ink)", background: "#181a20", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", overflow: "hidden" }}>
                {player.art ? <img src={player.art} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontFamily: "Bebas Neue", fontSize: "11px", color: "var(--mint)" }}>+ HERO</span>}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => handleImageUpload(event, "player", async (url) => persistPlayer(player.id, { art: url }))} />
              </label>

              <label className={`portrait persona-art ${player.personaArt ? "has-art" : ""}`} style={{ gridColumn: "2", gridRow: "2 / span 2", height: "100%", minHeight: "70px", width: "100%", border: "2px solid var(--ink)", background: "#181a20", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", overflow: "hidden" }}>
                {player.personaArt ? <img src={player.personaArt} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontFamily: "Bebas Neue", fontSize: "11px", color: "var(--mint)" }}>+ PERSONA</span>}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => handleImageUpload(event, "player", async (url) => persistPlayer(player.id, { personaArt: url }))} />
              </label>

              <div style={{ gridColumn: "1", gridRow: "3", display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                
                <div style={{ display: "flex", alignItems: "center", background: "var(--paper)", border: "2px solid var(--ink)", padding: "1px 2px", minWidth: 0 }}>
                  <span style={{ fontFamily: "Bebas Neue", fontSize: "11px", width: "16px", color: "#ff4d4d", fontWeight: "bold" }}>HP</span>
                  <input 
                    type="number" 
                    value={player.hp} 
                    onChange={(e) => updatePlayerLocal(player.id, { hp: Number(e.target.value) })} 
                    onBlur={(e) => persistPlayer(player.id, { hp: Number(e.target.value) })} 
                    style={{ width: "100%", minWidth: "22px", textAlign: "center", border: "1px solid var(--ink)", background: "#fff", fontSize: "11px", fontWeight: "bold", fontFamily: "Bebas Neue" }} 
                  />
                  <span style={{ margin: "0 1px", fontSize: "10px" }}>/</span>
                  <input 
                    type="number" 
                    value={player.maxHp ?? 100} 
                    onChange={(e) => updatePlayerLocal(player.id, { maxHp: Number(e.target.value) })} 
                    onBlur={(e) => persistPlayer(player.id, { maxHp: Number(e.target.value) })} 
                    style={{ width: "100%", minWidth: "22px", textAlign: "center", border: "1px solid var(--ink)", background: "#fff", fontSize: "11px", fontWeight: "bold", fontFamily: "Bebas Neue" }} 
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", background: "var(--paper)", border: "2px solid var(--ink)", padding: "1px 2px", minWidth: 0 }}>
                  <span style={{ fontFamily: "Bebas Neue", fontSize: "11px", width: "16px", color: "var(--mint)", fontWeight: "bold" }}>SP</span>
                  <input 
                    type="number" 
                    value={player.sp} 
                    onChange={(e) => updatePlayerLocal(player.id, { sp: Number(e.target.value) })} 
                    onBlur={(e) => persistPlayer(player.id, { sp: Number(e.target.value) })} 
                    style={{ width: "100%", minWidth: "22px", textAlign: "center", border: "1px solid var(--ink)", background: "#fff", fontSize: "11px", fontWeight: "bold", fontFamily: "Bebas Neue" }} 
                  />
                  <span style={{ margin: "0 1px", fontSize: "10px" }}>/</span>
                  <input 
                    type="number" 
                    value={player.maxSp ?? 50} 
                    onChange={(e) => updatePlayerLocal(player.id, { maxSp: Number(e.target.value) })} 
                    onBlur={(e) => persistPlayer(player.id, { maxSp: Number(e.target.value) })} 
                    style={{ width: "100%", minWidth: "22px", textAlign: "center", border: "1px solid var(--ink)", background: "#fff", fontSize: "11px", fontWeight: "bold", fontFamily: "Bebas Neue" }} 
                  />
                </div>

              </div>

            </div>
          ))}
        </div>

        <div className="phase"><span>ACCESS</span><strong>{role.toUpperCase()}</strong><small>GLOBAL</small></div>
      </footer>
    </main>
  );
}