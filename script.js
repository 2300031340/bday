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
  var bgAudioForcedMuteBySong = false;
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

  // Daily wish messages
  var DAILY_WISHES = [
    "May today bring you a smile that reaches your eyes and warmth that fills your heart.",
    "Here's to small joys, quiet moments, and the magic of being exactly who you are.",
    "Wishing you a day filled with gentle surprises and the comfort of knowing you're loved.",
    "May your path be lined with kindness, your heart with peace, and your day with delight.",
    "Today, may you feel the beauty of your own light shining brightly for all to see.",
    "Wishing you moments of pure joy, laughter that echoes, and dreams that feel within reach.",
    "May today wrap you in comfort, surround you with care, and remind you of your worth.",
    "Here's to new beginnings, fresh perspectives, and the courage to embrace them both.",
    "Wishing you a day of gentle adventures and the peace that comes from being true to yourself.",
    "May your heart be light, your spirit bright, and your day filled with unexpected happiness."
  ];

  function getDaysUntilBirthday() {
    var now = new Date();
    var diffMs = BIRTHDAY - now;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  function initDailyWish() {
    var daysLeft = getDaysUntilBirthday();
    if (daysLeft <= 0) {
      document.getElementById("daily-message").textContent = "Happy Birthday! Today is your day to shine.";
      return;
    }
    var messageIndex = (daysLeft - 1) % DAILY_WISHES.length;
    document.getElementById("daily-message").textContent = DAILY_WISHES[messageIndex];
  }

  /** One completion per calendar day (local); cleared next day automatically. */
  var DAILY_SURPRISE_LS = "madhu_daily_surprise_done_date";
  var DAILY_QUIZ_ANSWER = "v";
  var DAILY_PHASE2_UNLOCKED_LS = "madhu_daily_phase2_unlocked";
  var DAILY_INITIAL_FEEDBACK_DONE_LS = "madhu_daily_initial_feedback_done";
  var DAILY_SONG_ANSWER_LS = "madhu_daily_song_answer";
  var DAILY_SONG_FEEDBACK_DONE_LS = "madhu_daily_song_feedback_done";
  var DAILY_UPDATE_POPUP_DATE_LS = "madhu_daily_update_popup_date";
  var SONG_UNLOCK_HOUR = 8;
  var songUnlockTickId = null;

  function getDailySurpriseDateKey() {
    var d = new Date();
    return (
      String(d.getFullYear()) +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function parseDateKeyToLocalDate(dateKey) {
    if (!dateKey || typeof dateKey !== "string") return null;
    var parts = dateKey.split("-");
    if (parts.length !== 3) return null;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  function hasCompletedDailySurpriseToday() {
    try {
      return localStorage.getItem(DAILY_SURPRISE_LS) === getDailySurpriseDateKey();
    } catch (e) {
      return false;
    }
  }

  function isDailyPhase2Unlocked() {
    try {
      return localStorage.getItem(DAILY_PHASE2_UNLOCKED_LS) === "1" || hasCompletedDailySurpriseToday();
    } catch (e) {
      return false;
    }
  }

  function getSongUnlockDateTime() {
    try {
      var day1Key = localStorage.getItem(DAILY_SURPRISE_LS) || "";
      var base = parseDateKeyToLocalDate(day1Key);
      if (!base) return null;
      return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, SONG_UNLOCK_HOUR, 0, 0, 0);
    } catch (e) {
      return null;
    }
  }

  function isSongSectionUnlockedNow() {
    var unlockAt = getSongUnlockDateTime();
    if (!unlockAt) return false;
    return Date.now() >= unlockAt.getTime();
  }

  function formatTimeDiff(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var hrs = Math.floor(total / 3600);
    var mins = Math.floor((total % 3600) / 60);
    var secs = total % 60;
    return String(hrs).padStart(2, "0") + ":" + String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }

  function renderSongTimeLock() {
    var lockBox = document.getElementById("song-time-lock");
    var cd = document.getElementById("song-time-lock-countdown");
    if (!lockBox || !cd) return;
    if (!isDailyPhase2Unlocked() || !isDailyInitialFeedbackDone()) {
      lockBox.hidden = true;
      return;
    }
    var unlockAt = getSongUnlockDateTime();
    if (!unlockAt) {
      lockBox.hidden = true;
      return;
    }
    var left = unlockAt.getTime() - Date.now();
    if (left <= 0) {
      lockBox.hidden = true;
      return;
    }
    lockBox.hidden = false;
    cd.textContent = "Opens in " + formatTimeDiff(left);
  }

  function ensureSongUnlockTicker() {
    if (songUnlockTickId) return;
    songUnlockTickId = window.setInterval(function () {
      renderSongTimeLock();
      if (isDailyPhase2Unlocked() && isDailyInitialFeedbackDone() && isSongSectionUnlockedNow()) {
        renderDailySongAnswerState();
      }
    }, 1000);
  }

  function markDailySurpriseComplete() {
    try {
      localStorage.setItem(DAILY_SURPRISE_LS, getDailySurpriseDateKey());
      localStorage.setItem(DAILY_PHASE2_UNLOCKED_LS, "1");
    } catch (e) {}
  }

  function maybeResetDailySurpriseFromQuery() {
    try {
      if (typeof URLSearchParams === "undefined") return;
      var params = new URLSearchParams(window.location.search);
      if (params.get("resetDailySurprise") !== "1") return;
      localStorage.removeItem(DAILY_SURPRISE_LS);
      localStorage.removeItem(DAILY_PHASE2_UNLOCKED_LS);
      localStorage.removeItem(DAILY_INITIAL_FEEDBACK_DONE_LS);
      localStorage.removeItem(DAILY_SONG_ANSWER_LS);
      localStorage.removeItem(DAILY_SONG_FEEDBACK_DONE_LS);
      localStorage.removeItem(DAILY_UPDATE_POPUP_DATE_LS);
      var cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    } catch (e) {}
  }

  function showDailySurpriseStep(stepId) {
    ["daily-step-intro", "daily-step-quiz", "daily-step-envelope"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.hidden = id !== stepId;
    });
  }

  function closeDailySurpriseModal() {
    var modal = document.getElementById("daily-surprise-modal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("body--daily-surprise-open");
  }

  function openDailySurpriseModal() {
    if (isDailyPhase2Unlocked()) return;
    if (hasCompletedDailySurpriseToday()) return;
    if (!document.body.classList.contains("body--revealed")) return;
    var modal = document.getElementById("daily-surprise-modal");
    if (!modal) return;
    showDailySurpriseStep("daily-step-intro");
    var input = document.getElementById("daily-quiz-input");
    if (input) input.value = "";
    var fb = document.getElementById("daily-quiz-feedback");
    if (fb) {
      fb.hidden = true;
      fb.textContent = "";
    }
    var env = document.getElementById("daily-envelope-btn");
    if (env) env.classList.remove("daily-envelope--open");
    modal.hidden = false;
    document.body.classList.add("body--daily-surprise-open");
    var playBtn = document.getElementById("daily-surprise-play");
    if (playBtn) playBtn.focus();
  }

  function openDailySurpriseIfNeeded() {
    if (isDailyPhase2Unlocked()) {
      openDailyUpdateModalIfNeeded();
      return;
    }
    if (hasCompletedDailySurpriseToday()) return;
    openDailySurpriseModal();
  }

  /** Open from the Daily section card: quiz if not done today, otherwise replay today’s video. */
  function openDailySurpriseFromSection() {
    if (!document.body.classList.contains("body--revealed")) return;
    if (isDailyPhase2Unlocked()) {
      scrollToDailySection();
      return;
    }
    if (hasCompletedDailySurpriseToday()) {
      openDailyRewardVideoLayer();
      return;
    }
    openDailySurpriseModal();
  }

  function scrollToDailySection() {
    var daily = document.getElementById("daily");
    if (!daily) return;
    daily.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submitDailyQuiz() {
    var input = document.getElementById("daily-quiz-input");
    var fb = document.getElementById("daily-quiz-feedback");
    if (!input || !fb) return;
    var ans = (input.value || "").trim().toLowerCase();
    if (ans === DAILY_QUIZ_ANSWER) {
      fb.hidden = true;
      showDailySurpriseStep("daily-step-envelope");
      return;
    }
    fb.hidden = false;
    fb.textContent = "Not quite — try again 💜";
  }

  function onEnvelopeOpen() {
    var btn = document.getElementById("daily-envelope-btn");
    if (!btn || btn.classList.contains("daily-envelope--open")) return;
    btn.classList.add("daily-envelope--open");
    window.setTimeout(function () {
      closeDailySurpriseModal();
      openDailyRewardVideoLayer();
    }, 450);
  }

  function getDailyRewardFullscreenElement() {
    return (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement ||
      null
    );
  }

  /** Prefer fullscreen on the reward layer (whole-screen popup); fall back to the video element, then iOS native video fullscreen. */
  function tryEnterDailyRewardFullscreen(layer, video) {
    if (!layer) return;
    function requestOn(el) {
      if (!el) return null;
      try {
        if (el.requestFullscreen) {
          return el.requestFullscreen({ navigationUI: "hide" });
        }
        if (el.webkitRequestFullscreen) {
          return el.webkitRequestFullscreen();
        }
        if (el.msRequestFullscreen) {
          el.msRequestFullscreen();
          return Promise.resolve();
        }
      } catch (err) {
        return Promise.reject(err);
      }
      return null;
    }
    var p = requestOn(layer);
    if (p && typeof p.then === "function" && p.catch) {
      p.catch(function () {
        var p2 = requestOn(video);
        if (p2 && typeof p2.then === "function" && p2.catch) {
          p2.catch(function () {});
        }
      });
      return;
    }
    var p3 = requestOn(video);
    if (p3 && typeof p3.then === "function" && p3.catch) {
      p3.catch(function () {});
    }
  }

  function tryIOSVideoNativeFullscreen(video) {
    if (!video || !video.webkitEnterFullscreen) return;
    try {
      video.webkitEnterFullscreen();
    } catch (e) {}
  }

  function openDailyRewardVideoLayer() {
    var layer = document.getElementById("daily-reward-layer");
    var video = document.getElementById("daily-reward-video");
    if (!layer || !video) return;
    var completedBeforeOpen = hasCompletedDailySurpriseToday();
    var fb = document.getElementById("daily-reward-fallback");
    if (fb) fb.hidden = true;
    layer.hidden = false;
    document.body.classList.add("body--daily-reward-open");
    tryEnterDailyRewardFullscreen(layer, video);
    if (!completedBeforeOpen) {
      video.addEventListener(
        "playing",
        function onDailyRewardPlaying() {
          markDailySurpriseComplete();
          initDailyChallengeDescription();
        },
        { once: true }
      );
    }
    video.load();
    video.addEventListener(
      "loadedmetadata",
      function onDailyRewardMeta() {
        video.currentTime = 0;
        var pp = video.play();
        if (pp && typeof pp.catch === "function") {
          pp.catch(function () {});
        }
        window.setTimeout(function () {
          var fs = getDailyRewardFullscreenElement();
          if (fs !== layer && fs !== video) {
            tryEnterDailyRewardFullscreen(layer, video);
          }
        }, 80);
        window.setTimeout(function () {
          var fs = getDailyRewardFullscreenElement();
          if (!fs) {
            tryIOSVideoNativeFullscreen(video);
          }
        }, 320);
      },
      { once: true }
    );
  }

  function closeDailyRewardVideoLayer() {
    var layer = document.getElementById("daily-reward-layer");
    var video = document.getElementById("daily-reward-video");
    if (video) {
      video.pause();
    }
    if (getDailyRewardFullscreenElement()) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(function () {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
    if (layer) layer.hidden = true;
    document.body.classList.remove("body--daily-reward-open");
  }

  function isDailyInitialFeedbackDone() {
    try {
      return localStorage.getItem(DAILY_INITIAL_FEEDBACK_DONE_LS) === "1";
    } catch (e) {
      return false;
    }
  }

  function isDailySongFeedbackDone() {
    try {
      return localStorage.getItem(DAILY_SONG_FEEDBACK_DONE_LS) === "1";
    } catch (e) {
      return false;
    }
  }

  function getDailySongAnswer() {
    try {
      return localStorage.getItem(DAILY_SONG_ANSWER_LS) || "";
    } catch (e) {
      return "";
    }
  }

  function setDailySongAnswer(v) {
    try {
      localStorage.setItem(DAILY_SONG_ANSWER_LS, v);
    } catch (e) {}
  }

  function setDailyInitialFeedbackDone() {
    try {
      localStorage.setItem(DAILY_INITIAL_FEEDBACK_DONE_LS, "1");
    } catch (e) {}
  }

  function setDailySongFeedbackDone() {
    try {
      localStorage.setItem(DAILY_SONG_FEEDBACK_DONE_LS, "1");
    } catch (e) {}
  }

  function saveDailyFeedbackToSupabase(category, feedbackText, meta) {
    var client = getSupabaseClient();
    if (!client) return Promise.resolve();
    return client
      .from("daily_feedback")
      .insert({
        day_key: getDailySurpriseDateKey(),
        category: category,
        feedback_text: feedbackText,
        meta: meta || null,
        created_at: new Date().toISOString(),
      })
      .then(function (res) {
        if (res.error) throw res.error;
      });
  }

  function getSongReplyText(answer) {
    if (answer === "yes") {
      return (
        "Oh... someone already made a song for you? \ud83d\udc40\n\n" +
        "It's okay...\n\n" +
        "I got your back \ud83d\ude0c\n\n" +
        "From now on, you don't need anyone else doing that...\n\n" +
        "Just listen to this one \u2764\ufe0f\ud83c\udfb6"
      );
    }
    return (
      "No one ever made a song for you?\n\n" +
      "That's kinda surprising...\n\n" +
      "But it's fine...\n\n" +
      "I got your back \ud83d\ude0c\n\n" +
      "You won't be missing out anymore \u2764\ufe0f\ud83c\udfb6"
    );
  }

  function closeDailyUpdateModal() {
    var modal = document.getElementById("daily-update-modal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("body--daily-surprise-open");
  }

  function openDailyUpdateModalIfNeeded() {
    if (!isDailyPhase2Unlocked()) return;
    var today = getDailySurpriseDateKey();
    var lastShown = "";
    try {
      lastShown = localStorage.getItem(DAILY_UPDATE_POPUP_DATE_LS) || "";
    } catch (e) {}
    if (lastShown === today) return;
    var modal = document.getElementById("daily-update-modal");
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add("body--daily-surprise-open");
    try {
      localStorage.setItem(DAILY_UPDATE_POPUP_DATE_LS, today);
    } catch (e) {}
  }

  function renderDailySongAnswerState() {
    var questionWrap = document.getElementById("song-question-area");
    var reply = document.getElementById("song-question-reply");
    var tracks = document.getElementById("song-tracks-area");
    var lockWrap = document.getElementById("song-time-lock");
    var songStatus = document.getElementById("song-feedback-status");
    if (!questionWrap || !reply || !tracks) return;
    if (!isSongSectionUnlockedNow()) {
      questionWrap.hidden = true;
      tracks.hidden = true;
      if (lockWrap) lockWrap.hidden = false;
      renderSongTimeLock();
      return;
    }
    if (lockWrap) lockWrap.hidden = true;
    var ans = getDailySongAnswer();
    if (!ans) {
      questionWrap.hidden = false;
      reply.hidden = true;
      tracks.hidden = true;
      if (songStatus) {
        songStatus.hidden = true;
      }
      return;
    }
    questionWrap.hidden = false;
    reply.hidden = false;
    reply.textContent = getSongReplyText(ans);
    tracks.hidden = false;
    initSongFeedbackWizard();
    if (songStatus && isDailySongFeedbackDone()) {
      songStatus.hidden = false;
      songStatus.textContent = "Your song feedback is already saved. Thank you 💜";
    }
  }

  var songWizardStep = 1;
  var songWizardBound = false;

  function setSongFeedbackStatusMessage(msg) {
    var status = document.getElementById("song-feedback-status");
    if (!status) return;
    if (!msg) {
      status.hidden = true;
      status.textContent = "";
      return;
    }
    status.hidden = false;
    status.textContent = msg;
  }

  function validateSongWizardStep(step) {
    if (step === 1) {
      var t1 = document.getElementById("song-feedback-track1");
      if (!t1 || !(t1.value || "").trim()) return "Please tell how Track 1 made you feel.";
    } else if (step === 2) {
      var t2 = document.getElementById("song-feedback-track2");
      if (!t2 || !(t2.value || "").trim()) return "Please tell how Track 2 made you feel.";
    } else if (step === 3) {
      var fav = document.getElementById("song-feedback-favorite");
      if (!fav || !(fav.value || "").trim()) return "Please choose your favorite track.";
    } else if (step === 4) {
      var ow = document.getElementById("song-feedback-oneword");
      var oneWord = ow ? (ow.value || "").trim() : "";
      if (!oneWord) return "Please share one word for me.";
      if (/\s/.test(oneWord)) return "Please keep it to one word only.";
    }
    return "";
  }

  function showSongFeedbackWizardStep(step) {
    var wizard = document.getElementById("song-feedback-wizard");
    if (!wizard) return;
    if (step < 1) step = 1;
    if (step > 5) step = 5;
    songWizardStep = step;
    var progress = document.getElementById("song-feedback-progress");
    if (progress) progress.textContent = "Question " + step + " of 5";
    wizard.querySelectorAll(".song-feedback-step").forEach(function (el) {
      var n = parseInt(el.getAttribute("data-song-step"), 10);
      el.hidden = n !== step;
    });
  }

  function initSongFeedbackWizard() {
    var wizard = document.getElementById("song-feedback-wizard");
    if (!wizard) return;
    if (!songWizardBound) {
      songWizardBound = true;
      wizard.addEventListener("click", function (e) {
        var nextBtn = e.target.closest("[data-song-next]");
        if (nextBtn) {
          var err = validateSongWizardStep(songWizardStep);
          if (err) {
            setSongFeedbackStatusMessage(err);
            return;
          }
          setSongFeedbackStatusMessage("");
          showSongFeedbackWizardStep(songWizardStep + 1);
          return;
        }
        var backBtn = e.target.closest("[data-song-back]");
        if (backBtn) {
          setSongFeedbackStatusMessage("");
          showSongFeedbackWizardStep(songWizardStep - 1);
        }
      });
    }
    if (isDailySongFeedbackDone()) {
      showSongFeedbackWizardStep(5);
      return;
    }
    showSongFeedbackWizardStep(1);
  }

  function renderDailyPhase2UI() {
    var nextGiftArea = document.getElementById("daily-next-gift-area");
    var initialWrap = document.getElementById("daily-initial-feedback-wrap");
    var questionWrap = document.getElementById("song-question-area");
    var sectionBtn = document.getElementById("daily-surprise-section-play");
    if (!nextGiftArea || !initialWrap || !questionWrap) return;
    if (!isDailyPhase2Unlocked()) {
      nextGiftArea.hidden = true;
      return;
    }
    nextGiftArea.hidden = false;
    if (sectionBtn) sectionBtn.hidden = true;
    if (!isDailyInitialFeedbackDone()) {
      initialWrap.hidden = false;
      questionWrap.hidden = true;
      renderSongTimeLock();
      var tracks0 = document.getElementById("song-tracks-area");
      if (tracks0) tracks0.hidden = true;
      return;
    }
    initialWrap.hidden = true;
    renderSongTimeLock();
    renderDailySongAnswerState();
  }

  function submitInitialDailyFeedback() {
    var input = document.getElementById("daily-initial-feedback-input");
    var status = document.getElementById("daily-initial-feedback-status");
    if (!input || !status) return;
    var txt = (input.value || "").trim();
    if (!txt) {
      status.hidden = false;
      status.textContent = "Please type a small feedback first.";
      return;
    }
    status.hidden = false;
    status.textContent = "Saving feedback...";
    saveDailyFeedbackToSupabase("day1_feedback", txt, { source: "daily_update_phase2" })
      .then(function () {
        setDailyInitialFeedbackDone();
        status.textContent = "Feedback saved. Thank you \ud83d\udc9c";
        renderDailyPhase2UI();
      })
      .catch(function () {
        status.textContent = "Could not save to cloud now. Please try again.";
      });
  }

  function submitSongFeedback() {
    var track1Input = document.getElementById("song-feedback-track1");
    var track2Input = document.getElementById("song-feedback-track2");
    var favoriteInput = document.getElementById("song-feedback-favorite");
    var oneWordInput = document.getElementById("song-feedback-oneword");
    var extraInput = document.getElementById("song-feedback-extra");
    var status = document.getElementById("song-feedback-status");
    if (!track1Input || !track2Input || !favoriteInput || !oneWordInput || !extraInput || !status) return;
    var track1Feel = (track1Input.value || "").trim();
    var track2Feel = (track2Input.value || "").trim();
    var favorite = (favoriteInput.value || "").trim();
    var oneWord = (oneWordInput.value || "").trim();
    var extra = (extraInput.value || "").trim();
    if (!track1Feel || !track2Feel || !favorite || !oneWord) {
      setSongFeedbackStatusMessage("Please answer all required questions (1-4).");
      return;
    }
    if (/\s/.test(oneWord)) {
      setSongFeedbackStatusMessage("The 'one word' answer should be a single word only.");
      return;
    }
    var compactSummary =
      "Track1 feeling: " +
      track1Feel +
      " | Track2 feeling: " +
      track2Feel +
      " | Favorite: " +
      favorite +
      " | One word: " +
      oneWord +
      (extra ? " | Extra: " + extra : "");
    setSongFeedbackStatusMessage("Saving song feedback...");
    saveDailyFeedbackToSupabase("song_feedback", compactSummary, {
      song_answer: getDailySongAnswer() || null,
      track1_feeling: track1Feel,
      track2_feeling: track2Feel,
      favorite_track: favorite,
      one_word_for_me: oneWord,
      extra_note: extra || null,
    })
      .then(function () {
        setDailySongFeedbackDone();
        setSongFeedbackStatusMessage("Saved. So happy you listened \ud83c\udfb6");
      })
      .catch(function () {
        setSongFeedbackStatusMessage("Could not save to cloud now. Please try again.");
      });
  }

  function initDailyChallengeDescription() {
    var desc = document.getElementById("challenge-description");
    var sectionBtn = document.getElementById("daily-surprise-section-play");
    if (isDailyPhase2Unlocked()) {
      if (desc) {
        desc.textContent = "Today's gift is done. Open the update below for the next surprise.";
      }
      if (sectionBtn) {
        sectionBtn.textContent = "Open daily rewards update";
        sectionBtn.hidden = false;
      }
      renderDailyPhase2UI();
      return;
    }
    if (hasCompletedDailySurpriseToday()) {
      if (desc) {
        desc.textContent =
          "You've unlocked today's reward. Come back tomorrow for the next surprise — or watch today's clip again below.";
      }
      if (sectionBtn) sectionBtn.textContent = "Watch today’s reward again";
    } else {
      if (desc) {
        desc.textContent =
          "When you first open the site each day, a popup invites you to play a quick game to unlock that day’s video reward. Missed it? Use the button below anytime.";
      }
      if (sectionBtn) sectionBtn.textContent = "Play today’s game";
    }
    renderDailyPhase2UI();
  }

  function initDailyChallenge() {
    var title = document.getElementById("challenge-title");
    if (title) title.textContent = "Daily surprise";
    initDailyChallengeDescription();
  }

  var dailySurpriseFlowBound = false;

  function initDailySurpriseFlow() {
    if (dailySurpriseFlowBound) return;
    dailySurpriseFlowBound = true;

    var playBtn = document.getElementById("daily-surprise-play");
    var dismissBtn = document.getElementById("daily-surprise-dismiss");
    var backdrop = document.getElementById("daily-surprise-backdrop");
    var submitBtn = document.getElementById("daily-quiz-submit");
    var quizInput = document.getElementById("daily-quiz-input");
    var envelopeBtn = document.getElementById("daily-envelope-btn");
    var closeVid = document.getElementById("daily-reward-close");
    var rewardVideo = document.getElementById("daily-reward-video");
    var sectionPlay = document.getElementById("daily-surprise-section-play");
    var updateBackdrop = document.getElementById("daily-update-backdrop");
    var updateGo = document.getElementById("daily-update-go");
    var updateClose = document.getElementById("daily-update-close");
    var initialFeedbackSubmit = document.getElementById("daily-initial-feedback-submit");
    var songYes = document.getElementById("song-answer-yes");
    var songNo = document.getElementById("song-answer-no");
    var songFeedbackSubmit = document.getElementById("song-feedback-submit");

    if (sectionPlay) {
      sectionPlay.addEventListener("click", openDailySurpriseFromSection);
    }
    if (playBtn) {
      playBtn.addEventListener("click", function () {
        showDailySurpriseStep("daily-step-quiz");
        if (quizInput) {
          window.setTimeout(function () {
            quizInput.focus();
          }, 80);
        }
      });
    }
    if (dismissBtn) dismissBtn.addEventListener("click", closeDailySurpriseModal);
    if (backdrop) backdrop.addEventListener("click", closeDailySurpriseModal);
    if (submitBtn) submitBtn.addEventListener("click", submitDailyQuiz);
    if (quizInput) {
      quizInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") submitDailyQuiz();
      });
    }
    if (envelopeBtn) envelopeBtn.addEventListener("click", onEnvelopeOpen);
    if (closeVid) closeVid.addEventListener("click", closeDailyRewardVideoLayer);
    if (updateBackdrop) updateBackdrop.addEventListener("click", closeDailyUpdateModal);
    if (updateClose) updateClose.addEventListener("click", closeDailyUpdateModal);
    if (updateGo) {
      updateGo.addEventListener("click", function () {
        closeDailyUpdateModal();
        scrollToDailySection();
        renderDailyPhase2UI();
        var initInput = document.getElementById("daily-initial-feedback-input");
        if (initInput && !isDailyInitialFeedbackDone()) {
          window.setTimeout(function () {
            initInput.focus();
          }, 550);
        }
      });
    }
    if (initialFeedbackSubmit) {
      initialFeedbackSubmit.addEventListener("click", submitInitialDailyFeedback);
    }
    if (songYes) {
      songYes.addEventListener("click", function () {
        setDailySongAnswer("yes");
        renderDailySongAnswerState();
      });
    }
    if (songNo) {
      songNo.addEventListener("click", function () {
        setDailySongAnswer("no");
        renderDailySongAnswerState();
      });
    }
    if (songFeedbackSubmit) {
      songFeedbackSubmit.addEventListener("click", submitSongFeedback);
    }
    setupSongTracksAutoMute();
    updateBgMuteBySongTracks();
    ensureSongUnlockTicker();
    if (rewardVideo) {
      rewardVideo.addEventListener("error", function () {
        var fb = document.getElementById("daily-reward-fallback");
        if (fb) fb.hidden = false;
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var modal = document.getElementById("daily-surprise-modal");
      if (modal && !modal.hidden) {
        closeDailySurpriseModal();
      }
      var layer = document.getElementById("daily-reward-layer");
      if (layer && !layer.hidden) {
        closeDailyRewardVideoLayer();
      }
      var updateModal = document.getElementById("daily-update-modal");
      if (updateModal && !updateModal.hidden) {
        closeDailyUpdateModal();
      }
    });
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
    a.muted = isMuted || bgAudioForcedMuteBySong;
    a.loop = true;
  }

  function updateBgMuteBySongTracks() {
    var t1 = document.getElementById("song-track-1");
    var t2 = document.getElementById("song-track-2");
    var playing1 = !!(t1 && !t1.paused && !t1.ended);
    var playing2 = !!(t2 && !t2.paused && !t2.ended);
    bgAudioForcedMuteBySong = playing1 || playing2;
    applyMuteToAudio();
  }

  function setupSongTracksAutoMute() {
    var t1 = document.getElementById("song-track-1");
    var t2 = document.getElementById("song-track-2");
    if (!t1 && !t2) return;
    [t1, t2].forEach(function (t) {
      if (!t) return;
      ["play", "playing", "pause", "ended", "emptied", "abort", "stalled"].forEach(function (ev) {
        t.addEventListener(ev, updateBgMuteBySongTracks);
      });
    });
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
      window.setTimeout(openDailySurpriseIfNeeded, 1400);
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
          window.setTimeout(openDailySurpriseIfNeeded, 500);
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
    window.setTimeout(openDailySurpriseIfNeeded, 700);
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
    maybeResetDailySurpriseFromQuery();
    var didReset = maybeResetGalleryFromQuery();
    var afterSync = function () {
      applyHeroGreeting();
      initStarChart();
      buildNameLetters();
      initGalleryProgress();
      initDailyWish();
      initDailyChallenge();
      initDailySurpriseFlow();

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
