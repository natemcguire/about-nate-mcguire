/* AI tl;dr — floating button + theater modal that calls /api/tldr for real
 * provider summaries. The progress bar is fake; the answers are real.
 */
(function () {
  "use strict";

  const slug = (function () {
    const m = location.pathname.match(/\/author\/([a-z0-9-]+)\/?$/);
    return m ? m[1] : null;
  })();
  if (!slug) return;

  // ── Button ──────────────────────────────────────────────────────────
  const btn = document.createElement("button");
  btn.className = "tldr-button";
  btn.type = "button";
  btn.setAttribute("aria-haspopup", "dialog");
  btn.innerHTML =
    '<span class="tldr-button-glyph">✨</span><span class="tldr-button-label">AI tl;dr</span>';
  document.body.appendChild(btn);

  // ── Modal ───────────────────────────────────────────────────────────
  const modal = document.createElement("div");
  modal.className = "tldr-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "AI tl;dr");
  modal.hidden = true;
  modal.innerHTML = `
    <div class="tldr-backdrop"></div>
    <div class="tldr-card">
      <button class="tldr-close" aria-label="Close">×</button>
      <div class="tldr-header">
        <span class="tldr-eyebrow">// AI tl;dr</span>
        <h2 class="tldr-title">Three models, one article.</h2>
      </div>
      <div class="tldr-loader" data-state="loading">
        <div class="tldr-progress"><div class="tldr-progress-bar"></div></div>
        <ul class="tldr-steps"></ul>
      </div>
      <div class="tldr-result" hidden>
        <div class="tldr-tabs" role="tablist">
          <button class="tldr-tab is-active" role="tab" data-tab="anthropic">Claude</button>
          <button class="tldr-tab" role="tab" data-tab="openai">GPT</button>
          <button class="tldr-tab" role="tab" data-tab="grok">Grok</button>
        </div>
        <div class="tldr-panes">
          <div class="tldr-pane is-active" data-pane="anthropic"></div>
          <div class="tldr-pane" data-pane="openai"></div>
          <div class="tldr-pane" data-pane="grok"></div>
        </div>
        <p class="tldr-footnote">Summaries generated on demand by Anthropic Claude, OpenAI GPT, and xAI Grok. They sometimes disagree — that's the point.</p>
      </div>
      <div class="tldr-error" hidden>
        <p>Couldn't reach the models. <button class="tldr-retry" type="button">Try again</button></p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // ── Theater steps (pure vibes) ──────────────────────────────────────
  const THEATER_STEPS = [
    { text: "Parsing essay (mapping argumentative arcs)…", ms: 380 },
    { text: "Detecting opinions per kilobyte…", ms: 420 },
    { text: "Tokenizing (12,431 tokens, 87 em-dashes)…", ms: 460 },
    { text: "Asking Claude what it thinks…", ms: 520 },
    { text: "Asking GPT for the safest take…", ms: 540 },
    { text: "Asking Grok to be a smartass…", ms: 580 },
    { text: "Cross-referencing all three for vibes…", ms: 520 },
    { text: "Calibrating snark…", ms: 380 },
    { text: "Rendering summary…", ms: 280 },
  ];

  // ── State ───────────────────────────────────────────────────────────
  let resultPromise = null;
  let openOnce = false;

  function fmtSummary(text) {
    if (!text) return '<p class="tldr-pane-empty">(empty response)</p>';
    return text
      .trim()
      .split(/\n\s*\n/)
      .map(
        (p) =>
          "<p>" +
          p
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>") +
          "</p>"
      )
      .join("");
  }

  function runTheater() {
    const stepsEl = modal.querySelector(".tldr-steps");
    const barEl = modal.querySelector(".tldr-progress-bar");
    stepsEl.innerHTML = "";
    barEl.style.width = "0%";
    let cancelled = false;
    const total = THEATER_STEPS.reduce((a, s) => a + s.ms, 0);
    let elapsed = 0;

    return new Promise((resolve) => {
      const playNext = (i) => {
        if (cancelled || i >= THEATER_STEPS.length) {
          if (!cancelled) barEl.style.width = "100%";
          resolve();
          return;
        }
        const step = THEATER_STEPS[i];
        const li = document.createElement("li");
        li.className = "tldr-step is-active";
        li.textContent = step.text;
        stepsEl.appendChild(li);
        elapsed += step.ms;
        barEl.style.width = Math.min(96, (elapsed / total) * 96) + "%";
        setTimeout(() => {
          li.classList.remove("is-active");
          li.classList.add("is-done");
          li.insertAdjacentText("beforeend", "  ✓");
          playNext(i + 1);
        }, step.ms);
      };
      playNext(0);

      modal._cancelTheater = () => {
        cancelled = true;
        resolve();
      };
    });
  }

  async function fetchSummaries() {
    const res = await fetch("/api/tldr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    if (!data || !data.summaries) throw new Error("no summaries in response");
    return data.summaries;
  }

  async function open() {
    if (modal.hidden === false) return;
    modal.hidden = false;
    document.body.classList.add("tldr-open");
    btn.setAttribute("aria-expanded", "true");

    if (resultPromise) {
      // Re-opening with cached result already fetched — skip the theater.
      showResult(await resultPromise);
      return;
    }

    // Reset views
    modal.querySelector(".tldr-loader").hidden = false;
    modal.querySelector(".tldr-result").hidden = true;
    modal.querySelector(".tldr-error").hidden = true;

    resultPromise = fetchSummaries().catch((e) => {
      console.warn("tldr fetch err:", e);
      return null;
    });

    // Theater + real fetch race; show whichever finishes last (so the loader
    // doesn't disappear before the answer is ready).
    const [, summaries] = await Promise.all([runTheater(), resultPromise]);
    if (!summaries) {
      modal.querySelector(".tldr-loader").hidden = true;
      modal.querySelector(".tldr-error").hidden = false;
      resultPromise = null; // allow retry
      return;
    }
    showResult(summaries);
  }

  function showResult(summaries) {
    modal.querySelector(".tldr-loader").hidden = true;
    modal.querySelector(".tldr-result").hidden = false;
    modal.querySelector('[data-pane="anthropic"]').innerHTML = fmtSummary(summaries.anthropic);
    modal.querySelector('[data-pane="openai"]').innerHTML = fmtSummary(summaries.openai);
    modal.querySelector('[data-pane="grok"]').innerHTML = fmtSummary(summaries.grok);
  }

  function close() {
    modal.hidden = true;
    document.body.classList.remove("tldr-open");
    btn.setAttribute("aria-expanded", "false");
    if (modal._cancelTheater) modal._cancelTheater();
  }

  // ── Events ──────────────────────────────────────────────────────────
  btn.addEventListener("click", () => {
    open();
  });
  modal.querySelector(".tldr-close").addEventListener("click", close);
  modal.querySelector(".tldr-backdrop").addEventListener("click", close);
  modal.querySelector(".tldr-retry").addEventListener("click", () => {
    resultPromise = null;
    open();
  });
  modal.addEventListener("click", (e) => {
    const tab = e.target.closest(".tldr-tab");
    if (!tab) return;
    const which = tab.dataset.tab;
    modal.querySelectorAll(".tldr-tab").forEach((t) =>
      t.classList.toggle("is-active", t === tab)
    );
    modal.querySelectorAll(".tldr-pane").forEach((p) =>
      p.classList.toggle("is-active", p.dataset.pane === which)
    );
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) close();
  });
})();
