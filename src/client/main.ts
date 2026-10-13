import {
  tacticalActions,
  skillActions,
  tacticalSpecs,
  abilityLabels,
  abilityDescriptions,
  abilityCommand,
} from "../shared/abilities";
import {
  createIcons,
  Image,
  Activity,
  Archive,
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Check,
  CircleHelp,
  Copy,
  Download,
  ExternalLink,
  FlaskConical,
  History,
  Info,
  Layers,
  LayoutDashboard,
  Lightbulb,
  LockKeyhole,
  LogIn,
  LogOut,
  Maximize,
  Monitor,
  MonitorPlay,
  Mountain,
  Pause,
  Pencil,
  Play,
  Plug,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Send,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Swords,
  Trash2,
  Trophy,
  Unplug,
  Upload,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide";
const icons = {
  Image,
  Activity,
  Archive,
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Check,
  CircleHelp,
  Copy,
  Download,
  ExternalLink,
  FlaskConical,
  History,
  Info,
  Layers,
  LayoutDashboard,
  Lightbulb,
  LockKeyhole,
  LogIn,
  LogOut,
  Maximize,
  Monitor,
  MonitorPlay,
  Mountain,
  Pause,
  Pencil,
  Play,
  Plug,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Send,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Swords,
  Trash2,
  Trophy,
  Unplug,
  Upload,
  Users,
  Workflow,
  X,
  Zap,
};
import {
  fighters as builtins,
  arenas as builtinArenas,
  defaultMappings,
  defaultSettings,
  defaultSkills,
  animationKeys,
  optionalAnimationKeys,
  mergeMappings,
  type Fighter,
  type Arena,
  type Mapping,
  type Settings,
  type MatchState,
  type Team,
  type Action,
} from "../shared/model";
import { Engine } from "../shared/engine";
let arenaApi: typeof import("./arena") | undefined;
let arenaGeneration = 0;
function destroyArena() {
  arenaGeneration++;
  arenaApi?.destroyArena();
}
function updateArena(s: MatchState) {
  arenaApi?.updateArena(s);
}
async function mountArena(parent: HTMLElement) {
  const gen = arenaGeneration;
  const module = await import("./arena");
  if (gen !== arenaGeneration || !parent.isConnected) return;
  arenaApi = module;
  module.mountArena(parent);
  module.updateArena(view === "/admin/webhooks" && sandbox ? sandbox : state);
}
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";
import "./style.css";
const root = document.querySelector<HTMLDivElement>("#app")!;
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const icon = (n: string) => `<i data-lucide="${n}"></i>`;
let state: MatchState = new Engine().state,
  sandbox: MatchState | undefined,
  roster: Fighter[] = structuredClone(builtins),
  arenaList: Arena[] = structuredClone(builtinArenas),
  settings: Settings = { ...defaultSettings },
  mappings: Mapping[] = structuredClone(defaultMappings),
  authenticated = false,
  mustChangePassword = false,
  csrf = "",
  connected = false,
  view = location.pathname,
  ws: WebSocket | undefined,
  reconnect: ReturnType<typeof setTimeout> | undefined,
  modal: HTMLElement | undefined,
  history: any[] = [],
  sandboxPoll: ReturnType<typeof setInterval> | undefined;
const controlNames: Record<string, string> = {
  manual: "Manual",
  ai: "AI fighter",
  direct: "Direct webhook",
  "ai-webhook": "AI + webhook",
  webhook: "Webhook penuh",
  hybrid: "Hybrid",
};
const actionNames: Record<string, string> = {
  move_left: "Gerak kiri",
  move_right: "Gerak kanan",
  jump: "Lompat",
  light_attack: "Light attack",
  heavy_attack: "Heavy attack",
  block: "Block",
  dodge: "Dodge",
  special_attack: "Special",
  ultimate: "Ultimate",
  energy: "Tambah energi",
  heal: "Heal",
  shield: "Shield",
  ...abilityLabels,
};
function toast(message: string, error = false) {
  const el = document.createElement("div");
  el.className = "toast " + (error ? "error" : "");
  el.setAttribute("role", "status");
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 4500);
}
async function api(path: string, data?: unknown, method?: string) {
  const res = await fetch("/api" + path, {
    method: method || (data ? "POST" : "GET"),
    headers: {
      ...(data instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      "X-CSRF-Token": csrf,
    },
    body:
      data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
  });
  const result: any = await res.json();
  if (!res.ok) {
    if (res.status === 401 && path !== "/login") {
      authenticated = false;
      mustChangePassword = false;
      csrf = "";
      login();
    }
    throw Error(result.error || "Permintaan gagal.");
  }
  return result;
}
function hydrate() {
  createIcons({ icons });
}
function navigate(path: string) {
  if (mustChangePassword) {
    void accountEditor(true);
    return;
  }
  if (path.startsWith("/admin") && !authenticated) {
    login();
    return;
  }
  view = path;
  window.history.pushState({}, "", path);
  render();
}
window.addEventListener("popstate", () => {
  view = location.pathname;
  render();
});
function modalOpen(title: string, subtitle: string, content: string) {
  modal?.remove();
  modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button class="icon-button" data-close aria-label="Tutup">${icon("x")}</button></header>${content}</section>`;
  document.body.append(modal);
  modal.querySelector("[data-close]")?.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  hydrate();
  modal.querySelector<HTMLInputElement>("input")?.focus();
}
function closeModal() {
  modal?.remove();
  modal = undefined;
}
async function accountEditor(required = false) {
  try {
    const account = await api("/account");
    modalOpen(
      "Akun admin",
      required
        ? "Ganti password awal sebelum menggunakan control room."
        : "Perubahan akan mengeluarkan semua sesi admin.",
      `<form id="account-form" class="form-stack"><label>Username<input name="username" value="${esc(account.username)}" autocomplete="username" required minlength="3" maxlength="32" pattern="[A-Za-z0-9_.-]+"></label><label>Password saat ini<input name="currentPassword" type="password" autocomplete="current-password" required maxlength="256"></label><label>Password baru<input name="newPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="256"></label><label>Ulangi password baru<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="256"></label><p class="hint">Password baru minimal 12 karakter. Password lama tidak dapat dipakai lagi setelah disimpan.</p><p class="form-error" role="alert"></p><button class="button primary" type="submit">Simpan akun dan login kembali</button></form>`,
    );
    document.querySelector<HTMLFormElement>("#account-form")!.onsubmit = async (
      e,
    ) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const d = Object.fromEntries(new FormData(form));
      if (d.newPassword !== d.confirmPassword) {
        form.querySelector(".form-error")!.textContent =
          "Konfirmasi password tidak sama.";
        return;
      }
      const button = form.querySelector<HTMLButtonElement>(
        "button[type=submit]",
      )!;
      button.disabled = true;
      try {
        await api("/account", d);
        authenticated = false;
        mustChangePassword = false;
        csrf = "";
        closeModal();
        view = "/game";
        window.history.replaceState({}, "", view);
        await render();
        toast("Akun berhasil diganti. Masuk dengan password baru.");
        login();
      } catch (error) {
        form.querySelector(".form-error")!.textContent = (
          error as Error
        ).message;
      } finally {
        button.disabled = false;
      }
    };
  } catch (error) {
    toast((error as Error).message, true);
  }
}
function login() {
  modalOpen(
    "Masuk ke control room",
    "Satu akun admin. Overlay dan arena tetap tersedia untuk penonton.",
    `<form id="login-form" class="form-stack"><label>Username<input name="username" autocomplete="username" required value="admin"></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><p class="hint">Gunakan akun yang dikonfigurasi operator. Untuk pengembangan lokal, jalankan <code>npm run admin:setup</code>.</p><p class="form-error" role="alert"></p><button class="button primary" type="submit">${icon("log-in")} Masuk</button></form>`,
  );
  document.querySelector<HTMLFormElement>("#login-form")!.onsubmit = async (
    e,
  ) => {
    e.preventDefault();
    const f = e.currentTarget as HTMLFormElement;
    try {
      const d = await api("/login", Object.fromEntries(new FormData(f)));
      csrf = d.csrf;
      authenticated = true;
      mustChangePassword = !!d.mustChangePassword;
      closeModal();
      if (mustChangePassword) {
        await accountEditor(true);
        return;
      }
      await catalog();
      navigate("/admin");
      toast("Selamat datang di control room.");
    } catch (err) {
      f.querySelector(".form-error")!.textContent = (err as Error).message;
    }
  };
}
async function catalog() {
  const c = await api("/catalog");
  roster = c.fighters;
  arenaList = c.arenas;
  settings = c.settings;
  mappings = c.mappings;
}
function connect() {
  clearTimeout(reconnect);
  ws?.close();
  ws = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/game/ws`,
  );
  ws.onopen = () => {
    connected = true;
    patchStatus();
  };
  ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.type === "state") {
      state = d.state;
      if (view !== "/admin/webhooks") updateArena(state);
      patch();
    }
  };
  ws.onclose = () => {
    connected = false;
    patchStatus();
    reconnect = setTimeout(connect, 2000);
  };
  ws.onerror = () => {
    connected = false;
    patchStatus();
  };
}
function patchStatus() {
  document.querySelectorAll("[data-connection]").forEach((el) => {
    el.className = "status-dot " + (connected ? "online" : "");
    el.textContent = connected ? "STATE SYNCED" : "RECONNECTING";
  });
}
function header(title: string, subtitle: string, extra = "") {
  return `<div class="page-heading"><div><div class="eyebrow">KIZUNA / CONTROL ROOM</div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${extra}<span class="pill preview">${icon("flask-conical")} ${esc(state.environment === "production" ? "Production" : "Preview environment")}</span></div></div>`;
}
function shell(content: string) {
  const nav = [
    ["/admin", "layout-dashboard", "Control room"],
    ["/game", "swords", "Game arena"],
    ["/admin/fighters", "users", "Fighters"],
    ["/admin/arenas", "mountain", "Arenas"],
    ["/admin/webhooks", "radio", "LIVE & webhook"],
    ["/admin/analytics", "chart-no-axes-combined", "Analytics"],
    ["/admin/settings", "sliders-horizontal", "Settings"],
  ];
  root.innerHTML = `<div class="shell"><aside class="sidebar"><a class="brand" href="/game" data-nav="/game"><span class="brand-mark">絆</span><span>KIZUNA<small>LIVE FIGHTING ARENA</small></span></a><div class="workspace-label">WORKSPACE <span>01</span></div><nav>${nav.map(([path, i, label]) => `<a href="${path}" data-nav="${path}" class="nav-link ${view === path || (path === "/admin" && view === "/admin/matches") ? "selected" : ""}">${icon(i)}<span>${label}</span>${path === "/admin/webhooks" ? '<span class="mini-dot"></span>' : ""}</a>`).join("")}</nav><div class="sidebar-bottom"><div class="live-note">${icon("radio")}<div><strong>Built for your LIVE</strong><p>Dua tim. Satu arena.<br>Setiap dukungan berarti.</p></div></div><a class="nav-link" href="/live" data-nav="/live">${icon("monitor-play")}<span>Overlay LIVE</span>${icon("arrow-up-right")}</a><button class="account" id="account"><span class="avatar-small">${authenticated ? "A" : "G"}</span><span><strong>${authenticated ? "Administrator" : "Guest spectator"}</strong><small>${authenticated ? "Single admin account" : "Masuk untuk mengelola"}</small></span>${icon(authenticated ? "log-out" : "log-in")}</button></div></aside><div class="main"><header class="topbar"><div class="breadcrumbs">Workspace <span>/</span> <strong>${view === "/game" || view === "/" ? "Game arena" : view === "/admin" ? "Control room" : view.split("/").pop()}</strong></div><div class="topbar-right"><span data-connection class="status-dot">CONNECTING</span><button class="icon-button" id="help" aria-label="Panduan kontrol">${icon("circle-help")}</button><span class="top-avatar">K</span></div></header><main class="content">${content}</main><footer class="app-footer"><span>絆 KIZUNA <b>•</b> Original anime fighting experience</span><span>Authoritative simulation · 30 ticks/s</span></footer></div></div>`;
  document.querySelectorAll<HTMLAnchorElement>("[data-nav]").forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        navigate(a.dataset.nav!);
      }),
  );
  document.querySelector("#account")!.addEventListener("click", async () => {
    if (!authenticated) return login();
    try {
      await api("/logout", {});
      authenticated = false;
      mustChangePassword = false;
      csrf = "";
      csrf = "";
      navigate("/game");
    } catch (e) {
      toast((e as Error).message, true);
    }
  });
  document.querySelector("#help")!.addEventListener("click", help);
  hydrate();
  patchStatus();
}
function help() {
  modalOpen(
    "Kontrol & alur pertandingan",
    "Admin mengendalikan seluruh lifecycle. Tidak ada auto-rematch.",
    `<div class="help-content"><h3>Tim Merah</h3><p><kbd>A</kbd> <kbd>D</kbd> gerak · <kbd>W</kbd> lompat · <kbd>J</kbd> light · <kbd>K</kbd> heavy · <kbd>L</kbd> block · <kbd>I</kbd> special · <kbd>U</kbd> ultimate · <kbd>O</kbd> dodge</p><h3>Tim Biru</h3><p><kbd>←</kbd> <kbd>→</kbd> gerak · <kbd>↑</kbd> lompat · <kbd>1</kbd> light · <kbd>2</kbd> heavy · <kbd>3</kbd> block · <kbd>4</kbd> special · <kbd>5</kbd> ultimate · <kbd>6</kbd> dodge</p><h3>Urutan operator</h3><p>Pilih fighter, arena, dan mode kontrol saat idle. Mulai pertandingan, jeda bila perlu. Setelah KO, klik ronde berikutnya. Reset diperlukan untuk mengubah konfigurasi.</p><p class="hint">Special memerlukan 25 energi; ultimate 100. Di Game arena, buka 10 aksi taktis / 10 skill. Shift+A/D/C/W/E/P/F/T/B/G memilih aksi taktis; Alt+1…0 memilih skill untuk tim pada selector MANUAL INPUT. Timeout membandingkan persentase HP. Seri tidak menambah skor. Overlay tidak menerima input.</p></div>`,
  );
}
function arenaMarkup(overlay = false) {
  return `<section class="arena-shell ${overlay ? "overlay-arena" : ""}"><div class="arena-toolbar"><span><span class="live-badge">${icon("swords")} ARENA</span> <span data-arena-title>${esc(state.arena.name)}</span></span><div><span class="tiny-pill" data-round>ROUND ${state.round}</span><button class="icon-button" id="fullscreen" aria-label="Fullscreen arena">${icon("maximize")}</button></div></div><div class="arena-viewport"><div id="phaser-stage"></div><div class="fight-hud"><div class="fighter-hud red"><img data-red-avatar src="/assets/${state.red.fighter.id in { akari: 1, ren: 1, yuki: 1, kuro: 1 } ? state.red.fighter.id : "akari"}.svg" alt=""><div class="hud-info"><div class="hud-name"><strong data-red-name>${esc(state.red.fighter.name)}</strong><span>TEAM RED</span></div><div class="hp-track"><div data-red-hp></div></div><div class="hud-values"><span data-red-health></span><span data-red-control></span></div><div class="energy-track"><div data-red-energy></div></div></div></div><div class="timer"><strong data-time>99</strong><div><span data-red-score>0</span><b>:</b><span data-blue-score>0</span></div></div><div class="fighter-hud blue"><img data-blue-avatar src="/assets/ren.svg" alt=""><div class="hud-info"><div class="hud-name"><strong data-blue-name>Ren</strong><span>TEAM BLUE</span></div><div class="hp-track"><div data-blue-hp></div></div><div class="hud-values"><span data-blue-health></span><span data-blue-control></span></div><div class="energy-track"><div data-blue-energy></div></div></div></div></div><div class="arena-state" data-arena-message></div><div class="arena-caption"><span>${icon("sparkles")} <span data-arena-subtitle>${esc(state.arena.subtitle)}</span></span><span><span data-fps>60 FPS TARGET</span> · <span data-quality>HIGH QUALITY</span></span></div></div>${overlay ? "" : `<div class="arena-controls"><div class="match-status"><span class="pulse"></span><strong data-match-status>Siap bertanding</strong><small data-mode>Classic · Best of 3</small></div><div class="control-buttons"><button class="button subtle" data-control="reset">${icon("rotate-ccw")} Reset</button><button class="button subtle" data-control="pause" id="pause-button">${icon("pause")} Jeda</button><button class="button primary" data-control="start" id="start-button">${icon("play")} Mulai pertandingan</button><button class="button danger" data-control="end" id="end-button" title="Akhiri pertandingan">${icon("square")}</button></div></div>`}</section>`;
}
function controlsOptions(c: string) {
  return Object.entries(controlNames)
    .map(
      ([v, label]) =>
        `<option value="${v}" ${c === v ? "selected" : ""}>${label}</option>`,
    )
    .join("");
}
function rosterOptions(id: string) {
  return roster
    .filter((f) => f.published && !f.disabled)
    .map(
      (f) =>
        `<option value="${f.id}" ${id === f.id ? "selected" : ""}>${esc(f.name)} · ${esc(f.element)}</option>`,
    )
    .join("");
}
function setupPanel() {
  return `<section class="panel match-setup"><div class="panel-header"><h2>${icon("sliders-horizontal")} Match setup</h2><span class="muted">Edit saat idle</span></div><div class="setup-grid">${(["red", "blue"] as Team[]).map((t) => `<div class="setup-team ${t}"><div class="section-label"><span class="team-dot"></span> TEAM ${t.toUpperCase()}</div><label>Fighter<select id="${t}-fighter">${rosterOptions(state[t].fighter.id)}</select></label><label>Control mode<select id="${t}-control">${controlsOptions(state[t].control)}</select></label></div>`).join("")}<div class="setup-rules"><div class="section-label">MATCH RULES</div><label>Arena<select id="match-arena">${arenaList.map((a) => `<option value="${a.id}" ${state.arena.id === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label><label>Mode<select id="match-mode"><option value="classic">Classic · Best of ${settings.bestOf}</option><option value="elimination">Team elimination</option><option value="endless">Endless</option></select></label></div></div><div class="setup-bottom"><span>${icon("shield-check")} Competitive balance · Manual lifecycle</span><button class="button small" id="save-match">Terapkan ${icon("arrow-right")}</button></div></section>`;
}
function dashboard() {
  return (
    header(
      "Your arena. Your rules.",
      "Siapkan pertandingan. Hubungkan penonton. Ciptakan momen LIVE.",
      `<button class="button" id="open-overlay">${icon("external-link")} Overlay</button>`,
    ) +
    `<div class="stat-grid"><div class="stat-card"><span>${icon("swords")} MATCH STATUS</span><div><strong data-stat-status>Standby</strong><small class="green">● Manual control</small></div></div><div class="stat-card"><span>${icon("users")} FIGHTER ROSTER</span><div><strong>${roster
      .filter((f) => f.published && !f.disabled)
      .length.toString()
      .padStart(
        2,
        "0",
      )}</strong><small>Original fighters</small></div></div><div class="stat-card"><span>${icon("radio")} WEBHOOK EVENTS</span><div><strong data-stat-events>0</strong><small>Internal contract</small></div></div><div class="stat-card"><span>${icon("layers")} AVAILABLE ARENAS</span><div><strong>${arenaList.length.toString().padStart(2, "0")}</strong><small>Battle-ready stages</small></div></div></div><div class="battle-layout"><div class="battle-main">${arenaMarkup()}${setupPanel()}</div><aside class="battle-side"><section class="panel live-panel"><div class="panel-header"><h2>${icon("radio")} LIVE connection</h2><span class="offline-pill" data-live-status>OFFLINE</span></div><div class="connection-symbol">${icon("unplug")}</div><h3>Bring your audience<br>into the fight.</h3><p>Hubungkan satu TikTok LIVE.<br>Penonton mendukung dua tim.</p><button class="button full" id="configure-webhook">${icon("plug")} Konfigurasi webhook</button><div class="info-line">${icon("info")} Menunggu event konektor nyata</div></section><section class="panel activity-panel"><div class="panel-header"><h2>${icon("zap")} Arena activity</h2><span class="tiny-pill">REALTIME</span></div><div id="activity-list" class="activity-list"><div class="empty-mini">${icon("activity")}<p>Belum ada aksi.<br>Mulai pertandingan untuk melihat aktivitas.</p></div></div></section><div class="tip-card">${icon("lightbulb")}<p><strong>The crowd is your combo.</strong> Gunakan Event Tester untuk mencoba mapping sebelum LIVE.</p></div></aside></div><section class="roster-strip"><div><h2>Meet your fighters</h2><p>Empat identitas. Empat cara memenangkan arena.</p></div><div class="roster-preview">${roster
      .filter((f) => f.published && !f.disabled)
      .slice(0, 4)
      .map(
        (f) =>
          `<button class="mini-fighter" data-fighter-info="${f.id}"><img src="${esc(f.appearance?.faceAsset || f.asset || "/assets/" + (builtins.some((b) => b.id === f.id) ? f.id : "akari") + ".svg")}" alt="${esc(f.name)}"><span><strong>${esc(f.name)}</strong><small>${esc(f.element)}</small></span>${icon("arrow-up-right")}</button>`,
      )
      .join("")}</div></section>`
  );
}
function bindArena() {
  const stage = document.querySelector<HTMLElement>("#phaser-stage");
  if (stage) {
    mountArena(stage);
    updateArena(view === "/admin/webhooks" && sandbox ? sandbox : state);
  }
  document.querySelector("#fullscreen")?.addEventListener("click", () => {
    const arena = document.querySelector(".arena-shell")!;
    if (document.fullscreenElement) document.exitFullscreen();
    else
      arena
        .requestFullscreen()
        .catch(() =>
          toast("Fullscreen tidak tersedia pada browser ini.", true),
        );
  });
  document
    .querySelectorAll<HTMLButtonElement>("[data-control]")
    .forEach((b) => (b.onclick = () => control(b.dataset.control!)));
}
async function control(action: string) {
  if (!authenticated) return login();
  try {
    state = await api("/game/control", { action });
    updateArena(state);
    patch();
    toast(
      (
        {
          start: "Pertandingan dimulai.",
          pause: "Pertandingan dijeda.",
          resume: "Pertandingan dilanjutkan.",
          reset: "Pertandingan direset.",
          next: "Ronde berikutnya dimulai.",
          end: "Pertandingan diakhiri.",
        } as any
      )[action],
    );
  } catch (e) {
    toast((e as Error).message, true);
  }
}
function bindDashboard() {
  bindArena();
  document
    .querySelector("#open-overlay")!
    .addEventListener("click", () => navigate("/live"));
  document
    .querySelector("#configure-webhook")!
    .addEventListener("click", () => navigate("/admin/webhooks"));
  document.querySelector("#save-match")!.addEventListener("click", async () => {
    if (!authenticated) return login();
    try {
      const get = (id: string) =>
        (document.getElementById(id) as HTMLSelectElement).value;
      const mode = get("match-mode");
      const d: any = {
        red: get("red-fighter"),
        blue: get("blue-fighter"),
        redControl: get("red-control"),
        blueControl: get("blue-control"),
        arena: get("match-arena"),
        settings: { ...settings, mode },
      };
      if (mode === "elimination") {
        d.rosters = {
          red: [
            d.red,
            ...roster
              .filter((f) => f.published && !f.disabled && f.id !== d.red)
              .map((f) => f.id),
          ],
          blue: [
            d.blue,
            ...roster
              .filter((f) => f.published && !f.disabled && f.id !== d.blue)
              .map((f) => f.id),
          ],
        };
      }
      state = await api("/game/configure", d);
      updateArena(state);
      patch();
      toast("Konfigurasi diterapkan. Klik Mulai untuk bertanding.");
    } catch (e) {
      toast((e as Error).message, true);
    }
  });
  document
    .querySelectorAll<HTMLElement>("[data-fighter-info]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          fighterInfo(roster.find((f) => f.id === b.dataset.fighterInfo)!)),
    );
}
function patch() {
  const s = view === "/admin/webhooks" && sandbox ? sandbox : state;
  const text = (selector: string, value: string) =>
    document.querySelectorAll(selector).forEach((e) => {
      e.textContent = value;
    });
  for (const t of ["red", "blue"] as Team[]) {
    const a = s[t];
    text(`[data-${t}-name]`, a.fighter.name);
    text(`[data-${t}-health]`, `${Math.ceil(a.hp)} / ${a.fighter.hp} HP`);
    text(`[data-${t}-control]`, controlNames[a.control]);
    text(`[data-${t}-score]`, String(s.scores[t]));
    document
      .querySelectorAll<HTMLElement>(`[data-${t}-hp]`)
      .forEach((el) => (el.style.width = `${(a.hp / a.fighter.hp) * 100}%`));
    document
      .querySelectorAll<HTMLElement>(`[data-${t}-energy]`)
      .forEach((el) => (el.style.width = `${a.energy}%`));
    document
      .querySelectorAll<HTMLImageElement>(`[data-${t}-avatar]`)
      .forEach((el) => {
        const src =
          a.fighter.appearance?.faceAsset ||
          a.fighter.asset ||
          "/assets/" +
            (builtins.some((f) => f.id === a.fighter.id)
              ? a.fighter.id
              : "akari") +
            ".svg";
        if (el.getAttribute("src") !== src) el.src = src;
      });
  }
  text("[data-time]", String(Math.ceil(s.time)).padStart(2, "0"));
  text("[data-round]", `ROUND ${s.round}`);
  text("[data-arena-title]", s.arena.name);
  text("[data-arena-subtitle]", s.arena.subtitle);
  text("[data-quality]", s.settings.quality.toUpperCase() + " QUALITY");
  const liveActive =
    !!state.lastWebhookAt && Date.now() - state.lastWebhookAt < 30000;
  text("[data-live-status]", liveActive ? "RECEIVING" : "OFFLINE");
  const names = {
    idle: "Siap bertanding",
    running: "Pertandingan berlangsung",
    paused: "Pertandingan dijeda",
    "round-over": "Ronde selesai",
    finished: "Pertandingan selesai",
  };
  text("[data-match-status]", names[s.status]);
  text(
    "[data-stat-status]",
    {
      idle: "Standby",
      running: "In battle",
      paused: "Paused",
      "round-over": "Round ended",
      finished: "Finished",
    }[state.status],
  );
  text("[data-stat-events]", state.stats.received.toLocaleString());
  text("[data-mode]", `${s.settings.mode} · Best of ${s.settings.bestOf}`);
  const msg = document.querySelector<HTMLElement>("[data-arena-message]");
  if (msg) {
    msg.hidden = s.status === "running";
    msg.innerHTML =
      s.status === "idle"
        ? `<span class="arena-kicker">THE STAGE IS SET</span><strong>Ready to fight?</strong><span>Admin memulai pertandingan secara manual</span>`
        : s.status === "paused"
          ? `<span class="arena-kicker">TAKE A BREATH</span><strong>PAUSED</strong><span>Menunggu admin melanjutkan pertandingan</span>`
          : `<span class="arena-kicker">${s.status === "finished" ? "MATCH COMPLETE" : "ROUND COMPLETE"}</span><strong>${s.winner === "draw" ? "DRAW" : esc(s.winner ? s[s.winner].fighter.name.toUpperCase() : "")} ${s.winner && s.winner !== "draw" ? "WINS" : ""}</strong><span>${s.status === "finished" ? "Reset untuk menyiapkan pertandingan baru" : "Menunggu admin memulai ronde berikutnya"}</span>`;
  }
  const start = document.querySelector<HTMLButtonElement>("#start-button");
  if (start) {
    const action =
      s.status === "round-over"
        ? "next"
        : s.status === "paused"
          ? "resume"
          : "start";
    start.dataset.control = action;
    start.disabled = ["running", "finished"].includes(s.status);
    start.innerHTML =
      icon("play") +
      " " +
      (action === "next"
        ? "Ronde berikutnya"
        : action === "resume"
          ? "Lanjutkan"
          : "Mulai pertandingan");
    const pause = document.querySelector<HTMLButtonElement>("#pause-button")!;
    pause.disabled = s.status !== "running";
    const end = document.querySelector<HTMLButtonElement>("#end-button")!;
    end.disabled = ["idle", "finished"].includes(s.status);
  }
  const decisions = document.querySelector("#sandbox-decisions");
  if (decisions)
    decisions.innerHTML = s.logs.length
      ? `<table><thead><tr><th>STATUS</th><th>TEAM</th><th>ACTION</th><th>REASON</th></tr></thead><tbody>${s.logs
          .slice(0, 8)
          .map(
            (l) =>
              `<tr><td>${esc(l.status)}</td><td>${esc(l.team || "—")}</td><td>${esc(l.action || l.event)}</td><td>${esc(l.reason)}</td></tr>`,
          )
          .join("")}</tbody></table>`
      : empty(
          "activity",
          "No command decisions yet.",
          "Mulai sandbox dan kirim event untuk melihat keputusan server.",
        );
  const activity = document.querySelector("#activity-list");
  if (activity && s.logs.length) {
    activity.innerHTML = s.logs
      .slice(0, 5)
      .map(
        (l) =>
          `<div class="activity-item"><span class="activity-icon ${l.team || ""}">${icon(l.event === "hit" ? "swords" : "zap")}</span><div><strong>${esc(l.action ? actionNames[l.action] || l.action : l.event)}</strong><small>${esc(l.reason)}</small></div><span class="log-status">${esc(l.status)}</span></div>`,
      )
      .join("");
  }
  document
    .querySelectorAll<HTMLSelectElement>(".match-setup select")
    .forEach((el) => (el.disabled = state.status !== "idle"));
  hydrate();
}
function fighterInfo(f: Fighter) {
  modalOpen(
    f.name,
    f.title,
    `<div class="fighter-info"><img src="${esc(f.appearance?.faceAsset || f.asset || "/assets/" + (builtins.some((b) => b.id === f.id) ? f.id : "akari") + ".svg")}" alt="${esc(f.name)}"><div><span class="pill" style="color:${f.color}">${esc(f.element)}</span><h3>${esc(f.special)}</h3><p>Special · 25 energi</p><h3>${esc(f.ultimate)}</h3><p>Ultimate · 100 energi</p><div class="stats-inline">HP ${f.hp} · ATK ${f.attack}<br>DEF ${f.defense} · SPD ${f.speed}</div><p class="hint">AI personality: ${esc(f.personality)}<br>Version ${f.version} · ${f.published ? "Published" : "Draft"}</p></div></div>`,
  );
}
function fightersPage() {
  return (
    header(
      "Fighter roster",
      "Bangun identitas petarung. Setiap versi disnapshot saat pertandingan.",
      `<button class="button primary" id="new-fighter">${icon("plus")} Buat fighter</button>`,
    ) +
    `<div class="notice">${icon("shield-check")} Empat fighter orisinal bawaan. Upload spritesheet kompatibel; gambar statis tidak otomatis menjadi animasi.</div><div class="fighter-grid">${roster
      .filter((f) => !f.disabled)
      .map(
        (f) =>
          `<article class="fighter-card" style="--fighter-color:${f.color}"><div class="fighter-art"><img src="${esc(f.appearance?.faceAsset || f.asset || "/assets/" + (builtins.some((b) => b.id === f.id) ? f.id : "akari") + ".svg")}" alt="${esc(f.name)}"><span class="tiny-pill">${f.published ? "PUBLISHED" : "DRAFT"} · V${f.version}</span><span class="fighter-element">${esc(f.element)}</span></div><div class="fighter-detail"><div class="eyebrow">${esc(f.title)}</div><h2>${esc(f.name)}</h2><p>${esc(f.special)} <span>→</span> ${esc(f.ultimate)}</p><div class="fighter-stats">${[
            ["HP", f.hp],
            ["ATK", f.attack],
            ["DEF", f.defense],
            ["SPD", f.speed],
          ]
            .map(
              ([k, v]) =>
                `<span><small>${k}</small><strong>${v}</strong></span>`,
            )
            .join(
              "",
            )}</div><div class="fighter-actions"><button class="button small" data-edit-fighter="${f.id}">${icon("pencil")} Edit fighter</button><button class="icon-button" data-preview-fighter="${f.id}" title="Uji fighter pada sandbox">${icon("flask-conical")}</button><button class="icon-button" data-duplicate="${f.id}" title="Duplikasi">${icon("copy")}</button><button class="icon-button" data-disable="${f.id}" title="Nonaktifkan">${icon("archive")}</button></div></div></article>`,
      )
      .join(
        "",
      )}</div><div class="notice">${icon("info")} Editor: statistik, warna rambut/kostum, hurtbox, skill damage/range, frame data, combo window, spritesheet dan animasi. Rig per bagian, keyframe hitbox dan voice upload masih tahap lanjutan.</div>`
  );
}
function field(
  name: string,
  label: string,
  value: unknown,
  type = "text",
  extra = "",
) {
  return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
function fighterEditor(existing?: Fighter) {
  const f = structuredClone(
    existing || {
      ...builtins[0],
      id: "",
      name: "New fighter",
      title: "YOUR ORIGINAL FIGHTER",
      published: false,
    },
  );
  modalOpen(
    existing ? "Edit " + f.name : "Create your fighter",
    "Draft dapat disimpan. Publish memerlukan statistik dan semua animasi valid.",
    `<form id="fighter-form" class="form-stack"><div class="form-grid">${field("name", "Nama", f.name, "text", 'required maxlength="32"')}${field("title", "Title", f.title)}${field("element", "Elemen", f.element)}${field("color", "Warna template", f.color, "color")}${field("hp", "HP · 500–2000", f.hp, "number", 'min="500" max="2000" required')}${field("attack", "Attack · 50–150", f.attack, "number", 'min="50" max="150" required')}${field("defense", "Defense · 50–150", f.defense, "number", 'min="50" max="150" required')}${field("speed", "Speed · 60–140", f.speed, "number", 'min="60" max="140" required')}${field("special", "Nama special", f.special)}${field("ultimate", "Nama ultimate", f.ultimate)}<label>AI personality<select name="personality">${["aggressive", "balanced", "counter", "defensive"].map((v) => `<option ${v === f.personality ? "selected" : ""}>${v}</option>`).join("")}</select></label></div><details open><summary>Character Creator · wajah dan pakaian terpisah</summary><p class="hint">Ganti satu bagian tanpa mengubah statistik atau animasi. Upload wajah hanya berlaku pada rig modular; spritesheet utuh tetap memakai gambar asalnya.</p><div class="form-grid" style="margin-top:15px"><label>Model karakter<select name="renderMode"><option value="rig" ${!f.asset ? "selected" : ""}>Rig modular · wajah/pakaian terpisah</option><option value="sheet" ${f.asset ? "selected" : ""}>Spritesheet utuh</option></select></label><label>Preset wajah<select name="facePreset"><option value="">Wajah asli</option>${["akari", "ren", "yuki", "kuro"].map((id) => `<option value="${id}" ${f.appearance?.facePreset === id ? "selected" : ""}>${id}</option>`).join("")}</select></label><label>Model pakaian<select name="outfitStyle"><option value="">Pakaian asli</option>${["samurai", "jacket", "robe"].map((id) => `<option value="${id}" ${f.appearance?.outfitStyle === id ? "selected" : ""}>${({ samurai: "Samurai", jacket: "Jaket", robe: "Jubah" } as Record<string, string>)[id]}</option>`).join("")}</select></label>${field("hairColor", "Warna rambut", f.appearance?.hairColor || { akari: "#642c40", ren: "#243c57", yuki: "#315c65", kuro: "#3d334f" }[f.id] || "#642c40", "color")}${field("outfitColor", "Warna kostum", f.appearance?.outfitColor || { akari: "#382635", ren: "#25344a", yuki: "#263e43", kuro: "#302b43" }[f.id] || "#382635", "color")}</div><div class="upload-area"><label>Wajah custom · PNG/WebP maksimal 1024 × 1024<input id="face-file" type="file" accept="image/png,image/webp"></label><p class="hint">Gunakan gambar wajah terpotong menghadap kanan, ideal 280 × 340 px dengan background transparan. Rambut bawaan dan tubuh tetap digunakan.</p><p id="face-status">${f.appearance?.faceAsset ? "Wajah custom tersimpan" : "Memakai wajah preset"}</p><button class="button small" type="button" id="remove-face">Hapus wajah custom</button><img id="face-preview" alt="Preview wajah custom" ${f.appearance?.faceAsset ? `src="${esc(f.appearance.faceAsset)}"` : "hidden"} style="max-width:140px;max-height:170px;object-fit:contain"></div></details><details><summary>Combat Editor · skill, frame data & hurtbox</summary><p class="hint">Simulasi 30 tick/s. Attack aktif setelah startup; cooldown minimal total startup + active + recovery. Hitbox mengikuti arah serangan. Frame visual tetap membutuhkan sprite yang sesuai.</p><div class="form-grid">${field("hurtWidth", "Hurtbox width · 30–100", f.combat?.hurtbox.width || 50, "number")}${field("hurtHeight", "Hurtbox height · 80–180", f.combat?.hurtbox.height || 140, "number")}${field("comboWindow", "Combo window · 15–90 tick", f.combat?.comboWindow || 45, "number")}${field("comboMultiplier", "Combo multiplier · 1–1.2", f.combat?.comboMultiplier || 1, "number", 'step="0.05"')}</div><div class="table-wrap skill-editor"><table><thead><tr><th>SKILL</th>${["damage", "range", "start", "active", "recovery", "cooldown", "cost", "energy"].map((k) => `<th>${k}</th>`).join("")}</tr></thead><tbody>${Object.entries(
      defaultSkills,
    )
      .map(
        ([key, spec]) =>
          `<tr><td title="${esc(abilityDescriptions[key] || "Serangan dasar")}">${esc(actionNames[key])}</td>${Object.entries(
            spec,
          )
            .map(
              ([prop, value]) =>
                `<td><input aria-label="${key} ${prop}" name="skill_${key}_${prop}" type="number" value="${(f.combat?.skills[key as Action] as any)?.[prop] ?? value}" required></td>`,
            )
            .join("")}</tr>`,
      )
      .join(
        "",
      )}</tbody></table></div><div class="hitbox-preview"><span>HURTBOX</span><div class="hurtbox-outline"><span>FIGHTER</span></div><div class="hitbox-outline">ACTIVE HITBOX →</div></div><p class="hint">Preview diagram: hurtbox pusat fighter, hitbox memanjang ke arah lawan. Damage/collision diputuskan server. Editor keyframe hitbox per frame belum tersedia.</p></details><div class="upload-area"><label>${icon("upload")} PNG / WebP spritesheet · Maks. 8 MB<input id="sprite-file" type="file" accept="image/png,image/webp"></label><p id="upload-status">${f.asset ? "Aset tersimpan: " + esc(f.asset) : "Opsional: gunakan template bawaan jika tidak mengunggah aset."}</p></div><div class="form-grid">${field("frameWidth", "Frame width", f.frameWidth || 128, "number", 'min="8" max="2048"')}${field("frameHeight", "Frame height", f.frameHeight || 128, "number", 'min="8" max="2048"')}</div><details ${f.asset ? "open" : ""}><summary>Mapping animasi spritesheet</summary><p class="hint">Index frame mulai 0. Sembilan animasi dasar wajib saat publish; mapping 20 ability baru opsional dan memakai pose dasar bila kosong. Gambar tunggal tidak cukup untuk pose berbeda.</p><div class="animation-table"><b>Animation</b><b>Start</b><b>End</b><b>FPS</b>${[...animationKeys, ...optionalAnimationKeys].map((k) => `<span>${k}${(optionalAnimationKeys as readonly string[]).includes(k) ? " · opsional" : ""}</span>${["start", "end", "fps"].map((prop) => `<input aria-label="${k} ${prop}" name="${k}_${prop}" type="number" min="${prop === "fps" ? 1 : 0}" value="${(f.animations?.[k] as any)?.[prop] ?? (prop === "fps" ? 12 : "")}">`).join("")}`).join("")}</div></details><p class="form-error" role="alert"></p><div class="modal-actions"><button class="button" type="submit" name="publish" value="no">Simpan draft</button><button class="button primary" type="submit" name="publish" value="yes">${icon("check")} Publish fighter</button></div></form>`,
  );
  let asset = f.asset;
  let faceAsset = f.appearance?.faceAsset;
  let faceUploading = false;
  const faceInput = document.querySelector<HTMLInputElement>("#face-file")!;
  faceInput.onchange = async () => {
    const file = faceInput.files?.[0];
    if (!file) return;
    faceUploading = true;
    try {
      const data = new FormData();
      data.set("file", file);
      const uploaded = await api("/upload", data);
      if (uploaded.width > 1024 || uploaded.height > 1024)
        throw Error("Wajah maksimal 1024 × 1024 px.");
      faceAsset = uploaded.asset;
      const preview =
        document.querySelector<HTMLImageElement>("#face-preview")!;
      preview.src = faceAsset!;
      preview.hidden = false;
      document.querySelector("#face-status")!.textContent =
        `${file.name} · wajah siap disimpan`;
      document.querySelector<HTMLSelectElement>(
        'select[name="renderMode"]',
      )!.value = "rig";
    } catch (error) {
      toast((error as Error).message, true);
    } finally {
      faceUploading = false;
      faceInput.value = "";
    }
  };
  document.querySelector("#remove-face")!.addEventListener("click", () => {
    if (faceUploading) return;
    faceAsset = undefined;
    document.querySelector<HTMLImageElement>("#face-preview")!.hidden = true;
    document.querySelector("#face-status")!.textContent =
      "Memakai wajah preset";
  });
  document.querySelector<HTMLInputElement>("#sprite-file")!.onchange = async (
    e,
  ) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const form = new FormData();
      form.set("file", file);
      const d = await api("/upload", form);
      asset = d.asset;
      document.querySelector("#upload-status")!.textContent =
        `${file.name} · ${d.width} × ${d.height} px — upload berhasil`;
      toast("Aset tervalidasi. Lengkapi mapping animasi.");
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  document.querySelector<HTMLFormElement>("#fighter-form")!.onsubmit = async (
    e,
  ) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    if (faceUploading) {
      toast("Tunggu upload wajah selesai.", true);
      return;
    }
    const d = Object.fromEntries(new FormData(form));
    const modular = d.renderMode === "rig";
    const next: any = {
      ...f,
      name: d.name,
      title: d.title,
      element: d.element,
      color: d.color,
      special: d.special,
      ultimate: d.ultimate,
      personality: d.personality,
      asset: modular ? undefined : asset,
      published: (e as SubmitEvent).submitter?.getAttribute("value") === "yes",
    };
    for (const k of [
      "hp",
      "attack",
      "defense",
      "speed",
      "frameWidth",
      "frameHeight",
    ])
      next[k] = Number(d[k]);
    next.appearance = {
      hairColor: d.hairColor,
      outfitColor: d.outfitColor,
      ...(modular
        ? {
            facePreset: d.facePreset || undefined,
            outfitStyle: d.outfitStyle || undefined,
            faceAsset,
          }
        : {}),
    };
    next.combat = {
      hurtbox: { width: Number(d.hurtWidth), height: Number(d.hurtHeight) },
      comboWindow: Number(d.comboWindow),
      comboMultiplier: Number(d.comboMultiplier),
      skills: {},
    };
    for (const [key, spec] of Object.entries(defaultSkills)) {
      next.combat.skills[key] = {};
      for (const prop of Object.keys(spec))
        next.combat.skills[key][prop] = Number(d["skill_" + key + "_" + prop]);
    }
    if (next.asset) {
      next.animations = {};
      for (const key of [...animationKeys, ...optionalAnimationKeys]) {
        if (d[key + "_start"] === "" || d[key + "_end"] === "") {
          const optional = (
            optionalAnimationKeys as readonly string[]
          ).includes(key);
          if (
            (!next.published || optional) &&
            d[key + "_start"] === "" &&
            d[key + "_end"] === ""
          )
            continue;
          form.querySelector(".form-error")!.textContent =
            `Mapping ${key} belum lengkap.`;
          return;
        }
        next.animations[key] = {
          start: Number(d[key + "_start"]),
          end: Number(d[key + "_end"]),
          fps: Number(d[key + "_fps"]),
        };
      }
    }
    try {
      await api("/fighters", next);
      await catalog();
      closeModal();
      render();
      toast(
        next.published
          ? "Fighter dipublikasikan ke roster."
          : "Draft fighter disimpan.",
      );
    } catch (e) {
      form.querySelector(".form-error")!.textContent = (e as Error).message;
    }
  };
}
function arenasPage() {
  return (
    header(
      "Choose your battleground",
      "Tiga dunia orisinal. Kualitas render tidak mengubah simulasi combat.",
      `<button class="button primary" id="new-arena">${icon("plus")} Buat arena</button>`,
    ) +
    `<div class="arena-grid">${arenaList.map((a) => `<article class="arena-card"><div class="arena-art ${a.theme}"><div class="art-moon"></div><div class="art-mountain"></div><div class="art-gate">${a.theme === "city" ? "夜" : a.theme === "void" ? "◯" : "鳥居"}</div><span class="tiny-pill">${a.hazard ? "HAZARD · SUPPORT MODE" : "COMPETITIVE SAFE"}</span></div><div class="arena-detail"><div class="eyebrow">${a.theme.toUpperCase()} STAGE</div><h2>${esc(a.name)}</h2><p>${esc(a.subtitle)}</p><button class="button" data-edit-arena="${a.id}">${icon("sliders-horizontal")} Edit arena</button><button class="button subtle" data-use-arena="${a.id}">Pilih ${icon("arrow-right")}</button></div></article>`).join("")}</div><div class="notice">${icon("info")} Editor menggunakan tiga template procedural atau background PNG/WebP sendiri. Hazard diproses server dalam mode support/dynamic, dan dimatikan otomatis di competitive. Multilayer, destructible objects dan trigger dinamis belum tersedia.</div>`
  );
}
function arenaEditor(a?: Arena) {
  const f = a || { ...builtinArenas[0], id: "", name: "New arena" };
  modalOpen(
    a ? "Edit arena" : "New battleground",
    "Konfigurasi template tidak mengubah pertandingan yang sedang berjalan.",
    `<form id="arena-form" class="form-stack">${field("name", "Nama arena", f.name, "text", 'required maxlength="40"')}${field("subtitle", "Deskripsi", f.subtitle)}${field("color", "Accent", f.color, "color")}<label>Template<select name="theme">${["shrine", "city", "void"].map((t) => `<option ${t === f.theme ? "selected" : ""}>${t}</option>`).join("")}</select></label><div class="upload-area"><label>${icon("image")} Background PNG/WebP · maks. 8 MB<input id="background-file" type="file" accept="image/png,image/webp"></label><p id="background-status">${f.background ? "Background tersimpan." : "Opsional, gunakan template tanpa upload."}</p></div><label class="checkbox"><input name="hazard" type="checkbox" ${f.hazard ? "checked" : ""}> Aktifkan hazard (non-competitive)</label><div class="form-grid">${field("hazardX", "Posisi X · 100–900", f.hazardX || 500, "number")}${field("hazardRadius", "Radius · 30–120", f.hazardRadius || 70, "number")}${field("hazardDamage", "Damage / 2 detik · 1–20", f.hazardDamage || 10, "number")}</div><p class="hint">Area render background 1000 × 420; floor tetap Y=420. Hazard hanya mengenai fighter di tanah dan selalu mati di competitive.</p><p class="form-error" role="alert"></p><button class="button primary">Simpan arena</button></form>`,
  );
  let background = f.background;
  document.querySelector<HTMLInputElement>("#background-file")!.onchange =
    async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const form = new FormData();
        form.set("file", file);
        const d = await api("/upload", form);
        background = d.asset;
        document.querySelector("#background-status")!.textContent =
          `${file.name} · ${d.width} × ${d.height}px`;
        toast("Background diunggah.");
      } catch (e) {
        toast((e as Error).message, true);
      }
    };
  document.querySelector<HTMLFormElement>("#arena-form")!.onsubmit = async (
    e,
  ) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    try {
      const d = Object.fromEntries(new FormData(form));
      await api("/arenas", {
        ...f,
        ...d,
        background,
        hazard: d.hazard === "on",
        hazardX: Number(d.hazardX),
        hazardRadius: Number(d.hazardRadius),
        hazardDamage: Number(d.hazardDamage),
        floor: 420,
      });
      await catalog();
      closeModal();
      render();
      toast("Arena disimpan.");
    } catch (e) {
      form.querySelector(".form-error")!.textContent = (e as Error).message;
    }
  };
}
function webhooksPage() {
  return (
    header(
      "The audience enters the arena.",
      "Satu LIVE. Dua tim. Setiap event memiliki rute yang dapat diperiksa.",
    ) +
    `<div class="notice warning">${icon("info")} Adapter tiktok-live-konektor tersedia. Atur webhook HTTPS dan secret HMAC pada kedua layanan. Penerimaan event tidak memulai pertandingan secara otomatis.</div><div class="webhook-layout"><section class="panel"><div class="panel-header"><h2>${icon("plug")} Webhook receiver</h2><span class="offline-pill">HMAC RECEIVER</span></div><div class="panel-body"><label>Endpoint tiktok-live-konektor<div class="copy-field"><input readonly value="${esc(location.origin + "/api/game/tiktok")}" id="webhook-url"><button class="icon-button" id="copy-endpoint" aria-label="Salin endpoint">${icon("copy")}</button></div></label><div class="info-line">${icon("lock-keyhole")} HMAC-SHA256 · x-tlk-timestamp · x-tlk-signature</div><p class="hint">WEBHOOK_SIGNING_SECRET yang sama pada konektor dan Worker, minimal 32 karakter. Nilai tidak dikirim ke browser. Pilih chat, like, gift, follow, share di dashboard konektor.</p><div class="contract-code"><code>{<br>&nbsp; "id": "provider-event-uuid",<br>&nbsp; "version": 1,<br>&nbsp; "event": "chat",<br>&nbsp; "timestamp": "ISO-8601 timestamp",<br>&nbsp; "roomId": "room-id",<br>&nbsp; "data": { "username": "viewer", "message": "!attack" }<br>}</code></div><p class="hint">Identitas sementara memakai username konektor; ID TikTok belum disediakan. Envelope/signature maksimal berumur 30 detik. Endpoint internal Bearer tetap tersedia di <code>/api/game/webhook</code>.</p><p class="hint">Join: <code>!merah</code> / <code>!biru</code> · TTL ${settings.ttl}ms · Cap ${settings.queueCap}/tim · Strategy ${settings.strategy}</p></div></section><section class="panel tester-panel"><div class="panel-header"><h2>${icon("flask-conical")} Event Tester</h2><span class="pill preview">SANDBOX ONLY</span></div><div class="panel-body"><p class="hint">State sandbox terpisah. Tidak menulis riwayat atau skor lingkungan utama.</p><div class="sandbox-buttons"><button class="button primary small" id="sandbox-start">${icon("play")} Mulai sandbox</button><button class="button small" id="sandbox-reset">${icon("rotate-ccw")} Reset sandbox</button></div><form id="tester-form" class="form-stack"><div class="form-grid"><label>Tim<select name="team"><option value="red">Merah</option><option value="blue">Biru</option></select></label>${field("user_id", "Stable user ID", "tester-red", "text", 'required maxlength="100"')}<label>Event<select name="event_type">${["comment", "like", "gift", "follow", "share"].map((v) => `<option>${v}</option>`).join("")}</select></label>${field("text", "Komentar / gift", "!attack", "text", 'maxlength="100"')}${field("count", "Jumlah", 1, "number", 'min="1" max="100"')}</div><button class="button primary" type="submit">${icon("send")} Kirim event sandbox</button></form><button class="button subtle small" id="send-duplicate">${icon("copy")} Uji ID duplikat terakhir</button><div class="decision-box" id="tester-result" role="status"><span>WAITING FOR EVENT</span><p>Mulai sandbox, lalu kirim event sintetis.</p></div></div></section></div><div class="sandbox-stage">${arenaMarkup(true)}</div><section class="panel"><div class="panel-header"><h2>${icon("activity")} Sandbox command decisions</h2><span class="tiny-pill">SERVER LOG</span></div><div id="sandbox-decisions" class="table-wrap"></div></section><section class="panel mapping-panel"><div class="panel-header"><h2>${icon("workflow")} Event mapping</h2><button class="button small" id="import-abilities">${icon("plus")} Import 20 ability</button><button class="button small" id="new-mapping">${icon("plus")} Tambah mapping</button></div><div class="table-wrap"><table><thead><tr><th>EVENT</th><th>COMMAND / GIFT</th><th>ACTION</th><th>TEAM</th><th>PRIORITY</th><th>AMOUNT</th><th></th></tr></thead><tbody>${mappings.map((m) => `<tr><td><span class="event-tag">${esc(m.event)}</span></td><td><code>${esc(m.command || "—")}</code></td><td>${esc(actionNames[m.action])}</td><td>${esc(m.team)}</td><td>${m.priority}</td><td>${m.amount}</td><td><button class="icon-button" data-edit-mapping="${esc(m.id)}" aria-label="Edit mapping">${icon("pencil")}</button><button class="icon-button" data-delete-mapping="${esc(m.id)}" aria-label="Hapus mapping">${icon("trash-2")}</button></td></tr>`).join("")}</tbody></table></div></section>`
  );
}
function mappingEditor(existing?: Mapping) {
  const m = existing || {
    id: crypto.randomUUID(),
    event: "comment",
    command: "!heavy",
    action: "heavy_attack",
    team: "any",
    priority: 1,
    amount: 1,
  };
  modalOpen(
    "Event mapping",
    "Mapping dipakai oleh receiver dan sandbox; state pertandingan tetap terpisah.",
    `<form id="mapping-form" class="form-stack"><div class="form-grid"><label>Event<select name="event">${["comment", "gift", "like", "follow", "share"].map((v) => `<option ${m.event === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>${field("command", "Command / gift name", m.command, "text", 'maxlength="100"')}<label>Aksi<select name="action">${Object.entries(
      actionNames,
    )
      .map(
        ([v, label]) =>
          `<option value="${v}" ${m.action === v ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Tim<select name="team">${["any", "red", "blue"].map((v) => `<option ${m.team === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>${field("priority", "Priority · 0–10", m.priority, "number", 'min="0" max="10" required')}${field("amount", "Reward amount · 1–100", m.amount, "number", 'min="1" max="100" required')}</div><p class="form-error" role="alert"></p><button class="button primary">Simpan mapping</button></form>`,
  );
  document.querySelector<HTMLFormElement>("#mapping-form")!.onsubmit = async (
    e,
  ) => {
    e.preventDefault();
    const f = e.currentTarget as HTMLFormElement,
      d = Object.fromEntries(new FormData(f));
    try {
      await api("/mappings", [
        ...mappings.filter((v) => v.id !== m.id),
        { ...m, ...d, priority: Number(d.priority), amount: Number(d.amount) },
      ]);
      await catalog();
      closeModal();
      render();
      toast("Mapping disimpan.");
    } catch (e) {
      f.querySelector(".form-error")!.textContent = (e as Error).message;
    }
  };
}
let lastEvent: any;
async function bindWebhooks() {
  bindArena();
  document
    .querySelector("#import-abilities")!
    .addEventListener("click", async () => {
      const next = mergeMappings(mappings);
      if (next.length > 50)
        return toast(
          "Maksimal 50 mapping. Hapus mapping yang tidak dipakai sebelum import.",
          true,
        );
      try {
        await api("/mappings", next);
        await catalog();
        render();
        toast("Mapping 20 ability tersedia; mapping lama dipertahankan.");
      } catch (e) {
        toast((e as Error).message, true);
      }
    });
  document
    .querySelector("#copy-endpoint")!
    .addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(
          (document.querySelector("#webhook-url") as HTMLInputElement).value,
        );
        toast("Endpoint disalin.");
      } catch {
        toast("Salin endpoint dari kolom URL.", true);
      }
    });
  const poll = async () => {
    try {
      sandbox = await api("/sandbox/state");
      if (view === "/admin/webhooks") {
        updateArena(sandbox!);
        patch();
      }
    } catch {
      clearInterval(sandboxPoll);
    }
  };
  await poll();
  sandboxPoll = setInterval(poll, 750);
  document
    .querySelector("#sandbox-start")!
    .addEventListener("click", async () => {
      try {
        if (sandbox?.status === "idle") {
          await api("/sandbox/configure", {
            redControl: "webhook",
            blueControl: "webhook",
            settings: { ...settings, duration: 300 },
          });
          sandbox = await api("/sandbox/control", { action: "start" });
        } else if (sandbox?.status === "paused")
          sandbox = await api("/sandbox/control", { action: "resume" });
        else if (sandbox?.status === "round-over")
          sandbox = await api("/sandbox/control", { action: "next" });
        else throw Error("Reset sandbox sebelum memulai ulang.");
        updateArena(sandbox!);
        patch();
        toast("Sandbox aktif. Tidak memengaruhi match utama.");
      } catch (e) {
        toast((e as Error).message, true);
      }
    });
  document
    .querySelector("#sandbox-reset")!
    .addEventListener("click", async () => {
      try {
        sandbox = await api("/sandbox/control", { action: "reset" });
        lastEvent = undefined;
        updateArena(sandbox!);
        patch();
        toast("Sandbox direset.");
      } catch (e) {
        toast((e as Error).message, true);
      }
    });
  const result = (d: any) => {
    const el = document.querySelector("#tester-result");
    if (el)
      el.innerHTML = `<span class="${d.status === "rejected" ? "red-text" : "green"}">${esc(d.status.toUpperCase())} ${d.team ? "→ TEAM " + esc(d.team.toUpperCase()) : ""}</span><strong>${esc(d.action ? actionNames[d.action] || d.action : "Event decision")}</strong><p>${esc(d.reason)}</p>`;
  };
  document.querySelector<HTMLSelectElement>(
    "#tester-form select[name=team]",
  )!.onchange = (e) => {
    const input = document.querySelector<HTMLInputElement>(
      "#tester-form input[name=user_id]",
    )!;
    if (["tester-red", "tester-blue"].includes(input.value))
      input.value = "tester-" + (e.target as HTMLSelectElement).value;
  };
  document.querySelector<HTMLFormElement>("#tester-form")!.onsubmit = async (
    e,
  ) => {
    e.preventDefault();
    const d = Object.fromEntries(
      new FormData(e.currentTarget as HTMLFormElement),
    );
    try {
      const base = {
        source: "tiktok-live-konektor",
        user_id: d.user_id,
        event_type: "comment",
        occurred_at: new Date().toISOString(),
      };
      const join = await api("/sandbox/event", {
        ...base,
        event_id: crypto.randomUUID(),
        text: d.team === "red" ? "!merah" : "!biru",
      });
      if (join.status === "rejected") {
        result(join);
        return;
      }
      lastEvent = {
        ...base,
        event_id: crypto.randomUUID(),
        event_type: d.event_type,
        text: d.text,
        gift: d.text,
        count: Number(d.count),
        streak_finished: true,
      };
      result(await api("/sandbox/event", lastEvent));
      await poll();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  document
    .querySelector("#send-duplicate")!
    .addEventListener("click", async () => {
      if (!lastEvent) return toast("Kirim event terlebih dahulu.", true);
      try {
        result(await api("/sandbox/event", lastEvent));
      } catch (e) {
        toast((e as Error).message, true);
      }
    });
  document
    .querySelector("#new-mapping")!
    .addEventListener("click", () => mappingEditor());
  document
    .querySelectorAll<HTMLElement>("[data-edit-mapping]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          mappingEditor(mappings.find((m) => m.id === b.dataset.editMapping))),
    );
  document.querySelectorAll<HTMLElement>("[data-delete-mapping]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await api(
            "/mappings",
            mappings.filter((m) => m.id !== b.dataset.deleteMapping),
          );
          await catalog();
          render();
          toast("Mapping dihapus.");
        } catch (e) {
          toast((e as Error).message, true);
        }
      }),
  );
}
function settingsPage() {
  return (
    header(
      "Fine-tune the experience.",
      "Balance, antrean, AI, dan kualitas. Terapkan ke match saat idle.",
    ) +
    `<form id="settings-form" class="settings-layout"><section class="panel"><div class="panel-header"><h2>${icon("swords")} Combat & balance</h2></div><div class="panel-body form-grid"><label>Balance preset<select name="balance">${["competitive", "support", "dynamic"].map((v) => `<option ${settings.balance === v ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>AI difficulty<select name="difficulty">${["easy", "normal", "hard"].map((v) => `<option ${settings.difficulty === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>${field("duration", "Durasi ronde · detik", settings.duration, "number", 'min="10" max="300" required')}${field("bestOf", "Best of · ganjil", settings.bestOf, "number", 'min="1" max="9" step="2" required')}${field("damageScale", "Damage multiplier", settings.damageScale, "number", 'min="0.2" max="2" step="0.1" required')}${field("rewardCap", "Reward cap / tim / detik", settings.rewardCap, "number", 'min="0" max="100" required')}</div><p class="panel-note">Competitive menolak heal. Support mengizinkan reward terbatas. Dynamic saat ini memakai cap yang sama; auto-balancing belum aktif.</p></section><section class="panel"><div class="panel-header"><h2>${icon("workflow")} Smart Command Engine</h2></div><div class="panel-body form-grid"><label>Strategi<select name="strategy">${["fifo", "priority", "voting"].map((v) => `<option ${settings.strategy === v ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>Pengguna tanpa tim<select name="unknown"><option value="assign" ${settings.unknown === "assign" ? "selected" : ""}>Auto assign</option><option value="ignore" ${settings.unknown === "ignore" ? "selected" : ""}>Abaikan</option></select></label>${field("ttl", "Command TTL · ms", settings.ttl, "number", 'min="500" max="10000" required')}${field("queueCap", "Queue cap / tim", settings.queueCap, "number", 'min="1" max="100" required')}${field("userQuota", "User quota / detik", settings.userQuota, "number", 'min="1" max="20" required')}${field("votingWindow", "Voting window · ms", settings.votingWindow, "number", 'min="100" max="2000" required')}<label class="checkbox"><input name="allowSwitch" type="checkbox" ${settings.allowSwitch ? "checked" : ""}> Izinkan pindah tim</label></div><p class="panel-note">Tie voting: urutan aksi tetap. Priority: priority → timestamp → event ID. Tidak ada aksi ganda pada satu tick.</p></section><section class="panel"><div class="panel-header"><h2>${icon("monitor")} Performance & audio</h2></div><div class="panel-body form-grid"><label>Kualitas<select name="quality">${["low", "medium", "high"].map((v) => `<option ${settings.quality === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>${field("volume", "SFX volume · 0–1", settings.volume, "number", 'min="0" max="1" step="0.1" required')}<label class="checkbox"><input type="checkbox" name="sound" ${settings.sound ? "checked" : ""}> SFX hit sintetis</label><label class="checkbox"><input type="checkbox" name="tts" ${settings.tts ? "checked" : ""}> Announcer browser TTS</label></div><p class="panel-note">Audio aktif setelah interaksi browser. BGM dan voice fighter belum disediakan. TTS hanya pengumuman ronde, maksimal satu per 5 detik.</p></section><section class="panel"><div class="panel-header"><h2>${icon("shield")} Data & privacy</h2></div><div class="panel-body form-stack">${field("retentionDays", "Retensi riwayat · hari", settings.retentionDays, "number", 'min="1" max="365" required')}<p class="hint">Riwayat menyimpan ID kontribusi penonton. Retensi berjalan saat match selesai. Tetapkan pemberitahuan privasi sebelum production.</p><button type="button" class="button danger" id="clear-history">${icon("trash-2")} Hapus seluruh riwayat</button></div></section><div class="settings-submit"><p>Perubahan tersimpan tidak mengganti snapshot match yang aktif.</p><button class="button primary" type="submit">${icon("save")} Simpan pengaturan</button></div></form>`
  );
}
function analyticsPage() {
  const wins: Record<
    string,
    { name: string; wins: number; matches: number; damage: number }
  > = {};
  for (const m of history) {
    const s = m.result as MatchState;
    for (const t of ["red", "blue"] as Team[]) {
      const f = s[t].fighter;
      wins[f.id] ??= { name: f.name, wins: 0, matches: 0, damage: 0 };
      wins[f.id].matches++;
      wins[f.id].damage += s[t].damage;
      if (s.winner === t) wins[f.id].wins++;
    }
  }
  return (
    header(
      "Every battle tells a story.",
      "Riwayat match selesai pada lingkungan ini. Sandbox tidak masuk analytics.",
      `<button class="button" id="export-json">${icon("download")} JSON</button><button class="button" id="export-csv">${icon("download")} CSV</button>`,
    ) +
    `<div class="stat-grid"><div class="stat-card"><span>${icon("swords")} MATCHES</span><div><strong>${history.length}</strong><small>Latest 100</small></div></div><div class="stat-card"><span>${icon("zap")} DAMAGE DEALT</span><div><strong>${history.reduce((a, m) => a + (m.result.totalDamage?.red ?? m.result.red.damage) + (m.result.totalDamage?.blue ?? m.result.blue.damage), 0).toLocaleString()}</strong><small>Both teams</small></div></div><div class="stat-card"><span>${icon("radio")} EVENTS RECEIVED</span><div><strong>${history.reduce((a, m) => a + m.result.stats.received, 0)}</strong><small>Completed matches</small></div></div><div class="stat-card"><span>${icon("shield-check")} EVENTS APPLIED</span><div><strong>${history.reduce((a, m) => a + m.result.stats.applied, 0)}</strong><small>Validated commands</small></div></div></div><section class="panel"><div class="panel-header"><h2>${icon("trophy")} Fighter leaderboard</h2></div>${
      Object.keys(wins).length
        ? `<div class="table-wrap"><table><thead><tr><th>FIGHTER</th><th>MATCHES</th><th>WINS</th><th>WIN RATE</th><th>DAMAGE</th></tr></thead><tbody>${Object.values(
            wins,
          )
            .sort((a, b) => b.wins - a.wins)
            .map(
              (v, i) =>
                `<tr><td><b class="rank">${i + 1}</b> ${esc(v.name)}</td><td>${v.matches}</td><td>${v.wins}</td><td>${Math.round((v.wins / v.matches) * 100)}%</td><td>${v.damage}</td></tr>`,
            )
            .join("")}</tbody></table></div>`
        : empty(
            "trophy",
            "The first victory is still ahead.",
            "Selesaikan pertandingan untuk mulai mengisi leaderboard.",
          )
    }</section><section class="panel history-panel"><div class="panel-header"><h2>${icon("history")} Match history</h2><span class="muted">${esc(state.environment.toUpperCase())} ONLY</span></div>${history.length ? `<div class="table-wrap"><table><thead><tr><th>DATE</th><th>MATCH</th><th>MODE</th><th>RESULT</th><th>SCORE</th></tr></thead><tbody>${history.map((m) => `<tr><td>${esc(new Date(m.ended_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }))}</td><td>${esc(m.result.red.fighter.name)} <small>vs</small> ${esc(m.result.blue.fighter.name)}</td><td>${esc(m.result.settings.mode)}</td><td><span class="pill">${m.result.winner === "draw" ? "DRAW" : esc(m.result[m.result.winner]?.fighter.name || "—")}</span></td><td>${m.result.scores.red} : ${m.result.scores.blue}</td></tr>`).join("")}</tbody></table></div>` : empty("history", "No matches yet.", "Lifecycle manual. Klik End atau tuntaskan best-of untuk merekam hasil.")}</section>`
  );
}
function empty(i: string, title: string, subtitle: string) {
  return `<div class="empty-state">${icon(i)}<h3>${title}</h3><p>${subtitle}</p></div>`;
}
function download(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
async function render() {
  clearInterval(sandboxPoll);
  destroyArena();
  if (view === "/live" || view === "/overlay") {
    document.body.classList.add("overlay-body");
    const portrait =
      new URLSearchParams(location.search).get("layout") === "portrait";
    root.innerHTML = `<main class="overlay-page ${portrait ? "portrait" : ""}"><div class="overlay-brand"><span class="brand-mark">絆</span><strong>KIZUNA <small>LIVE ARENA</small></strong><span data-connection class="status-dot">CONNECTING</span></div>${arenaMarkup(true)}<div class="overlay-bottom"><span>TEAM RED <b>VS</b> TEAM BLUE</span><p>Join your team · !merah / !biru</p></div></main>`;
    document.querySelector("#fullscreen")?.remove();
    bindArena();
    patch();
    patchStatus();
    return;
  }
  document.body.classList.remove("overlay-body");
  if (view.startsWith("/admin") && !authenticated) {
    view = "/game";
    window.history.replaceState({}, "", view);
    login();
  }
  if (view === "/admin/fighters") {
    shell(fightersPage());
    document
      .querySelector("#new-fighter")!
      .addEventListener("click", () => fighterEditor());
    document
      .querySelectorAll<HTMLElement>("[data-edit-fighter]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            fighterEditor(roster.find((f) => f.id === b.dataset.editFighter))),
      );
    document.querySelectorAll<HTMLElement>("[data-preview-fighter]").forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            await api("/sandbox/control", { action: "reset" });
            await api("/sandbox/configure", {
              red: b.dataset.previewFighter,
              blue: "ren",
              redControl: "ai",
              blueControl: "ai",
              settings: { ...settings, duration: 30 },
            });
            sandbox = await api("/sandbox/control", { action: "start" });
            navigate("/admin/webhooks");
            toast(
              "Preview fighter dimulai pada sandbox. Match utama tetap terpisah.",
            );
          } catch (e) {
            toast((e as Error).message, true);
          }
        }),
    );
    document.querySelectorAll<HTMLElement>("[data-duplicate]").forEach(
      (b) =>
        (b.onclick = () =>
          fighterEditor({
            ...roster.find((f) => f.id === b.dataset.duplicate)!,
            id: "",
            version: 0,
            name:
              "Copy " + roster.find((f) => f.id === b.dataset.duplicate)!.name,
            published: false,
          })),
    );
    document.querySelectorAll<HTMLElement>("[data-disable]").forEach(
      (b) =>
        (b.onclick = () => {
          modalOpen(
            "Nonaktifkan fighter?",
            "Versi historis dan snapshot pertandingan tetap dipertahankan.",
            `<p>Fighter ini tidak akan tersedia pada pemilihan pertandingan baru.</p><button class="button danger" id="confirm-disable">Nonaktifkan</button>`,
          );
          document
            .querySelector("#confirm-disable")!
            .addEventListener("click", async () => {
              try {
                await api("/fighters", { id: b.dataset.disable }, "DELETE");
                await catalog();
                closeModal();
                render();
                toast("Fighter dinonaktifkan.");
              } catch (e) {
                toast((e as Error).message, true);
              }
            });
        }),
    );
  } else if (view === "/admin/arenas") {
    shell(arenasPage());
    document
      .querySelector("#new-arena")!
      .addEventListener("click", () => arenaEditor());
    document
      .querySelectorAll<HTMLElement>("[data-edit-arena]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            arenaEditor(arenaList.find((a) => a.id === b.dataset.editArena))),
      );
    document.querySelectorAll<HTMLElement>("[data-use-arena]").forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            state = await api("/game/configure", { arena: b.dataset.useArena });
            navigate("/admin");
            toast("Arena dipilih.");
          } catch (e) {
            toast((e as Error).message, true);
          }
        }),
    );
  } else if (view === "/admin/webhooks") {
    shell(webhooksPage());
    await bindWebhooks();
  } else if (view === "/admin/settings") {
    shell(
      settingsPage() +
        `<section class="panel"><div class="panel-header"><h2>Akun admin</h2><button class="button" id="edit-account">Ganti username / password</button></div><p class="panel-note">Perubahan akun berlaku untuk lingkungan ini dan mengeluarkan semua sesi admin.</p></section>`,
    );
    document
      .querySelector("#edit-account")!
      .addEventListener("click", () => void accountEditor());
    document.querySelector<HTMLFormElement>("#settings-form")!.onsubmit =
      async (e) => {
        e.preventDefault();
        const f = e.currentTarget as HTMLFormElement;
        const d = Object.fromEntries(new FormData(f));
        const next: any = {
          ...settings,
          ...d,
          allowSwitch: d.allowSwitch === "on",
          sound: d.sound === "on",
          tts: d.tts === "on",
        };
        for (const k of [
          "duration",
          "bestOf",
          "damageScale",
          "rewardCap",
          "ttl",
          "queueCap",
          "userQuota",
          "votingWindow",
          "volume",
          "retentionDays",
        ])
          next[k] = Number(d[k]);
        try {
          settings = await api("/settings", next);
          if (state.status === "idle")
            state = await api("/game/configure", { settings });
          toast(
            "Pengaturan disimpan" +
              (state.status === "idle"
                ? " dan diterapkan."
                : ". Terapkan saat match idle."),
          );
        } catch (e) {
          toast((e as Error).message, true);
        }
      };
    document.querySelector("#clear-history")!.addEventListener("click", () => {
      modalOpen(
        "Hapus riwayat?",
        "Tindakan ini menghapus analytics lingkungan ini secara permanen.",
        `<p>Match aktif tidak diubah. Data sandbox tidak tercampur.</p><button class="button danger" id="confirm-clear">Hapus seluruh riwayat</button>`,
      );
      document
        .querySelector("#confirm-clear")!
        .addEventListener("click", async () => {
          try {
            await api("/privacy/clear", {});
            history = [];
            closeModal();
            toast("Riwayat dihapus.");
          } catch (e) {
            toast((e as Error).message, true);
          }
        });
    });
  } else if (view === "/admin/analytics") {
    try {
      history = (await api("/analytics")).matches;
    } catch (e) {
      toast((e as Error).message, true);
    }
    shell(analyticsPage());
    document
      .querySelector("#export-json")!
      .addEventListener("click", () =>
        download(
          "kizuna-matches.json",
          JSON.stringify(history, null, 2),
          "application/json",
        ),
      );
    document.querySelector("#export-csv")!.addEventListener("click", () => {
      const csv = (s: unknown) =>
        '"' +
        String(s ?? "")
          .replace(/"/g, '""')
          .replace(/^[=+@-]/, "'") +
        '"';
      download(
        "kizuna-matches.csv",
        [
          [
            "id",
            "ended_at",
            "red",
            "blue",
            "winner",
            "score_red",
            "score_blue",
          ],
          ...history.map((m) => [
            m.id,
            m.ended_at,
            m.result.red.fighter.name,
            m.result.blue.fighter.name,
            m.result.winner,
            m.result.scores.red,
            m.result.scores.blue,
          ]),
        ]
          .map((row) => row.map(csv).join(","))
          .join("\n"),
        "text/csv",
      );
    });
  } else {
    shell(dashboard());
    bindDashboard();
    if (view === "/game" || view === "/") {
      const target = document.querySelector(".battle-main")!;
      const touch = document.createElement("div");
      touch.className = "touch-controls";
      touch.innerHTML = `<span>MANUAL INPUT</span><select id="touch-team" aria-label="Tim input"><option value="red">Team Red</option><option value="blue">Team Blue</option></select>${(["move_left", "move_right", "jump", "light_attack", "heavy_attack", "block", "special_attack", "ultimate", "dodge"] as Action[]).map((a) => `<button class="button small" data-touch="${a}">${esc(actionNames[a])}</button>`).join("")}`;
      const abilityButtons = (list: readonly Action[]) =>
        list
          .map((a) => {
            const spec = defaultSkills[a];
            const cost = spec
              ? `${spec.energy} energi · ${spec.cost} stamina`
              : `${tacticalSpecs[a as keyof typeof tacticalSpecs].cost} stamina`;
            return `<button class="button small" data-touch="${a}" title="${esc(abilityDescriptions[a])}"><strong>${esc(actionNames[a])}</strong><small>${cost} · ${abilityCommand(a)}</small></button>`;
          })
          .join("");
      touch.innerHTML += `<details class="ability-controls"><summary>10 aksi taktis · Shift + tombol · tim terpilih</summary><div class="ability-grid">${abilityButtons(tacticalActions)}</div><p class="hint">Shift+A dash maju · D mundur · C crouch · W lompat tinggi · E air dash · P parry · F focus · T taunt · B brace · G feint</p></details><details class="ability-controls"><summary>10 skill · Alt+1…0 · tim terpilih</summary><div class="ability-grid">${abilityButtons(skillActions)}</div><p class="hint">Urutan skill mengikuti tombol 1 sampai 9, lalu 0. Semua skill memiliki cooldown sendiri. Meteor Dive memerlukan posisi di udara.</p></details>`;
      target.append(touch);
      touch
        .querySelectorAll<HTMLElement>("[data-touch]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              sendInput(
                (document.querySelector("#touch-team") as HTMLSelectElement)
                  .value as Team,
                b.dataset.touch as Action,
              )),
        );
    }
  }
  patch();
}
let lastInput = 0;
async function sendInput(team: Team, action: Action) {
  if (view === "/live" || view === "/overlay" || modal) return;
  if (!authenticated) return login();
  const now = Date.now();
  if (now - lastInput < 85) return;
  lastInput = now;
  try {
    await api("/game/input", { team, action });
  } catch (e) {
    toast((e as Error).message, true);
  }
}
const keys: Record<string, [Team, Action]> = {
  a: ["red", "move_left"],
  d: ["red", "move_right"],
  w: ["red", "jump"],
  j: ["red", "light_attack"],
  k: ["red", "heavy_attack"],
  l: ["red", "block"],
  i: ["red", "special_attack"],
  u: ["red", "ultimate"],
  o: ["red", "dodge"],
  ArrowLeft: ["blue", "move_left"],
  ArrowRight: ["blue", "move_right"],
  ArrowUp: ["blue", "jump"],
  "1": ["blue", "light_attack"],
  "2": ["blue", "heavy_attack"],
  "3": ["blue", "block"],
  "4": ["blue", "special_attack"],
  "5": ["blue", "ultimate"],
  "6": ["blue", "dodge"],
};
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    return;
  }
  if (e.key === "Tab" && modal) {
    const items = Array.from(
      modal.querySelectorAll<HTMLElement>(
        "button,input,select,textarea,a[href],summary",
      ),
    ).filter(
      (el) => !(el as HTMLButtonElement).disabled && el.offsetParent !== null,
    );
    const first = items[0],
      last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
    return;
  }
  if (
    !["/game", "/", "/admin", "/admin/matches"].includes(view) ||
    modal ||
    ["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)
  )
    return;
  const selectedTeam = (document.querySelector<HTMLSelectElement>("#touch-team")
    ?.value || "red") as Team;
  const tacticalKeys: Record<string, Action> = {
    a: "dash_forward",
    d: "dash_back",
    c: "crouch",
    w: "high_jump",
    e: "air_dash",
    p: "parry",
    f: "focus",
    t: "taunt",
    b: "brace",
    g: "feint",
  };
  if (e.shiftKey && tacticalKeys[e.key.toLowerCase()]) {
    e.preventDefault();
    sendInput(selectedTeam, tacticalKeys[e.key.toLowerCase()]);
    return;
  }
  if (e.altKey && /^Digit[0-9]$/.test(e.code)) {
    e.preventDefault();
    const digit = Number(e.code.slice(-1));
    sendInput(selectedTeam, skillActions[digit === 0 ? 9 : digit - 1]);
    return;
  }
  const input = keys[e.key];
  if (input) {
    e.preventDefault();
    sendInput(...input);
  }
});
let audio: AudioContext | undefined,
  lastHealth = 2000,
  lastAnnouncement = "",
  lastSpeech = 0;
window.addEventListener(
  "pointerdown",
  () => {
    if (!audio) audio = new AudioContext();
    if (audio.state === "suspended") audio.resume();
  },
  { once: true },
);
setInterval(() => {
  const hp = state.red.hp + state.blue.hp;
  if (hp < lastHealth && state.settings.sound && audio?.state === "running") {
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(180, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(45, audio.currentTime + 0.13);
    g.gain.setValueAtTime(state.settings.volume * 0.2, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.16);
  }
  lastHealth = hp;
  const marker = state.id + state.round + state.status;
  if (
    state.settings.tts &&
    marker !== lastAnnouncement &&
    ["round-over", "finished"].includes(state.status) &&
    Date.now() - lastSpeech > 5000 &&
    "speechSynthesis" in window
  ) {
    lastAnnouncement = marker;
    lastSpeech = Date.now();
    const msg = new SpeechSynthesisUtterance(
      state.winner === "draw"
        ? "Ronde seri"
        : `${state.winner ? state[state.winner].fighter.name : "Fighter"} wins`,
    );
    msg.volume = state.settings.volume;
    speechSynthesis.cancel();
    speechSynthesis.speak(msg);
  }
}, 150);
setInterval(async () => {
  if (
    !authenticated ||
    mustChangePassword ||
    !["/admin", "/game", "/"].includes(view)
  )
    return;
  try {
    const detailed = await api("/admin/state");
    state = { ...state, logs: detailed.logs };
    patch();
  } catch {
    /* Connection indicator comes from WebSocket. */
  }
}, 1000);
async function boot() {
  try {
    const auth = await api("/auth");
    authenticated = auth.authenticated;
    csrf = auth.csrf || "";
    mustChangePassword = !!auth.mustChangePassword;
    if (authenticated && !mustChangePassword) await catalog();
    const initial = await api("/game/state");
    state = initial;
  } catch (e) {
    toast(
      "API belum tersedia. Jalankan server Worker. " + (e as Error).message,
      true,
    );
  }
  await render();
  connect();
  if (mustChangePassword) await accountEditor(true);
}
boot();
