/**
 * Birthday Countdown — Madhu Shalini
 * Wake intro (panda) + butterfly name formation + countdown, message, audio, confetti.
 */

(function () {
  "use strict";

  var BIRTHDAY = new Date(2026, 5, 30, 0, 0, 0, 0);
  var GALLERY_STEPS = 6;
  /** Progress denominator = that card’s “Surprise in X days” (equal daily taps to fill). */
  var GALLERY_LS = "madhu_mem_";
  /** Next page load: push local state to Supabase without merging max() with remote (fixes reset when server still has old taps). */
  var GALLERY_SESSION_SKIP_MERGE = "madhu_gallery_skip_remote_merge_once";
  var GALLERY_SUPABASE_TABLE = "gallery_progress";
  var GALLERY_SUPABASE_ROW_ID = "shared";
  /** Cached client; null if URL/key missing or library not loaded. */
  var gallerySupabaseClient = null;

  var MESSAGE =
    "Madhu Shalini, some people make the world softer just by being in it — and you’re one of them. " +
    "On your birthday and every day after, I hope you feel seen, cherished, and celebrated the way you deserve. " +
    "Here’s to laughter that lingers, quiet joys that surprise you, and a year that feels like home. " +
    "With warmth and love, always.";

  var NAME_LINE1 = "Madhu";
  var NAME_LINE2 = "Shalini";

  /** Hero subtitle: “Good morning, Madhuluuuuuuuuuuu” etc. by local time of day. */
  function getTimeOfDayGreeting() {
    var h = new Date().getHours();
    if (h >= 5 && h < 12) return "Good morning";
    if (h >= 12 && h < 17) return "Good afternoon";
    if (h >= 17 && h < 22) return "Good evening";
    return "Good night";
  }

  function applyHeroGreeting() {
    var el = document.getElementById("hero-greeting-text");
    if (!el) return;
    el.textContent = getTimeOfDayGreeting() + ", Madhuluuuuuuuuuuu";
  }

  var STAR_CHART_API = "https://api.astronomyapi.com/api/v2/studio/star-chart";

  function starChartImageUrlFromResponse(json) {
    if (!json) return "";
    if (typeof json.imageUrl === "string") return json.imageUrl;
    if (!json.data) return "";
    var d = json.data;
    if (typeof d === "string") return d;
    if (typeof d.imageUrl === "string") return d.imageUrl;
    if (d.data && typeof d.data.imageUrl === "string") return d.data.imageUrl;
    return "";
  }

  function clearStarChartLoading(img) {
    if (img) img.classList.remove("star-map__img--loading");
  }

  function finishStarChartImage(img, url) {
    if (!img || !url) return;
    var done = function () {
      clearStarChartLoading(img);
    };
    img.onload = done;
    img.onerror = done;
    img.src = url;
    if (img.complete && img.naturalWidth > 0) {
      window.setTimeout(done, 0);
    }
  }

  function initStarChart() {
    var img = document.getElementById("star-chart-img");
    if (!img) return;

    var appId = typeof window.MADHU_ASTRONOMY_APP_ID === "string" ? window.MADHU_ASTRONOMY_APP_ID.trim() : "";
    var appSecret = typeof window.MADHU_ASTRONOMY_APP_SECRET === "string" ? window.MADHU_ASTRONOMY_APP_SECRET.trim() : "";
    var lat = parseFloat(window.MADHU_STAR_CHART_LAT);
    var lon = parseFloat(window.MADHU_STAR_CHART_LON);
    var dateStr =
      typeof window.MADHU_STAR_CHART_DATE === "string" && window.MADHU_STAR_CHART_DATE.trim()
        ? window.MADHU_STAR_CHART_DATE.trim()
        : "2006-06-30";
    var constellation =
      typeof window.MADHU_STAR_CHART_CONSTELLATION === "string" && window.MADHU_STAR_CHART_CONSTELLATION.trim()
        ? window.MADHU_STAR_CHART_CONSTELLATION.trim().toLowerCase()
        : "cnc";
    var style =
      typeof window.MADHU_STAR_CHART_STYLE === "string" && window.MADHU_STAR_CHART_STYLE.trim()
        ? window.MADHU_STAR_CHART_STYLE.trim()
        : "navy";

    if (!appId || !appSecret || isNaN(lat) || isNaN(lon)) {
      return;
    }

    var auth;
    try {
      auth = btoa(appId + ":" + appSecret);
    } catch (e) {
      console.warn("Star chart: could not encode API credentials.");
      return;
    }

    var body = {
      style: style,
      observer: {
        latitude: lat,
        longitude: lon,
        date: dateStr,
      },
      view: {
        type: "constellation",
        parameters: {
          constellation: constellation,
        },
      },
    };

    img.classList.add("star-map__img--loading");

    var controller = new AbortController();
    var timeoutId = window.setTimeout(function () {
      controller.abort();
    }, 60000);

    fetch(STAR_CHART_API, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: "Basic " + auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch (e) {
            throw new Error("Star chart API returned non-JSON: " + (text || "").slice(0, 120));
          }
          if (!res.ok) {
            var msg =
              (json && (json.message || json.error || json.statusMessage)) ||
              text ||
              res.statusText ||
              "Request failed (" + res.status + ")";
            throw new Error(msg);
          }
          return json;
        });
      })
      .then(function (json) {
        window.clearTimeout(timeoutId);
        var url = starChartImageUrlFromResponse(json);
        if (!url) {
          console.warn("Star chart unexpected JSON:", json);
          throw new Error("No imageUrl in API response");
        }
        img.alt =
          "Star chart: constellation " + constellation + " on " + dateStr + " (observer at " + lat + ", " + lon + ").";
        finishStarChartImage(img, url);
      })
      .catch(function (err) {
        window.clearTimeout(timeoutId);
        console.warn("Star chart API:", err);
        clearStarChartLoading(img);
      });
  }

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var confettiFiredSession = sessionStorage.getItem("confetti-fired") === "1";
  var countdownIntervalId = null;
  var isMuted = false;
  var typewriterStarted = false;

  var els = {
    days: document.getElementById("days"),
    hours: document.getElementById("hours"),
    minutes: document.getElementById("minutes"),
    seconds: document.getElementById("seconds"),
    countdownDone: document.getElementById("countdown-done"),
    surpriseLocked: document.getElementById("surprise-locked"),
    surpriseOpen: document.getElementById("surprise-open"),
    messageText: document.getElementById("message-text"),
    messageCursor: document.getElementById("message-cursor"),
    musicToggle: document.getElementById("music-toggle"),
    bgAudio: document.getElementById("bg-audio"),
    confettiCanvas: document.getElementById("confetti-canvas"),
    nameLine1: document.getElementById("name-line-1"),
    nameLine2: document.getElementById("name-line-2"),
    heroSubtitle: document.getElementById("hero-subtitle"),
  };

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function isBirthdayTime() {
    return Date.now() >= BIRTHDAY.getTime();
  }

  function updateCountdown() {
    var now = Date.now();
    var diff = BIRTHDAY.getTime() - now;

    if (diff <= 0) {
      els.days.textContent = "00";
      els.hours.textContent = "00";
      els.minutes.textContent = "00";
      els.seconds.textContent = "00";
      els.countdownDone.hidden = false;
      unlockSurprise();
      if (countdownIntervalId !== null) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
      }
      if (!confettiFiredSession && !prefersReducedMotion) {
        confettiFiredSession = true;
        sessionStorage.setItem("confetti-fired", "1");
        startConfetti();
      } else if (!confettiFiredSession && prefersReducedMotion) {
        confettiFiredSession = true;
        sessionStorage.setItem("confetti-fired", "1");
      }
      updateGalleryMemories();
      return;
    }

    var s = Math.floor(diff / 1000);
    var days = Math.floor(s / 86400);
    s -= days * 86400;
    var hours = Math.floor(s / 3600);
    s -= hours * 3600;
    var minutes = Math.floor(s / 60);
    var seconds = s - minutes * 60;

    els.days.textContent = pad2(Math.min(days, 99));
    els.hours.textContent = pad2(hours);
    els.minutes.textContent = pad2(minutes);
    els.seconds.textContent = pad2(seconds);
    els.countdownDone.hidden = true;
    updateGalleryMemories();
  }

  function updateGalleryMemories() {
    var now = Date.now();
    var end = BIRTHDAY.getTime();
    var items = document.querySelectorAll(".gallery-item[data-memory-index]");
    if (!items.length) return;

    items.forEach(function (fig) {
      var i = parseInt(fig.getAttribute("data-memory-index"), 10);
      var label = document.getElementById("gallery-label-" + i);
      var calm = label && label.querySelector(".gallery-surprise-calm");
      var daysEl = label && label.querySelector(".gallery-surprise-days");
      var unitEl = label && label.querySelector(".gallery-day-unit");

      if (now >= end) {
        fig.classList.add("gallery-item--unlocked");
        if (calm) {
          calm.innerHTML = "This memory is open for you.";
        }
        if (label) label.classList.add("gallery-surprise-label--unlocked");
        galleryProgressMarkComplete(i);
        return;
      }

      var spanMs = end - now;
      var unlockTime = now + (spanMs * (i + 1)) / GALLERY_STEPS;
      var diff = unlockTime - now;
      var days = Math.ceil(diff / 86400000);
      if (days < 0) days = 0;

      if (diff <= 0) {
        fig.classList.add("gallery-item--unlocked");
        if (calm) {
          calm.innerHTML = "This memory is open for you.";
        }
        if (label) label.classList.add("gallery-surprise-label--unlocked");
        galleryProgressMarkComplete(i);
      } else {
        fig.classList.remove("gallery-item--unlocked");
        if (label) label.classList.remove("gallery-surprise-label--unlocked");
        if (daysEl) daysEl.textContent = String(days);
        if (unitEl) unitEl.textContent = days === 1 ? "day" : "days";
      }
    });
    syncAllGalleryProgressUI();
  }

  function galleryTodayLocal() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  /** Same horizon as the “Surprise in X days” label for this memory. */
  function getGalleryTargetDays(i) {
    var now = Date.now();
    var end = BIRTHDAY.getTime();
    if (now >= end) return 1;
    var spanMs = end - now;
    var unlockTime = now + (spanMs * (i + 1)) / GALLERY_STEPS;
    var diff = unlockTime - now;
    var days = Math.ceil(diff / 86400000);
    return Math.max(1, days);
  }

  function galleryLoadTapsRaw(i) {
    var raw = localStorage.getItem(GALLERY_LS + i + "_taps");
    var t = parseInt(raw, 10);
    if (isNaN(t)) t = 0;
    return Math.max(0, t);
  }

  function galleryLoadLastDay(i) {
    return localStorage.getItem(GALLERY_LS + i + "_day") || "";
  }

  function gallerySaveTaps(i, taps, lastDay) {
    try {
      localStorage.setItem(GALLERY_LS + i + "_taps", String(taps));
      localStorage.setItem(GALLERY_LS + i + "_day", lastDay);
    } catch (e) {}
  }

  function getSupabaseClient() {
    if (gallerySupabaseClient) return gallerySupabaseClient;
    var url = typeof window.MADHU_SUPABASE_URL === "string" ? window.MADHU_SUPABASE_URL.trim() : "";
    var key = typeof window.MADHU_SUPABASE_ANON_KEY === "string" ? window.MADHU_SUPABASE_ANON_KEY.trim() : "";
    if (!url || !key) return null;
    var lib = window.supabase;
    if (!lib || typeof lib.createClient !== "function") return null;
    gallerySupabaseClient = lib.createClient(url, key);
    return gallerySupabaseClient;
  }

  /** Full state object: { "0": { t, d }, ... } for cloud sync. */
  function galleryCollectState() {
    var o = {};
    var i = 0;
    for (i = 0; i < GALLERY_STEPS; i++) {
      o[String(i)] = { t: galleryLoadTapsRaw(i), d: galleryLoadLastDay(i) };
    }
    return o;
  }

  function galleryApplyState(state) {
    if (!state || typeof state !== "object") state = {};
    var i = 0;
    for (i = 0; i < GALLERY_STEPS; i++) {
      var e = state[String(i)];
      if (e == null) {
        gallerySaveTaps(i, 0, "");
        continue;
      }
      if (typeof e === "number") {
        var tn = Math.floor(e);
        gallerySaveTaps(i, Math.max(0, isNaN(tn) ? 0 : tn), "");
        continue;
      }
      if (typeof e === "string") {
        var ts = parseInt(e, 10);
        gallerySaveTaps(i, Math.max(0, isNaN(ts) ? 0 : ts), "");
        continue;
      }
      if (!e || typeof e !== "object") {
        gallerySaveTaps(i, 0, "");
        continue;
      }
      var t = parseInt(e.t, 10);
      if (isNaN(t)) t = 0;
      var d = typeof e.d === "string" ? e.d : "";
      gallerySaveTaps(i, Math.max(0, t), d);
    }
  }

  /**
   * Supabase JSON may be legacy shape {"0":1} or proper {"0":{"t":1,"d":"…"}}.
   * Always convert to { "0"…"5": { t, d } } so merge / zero-snapshot logic works.
   */
  function normalizeGalleryRemoteState(remote) {
    if (!remote || typeof remote !== "object") return {};
    var out = {};
    var i = 0;
    for (i = 0; i < GALLERY_STEPS; i++) {
      var key = String(i);
      var v = remote[key];
      if (v == null) {
        out[key] = { t: 0, d: "" };
      } else if (typeof v === "number" && !isNaN(v)) {
        out[key] = { t: Math.max(0, Math.floor(v)), d: "" };
      } else if (typeof v === "string") {
        var tstr = parseInt(v, 10);
        out[key] = { t: isNaN(tstr) ? 0 : Math.max(0, tstr), d: "" };
      } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        var tt = parseInt(v.t, 10);
        if (isNaN(tt)) tt = 0;
        var dd = typeof v.d === "string" ? v.d : "";
        out[key] = { t: Math.max(0, tt), d: dd };
      } else {
        out[key] = { t: 0, d: "" };
      }
    }
    return out;
  }

  /** True when every memory on the server has tap count 0 (e.g. after SQL reset). */
  function isRemoteAllZeroSnapshot(remote) {
    if (!remote || typeof remote !== "object") return false;
    var i = 0;
    for (i = 0; i < GALLERY_STEPS; i++) {
      var e = remote[String(i)];
      var t = 0;
      if (e && typeof e === "object") {
        t = parseInt(e.t, 10);
        if (isNaN(t)) t = 0;
      } else if (typeof e === "number") {
        t = Math.floor(e);
        if (isNaN(t)) t = 0;
      }
      if (t !== 0) return false;
    }
    return true;
  }

  function mergeGalleryEntry(a, b) {
    if (!a || typeof a !== "object") a = { t: 0, d: "" };
    if (!b || typeof b !== "object") b = { t: 0, d: "" };
    var ta = parseInt(a.t, 10);
    var tb = parseInt(b.t, 10);
    if (isNaN(ta)) ta = 0;
    if (isNaN(tb)) tb = 0;
    if (ta > tb) return { t: ta, d: typeof a.d === "string" ? a.d : "" };
    if (tb > ta) return { t: tb, d: typeof b.d === "string" ? b.d : "" };
    var da = typeof a.d === "string" ? a.d : "";
    var db = typeof b.d === "string" ? b.d : "";
    return { t: ta, d: da >= db ? da : db };
  }

  function galleryMergeFullState(local, remote) {
    var out = {};
    var i = 0;
    for (i = 0; i < GALLERY_STEPS; i++) {
      var key = String(i);
      out[key] = mergeGalleryEntry(local[key], remote[key]);
    }
    return out;
  }

  function galleryPushStateToSupabase(state) {
    var client = getSupabaseClient();
    if (!client) return Promise.resolve();
    return client
      .from(GALLERY_SUPABASE_TABLE)
      .upsert(
        {
          id: GALLERY_SUPABASE_ROW_ID,
          state: state,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .then(function (res) {
        if (res.error) throw res.error;
      });
  }

  function galleryPushStateToSupabaseFireAndForget() {
    var state = galleryCollectState();
    galleryPushStateToSupabase(state).catch(function (e) {
      console.warn("Gallery sync push failed:", e);
    });
  }

  function galleryMergeFromSupabase() {
    var client = getSupabaseClient();
    if (!client) return Promise.resolve();

    var skipMerge = false;
    try {
      skipMerge = sessionStorage.getItem(GALLERY_SESSION_SKIP_MERGE) === "1";
      if (skipMerge) {
        sessionStorage.removeItem(GALLERY_SESSION_SKIP_MERGE);
      }
    } catch (e) {}

    // After ?resetGallery=1, next load: overwrite server with this browser's local state
    // without reading remote first (avoids max-merge bringing old "1"s back if push failed earlier).
    if (skipMerge) {
      var localOnly = galleryCollectState();
      return galleryPushStateToSupabase(localOnly).catch(function (e) {
        console.warn("Gallery sync push (post-reset) failed:", e);
      });
    }

    return client
      .from(GALLERY_SUPABASE_TABLE)
      .select("state")
      .eq("id", GALLERY_SUPABASE_ROW_ID)
      .maybeSingle()
      .then(function (res) {
        if (res.error) throw res.error;
        var remote = res.data && res.data.state;
        if (!remote || typeof remote !== "object") remote = {};
        remote = normalizeGalleryRemoteState(remote);
        // If the row was reset in Supabase (all t === 0), use that — do not max() with
        // localStorage or local "1" wins forever after a DB reset.
        if (isRemoteAllZeroSnapshot(remote)) {
          var z = {};
          var zi = 0;
          for (zi = 0; zi < GALLERY_STEPS; zi++) {
            var re = remote[String(zi)];
            var rd = re && typeof re === "object" && typeof re.d === "string" ? re.d : "";
            z[String(zi)] = { t: 0, d: rd };
          }
          galleryApplyState(z);
          return galleryPushStateToSupabase(galleryCollectState());
        }
        var local = galleryCollectState();
        var merged = galleryMergeFullState(local, remote);
        galleryApplyState(merged);
        return galleryPushStateToSupabase(merged);
      })
      .catch(function (e) {
        console.warn("Gallery sync fetch failed:", e);
      });
  }

  function galleryProgressMarkComplete(i) {
    gallerySaveTaps(i, getGalleryTargetDays(i), galleryTodayLocal());
    galleryPushStateToSupabaseFireAndForget();
  }

  function syncAllGalleryProgressUI() {
    var k = 0;
    for (k = 0; k < GALLERY_STEPS; k++) {
      applyGalleryProgressUI(k);
    }
  }

  function applyGalleryProgressUI(i) {
    var fig = document.querySelector('.gallery-item[data-memory-index="' + i + '"]');
    if (!fig) return;
    var maxDays = getGalleryTargetDays(i);
    var rawTaps = galleryLoadTapsRaw(i);
    var taps = Math.min(rawTaps, maxDays);
    var lastDay = galleryLoadLastDay(i);
    var today = galleryTodayLocal();
    var unlocked = fig.classList.contains("gallery-item--unlocked");
    if (unlocked) {
      taps = maxDays;
    }
    var pct = maxDays > 0 ? (taps / maxDays) * 100 : 100;
    var fill = document.getElementById("gallery-progress-fill-" + i);
    var track = document.getElementById("gallery-progress-track-" + i);
    var countEl = document.getElementById("gallery-progress-count-" + i);
    var maxEl = document.getElementById("gallery-progress-max-" + i);
    var btn = fig.querySelector(".gallery-progress__btn");
    if (fill) fill.style.width = pct + "%";
    if (track) {
      track.setAttribute("aria-valuenow", String(Math.round(pct)));
    }
    if (countEl) countEl.textContent = String(taps);
    if (maxEl) maxEl.textContent = String(maxDays);
    if (!btn) return;
    if (unlocked || taps >= maxDays) {
      btn.disabled = true;
      btn.textContent = "Progress complete";
      return;
    }
    if (lastDay === today) {
      btn.disabled = true;
      btn.textContent = "Added today — come back tomorrow";
      return;
    }
    btn.disabled = false;
    btn.textContent = "Tap once for today";
  }

  function onGalleryProgressTap(i) {
    var fig = document.querySelector('.gallery-item[data-memory-index="' + i + '"]');
    if (!fig || fig.classList.contains("gallery-item--unlocked")) return;
    var maxDays = getGalleryTargetDays(i);
    var taps = Math.min(galleryLoadTapsRaw(i), maxDays);
    var lastDay = galleryLoadLastDay(i);
    var today = galleryTodayLocal();
    if (taps >= maxDays) return;
    if (lastDay === today) return;
    taps = Math.min(taps + 1, maxDays);
    gallerySaveTaps(i, taps, today);
    applyGalleryProgressUI(i);
    galleryPushStateToSupabaseFireAndForget();
  }

  function initGalleryProgress() {
    document.querySelectorAll(".gallery-progress__btn").forEach(function (btn) {
      var idx = parseInt(btn.getAttribute("data-memory-index"), 10);
      if (isNaN(idx)) return;
      btn.addEventListener("click", function () {
        onGalleryProgressTap(idx);
      });
    });
    syncAllGalleryProgressUI();
  }

  function unlockSurprise() {
    els.surpriseLocked.hidden = true;
    els.surpriseOpen.hidden = false;
    els.surpriseOpen.classList.add("reveal");
  }

  function lockSurprise() {
    els.surpriseLocked.hidden = false;
    els.surpriseOpen.hidden = true;
  }

  function runTypewriter() {
    if (typewriterStarted) return;
    typewriterStarted = true;
    els.messageText.textContent = "";

    if (prefersReducedMotion) {
      els.messageText.textContent = MESSAGE;
      els.messageCursor.classList.add("is-hidden");
      return;
    }

    var i = 0;
    var speed = 28;

    function tick() {
      if (i < MESSAGE.length) {
        els.messageText.textContent += MESSAGE.charAt(i);
        i += 1;
        window.setTimeout(tick, speed);
      } else {
        els.messageCursor.classList.add("is-hidden");
      }
    }

    window.setTimeout(tick, 400);
  }

  function syncMusicUi() {
    var btn = els.musicToggle;
    if (!btn) return;
    btn.classList.toggle("is-muted", isMuted);
    btn.setAttribute("aria-pressed", (!isMuted).toString());
    btn.setAttribute("aria-label", isMuted ? "Unmute background music" : "Mute background music");
  }

  function applyMuteToAudio() {
    var a = els.bgAudio;
    if (!a) return;
    a.muted = isMuted;
    a.loop = true;
  }

  function tryPlayBgAudio() {
    var a = els.bgAudio;
    if (!a) return;
    applyMuteToAudio();
    var p = a.play();
    if (p && typeof p.then === "function") {
      return p;
    }
    return Promise.resolve();
  }

  function toggleMusic() {
    isMuted = !isMuted;
    applyMuteToAudio();
    syncMusicUi();
    if (!isMuted && els.bgAudio && els.bgAudio.paused) {
      tryPlayBgAudio();
    }
  }

  function setupBgAudio() {
    var a = els.bgAudio;
    if (!a) return;

    a.loop = true;
    a.muted = isMuted;
    syncMusicUi();

    tryPlayBgAudio().catch(function () {
      function unlockOnce() {
        tryPlayBgAudio().catch(function () {});
        document.removeEventListener("click", unlockOnce);
        document.removeEventListener("touchstart", unlockOnce);
      }
      document.addEventListener("click", unlockOnce);
      document.addEventListener("touchstart", unlockOnce, { passive: true });
    });

    a.addEventListener(
      "error",
      function () {
        console.warn("Could not load audio: assets/audio/dheema.mp3 — check the file path.");
      },
      { once: true }
    );
  }

  if (els.musicToggle) {
    els.musicToggle.addEventListener("click", function () {
      toggleMusic();
    });
  }

  function startConfetti() {
    var canvas = els.confettiCanvas;
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var w = (canvas.width = window.innerWidth);
    var h = (canvas.height = window.innerHeight);
    var colors = ["#f8b4d9", "#e879a9", "#b794f6", "#d4c4f7", "#f687b3", "#fff5fb"];
    var particles = [];
    var count = Math.min(160, Math.floor((w * h) / 12000));
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * -h * 0.5,
        r: 4 + Math.random() * 6,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
        color: colors[(Math.random() * colors.length) | 0],
        life: 1,
      });
    }

    var start = performance.now();
    var duration = 4500;

    function frame(now) {
      var t = (now - start) / duration;
      if (t > 1) t = 1;
      ctx.clearRect(0, 0, w, h);
      particles.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.vy += 0.08;
        p.life = 1 - t;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = 0.5 * p.life + 0.2;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
        ctx.restore();
      });
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
    }

    requestAnimationFrame(frame);

    window.addEventListener(
      "resize",
      function onResize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      },
      { passive: true }
    );
  }

  function createButterflySvg() {
    var tpl = document.getElementById("butterfly-premium");
    if (tpl && tpl.content && tpl.content.firstElementChild) {
      return tpl.content.firstElementChild.cloneNode(true);
    }
    var fallback = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    fallback.setAttribute("class", "bf-svg");
    fallback.setAttribute("width", "44");
    fallback.setAttribute("height", "44");
    fallback.setAttribute("viewBox", "0 0 80 80");
    return fallback;
  }

  /**
   * Curved flight path (motion-graphics style): arc midpoint + easing; wings flap via CSS while .bf-svg--flying.
   */
  function runButterflyFlight(bf, fx, fy, fr, delayMs, durationMs, seed, onDone) {
    var s = seed * 17.917;
    var midX = fx * 0.32 + Math.sin(s) * 42;
    var midY = fy * 0.32 + Math.cos(s * 1.3) * 36;
    var midR = fr * 0.35 + Math.sin(s * 2) * 8;
    var midS = 0.78 + Math.sin(s) * 0.06;

    var t0 =
      "translate(" + fx + "px, " + fy + "px) rotate(" + fr + "deg) scale(0.66)";
    var t1 =
      "translate(" +
      midX.toFixed(1) +
      "px, " +
      midY.toFixed(1) +
      "px) rotate(" +
      midR.toFixed(2) +
      "deg) scale(" +
      midS.toFixed(3) +
      ")";
    var t2 = "translate(0px, 0px) rotate(0deg) scale(0.38)";

    bf.classList.add("bf-svg--flying");

    if (typeof bf.animate !== "function") {
      window.setTimeout(function () {
        bf.classList.remove("bf-svg--flying");
        bf.style.opacity = "0";
        if (onDone) onDone();
      }, delayMs + durationMs);
      return null;
    }

    var anim = bf.animate(
      [
        { transform: t0, opacity: 0.92 },
        { transform: t1, opacity: 1, offset: 0.52 },
        { transform: t2, opacity: 0 },
      ],
      {
        duration: durationMs,
        delay: delayMs,
        easing: "cubic-bezier(0.23, 1, 0.32, 1)",
        fill: "forwards",
      }
    );

    if (anim.finished) {
      anim.finished
        .then(function () {
          bf.classList.remove("bf-svg--flying");
          bf.style.transform = "";
          bf.style.opacity = "0";
          if (onDone) onDone();
        })
        .catch(function () {
          if (onDone) onDone();
        });
    } else {
      anim.onfinish = function () {
        bf.classList.remove("bf-svg--flying");
        bf.style.transform = "";
        bf.style.opacity = "0";
        if (onDone) onDone();
      };
    }

    return anim;
  }

  function buildNameLetters() {
    var l1 = els.nameLine1;
    var l2 = els.nameLine2;
    if (!l1 || !l2) return;

    function addString(container, str, charIndexStart) {
      var idx = charIndexStart;
      for (var i = 0; i < str.length; i++) {
        var ch = str.charAt(i);
        var span = document.createElement("span");
        span.className = "name-char";
        span.style.setProperty("--ci", String(idx));

        var bfs = document.createElement("span");
        bfs.className = "name-char__bfs";
        for (var b = 0; b < 3; b++) {
          bfs.appendChild(createButterflySvg());
        }

        var glyph = document.createElement("span");
        glyph.className = "name-char__glyph";
        glyph.textContent = ch;

        span.appendChild(bfs);
        span.appendChild(glyph);
        container.appendChild(span);
        idx += 1;
      }
    }

    addString(l1, NAME_LINE1, 0);
    addString(l2, NAME_LINE2, NAME_LINE1.length);
  }

  function randomFlightVars(seed) {
    var r = Math.sin(seed * 9999) * 10000;
    return r - Math.floor(r);
  }

  function runButterflyFormation() {
    var chars = document.querySelectorAll(".name-char");
    if (!chars.length) return;

    chars.forEach(function (char, ci) {
      var bfs = char.querySelectorAll(".bf-svg");
      var total = bfs.length;
      var finished = 0;

      function tryRevealGlyph() {
        finished += 1;
        if (finished >= total) {
          char.classList.add("name-char--arrived");
        }
      }

      bfs.forEach(function (bf, j) {
        var rnd = randomFlightVars(ci * 4 + j + 1);
        var rnd2 = randomFlightVars(ci * 7 + j * 3 + 2);
        var side = rnd < 0.5 ? -1 : 1;
        var fx = side * (140 + rnd * 240) + (j - 1) * 34;
        var fy = (rnd2 - 0.5) * 340;
        var fr = rnd * 56 - 28 + (j - 1) * 9;
        var seed = randomFlightVars(ci * 11 + j * 5 + 3);
        var delayMs = 80 + ci * 105 + j * 48;
        var durationMs = 1480 + (ci % 4) * 35 + j * 25;

        runButterflyFlight(bf, fx, fy, fr, delayMs, durationMs, seed, tryRevealGlyph);
      });
    });
  }

  function tryPlayHeroVideo() {
    if (prefersReducedMotion) return;
    var v = document.getElementById("hero-video");
    if (!v || typeof v.play !== "function") return;
    var p = v.play();
    if (p && typeof p.catch === "function") {
      p.catch(function () {});
    }
  }

  function setupWakeIntro() {
    var overlay = document.getElementById("wake-overlay");
    var btn = document.getElementById("panda-wake");
    var musicBtn = els.musicToggle;

    if (!overlay || !btn) {
      document.body.classList.remove("body--intro");
      document.body.classList.add("body--revealed");
      tryPlayHeroVideo();
      runButterflyFormation();
      if (els.heroSubtitle) els.heroSubtitle.classList.add("is-visible");
      window.setTimeout(runTypewriter, 800);
      return;
    }

    btn.addEventListener("click", function onWake() {
      btn.removeEventListener("click", onWake);
      tryPlayHeroVideo();
      btn.classList.add("panda-btn--waking");

      window.setTimeout(function () {
        btn.classList.remove("panda-btn--waking");
        btn.classList.add("panda-btn--running");
      }, 850);

      window.setTimeout(function () {
        overlay.classList.add("wake-overlay--exit");
      }, 1950);

      window.setTimeout(function () {
        document.body.classList.remove("body--intro");
        document.body.classList.add("body--revealed");
        overlay.setAttribute("aria-hidden", "true");
        if (musicBtn) musicBtn.setAttribute("tabindex", "0");
        tryPlayHeroVideo();

        window.setTimeout(function () {
          runButterflyFormation();
        }, 350);

        window.setTimeout(function () {
          if (els.heroSubtitle) els.heroSubtitle.classList.add("is-visible");
        }, 3000);

        window.setTimeout(function () {
          runTypewriter();
        }, 3400);

        window.setTimeout(function () {
          overlay.classList.add("wake-overlay--gone");
          overlay.remove();
        }, 1100);
      }, 2100);
    });
  }

  function skipIntroForReducedMotion() {
    document.body.classList.remove("body--intro");
    document.body.classList.add("body--revealed");
    var overlay = document.getElementById("wake-overlay");
    if (overlay) overlay.remove();
    if (els.musicToggle) els.musicToggle.setAttribute("tabindex", "0");
    var hv = document.getElementById("hero-video");
    if (hv && typeof hv.pause === "function") hv.pause();

    document.querySelectorAll(".name-char").forEach(function (c) {
      c.classList.add("name-char--arrived");
    });
    if (els.heroSubtitle) els.heroSubtitle.classList.add("is-visible");
    runTypewriter();
  }

  /** Testing: ?resetGallery=1 clears gallery tap data in this browser and, if Supabase is configured, resets the shared row. Returns true if reset ran. */
  function maybeResetGalleryFromQuery() {
    try {
      if (typeof URLSearchParams === "undefined") return false;
      var params = new URLSearchParams(window.location.search);
      if (params.get("resetGallery") !== "1") return false;
      var i = 0;
      for (i = 0; i < GALLERY_STEPS; i++) {
        localStorage.removeItem(GALLERY_LS + i + "_taps");
        localStorage.removeItem(GALLERY_LS + i + "_day");
      }
      try {
        sessionStorage.setItem(GALLERY_SESSION_SKIP_MERGE, "1");
      } catch (err2) {}
      var cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
      return true;
    } catch (err) {
      return false;
    }
  }

  function init() {
    var didReset = maybeResetGalleryFromQuery();
    var afterSync = function () {
      applyHeroGreeting();
      initStarChart();
      buildNameLetters();
      initGalleryProgress();

      if (isBirthdayTime()) {
        updateCountdown();
      } else {
        lockSurprise();
        updateCountdown();
        countdownIntervalId = window.setInterval(updateCountdown, 1000);
      }

      setupBgAudio();

      if (prefersReducedMotion) {
        skipIntroForReducedMotion();
      } else {
        setupWakeIntro();
      }
    };

    // After reset: localStorage cleared; optional Supabase push. Never merge on this load.
    // sessionStorage skip-merge ensures the *next* load overwrites remote without max-merge first.
    if (didReset) {
      if (getSupabaseClient()) {
        galleryPushStateToSupabase(galleryCollectState())
          .catch(function (e) {
            console.warn("Gallery reset sync failed:", e);
          })
          .then(function () {
            afterSync();
          });
      } else {
        afterSync();
      }
      return;
    }

    galleryMergeFromSupabase().then(afterSync);
    return;

  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
