const state = {
  questions: [],
  filtered: [],
  activeQuestionId: null,
  search: "",
};

const elements = {
  searchInput: document.getElementById("searchInput"),
  sheetMeta: document.getElementById("sheetMeta"),
  sheetList: document.getElementById("sheetList"),
  activeQuestionNumber: document.getElementById("activeQuestionNumber"),
  activeQuestionTitle: document.getElementById("activeQuestionTitle"),
  answerContent: document.getElementById("answerContent"),
  sourceLink: document.getElementById("sourceLink"),
  prevFloatingBtn: document.getElementById("prevFloatingBtn"),
  nextFloatingBtn: document.getElementById("nextFloatingBtn"),
};

const languageAliases = {
  js: "javascript",
  ts: "typescript",
  html: "markup",
  xml: "markup",
  sh: "bash",
  shell: "bash",
  yml: "yaml",
  md: "markdown",
};

function escapeHtml(input) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.activeQuestionId) {
    params.set("q", String(state.activeQuestionId));
  }
  if (state.search.trim()) {
    params.set("s", state.search.trim());
  }
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
  history.replaceState({}, "", next);
}

function getQuestionById(id) {
  return state.questions.find((item) => item.id === id) || null;
}

function applySearch() {
  const term = state.search.trim().toLowerCase();
  state.filtered = state.questions.filter((question) => {
    if (!term) {
      return true;
    }
    return `${question.question} ${question.answerMarkdown}`.toLowerCase().includes(term);
  });
}

function normalizeMarkdownContent(markdown) {
  const raw = String(markdown || "").replace(/\r\n/g, "\n");

  const lines = raw.split("\n");
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  const indentedLines = nonEmpty.filter((line) => /^\s{4,}|^\t/.test(line));

  // Dataset answers are often block-indented, which turns markdown into code blocks.
  const looksBlockIndented =
    nonEmpty.length > 0 &&
    indentedLines.length / nonEmpty.length > 0.35 &&
    /(^\s{4,}(\d+\.|[-*+])\s)|(^\s{4,}```)|(^\s{4,}\|.*\|)/m.test(raw);

  if (!looksBlockIndented) {
    return raw.trim();
  }

  const deindentOneLevel = (text) =>
    text
      .split("\n")
      .map((line) => {
        if (line.startsWith("\t")) {
          return line.slice(1);
        }
        if (line.startsWith("    ")) {
          return line.slice(4);
        }
        return line;
      })
      .join("\n");

  let normalized = raw;
  for (let pass = 0; pass < 3; pass += 1) {
    if (!/(^\s{4,}```)|(^\s{4,}(\d+\.|[-*+])\s)|(^\s{4,}\|.*\|)/m.test(normalized)) {
      break;
    }
    normalized = deindentOneLevel(normalized);
  }

  return normalized.trim();
}

function wrapTables(container) {
  if (!container) {
    return;
  }

  container.querySelectorAll("table").forEach((table) => {
    const parent = table.parentElement;
    if (parent && parent.classList.contains("table-wrap")) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "table-wrap";
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

function moveActiveQuestion(step) {
  if (!state.filtered.length) {
    return;
  }

  const index = state.filtered.findIndex((item) => item.id === state.activeQuestionId);
  const safeIndex = index >= 0 ? index : 0;
  const nextIndex = Math.max(0, Math.min(safeIndex + step, state.filtered.length - 1));

  state.activeQuestionId = state.filtered[nextIndex].id;
  updateView();
}

function normalizeAndHighlightCodeBlocks(container) {
  if (!window.Prism || !container) {
    return;
  }

  const blocks = container.querySelectorAll("pre code");

  blocks.forEach((codeEl) => {
    const languageClass = [...codeEl.classList].find(
      (className) => className.startsWith("language-") || className.startsWith("lang-")
    );

    let language = languageClass ? languageClass.replace(/^language-|^lang-/, "").toLowerCase() : "";
    language = languageAliases[language] || language || "javascript";

    const resolvedLanguage = window.Prism.languages[language] ? language : "javascript";

    codeEl.classList.forEach((className) => {
      if (className.startsWith("language-") || className.startsWith("lang-")) {
        codeEl.classList.remove(className);
      }
    });
    codeEl.classList.add(`language-${resolvedLanguage}`);

    const pre = codeEl.parentElement;
    if (pre) {
      pre.classList.forEach((className) => {
        if (className.startsWith("language-") || className.startsWith("lang-")) {
          pre.classList.remove(className);
        }
      });
      pre.classList.add(`language-${resolvedLanguage}`);
    }

    window.Prism.highlightElement(codeEl);
  });
}

function setActiveQuestion(question) {
  if (!question) {
    elements.activeQuestionNumber.textContent = "Question #";
    elements.activeQuestionTitle.textContent = "No matching sheet found";
    elements.answerContent.innerHTML = "<p>Try a different search term.</p>";
    elements.sourceLink.href = "https://github.com/sudheerj/javascript-interview-questions/blob/master/README.md";
    return;
  }

  state.activeQuestionId = question.id;
  elements.activeQuestionNumber.textContent = `Question #${question.id}`;
  elements.activeQuestionTitle.textContent = question.question;

  const normalizedMarkdown = normalizeMarkdownContent(question.answerMarkdown || "No answer available.");
  const rendered = marked.parse(normalizedMarkdown, { gfm: true, breaks: true });
  elements.answerContent.innerHTML = DOMPurify.sanitize(rendered);
  wrapTables(elements.answerContent);
  normalizeAndHighlightCodeBlocks(elements.answerContent);
  elements.sourceLink.href = `https://github.com/sudheerj/javascript-interview-questions/blob/master/README.md#${escapeHtml(question.slug || "")}`;
}

function renderList() {
  elements.sheetList.innerHTML = state.filtered
    .map((question) => {
      const activeClass = question.id === state.activeQuestionId ? "active" : "";
      return `<li><button data-id="${question.id}" class="${activeClass}" type="button"><span class="sheet-id">#${question.id}</span><span class="sheet-title">${escapeHtml(question.question)}</span></button></li>`;
    })
    .join("");
}

function syncMeta() {
  const total = state.questions.length;
  const shown = state.filtered.length;
  elements.sheetMeta.textContent = `${shown} / ${total} Sheets`;
}

function updateView() {
  const activeStillVisible = state.filtered.some((item) => item.id === state.activeQuestionId);
  if (!activeStillVisible) {
    state.activeQuestionId = state.filtered[0]?.id ?? null;
  }

  renderList();
  setActiveQuestion(getQuestionById(state.activeQuestionId));
  syncMeta();
  syncUrl();

  const index = state.filtered.findIndex((item) => item.id === state.activeQuestionId);
  const safeIndex = index >= 0 ? index : 0;
  if (elements.prevFloatingBtn) {
    elements.prevFloatingBtn.disabled = safeIndex <= 0;
  }
  if (elements.nextFloatingBtn) {
    elements.nextFloatingBtn.disabled = safeIndex >= state.filtered.length - 1;
  }
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    applySearch();
    updateView();
  });

  elements.sheetList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-id]");
    if (!button) {
      return;
    }
    state.activeQuestionId = Number(button.dataset.id);
    updateView();
  });

  elements.prevFloatingBtn?.addEventListener("click", () => {
    moveActiveQuestion(-1);
  });

  elements.nextFloatingBtn?.addEventListener("click", () => {
    moveActiveQuestion(1);
  });

  window.addEventListener("keydown", (event) => {
    const tag = document.activeElement?.tagName?.toLowerCase() || "";
    const inInput = tag === "input" || tag === "textarea" || tag === "select";

    if (event.key === "/" && !inInput) {
      event.preventDefault();
      elements.searchInput.focus();
      return;
    }

    if (inInput || !state.filtered.length) {
      return;
    }

    if (event.key === "j" || event.key === "J") {
      event.preventDefault();
      moveActiveQuestion(1);
    }

    if (event.key === "k" || event.key === "K") {
      event.preventDefault();
      moveActiveQuestion(-1);
    }
  });
}

function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const search = params.get("s");
  const questionId = Number(params.get("q"));

  if (search) {
    state.search = search;
    elements.searchInput.value = search;
  }
  if (questionId) {
    state.activeQuestionId = questionId;
  }
}

async function init() {
  try {
    hydrateFromUrl();

    const response = await fetch("./questions.json", { cache: "no-store" });
    const data = await response.json();

    state.questions = Array.isArray(data) ? data : [];
    applySearch();

    if (!state.activeQuestionId) {
      state.activeQuestionId = state.filtered[0]?.id ?? null;
    }

    bindEvents();
    updateView();
  } catch (error) {
    elements.answerContent.innerHTML = `<p>Failed to load content. ${escapeHtml(String(error.message || error))}</p>`;
    elements.sheetMeta.textContent = "Failed to load sheets";
  }
}

init();
