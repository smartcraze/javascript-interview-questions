const state = {
  allQuestions: [],
  filteredQuestions: [],
  page: 1,
  perPage: 20,
  activeQuestionId: null,
  search: "",
  sort: "asc",
  favoritesOnly: false,
  favorites: new Set(),
  theme: "day",
};

const elements = {
  searchInput: document.getElementById("searchInput"),
  perPageSelect: document.getElementById("perPageSelect"),
  jumpInput: document.getElementById("jumpInput"),
  jumpBtn: document.getElementById("jumpBtn"),
  sortSelect: document.getElementById("sortSelect"),
  favoritesOnly: document.getElementById("favoritesOnly"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  themeToggle: document.getElementById("themeToggle"),
  questionList: document.getElementById("questionList"),
  listMeta: document.getElementById("listMeta"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  pageNumbers: document.getElementById("pageNumbers"),
  activeQuestionNumber: document.getElementById("activeQuestionNumber"),
  activeQuestionTitle: document.getElementById("activeQuestionTitle"),
  answerContent: document.getElementById("answerContent"),
  sourceLink: document.getElementById("sourceLink"),
  totalQuestions: document.getElementById("totalQuestions"),
  currentPageLabel: document.getElementById("currentPageLabel"),
  resultsLabel: document.getElementById("resultsLabel"),
  favoriteActiveBtn: document.getElementById("favoriteActiveBtn"),
  copyLinkBtn: document.getElementById("copyLinkBtn"),
  copyAnswerBtn: document.getElementById("copyAnswerBtn"),
  randomQuestionBtn: document.getElementById("randomQuestionBtn"),
  backToTop: document.getElementById("backToTop"),
  toast: document.getElementById("toast"),
};

let toastTimer = null;

function escapeHtml(input) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function applySearch() {
  const term = state.search.trim().toLowerCase();

  let rows = state.allQuestions.filter((question) => {
    if (state.favoritesOnly && !state.favorites.has(question.id)) {
      return false;
    }

    if (!term) {
      return true;
    }

    const fullText = `${question.question} ${question.answerMarkdown}`.toLowerCase();
    return fullText.includes(term);
  });

  rows = rows.sort((a, b) => (state.sort === "asc" ? a.id - b.id : b.id - a.id));
  state.filteredQuestions = rows;
}

function getTotalPages() {
  return Math.max(1, Math.ceil(state.filteredQuestions.length / state.perPage));
}

function getQuestionsForCurrentPage() {
  const start = (state.page - 1) * state.perPage;
  return state.filteredQuestions.slice(start, start + state.perPage);
}

function savePreferences() {
  localStorage.setItem("jsiq-per-page", String(state.perPage));
  localStorage.setItem("jsiq-theme", state.theme);
  localStorage.setItem("jsiq-sort", state.sort);
  localStorage.setItem("jsiq-favorites", JSON.stringify([...state.favorites]));
}

function showToast(message) {
  if (!elements.toast) {
    return;
  }

  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 1500);
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.activeQuestionId) {
    params.set("q", String(state.activeQuestionId));
  }
  if (state.search.trim()) {
    params.set("s", state.search.trim());
  }
  if (state.page > 1) {
    params.set("p", String(state.page));
  }
  if (state.perPage !== 20) {
    params.set("pp", String(state.perPage));
  }
  if (state.sort !== "asc") {
    params.set("sort", state.sort);
  }
  if (state.favoritesOnly) {
    params.set("fav", "1");
  }

  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
  history.replaceState({}, "", next);
}

function applyTheme() {
  if (state.theme === "night") {
    document.body.setAttribute("data-theme", "night");
    elements.themeToggle.textContent = "Theme: Night";
  } else {
    document.body.removeAttribute("data-theme");
    elements.themeToggle.textContent = "Theme: Day";
  }
}

function getQuestionById(id) {
  return state.allQuestions.find((item) => item.id === id) || null;
}

function jumpToQuestion(id) {
  const itemIndex = state.filteredQuestions.findIndex((question) => question.id === id);
  if (itemIndex < 0) {
    return false;
  }

  state.page = Math.floor(itemIndex / state.perPage) + 1;
  state.activeQuestionId = id;
  return true;
}

function moveActiveQuestion(delta) {
  if (!state.filteredQuestions.length) {
    return;
  }

  const currentIndex = state.filteredQuestions.findIndex((item) => item.id === state.activeQuestionId);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = Math.max(0, Math.min(safeIndex + delta, state.filteredQuestions.length - 1));
  const nextQuestion = state.filteredQuestions[nextIndex];

  state.activeQuestionId = nextQuestion.id;
  state.page = Math.floor(nextIndex / state.perPage) + 1;
  updateView();
}

function setFavorite(questionId, shouldFavorite) {
  if (shouldFavorite) {
    state.favorites.add(questionId);
  } else {
    state.favorites.delete(questionId);
  }

  savePreferences();
}

function setActiveQuestion(question) {
  if (!question) {
    elements.activeQuestionNumber.textContent = "Question #";
    elements.activeQuestionTitle.textContent = "No question found";
    elements.answerContent.innerHTML = "<p>Try a different search term.</p>";
    elements.sourceLink.href = "https://github.com/sudheerj/javascript-interview-questions/blob/master/README.md";
    return;
  }

  state.activeQuestionId = question.id;
  elements.activeQuestionNumber.textContent = `Question #${question.id}`;
  elements.activeQuestionTitle.textContent = question.question;

  const rawHtml = marked.parse(question.answerMarkdown || "No answer available.");
  const safeHtml = DOMPurify.sanitize(rawHtml);
  elements.answerContent.innerHTML = safeHtml;

  if (window.Prism) {
    Prism.highlightAllUnder(elements.answerContent);
  }

  const safeSlug = escapeHtml(question.slug);
  elements.sourceLink.href = `https://github.com/sudheerj/javascript-interview-questions/blob/master/README.md#${safeSlug}`;
  const isFavorite = state.favorites.has(question.id);
  elements.favoriteActiveBtn.textContent = isFavorite ? "Unfavorite" : "Favorite";
}

function renderQuestionList() {
  const questionsOnPage = getQuestionsForCurrentPage();

  elements.questionList.innerHTML = questionsOnPage
    .map((question) => {
      const isActive = question.id === state.activeQuestionId;
      const isFavorite = state.favorites.has(question.id);
      return `<li class="question-item"><div class="question-row"><button data-id="${question.id}" class="${isActive ? "active" : ""}"><span class="question-id">#${question.id}</span>${escapeHtml(question.question)}</button><button class="fav-btn ${isFavorite ? "active" : ""}" data-fav="${question.id}" aria-label="${isFavorite ? "Remove from favorites" : "Add to favorites"}">${isFavorite ? "★" : "☆"}</button></div></li>`;
    })
    .join("");

  if (!state.activeQuestionId && questionsOnPage[0]) {
    setActiveQuestion(questionsOnPage[0]);
  }

  if (state.activeQuestionId) {
    const active = state.filteredQuestions.find((item) => item.id === state.activeQuestionId);
    if (!active) {
      setActiveQuestion(questionsOnPage[0] || null);
    }
  }

  const totalPages = getTotalPages();
  const start = state.filteredQuestions.length ? (state.page - 1) * state.perPage + 1 : 0;
  const end = Math.min(state.page * state.perPage, state.filteredQuestions.length);

  elements.listMeta.textContent = `${start}-${end} of ${state.filteredQuestions.length}`;
  elements.currentPageLabel.textContent = `${state.page}/${totalPages}`;
  elements.resultsLabel.textContent = `${state.filteredQuestions.length}`;
}

function renderPagination() {
  const totalPages = getTotalPages();
  elements.prevPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= totalPages;

  const pages = [];
  const windowSize = 2;

  for (let i = Math.max(1, state.page - windowSize); i <= Math.min(totalPages, state.page + windowSize); i += 1) {
    pages.push(i);
  }

  if (pages[0] > 1) {
    pages.unshift(1);
  }

  if (pages[pages.length - 1] < totalPages) {
    pages.push(totalPages);
  }

  const deduped = [...new Set(pages)];

  elements.pageNumbers.innerHTML = deduped
    .map((page, index) => {
      const prev = deduped[index - 1];
      const gap = prev && page - prev > 1;
      const ellipsis = gap ? '<span aria-hidden="true">...</span>' : "";
      return `${ellipsis}<button data-page="${page}" class="${page === state.page ? "active" : ""}">${page}</button>`;
    })
    .join("");
}

function updateView() {
  const totalPages = getTotalPages();
  if (state.page > totalPages) {
    state.page = totalPages;
  }

  renderQuestionList();
  renderPagination();

  const currentQuestion = state.filteredQuestions.find((item) => item.id === state.activeQuestionId);
  setActiveQuestion(currentQuestion || getQuestionsForCurrentPage()[0] || null);
  syncUrl();
}

function getActivePermalink() {
  const url = new URL(window.location.href);
  if (state.activeQuestionId) {
    url.searchParams.set("q", String(state.activeQuestionId));
  }
  return url.toString();
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message);
  } catch {
    showToast("Copy failed on this browser");
  }
}

function hydrateFromUrlAndStorage() {
  const params = new URLSearchParams(window.location.search);

  const savedPerPage = Number(localStorage.getItem("jsiq-per-page"));
  if (savedPerPage) {
    state.perPage = savedPerPage;
  }

  const savedTheme = localStorage.getItem("jsiq-theme");
  if (savedTheme === "night" || savedTheme === "day") {
    state.theme = savedTheme;
  }

  const savedSort = localStorage.getItem("jsiq-sort");
  if (savedSort === "asc" || savedSort === "desc") {
    state.sort = savedSort;
  }

  try {
    const savedFavorites = JSON.parse(localStorage.getItem("jsiq-favorites") || "[]");
    if (Array.isArray(savedFavorites)) {
      state.favorites = new Set(savedFavorites.map((item) => Number(item)).filter(Boolean));
    }
  } catch {
    state.favorites = new Set();
  }

  if (params.get("s")) {
    state.search = params.get("s");
  }

  if (params.get("sort") === "desc") {
    state.sort = "desc";
  }

  if (params.get("fav") === "1") {
    state.favoritesOnly = true;
  }

  if (params.get("pp")) {
    const urlPerPage = Number(params.get("pp"));
    if (urlPerPage) {
      state.perPage = urlPerPage;
    }
  }

  if (params.get("p")) {
    const urlPage = Number(params.get("p"));
    if (urlPage) {
      state.page = urlPage;
    }
  }

  elements.searchInput.value = state.search;
  elements.perPageSelect.value = String(state.perPage);
  elements.sortSelect.value = state.sort;
  elements.favoritesOnly.checked = state.favoritesOnly;
  applyTheme();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    state.page = 1;
    applySearch();
    updateView();
  });

  elements.perPageSelect.addEventListener("change", (event) => {
    state.perPage = Number(event.target.value) || 20;
    state.page = 1;
    savePreferences();
    updateView();
  });

  elements.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value === "desc" ? "desc" : "asc";
    state.page = 1;
    applySearch();
    savePreferences();
    updateView();
  });

  elements.favoritesOnly.addEventListener("change", (event) => {
    state.favoritesOnly = Boolean(event.target.checked);
    state.page = 1;
    applySearch();
    updateView();
  });

  elements.clearFiltersBtn.addEventListener("click", () => {
    state.search = "";
    state.sort = "asc";
    state.favoritesOnly = false;
    state.page = 1;
    elements.searchInput.value = "";
    elements.sortSelect.value = "asc";
    elements.favoritesOnly.checked = false;
    applySearch();
    savePreferences();
    updateView();
    showToast("Filters reset");
  });

  elements.themeToggle.addEventListener("click", () => {
    state.theme = state.theme === "day" ? "night" : "day";
    applyTheme();
    savePreferences();
  });

  elements.jumpBtn.addEventListener("click", () => {
    const questionId = Number(elements.jumpInput.value);
    if (!questionId) {
      return;
    }

    if (!jumpToQuestion(questionId)) {
      showToast("Question not in current filter");
      return;
    }

    updateView();
  });

  elements.questionList.addEventListener("click", (event) => {
    const favButton = event.target.closest("button[data-fav]");
    if (favButton) {
      const id = Number(favButton.dataset.fav);
      const shouldFavorite = !state.favorites.has(id);
      setFavorite(id, shouldFavorite);
      if (state.favoritesOnly) {
        applySearch();
      }
      updateView();
      showToast(shouldFavorite ? "Added to favorites" : "Removed from favorites");
      return;
    }

    const button = event.target.closest("button[data-id]");
    if (!button) {
      return;
    }

    state.activeQuestionId = Number(button.dataset.id);
    updateView();
  });

  elements.prevPage.addEventListener("click", () => {
    if (state.page > 1) {
      state.page -= 1;
      updateView();
    }
  });

  elements.nextPage.addEventListener("click", () => {
    if (state.page < getTotalPages()) {
      state.page += 1;
      updateView();
    }
  });

  elements.pageNumbers.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-page]");
    if (!button) {
      return;
    }

    state.page = Number(button.dataset.page);
    updateView();
  });

  elements.favoriteActiveBtn.addEventListener("click", () => {
    if (!state.activeQuestionId) {
      return;
    }

    const shouldFavorite = !state.favorites.has(state.activeQuestionId);
    setFavorite(state.activeQuestionId, shouldFavorite);
    if (state.favoritesOnly) {
      applySearch();
    }
    updateView();
    showToast(shouldFavorite ? "Added to favorites" : "Removed from favorites");
  });

  elements.copyLinkBtn.addEventListener("click", async () => {
    await copyText(getActivePermalink(), "Question link copied");
  });

  elements.copyAnswerBtn.addEventListener("click", async () => {
    const active = getQuestionById(state.activeQuestionId);
    if (!active) {
      return;
    }
    await copyText(`${active.question}\n\n${active.answerMarkdown}`, "Answer copied");
  });

  elements.randomQuestionBtn.addEventListener("click", () => {
    if (!state.filteredQuestions.length) {
      return;
    }

    const index = Math.floor(Math.random() * state.filteredQuestions.length);
    const randomQuestion = state.filteredQuestions[index];
    jumpToQuestion(randomQuestion.id);
    updateView();
    showToast("Random question loaded");
  });

  elements.backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", () => {
    elements.backToTop.classList.toggle("visible", window.scrollY > 400);
  });

  window.addEventListener("keydown", (event) => {
    const tag = document.activeElement?.tagName?.toLowerCase() || "";
    const inInput = tag === "input" || tag === "textarea" || tag === "select";

    if (event.key === "/" && !inInput) {
      event.preventDefault();
      elements.searchInput.focus();
      return;
    }

    if (inInput) {
      return;
    }

    if (event.key === "j" || event.key === "J") {
      event.preventDefault();
      moveActiveQuestion(1);
    } else if (event.key === "k" || event.key === "K") {
      event.preventDefault();
      moveActiveQuestion(-1);
    } else if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      if (state.page < getTotalPages()) {
        state.page += 1;
        updateView();
      }
    } else if (event.key === "p" || event.key === "P") {
      event.preventDefault();
      if (state.page > 1) {
        state.page -= 1;
        updateView();
      }
    }
  });
}

async function init() {
  try {
    hydrateFromUrlAndStorage();
    const response = await fetch("./questions.json", { cache: "no-store" });
    const questions = await response.json();

    state.allQuestions = questions;
    applySearch();

    const urlQuestionId = Number(new URLSearchParams(window.location.search).get("q"));
    if (urlQuestionId) {
      state.activeQuestionId = urlQuestionId;
      jumpToQuestion(urlQuestionId);
    } else {
      state.activeQuestionId = state.filteredQuestions[0]?.id ?? null;
    }

    elements.totalQuestions.textContent = String(questions.length);

    bindEvents();
    updateView();
  } catch (error) {
    elements.answerContent.innerHTML = `<p>Failed to load question data. ${escapeHtml(String(error.message || error))}</p>`;
  }
}

init();
