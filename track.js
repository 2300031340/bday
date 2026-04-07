/* Track detail page: plays audio + loads matching lyrics txt. */
(function () {
  "use strict";

  function qs(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  function encodeAudioPath(raw) {
    var parts = raw.split("/");
    parts[parts.length - 1] = encodeURIComponent(parts[parts.length - 1]);
    return parts.join("/");
  }

  function getHashParam(name) {
    try {
      var h = String(window.location.hash || "");
      if (!h) return null;
      if (h.charAt(0) === "#") h = h.slice(1);
      // support "#track=2" and also "#?track=2"
      if (h.charAt(0) === "?") h = h.slice(1);
      return new URLSearchParams(h).get(name);
    } catch (e) {
      return null;
    }
  }

  function getTrackId() {
    var hv = getHashParam("track");
    if (hv) return String(hv).trim();
    var v = qs("track");
    if (v) return String(v).trim();
    // Fallback: some hosts/browsers can behave oddly with cached navigations.
    // Parse from full URL as a last resort.
    try {
      var href = String(window.location.href || "");
      var m = href.match(/[?#&]track=([^&#]+)/i);
      if (m && m[1]) return decodeURIComponent(m[1]).trim();
    } catch (e) {}
    return "";
  }

  var trackId = getTrackId();

  var metaById = {
    "1": {
      title: "Track 1",
      subtitle: "For everyone",
      audio: "assets/audio/track 1.mp3",
      lyrics: "assets/images/track 1 lyrics.txt",
    },
    "2": {
      title: "Track 2",
      subtitle: "Only you can listen",
      audio: "assets/audio/track 2.mp3",
      lyrics: "assets/images/track 2 lyrics.txt",
    },
  };

  var meta = metaById[String(trackId || "")] || metaById["1"];

  var titleEl = document.getElementById("track-title");
  var subEl = document.getElementById("track-subtitle");
  var audioEl = document.getElementById("track-audio");
  var preEl = document.getElementById("track-lyrics");
  var errEl = document.getElementById("track-lyrics-error");

  if (titleEl) titleEl.textContent = meta.title;
  if (subEl) subEl.textContent = meta.subtitle;
  document.title = meta.title + " · Lyrics";

  if (audioEl) {
    audioEl.src = encodeAudioPath(meta.audio);
  }

  function showError(msg) {
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = msg;
    }
    if (preEl) preEl.textContent = "";
  }

  var backBtn = document.getElementById("track-page-back");
  if (backBtn) {
    backBtn.addEventListener("click", function () {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "index.html";
      }
    });
  }

  fetch(encodeAudioPath(meta.lyrics), { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(function (text) {
      if (errEl) errEl.hidden = true;
      if (preEl) preEl.textContent = (text || "").trim() || "(No lyrics found.)";
    })
    .catch(function () {
      showError("Couldn’t load lyrics. Make sure the .txt file path is correct.");
    });
})();

