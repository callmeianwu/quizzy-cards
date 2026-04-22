class CardSet {
    constructor(title, cards) {
        this.title = title;
        this.cards = cards;
        this.created = new Date();
        this.lastStudied = null;
        this.studySections = [];
        this.studyPrefs = createDefaultStudyPrefs();
        this.studyStats = createDefaultStudyStats();
    }
}

const EXPORT_VERSION = "1.1";
const DEFAULT_CHUNK_SIZE = 5;
const SECTION_SIZE_OPTIONS = [5, 10];
const STUDY_MODE_OPTIONS = ["flip", "type", "multiple-choice"];
const AI_CACHE_VERSION = 2;
const HARD_REINSERT_OFFSETS = [2, 3];
const MEDIUM_REINSERT_OFFSETS = [5, 6, 7, 8];
const MIN_MULTIPLE_CHOICE_DISTRACTORS = 2;
const MAX_MULTIPLE_CHOICE_DISTRACTORS = 3;
const MAX_SET_TITLE_LENGTH = 120;
const MAX_CARDS_PER_SET = 200;
const MAX_CARD_TEXT_LENGTH = 2000;
const MAX_AI_HISTORY_ENTRIES = 10;
const TYPE_SIMILARITY_THRESHOLD = 0.72;
const IMPORT_LIMITS = {
    maxFileBytes: 1000000,
    maxSets: 50,
    maxTotalCards: 2000
};

const STORAGE_KEYS = {
    sets: "flashcardSets",
    uiPrefs: "quizzy_ui_prefs"
};

const state = {
    cardSets: [],
    activePanel: "create-panel",
    activeCreateTab: "manual",
    currentSetIndex: -1,
    currentCardIndex: -1,
    studyComplete: false,
    studyCompletionRecorded: false,
    studyManagerOpen: false,
    studySectionSizeMode: String(DEFAULT_CHUNK_SIZE),
    studyQueue: [],
    studyScope: createEmptyStudyScope(),
    resumeStudyScope: createEmptyStudyScope(),
    studyMode: "flip",
    roundStep: 0,
    roundPresentationCount: 0,
    activeCardId: "",
    currentStreak: 0,
    bestStreak: 0,
    streakPulseTimeoutId: 0,
    sessionCompletedCardIds: [],
    troublePile: [],
    masteredPile: [],
    adaptiveHelpEnabled: false,
    currentCardAttempt: createEmptyCardAttemptState(),
    typeAnswerValue: "",
    typeAnswerResult: null,
    multipleChoiceState: createEmptyMultipleChoiceState(),
    adaptiveHelpState: createEmptyAdaptiveHelpState(),
    confirmAction: null
};

const dom = {};

document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
    cacheDom();
    bindEvents();
    restoreUiPrefs();
    loadSavedSets();
    renderDashboard();
    renderStudyState();
    exposeAppBridge();
}

function cacheDom() {
    dom.appShell = document.getElementById("appShell");
    dom.studyView = document.getElementById("studyView");
    dom.setTitle = document.getElementById("setTitle");
    dom.cardsList = document.getElementById("cardsList");
    dom.saveSetBtn = document.getElementById("saveSetBtn");
    dom.exportAllSetsBtn = document.getElementById("exportAllSetsBtn");
    dom.clearAllDataBtn = document.getElementById("clearAllDataBtn");
    dom.importTriggerBtn = document.getElementById("importTriggerBtn");
    dom.importFileInput = document.getElementById("importFileInput");
    dom.setList = document.getElementById("setList");
    dom.libraryEmptyState = document.getElementById("libraryEmptyState");
    dom.totalSetsStat = document.getElementById("totalSetsStat");
    dom.totalCardsStat = document.getElementById("totalCardsStat");
    dom.recentSetTitle = document.getElementById("recentSetTitle");
    dom.recentSetMeta = document.getElementById("recentSetMeta");
    dom.resumeRecentBtn = document.getElementById("resumeRecentBtn");
    dom.manualFormMessage = document.getElementById("manualFormMessage");
    dom.importMessage = document.getElementById("importMessage");
    dom.aiFormMessage = document.getElementById("aiFormMessage");
    dom.aiSuccess = document.getElementById("aiSuccess");
    dom.panelSections = Array.from(document.querySelectorAll("[data-panel]"));
    dom.navButtons = Array.from(document.querySelectorAll("[data-panel-target]"));
    dom.createTabButtons = Array.from(document.querySelectorAll("[data-create-tab]"));
    dom.createPanes = Array.from(document.querySelectorAll("[data-create-pane]"));
    dom.flashcard = document.getElementById("flashcard");
    dom.cardQuestion = document.getElementById("cardQuestion");
    dom.cardAnswer = document.getElementById("cardAnswer");
    dom.studyProgressLabel = document.getElementById("studyProgressLabel");
    dom.studyProgressFill = document.getElementById("studyProgressFill");
    dom.studySetTitle = document.getElementById("studySetTitle");
    dom.studyScopeLabel = document.getElementById("studyScopeLabel");
    dom.studyStreak = document.getElementById("studyStreak");
    dom.currentStreakCount = document.getElementById("currentStreakCount");
    dom.studyModeButtons = Array.from(document.querySelectorAll("[data-study-mode]"));
    dom.studyHint = document.getElementById("studyHint");
    dom.studyInteraction = document.getElementById("studyInteraction");
    dom.typeAnswerPanel = document.getElementById("typeAnswerPanel");
    dom.typeAnswerInput = document.getElementById("typeAnswerInput");
    dom.submitTypeAnswerBtn = document.getElementById("submitTypeAnswerBtn");
    dom.typeAnswerFeedback = document.getElementById("typeAnswerFeedback");
    dom.multipleChoicePanel = document.getElementById("multipleChoicePanel");
    dom.multipleChoiceStatus = document.getElementById("multipleChoiceStatus");
    dom.multipleChoiceOptions = document.getElementById("multipleChoiceOptions");
    dom.multipleChoiceFeedback = document.getElementById("multipleChoiceFeedback");
    dom.studyActions = document.getElementById("studyActions");
    dom.adaptiveHelpPanel = document.getElementById("adaptiveHelpPanel");
    dom.adaptiveHelpStatus = document.getElementById("adaptiveHelpStatus");
    dom.adaptiveHelpToggleBtn = document.getElementById("adaptiveHelpToggleBtn");
    dom.adaptiveHelpContent = document.getElementById("adaptiveHelpContent");
    dom.reviewTroubleBtn = document.getElementById("reviewTroubleBtn");
    dom.ratingButtons = Array.from(document.querySelectorAll("[data-rating]"));
    dom.exitStudyBtn = document.getElementById("exitStudyBtn");
    dom.restartStudyBtn = document.getElementById("restartStudyBtn");
    dom.toggleStudySectionsBtn = document.getElementById("toggleStudySectionsBtn");
    dom.studySectionManager = document.getElementById("studySectionManager");
    dom.studyWholeSetBtn = document.getElementById("studyWholeSetBtn");
    dom.studySectionList = document.getElementById("studySectionList");
    dom.studySectionListMeta = document.getElementById("studySectionListMeta");
    dom.createStudySectionsBtn = document.getElementById("createStudySectionsBtn");
    dom.customSectionSizeInput = document.getElementById("customSectionSizeInput");
    dom.sectionSizeButtons = Array.from(document.querySelectorAll("[data-section-size]"));
    dom.studySectionsMessage = document.getElementById("studySectionsMessage");
    dom.studySummary = document.getElementById("studySummary");
    dom.studySummaryText = document.getElementById("studySummaryText");
    dom.studyAgainBtn = document.getElementById("studyAgainBtn");
    dom.returnToLibraryBtn = document.getElementById("returnToLibraryBtn");
    dom.toastStack = document.getElementById("toastStack");
    dom.confirmDialog = document.getElementById("confirmDialog");
    dom.confirmTitle = document.getElementById("confirmTitle");
    dom.confirmMessage = document.getElementById("confirmMessage");
    dom.confirmApproveBtn = document.getElementById("confirmApproveBtn");
    dom.confirmCancelBtn = document.getElementById("confirmCancelBtn");
}

function bindEvents() {
    dom.navButtons.forEach((button) => {
        button.addEventListener("click", () => {
            switchPanel(button.dataset.panelTarget);
        });
    });

    dom.createTabButtons.forEach((button) => {
        button.addEventListener("click", () => {
            switchCreateTab(button.dataset.createTab);
        });
    });

    dom.saveSetBtn.addEventListener("click", createSet);
    dom.cardsList.addEventListener("keydown", handleComposerKeydown);
    dom.cardsList.addEventListener("focus", handleComposerFocus);
    dom.exportAllSetsBtn.addEventListener("click", exportAllSets);
    dom.clearAllDataBtn.addEventListener("click", clearAllData);
    dom.importTriggerBtn.addEventListener("click", () => dom.importFileInput.click());
    dom.importFileInput.addEventListener("change", handleImportChange);
    dom.setList.addEventListener("click", handleSetListClick);
    dom.resumeRecentBtn.addEventListener("click", handleResumeRecent);
    dom.flashcard.addEventListener("click", flipFlashcard);
    dom.studyModeButtons.forEach((button) => {
        button.addEventListener("click", () => changeStudyMode(button.dataset.studyMode));
    });
    dom.submitTypeAnswerBtn.addEventListener("click", submitTypeAnswer);
    dom.typeAnswerInput.addEventListener("keydown", handleTypeAnswerKeydown);
    dom.ratingButtons.forEach((button) => {
        button.addEventListener("click", () => rateCard(Number(button.dataset.rating)));
    });
    dom.exitStudyBtn.addEventListener("click", () => exitStudyMode("library-panel"));
    dom.restartStudyBtn.addEventListener("click", restartSession);
    dom.studyAgainBtn.addEventListener("click", studyAgain);
    dom.reviewTroubleBtn.addEventListener("click", startTroubleReview);
    if (dom.adaptiveHelpToggleBtn) {
        dom.adaptiveHelpToggleBtn.addEventListener("click", toggleAdaptiveHelp);
    }
    dom.returnToLibraryBtn.addEventListener("click", () => exitStudyMode("library-panel"));
    dom.toggleStudySectionsBtn.addEventListener("click", toggleStudySectionManager);
    dom.studyWholeSetBtn.addEventListener("click", () => activateStudyScope({ type: "full", sectionId: null }));
    dom.createStudySectionsBtn.addEventListener("click", createStudySections);
    dom.customSectionSizeInput.addEventListener("change", handleCustomSectionSizeChange);
    dom.studySectionList.addEventListener("click", handleStudySectionListClick);
    dom.sectionSizeButtons.forEach((button) => {
        button.addEventListener("click", () => handleSectionSizeButtonClick(button.dataset.sectionSize));
    });
    dom.confirmCancelBtn.addEventListener("click", closeConfirmDialog);
    dom.confirmApproveBtn.addEventListener("click", approveConfirmDialog);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !dom.confirmDialog.hidden) {
            closeConfirmDialog();
        }
    });
}

function exposeAppBridge() {
    window.QuizzyApp = {
        populateGeneratedDraft,
        showToast,
        setInlineMessage,
        clearInlineMessage,
        getStudyCardContext,
        recordStudyAiExchange,
        handleStudyAiAvailabilityChange
    };
}

function createDefaultStudyPrefs() {
    return {
        defaultChunkSize: DEFAULT_CHUNK_SIZE,
        lastSectionId: null,
        lastScopeType: "full"
    };
}

function createDefaultStudyStats() {
    return {
        bestStreak: 0
    };
}

function createEmptyStudyScope() {
    return {
        type: "full",
        sectionId: null,
        cardIndexes: [],
        label: "Whole set",
        includeAll: false
    };
}

function cloneStudyScope(scope) {
    if (!scope || typeof scope !== "object") {
        return createEmptyStudyScope();
    }

    return {
        type: scope.type || "full",
        sectionId: scope.sectionId || null,
        cardIndexes: Array.isArray(scope.cardIndexes) ? scope.cardIndexes.slice() : [],
        label: typeof scope.label === "string" ? scope.label : "Whole set",
        includeAll: Boolean(scope.includeAll)
    };
}

function createEmptyMultipleChoiceState() {
    return {
        status: "idle",
        options: [],
        feedback: "",
        selectedOption: "",
        isCorrect: null
    };
}

function createEmptyAdaptiveHelpState() {
    return {
        status: "idle",
        cardId: "",
        message: ""
    };
}

function createEmptyCardAttemptState(cardId = "") {
    return {
        cardId,
        isSubmitted: false,
        mode: "",
        isCorrect: null
    };
}

function resetCurrentCardAttempt(cardId = "") {
    state.currentCardAttempt = createEmptyCardAttemptState(cardId);
}

function hasSubmittedAttemptForCard(card) {
    return Boolean(card
        && state.currentCardAttempt
        && state.currentCardAttempt.cardId === card.id
        && state.currentCardAttempt.isSubmitted);
}

function markCardAttemptSubmitted(card, mode, isCorrect = null) {
    if (!card) {
        return;
    }

    state.currentCardAttempt = {
        cardId: card.id,
        isSubmitted: true,
        mode,
        isCorrect: typeof isCorrect === "boolean" ? isCorrect : null
    };
}

function clearTransientStudyModeState() {
    if (state.typeAnswerResult) {
        state.typeAnswerResult = {
            ...state.typeAnswerResult,
            feedback: ""
        };
    }

    if (state.multipleChoiceState.status === "answered") {
        state.multipleChoiceState = {
            ...state.multipleChoiceState,
            feedback: "",
            selectedOption: ""
        };
    }
}

function restoreUiPrefs() {
    const savedPrefs = localStorage.getItem(STORAGE_KEYS.uiPrefs);

    if (!savedPrefs) {
        return;
    }

    try {
        const parsed = JSON.parse(savedPrefs);
        state.activePanel = parsed.activePanel === "library-panel" ? "library-panel" : "create-panel";
        state.activeCreateTab = ["manual", "ai", "import"].includes(parsed.activeCreateTab) ? parsed.activeCreateTab : "manual";
    } catch (error) {
        console.error("Unable to parse UI preferences.", error);
    }
}

function saveUiPrefs() {
    const payload = {
        activePanel: state.activePanel,
        activeCreateTab: state.activeCreateTab
    };

    localStorage.setItem(STORAGE_KEYS.uiPrefs, JSON.stringify(payload));
}

function loadSavedSets() {
    const savedSets = localStorage.getItem(STORAGE_KEYS.sets);

    if (!savedSets) {
        state.cardSets = [];
        return;
    }

    try {
        const parsedSets = JSON.parse(savedSets);
        state.cardSets = Array.isArray(parsedSets) ? parsedSets.map(hydrateCardSet) : [];
    } catch (error) {
        console.error("Unable to parse saved flashcard sets.", error);
        state.cardSets = [];
        showToast("Saved data could not be loaded cleanly.", "warning");
    }
}

function hydrateCardSet(rawSet) {
    const cards = Array.isArray(rawSet.cards) ? rawSet.cards.map(hydrateCard) : [];
    const set = new CardSet(rawSet.title || "Untitled Set", cards);
    set.created = getValidDate(rawSet.created, new Date());
    set.lastStudied = getValidDateOrNull(rawSet.lastStudied);
    set.studySections = sanitizeStudySections(rawSet.studySections, cards.length);
    set.studyPrefs = sanitizeStudyPrefs(rawSet.studyPrefs, set.studySections);
    set.studyStats = sanitizeStudyStats(rawSet.studyStats);
    return set;
}

function hydrateCard(rawCard) {
    const card = new Card(rawCard.question || "", rawCard.answer || "");
    card.id = typeof rawCard.id === "string" && rawCard.id.trim() ? rawCard.id.trim() : card.id;
    card.level = Math.max(0, Number(rawCard.level) || 0);
    card.attempts = Math.max(0, Number(rawCard.attempts) || 0);
    card.mastered = Boolean(rawCard.mastered);
    card.nextReview = getValidDate(rawCard.nextReview, new Date());
    card.aiHelpHistory = sanitizeAiHelpHistory(rawCard.aiHelpHistory);
    card.difficultyScore = Math.max(0, Number(rawCard.difficultyScore) || 0);
    card.timesSeen = Math.max(0, Number(rawCard.timesSeen) || 0);
    card.lastSeenIndex = Number.isInteger(rawCard.lastSeenIndex) ? rawCard.lastSeenIndex : -1;
    card.hardCount = Math.max(0, Number(rawCard.hardCount) || 0);
    card.easyCount = Math.max(0, Number(rawCard.easyCount) || 0);
    card.cachedDistractors = sanitizeDistractorList(rawCard.cachedDistractors);
    card.cachedCloze = typeof rawCard.cachedCloze === "string" ? rawCard.cachedCloze.trim() : "";
    card.aiSupport = sanitizeAdaptiveHelp(rawCard.aiSupport);
    card.aiCache = sanitizeAiCache(rawCard.aiCache, card);
    syncLegacyCardCacheFields(card);
    invalidateCardCacheIfNeeded(card);
    return card;
}

function sanitizeStudySections(entries, cardCount) {
    if (!Array.isArray(entries)) {
        return [];
    }

    const usedIds = new Set();

    return entries.reduce((sections, entry, index) => {
        const cardIndexes = Array.isArray(entry && entry.cardIndexes)
            ? Array.from(new Set(entry.cardIndexes
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value) && value >= 0 && value < cardCount)))
            : [];

        if (cardIndexes.length === 0) {
            return sections;
        }

        cardIndexes.sort((left, right) => left - right);

        let id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : createStudySectionId(index);

        while (usedIds.has(id)) {
            id = createStudySectionId(index);
        }

        usedIds.add(id);

        sections.push({
            id,
            label: typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : `Part ${index + 1}`,
            cardIndexes,
            size: Math.max(1, Number(entry.size) || cardIndexes.length),
            createdAt: getValidTimestamp(entry.createdAt),
            lastStudiedAt: getValidTimestampOrNull(entry.lastStudiedAt),
            completedCount: Math.max(0, Number(entry.completedCount) || 0)
        });

        return sections;
    }, []);
}

function sanitizeStudyPrefs(rawPrefs, studySections) {
    const prefs = createDefaultStudyPrefs();
    const parsedChunkSize = Math.max(1, Number(rawPrefs && rawPrefs.defaultChunkSize) || DEFAULT_CHUNK_SIZE);

    prefs.defaultChunkSize = parsedChunkSize;

    if (rawPrefs && rawPrefs.lastScopeType === "section" && typeof rawPrefs.lastSectionId === "string") {
        const hasSection = studySections.some((section) => section.id === rawPrefs.lastSectionId);

        if (hasSection) {
            prefs.lastScopeType = "section";
            prefs.lastSectionId = rawPrefs.lastSectionId;
        }
    }

    return prefs;
}

function sanitizeStudyStats(rawStats) {
    const stats = createDefaultStudyStats();
    stats.bestStreak = Math.max(0, Number(rawStats && rawStats.bestStreak) || 0);
    return stats;
}

function createEmptyAiCache(contentHash) {
    return {
        version: AI_CACHE_VERSION,
        contentHash,
        distractors: [],
        cloze: "",
        adaptiveHelp: null
    };
}

function createCardContentHash(card) {
    return [card && card.question, card && card.answer]
        .map((value) => String(value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " "))
        .join("::");
}

function sanitizeDistractorList(values, correctAnswer = "") {
    const correctAnswerText = normalizeAnswerText(correctAnswer);
    const unique = [];
    const seen = new Set();

    if (!Array.isArray(values)) {
        return unique;
    }

    values.forEach((value) => {
        if (typeof value !== "string") {
            return;
        }

        const trimmed = value.trim().slice(0, MAX_CARD_TEXT_LENGTH);
        const normalized = normalizeAnswerText(trimmed);

        if (!trimmed || !normalized || normalized === correctAnswerText || seen.has(normalized)) {
            return;
        }

        seen.add(normalized);
        unique.push(trimmed);
    });

    return unique.slice(0, 6);
}

function sanitizeAdaptiveHelp(rawSupport) {
    if (!rawSupport || typeof rawSupport !== "object") {
        return null;
    }

    const support = {
        explanation: typeof rawSupport.explanation === "string" ? rawSupport.explanation.trim().slice(0, MAX_CARD_TEXT_LENGTH) : "",
        mnemonic: typeof rawSupport.mnemonic === "string" ? rawSupport.mnemonic.trim().slice(0, MAX_CARD_TEXT_LENGTH) : "",
        example: typeof rawSupport.example === "string" ? rawSupport.example.trim().slice(0, MAX_CARD_TEXT_LENGTH) : "",
        alternateQuestion: typeof rawSupport.alternateQuestion === "string" ? rawSupport.alternateQuestion.trim().slice(0, MAX_CARD_TEXT_LENGTH) : "",
        generatedAt: getValidTimestamp(rawSupport.generatedAt)
    };

    if (!support.explanation && !support.mnemonic && !support.example && !support.alternateQuestion) {
        return null;
    }

    return support;
}

function sanitizeAiCache(rawAiCache, card) {
    const contentHash = createCardContentHash(card);
    const cache = createEmptyAiCache(contentHash);
    const source = rawAiCache && typeof rawAiCache === "object" ? rawAiCache : {};

    cache.version = Math.max(1, Number(source.version) || AI_CACHE_VERSION);
    cache.contentHash = typeof source.contentHash === "string" && source.contentHash.trim()
        ? source.contentHash.trim()
        : contentHash;
    cache.distractors = sanitizeDistractorList(source.distractors || card.cachedDistractors, card.answer);
    cache.cloze = typeof source.cloze === "string"
        ? source.cloze.trim().slice(0, MAX_CARD_TEXT_LENGTH)
        : card.cachedCloze;
    cache.adaptiveHelp = sanitizeAdaptiveHelp(source.adaptiveHelp || card.aiSupport);
    return cache;
}

function syncLegacyCardCacheFields(card) {
    const contentHash = createCardContentHash(card);

    if (!card.aiCache || typeof card.aiCache !== "object") {
        card.aiCache = createEmptyAiCache(contentHash);
    }

    card.contentHash = contentHash;
    card.aiCache.version = AI_CACHE_VERSION;
    card.aiCache.contentHash = contentHash;
    card.cachedDistractors = sanitizeDistractorList(card.aiCache.distractors, card.answer);
    card.cachedCloze = typeof card.aiCache.cloze === "string" ? card.aiCache.cloze : "";
    card.aiSupport = sanitizeAdaptiveHelp(card.aiCache.adaptiveHelp);
}

function invalidateCardCacheIfNeeded(card) {
    const contentHash = createCardContentHash(card);

    if (!card.aiCache || card.aiCache.contentHash !== contentHash) {
        card.aiCache = createEmptyAiCache(contentHash);
    }

    syncLegacyCardCacheFields(card);
}

function buildCachedDistractorPayload(card, distractors) {
    card.aiCache.distractors = sanitizeDistractorList(distractors, card.answer);
    syncLegacyCardCacheFields(card);
}

function buildCachedAdaptiveHelpPayload(card, adaptiveHelp) {
    card.aiCache.adaptiveHelp = sanitizeAdaptiveHelp(adaptiveHelp);
    syncLegacyCardCacheFields(card);
}

function addUniqueValue(collection, value) {
    if (!collection.includes(value)) {
        collection.push(value);
    }
}

function isCurrentStudyCard(cardId) {
    const set = getCurrentSet();
    const card = set ? set.cards[state.currentCardIndex] : null;
    return Boolean(card && card.id === cardId);
}

function saveSets() {
    localStorage.setItem(STORAGE_KEYS.sets, JSON.stringify(state.cardSets));
}

function switchPanel(panelId) {
    if (!["create-panel", "library-panel"].includes(panelId)) {
        return;
    }

    state.activePanel = panelId;
    renderPanelVisibility();
    saveUiPrefs();
}

function switchCreateTab(tabId) {
    if (!["manual", "ai", "import"].includes(tabId)) {
        return;
    }

    state.activeCreateTab = tabId;
    renderCreateTabs();
    saveUiPrefs();
}

function renderDashboard() {
    renderPanelVisibility();
    renderCreateTabs();
    renderSetList();
    updateDashboardStats();
    updateRecentActivity();
}

function renderPanelVisibility() {
    dom.panelSections.forEach((section) => {
        const isActive = section.id === state.activePanel;
        section.classList.toggle("active", isActive);
        section.hidden = !isActive;
    });

    dom.navButtons.forEach((button) => {
        if (button.classList.contains("nav-pill")) {
            button.classList.toggle("active", button.dataset.panelTarget === state.activePanel);
        }
    });
}

function renderCreateTabs() {
    dom.createTabButtons.forEach((button) => {
        const isActive = button.dataset.createTab === state.activeCreateTab;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-selected", String(isActive));
    });

    dom.createPanes.forEach((pane) => {
        const isActive = pane.dataset.createPane === state.activeCreateTab;
        pane.classList.toggle("active", isActive);
        pane.hidden = !isActive;
    });
}

function createSet() {
    clearInlineMessage(dom.manualFormMessage);
    clearInlineMessage(dom.importMessage);
    clearInlineMessage(dom.aiFormMessage);

    const title = dom.setTitle.value.trim();
    const cards = parseCardsFromText(dom.cardsList.value);
    const draftError = validateSetDraft(title, cards);

    if (!title) {
        setInlineMessage(dom.manualFormMessage, "Give your set a title before saving it.", "error");
        dom.setTitle.focus();
        return;
    }

    if (cards.length === 0) {
        setInlineMessage(dom.manualFormMessage, "Add at least one valid `Q:` / `A:` pair before saving.", "error");
        dom.cardsList.focus();
        return;
    }

    if (draftError) {
        setInlineMessage(dom.manualFormMessage, draftError, "error");
        return;
    }

    const newSet = new CardSet(title, cards);
    state.cardSets.push(newSet);
    saveSets();

    dom.setTitle.value = "";
    dom.cardsList.value = "";
    dom.aiSuccess.hidden = true;

    renderDashboard();
    switchPanel("library-panel");
    showToast("Set saved to your library.", "success");
}

function parseCardsFromText(text) {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const cards = [];

    for (let index = 0; index < lines.length; index += 1) {
        const questionLine = lines[index];

        if (!questionLine.startsWith("Q:")) {
            continue;
        }

        const answerLine = lines[index + 1];

        if (!answerLine || !answerLine.startsWith("A:")) {
            continue;
        }

        const question = questionLine.slice(2).trim();
        const answer = answerLine.slice(2).trim();

        if (question && answer) {
            cards.push(new Card(question, answer));
        }

        index += 1;
    }

    return cards;
}

function renderSetList() {
    dom.setList.innerHTML = "";

    if (state.cardSets.length === 0) {
        dom.libraryEmptyState.hidden = false;
        return;
    }

    dom.libraryEmptyState.hidden = true;

    state.cardSets
        .map((set, index) => ({ set, index }))
        .reverse()
        .forEach(({ set, index }) => {
            const card = document.createElement("article");
            card.className = "set-item";

            const info = document.createElement("div");
            info.className = "set-info";

            const title = document.createElement("h4");
            title.textContent = set.title;

            const subhead = document.createElement("p");
            subhead.textContent = set.lastStudied
                ? `Last studied ${formatDate(set.lastStudied)}`
                : `Created ${formatDate(set.created)}`;

            const meta = document.createElement("div");
            meta.className = "set-meta";

            const cardCount = document.createElement("span");
            cardCount.className = "meta-pill";
            cardCount.textContent = `${set.cards.length} card${set.cards.length === 1 ? "" : "s"}`;

            const status = document.createElement("span");
            status.className = "meta-pill";
            status.textContent = set.lastStudied ? "Study ready" : "New set";

            meta.append(cardCount, status);

            if (set.studySections.length > 0) {
                const sectionCount = document.createElement("span");
                sectionCount.className = "meta-pill";
                sectionCount.textContent = `${set.studySections.length} section${set.studySections.length === 1 ? "" : "s"}`;
                meta.appendChild(sectionCount);
            }

            info.append(title, subhead, meta);

            const actions = document.createElement("div");
            actions.className = "set-actions";

            const studyButton = buildActionButton("Study Now", "primary-btn", "study", index);
            const exportButton = buildActionButton("Export", "action-text-btn", "export", index);
            const deleteButton = buildActionButton("Delete", "action-text-btn delete", "delete", index);

            actions.append(studyButton, exportButton, deleteButton);
            card.append(info, actions);

            const aiHistoryCount = countSetAiHistoryEntries(set);

            if (aiHistoryCount > 0) {
                card.appendChild(buildAiHistorySection(set, aiHistoryCount));
            }

            dom.setList.appendChild(card);
        });
}

function buildActionButton(label, className, action, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.index = String(index);
    return button;
}

function updateDashboardStats() {
    const totalCards = state.cardSets.reduce((sum, set) => sum + set.cards.length, 0);
    dom.totalSetsStat.textContent = String(state.cardSets.length);
    dom.totalCardsStat.textContent = String(totalCards);
}

function updateRecentActivity() {
    const mostRecent = findMostRecentSet();

    if (!mostRecent) {
        dom.recentSetTitle.textContent = "Nothing studied yet";
        dom.recentSetMeta.textContent = "Your latest session will show up here once you start studying.";
        dom.resumeRecentBtn.disabled = true;
        dom.resumeRecentBtn.textContent = "Study Latest Set";
        delete dom.resumeRecentBtn.dataset.index;
        return;
    }

    dom.recentSetTitle.textContent = mostRecent.set.title;
    dom.recentSetMeta.textContent = `Studied ${formatDate(mostRecent.set.lastStudied)} | ${getRecentScopeLabel(mostRecent.set)}`;
    dom.resumeRecentBtn.disabled = false;
    dom.resumeRecentBtn.dataset.index = String(mostRecent.index);
    dom.resumeRecentBtn.textContent = getResumeButtonText(mostRecent.set);
}

function getResumeButtonText(set) {
    return getResumeScopeForSet(set).type === "section" ? "Resume Latest Section" : "Study Latest Set";
}

function getRecentScopeLabel(set) {
    const scope = getResumeScopeForSet(set);

    if (scope.type === "section") {
        const section = findStudySectionById(set, scope.sectionId);

        if (section) {
            return `Section ${section.label}`;
        }
    }

    return `${set.cards.length} cards`;
}

function findMostRecentSet() {
    return state.cardSets.reduce((latest, set, index) => {
        if (!set.lastStudied) {
            return latest;
        }

        if (!latest || set.lastStudied > latest.set.lastStudied) {
            return { set, index };
        }

        return latest;
    }, null);
}

function handleSetListClick(event) {
    const button = event.target.closest("[data-action]");

    if (!button) {
        return;
    }

    const index = Number(button.dataset.index);
    const action = button.dataset.action;

    if (action === "study") {
        startStudySet(index);
    }

    if (action === "export") {
        exportSingleSet(index);
    }

    if (action === "delete") {
        deleteSet(index);
    }
}

function handleResumeRecent() {
    const index = Number(dom.resumeRecentBtn.dataset.index);
    const set = state.cardSets[index];

    if (!Number.isNaN(index) && set) {
        startStudySet(index, getResumeScopeForSet(set));
    }
}

function getResumeScopeForSet(set) {
    if (!set || !set.studyPrefs) {
        return { type: "full", sectionId: null };
    }

    if (set.studyPrefs.lastScopeType === "section" && set.studyPrefs.lastSectionId) {
        const section = findStudySectionById(set, set.studyPrefs.lastSectionId);

        if (section) {
            return { type: "section", sectionId: section.id };
        }
    }

    return { type: "full", sectionId: null };
}

function exportAllSets() {
    if (state.cardSets.length === 0) {
        showToast("There are no sets to export yet.", "warning");
        return;
    }

    downloadJson(
        `flashcard-sets-${getDateStamp()}.json`,
        {
            version: EXPORT_VERSION,
            sets: state.cardSets,
            exportDate: new Date().toISOString()
        }
    );

    showToast("Library export started.", "info");
}

function exportSingleSet(index) {
    const set = state.cardSets[index];

    if (!set) {
        showToast("That set could not be found.", "error");
        return;
    }

    downloadJson(
        `flashcard-set-${sanitizeFilename(set.title)}-${getDateStamp()}.json`,
        {
            version: EXPORT_VERSION,
            sets: [set],
            exportDate: new Date().toISOString()
        }
    );

    showToast(`Exported "${set.title}".`, "info");
}

function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function handleImportChange(event) {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    if (file.size > IMPORT_LIMITS.maxFileBytes) {
        setInlineMessage(dom.importMessage, "Import files must stay under 1 MB.", "error");
        event.target.value = "";
        return;
    }

    clearInlineMessage(dom.importMessage);

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
        try {
            const importedData = JSON.parse(loadEvent.target.result);
            const validationError = validateImportedData(importedData);

            if (validationError) {
                throw new Error(validationError);
            }

            const importedCount = handleImportedSets(importedData.sets);
            saveSets();
            renderDashboard();
            switchPanel("library-panel");
            setInlineMessage(
                dom.importMessage,
                `Imported ${importedCount} set${importedCount === 1 ? "" : "s"} into your library.`,
                "success"
            );
            showToast("Import complete.", "success");
        } catch (error) {
            console.error("Import failed.", error);
            setInlineMessage(dom.importMessage, `Import failed: ${error.message}`, "error");
        }
    };

    reader.onerror = () => {
        setInlineMessage(dom.importMessage, "The selected file could not be read.", "error");
    };

    reader.readAsText(file);
    event.target.value = "";
}

function validateImportedData(data) {
    if (!data || !["1.0", EXPORT_VERSION].includes(data.version) || !Array.isArray(data.sets)) {
        return "Please choose a Quizzy JSON export with valid sets.";
    }

    if (data.sets.length === 0) {
        return "The import file does not contain any sets.";
    }

    if (data.sets.length > IMPORT_LIMITS.maxSets) {
        return `Import files can include up to ${IMPORT_LIMITS.maxSets} sets at a time.`;
    }

    const totalCards = data.sets.reduce((sum, set) => sum + (Array.isArray(set && set.cards) ? set.cards.length : 0), 0);

    if (totalCards > IMPORT_LIMITS.maxTotalCards) {
        return `Import files can include up to ${IMPORT_LIMITS.maxTotalCards} total cards.`;
    }

    for (const set of data.sets) {
        if (!set || typeof set.title !== "string" || !Array.isArray(set.cards)) {
            return "Each imported set needs a title and a cards array.";
        }

        const draftError = validateSetDraft(set.title, set.cards);

        if (draftError) {
            return `Import rejected for "${set.title || "Untitled Set"}": ${draftError}`;
        }
    }

    return null;
}

function handleImportedSets(importedSets) {
    importedSets.forEach((importedSet) => {
        let title = importedSet.title;
        let duplicateCount = 1;

        while (state.cardSets.some((set) => set.title === title)) {
            title = `${importedSet.title} (${duplicateCount})`;
            duplicateCount += 1;
        }

        const cards = importedSet.cards.map(hydrateCard);
        const newSet = new CardSet(title, cards);
        newSet.created = getValidDate(importedSet.created, new Date());
        newSet.lastStudied = getValidDateOrNull(importedSet.lastStudied);
        newSet.studySections = sanitizeStudySections(importedSet.studySections, cards.length);
        newSet.studyPrefs = sanitizeStudyPrefs(importedSet.studyPrefs, newSet.studySections);
        newSet.studyStats = sanitizeStudyStats(importedSet.studyStats);

        state.cardSets.push(newSet);
    });

    return importedSets.length;
}

function deleteSet(index) {
    const set = state.cardSets[index];

    if (!set) {
        return;
    }

    showConfirmDialog({
        title: `Delete "${set.title}"?`,
        message: "This removes the set from this browser and cannot be undone.",
        confirmText: "Delete Set",
        onConfirm: () => {
            state.cardSets.splice(index, 1);

            if (state.currentSetIndex === index) {
                exitStudyMode("library-panel");
            } else if (state.currentSetIndex > index) {
                state.currentSetIndex -= 1;
            }

            saveSets();
            renderDashboard();
            showToast("Set deleted.", "info");
        }
    });
}

function clearAllData() {
    showConfirmDialog({
        title: "Clear all local data?",
        message: "This removes every saved set, study section, and AI helper history from this browser.",
        confirmText: "Clear Everything",
        onConfirm: () => {
            localStorage.removeItem(STORAGE_KEYS.sets);
            localStorage.removeItem(STORAGE_KEYS.uiPrefs);
            sessionStorage.removeItem("quizzy_client_openai_api_key");
            state.cardSets = [];
            state.activePanel = "create-panel";
            state.activeCreateTab = "manual";
            state.currentSetIndex = -1;
            state.currentCardIndex = -1;
            state.studyComplete = false;
            state.studyCompletionRecorded = false;
            state.studyManagerOpen = false;
            state.studySectionSizeMode = String(DEFAULT_CHUNK_SIZE);
            state.studyQueue = [];
            state.studyScope = createEmptyStudyScope();
            state.studyMode = "flip";
            state.bestStreak = 0;
            resetStudyRoundState();
            dom.appShell.hidden = false;
            dom.studyView.hidden = true;
            dom.setTitle.value = "";
            dom.cardsList.value = "";
            dom.aiSuccess.hidden = true;
            clearInlineMessage(dom.manualFormMessage);
            clearInlineMessage(dom.importMessage);
            clearInlineMessage(dom.aiFormMessage);
            renderDashboard();
            renderStudyState();
            showToast("Local study data cleared from this browser.", "info");
        }
    });
}

function showConfirmDialog({ title, message, confirmText, onConfirm }) {
    state.confirmAction = onConfirm;
    dom.confirmTitle.textContent = title;
    dom.confirmMessage.textContent = message;
    dom.confirmApproveBtn.textContent = confirmText || "Confirm";
    dom.confirmDialog.hidden = false;
}

function closeConfirmDialog() {
    dom.confirmDialog.hidden = true;
    state.confirmAction = null;
}

function approveConfirmDialog() {
    const action = state.confirmAction;
    closeConfirmDialog();

    if (typeof action === "function") {
        action();
    }
}

function startStudySet(index, requestedScope = { type: "full", sectionId: null }) {
    state.studyMode = "flip";
    initializeStudySession(index, requestedScope, {
        enterMode: true,
        preserveManagerOpen: false
    });
}

function activateStudyScope(requestedScope) {
    if (state.currentSetIndex < 0) {
        return;
    }

    initializeStudySession(state.currentSetIndex, requestedScope, {
        enterMode: false,
        preserveManagerOpen: true
    });
}

function initializeStudySession(index, requestedScope, options = {}) {
    const set = state.cardSets[index];

    if (!set) {
        showToast("That set could not be found.", "error");
        return;
    }

    const resolvedScope = resolveStudyScope(set, requestedScope);
    const nowIso = new Date().toISOString();

    state.currentSetIndex = index;

    if (resolvedScope.type !== "custom") {
        state.resumeStudyScope = cloneStudyScope(resolvedScope);
    }

    state.studyScope = resolvedScope;
    state.studyQueue = buildStudyQueue(set, resolvedScope.cardIndexes, resolvedScope);
    state.currentCardIndex = state.studyQueue[0] ?? -1;
    state.studyComplete = state.studyQueue.length === 0;
    state.studyCompletionRecorded = false;
    state.studyManagerOpen = Boolean(options.preserveManagerOpen) ? state.studyManagerOpen : false;
    state.bestStreak = Math.max(0, Number(set.studyStats && set.studyStats.bestStreak) || 0);
    syncStudySectionSizeMode(set);
    resetStudyRoundState();
    syncCardPileMembership(set);

    set.lastStudied = new Date(nowIso);

    if (resolvedScope.type === "section") {
        const section = findStudySectionById(set, resolvedScope.sectionId);

        if (section) {
            section.lastStudiedAt = nowIso;
            set.studyPrefs.lastScopeType = "section";
            set.studyPrefs.lastSectionId = section.id;
        }
    } else if (resolvedScope.type !== "custom") {
        set.studyPrefs.lastScopeType = "full";
        set.studyPrefs.lastSectionId = null;
    }

    saveSets();
    renderDashboard();

    if (options.enterMode) {
        enterStudyMode();
    }

    renderStudyState();

    if (options.enterMode) {
        dom.flashcard.focus();
    }
}

function resolveStudyScope(set, requestedScope) {
    if (!set) {
        return createEmptyStudyScope();
    }

    const shouldIncludeAll = Boolean(requestedScope && requestedScope.includeAll);

    if (requestedScope && requestedScope.type === "custom" && Array.isArray(requestedScope.cardIndexes)) {
        const cardIndexes = Array.from(new Set(requestedScope.cardIndexes
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 0 && value < set.cards.length)));

        return {
            type: "custom",
            sectionId: null,
            cardIndexes,
            label: typeof requestedScope.label === "string" && requestedScope.label.trim()
                ? requestedScope.label.trim()
                : "Custom round",
            includeAll: requestedScope.includeAll !== false
        };
    }

    if (requestedScope && requestedScope.type === "section" && requestedScope.sectionId) {
        const section = findStudySectionById(set, requestedScope.sectionId);

        if (section) {
            return {
                type: "section",
                sectionId: section.id,
                cardIndexes: section.cardIndexes.slice(),
                label: `Section ${section.label}`,
                includeAll: shouldIncludeAll
            };
        }
    }

    return {
        type: "full",
        sectionId: null,
        cardIndexes: set.cards.map((_, cardIndex) => cardIndex),
        label: "Whole set",
        includeAll: shouldIncludeAll
    };
}

function buildStudyQueue(set, cardIndexes, scope = createEmptyStudyScope()) {
    const now = Date.now();
    let queuedIndexes = cardIndexes.filter((cardIndex) => {
        const card = set.cards[cardIndex];
        return card && (scope.includeAll || shouldIncludeCardInRound(card, now));
    });

    if (queuedIndexes.length === 0) {
        queuedIndexes = cardIndexes.filter((cardIndex) => set.cards[cardIndex]);
    }

    return queuedIndexes
        .slice()
        .sort((leftIndex, rightIndex) => compareStudyPriority(set.cards[leftIndex], set.cards[rightIndex], leftIndex, rightIndex, now));
}

function shouldIncludeCardInRound(card, now) {
    return !card.mastered || card.nextReview.getTime() <= now;
}

function compareStudyPriority(leftCard, rightCard, leftIndex, rightIndex, now) {
    const leftPriority = getCardStudyPriority(leftCard, now);
    const rightPriority = getCardStudyPriority(rightCard, now);

    if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
    }

    const nextReviewDifference = leftCard.nextReview.getTime() - rightCard.nextReview.getTime();

    if (nextReviewDifference !== 0) {
        return nextReviewDifference;
    }

    if (leftCard.level !== rightCard.level) {
        return leftCard.level - rightCard.level;
    }

    if (leftCard.difficultyScore !== rightCard.difficultyScore) {
        return rightCard.difficultyScore - leftCard.difficultyScore;
    }

    if (leftCard.attempts !== rightCard.attempts) {
        return rightCard.attempts - leftCard.attempts;
    }

    return leftIndex - rightIndex;
}

function getCardStudyPriority(card, now) {
    if (!card.mastered) {
        return 0;
    }

    if (card.nextReview.getTime() <= now) {
        return 1;
    }

    return 2;
}

function enterStudyMode() {
    dom.appShell.hidden = true;
    dom.studyView.hidden = false;
}

function exitStudyMode(returnPanel = "library-panel") {
    dom.studyView.hidden = true;
    dom.appShell.hidden = false;
    state.currentSetIndex = -1;
    state.currentCardIndex = -1;
    state.studyComplete = false;
    state.studyCompletionRecorded = false;
    state.studyManagerOpen = false;
    state.studyQueue = [];
    state.studyScope = createEmptyStudyScope();
    state.resumeStudyScope = createEmptyStudyScope();
    state.bestStreak = 0;
    resetStudyRoundState();
    switchPanel(returnPanel);
    renderStudyState();
}

function restartSession() {
    if (state.currentSetIndex < 0) {
        return;
    }

    initializeStudySession(state.currentSetIndex, {
        ...cloneStudyScope(state.studyScope),
        includeAll: true
    }, {
        enterMode: false,
        preserveManagerOpen: true
    });

    showToast("Round restarted without clearing your saved progress.", "info");
}

function studyAgain() {
    if (state.currentSetIndex < 0) {
        return;
    }

    const targetScope = isTroubleReviewScope()
        ? (state.resumeStudyScope.cardIndexes.length > 0 ? state.resumeStudyScope : createEmptyStudyScope())
        : state.studyScope;

    initializeStudySession(state.currentSetIndex, {
        ...cloneStudyScope(targetScope),
        includeAll: true
    }, {
        enterMode: false,
        preserveManagerOpen: true
    });

    showToast("Round restarted without clearing your saved progress.", "info");
}

function isTroubleReviewScope(scope = state.studyScope) {
    return Boolean(scope && scope.type === "custom" && scope.label === "Trouble review");
}

function flipFlashcard() {
    if (!getCurrentSet() || state.studyComplete) {
        return;
    }

    if (state.studyMode !== "flip") {
        return;
    }

    dom.flashcard.classList.toggle("flipped");
}

async function rateCard(difficulty) {
    const set = getCurrentSet();

    if (!set || state.studyComplete) {
        return;
    }

    const currentCard = set.cards[state.currentCardIndex];

    if (!currentCard) {
        return;
    }

    updateCardAfterRating(currentCard, difficulty);
    updateStreak(difficulty, state.currentCardAttempt);
    updateStruggleTracking(currentCard);
    removeCurrentCardFromQueue();
    reinsertCardByDifficulty(set, currentCard, state.currentCardIndex, difficulty);

    state.currentCardIndex = state.studyQueue[0] ?? -1;
    state.studyComplete = state.studyQueue.length === 0;

    if (difficulty === 1) {
        await maybeUnlockAdaptiveHelp(currentCard, set);
    }

    if (state.studyComplete) {
        finalizeCompletedStudySession(set);
    }

    saveSets();
    renderDashboard();
    renderStudyState();
}

function getLevelDeltaForDifficulty(difficulty) {
    if (difficulty === 3) {
        return 1;
    }

    if (difficulty === 2) {
        return 0;
    }

    return -1;
}

function resetStudyRoundState() {
    state.roundStep = 0;
    state.roundPresentationCount = 0;
    state.activeCardId = "";
    state.currentStreak = 0;
    state.sessionCompletedCardIds = [];
    state.troublePile = [];
    state.masteredPile = [];
    state.adaptiveHelpEnabled = false;
    resetCurrentCardAttempt();
    state.typeAnswerValue = "";
    state.typeAnswerResult = null;
    state.multipleChoiceState = createEmptyMultipleChoiceState();
    state.adaptiveHelpState = createEmptyAdaptiveHelpState();
    clearStreakPulse();
}

function updateCardAfterRating(card, difficulty) {
    card.attempts += 1;
    card.level = Math.max(0, card.level + getLevelDeltaForDifficulty(difficulty));
    card.difficultyScore = Math.max(0, card.difficultyScore + getDifficultyDelta(difficulty));

    if (difficulty === 1) {
        card.hardCount += 1;
        card.mastered = false;
    }

    if (difficulty === 3) {
        card.easyCount += 1;
        card.difficultyScore = Math.max(0, card.difficultyScore - 2);
    }

    card.mastered = difficulty === 3 || (difficulty !== 1 && card.level >= 3);
    card.nextReview = calculateNextReviewDate(card, difficulty);
}

function getDifficultyDelta(difficulty) {
    if (difficulty === 3) {
        return -1;
    }

    if (difficulty === 2) {
        return 1;
    }

    return 2;
}

function calculateNextReviewDate(card, difficulty) {
    const now = Date.now();

    if (difficulty === 1) {
        return new Date(now + 15 * 60 * 1000);
    }

    if (difficulty === 2) {
        return new Date(now + 8 * 60 * 60 * 1000);
    }

    const easyDays = Math.max(1, card.level + 1);
    return new Date(now + easyDays * 24 * 60 * 60 * 1000);
}

function removeCurrentCardFromQueue() {
    if (state.studyQueue[0] === state.currentCardIndex) {
        state.studyQueue.shift();
        return;
    }

    state.studyQueue = state.studyQueue.filter((cardIndex) => cardIndex !== state.currentCardIndex);
}

function reinsertCardByDifficulty(set, card, cardIndex, difficulty) {
    if (difficulty === 3) {
        addUniqueValue(state.sessionCompletedCardIds, card.id);
        return;
    }

    const offset = getQueueReinsertOffset(card, difficulty);
    const insertAt = Math.min(offset, state.studyQueue.length);
    state.studyQueue.splice(insertAt, 0, cardIndex);

    if (difficulty === 2 && !card.mastered) {
        card.mastered = false;
    }
}

function getQueueReinsertOffset(card, difficulty) {
    const offsets = difficulty === 1 ? HARD_REINSERT_OFFSETS : MEDIUM_REINSERT_OFFSETS;
    const seed = Array.from(String(card.id || card.question))
        .reduce((total, character) => total + character.charCodeAt(0), 0);

    return offsets[seed % offsets.length];
}

function updateStruggleTracking(card) {
    updateCardPileMembership(card);
}

function isCardInTrouble(card) {
    return Boolean(card
        && card.hardCount >= 2
        && !card.mastered
        && card.difficultyScore > 0);
}

function isCardInMasteredPile(card) {
    return Boolean(card
        && !isCardInTrouble(card)
        && (card.mastered || card.easyCount >= 2));
}

function updateCardPileMembership(card) {
    if (!card || !card.id) {
        return;
    }

    const isTrouble = isCardInTrouble(card);
    const isMastered = isCardInMasteredPile(card);

    if (isTrouble) {
        addUniqueValue(state.troublePile, card.id);
    } else {
        state.troublePile = state.troublePile.filter((cardId) => cardId !== card.id);
    }

    if (isMastered) {
        addUniqueValue(state.masteredPile, card.id);
    } else {
        state.masteredPile = state.masteredPile.filter((cardId) => cardId !== card.id);
    }

    if (isTrouble) {
        state.masteredPile = state.masteredPile.filter((cardId) => cardId !== card.id);
    }
}

function syncCardPileMembership(set) {
    state.troublePile = [];
    state.masteredPile = [];

    if (!set || !Array.isArray(set.cards)) {
        return;
    }

    set.cards.forEach((card) => {
        updateCardPileMembership(card);
    });
}

function getTroubleCardIdsInScope(set, cardIndexes) {
    if (!set || !Array.isArray(cardIndexes)) {
        return [];
    }

    return cardIndexes.reduce((ids, cardIndex) => {
        const card = set.cards[cardIndex];

        if (card && state.troublePile.includes(card.id)) {
            ids.push(card.id);
        }

        return ids;
    }, []);
}

function updateStreak(difficulty, typeAnswerResult) {
    const previousStreak = state.currentStreak;

    if (typeAnswerResult && typeAnswerResult.mode === "type" && typeAnswerResult.isCorrect) {
        state.currentStreak += 1;
    }

    if (difficulty === 3) {
        state.currentStreak += 1;
    } else if (difficulty === 2) {
        state.currentStreak = Math.max(0, state.currentStreak - 1);
    } else {
        state.currentStreak = 0;
    }

    const set = getCurrentSet();

    if (set) {
        if (!set.studyStats) {
            set.studyStats = createDefaultStudyStats();
        }

        set.studyStats.bestStreak = Math.max(set.studyStats.bestStreak, state.currentStreak);
        state.bestStreak = set.studyStats.bestStreak;
    }

    if (state.currentStreak > previousStreak) {
        triggerStreakPulse();
    }
}

function finalizeCompletedStudySession(set) {
    if (state.studyCompletionRecorded || !set) {
        return;
    }

    state.studyCompletionRecorded = true;

    if (state.studyScope.type === "section") {
        const section = findStudySectionById(set, state.studyScope.sectionId);

        if (section) {
            section.completedCount += 1;
        }
    }
}

function renderStudyState() {
    const set = getCurrentSet();

    if (!set) {
        dom.studySetTitle.textContent = "Study session";
        dom.cardQuestion.textContent = "";
        dom.cardAnswer.textContent = "";
        dom.studyProgressLabel.textContent = "Ready to begin";
        dom.studyProgressFill.style.width = "0%";
        dom.studyScopeLabel.textContent = "Whole set";
        renderStreakState();
        renderStudyModeControls();
        dom.studySummary.hidden = true;
        dom.studyActions.hidden = false;
        dom.studyHint.hidden = false;
        dom.studyInteraction.hidden = true;
        dom.typeAnswerPanel.hidden = true;
        dom.multipleChoicePanel.hidden = true;
        dom.adaptiveHelpPanel.hidden = true;
        dom.reviewTroubleBtn.hidden = true;
        dom.flashcard.classList.remove("flipped");
        dom.flashcard.classList.remove("study-locked");
        dom.toggleStudySectionsBtn.disabled = true;
        dom.toggleStudySectionsBtn.textContent = "Auto-Split";
        dom.restartStudyBtn.textContent = "Restart Round";
        dom.studySectionManager.hidden = true;
        clearInlineMessage(dom.studySectionsMessage);
        dispatchStudyContextChange(null);
        return;
    }

    const totalCards = state.studyScope.cardIndexes.length;
    const masteredInScope = countMasteredCards(set, state.studyScope.cardIndexes);
    const completedInScope = countCompletedCardsInScope(set, state.studyScope.cardIndexes);
    const troubleCardIdsInScope = getTroubleCardIdsInScope(set, state.studyScope.cardIndexes);
    const progressRatio = totalCards === 0 ? 0 : completedInScope / totalCards;

    dom.studySetTitle.textContent = set.title;
    dom.studyProgressFill.style.width = `${progressRatio * 100}%`;
    dom.studyScopeLabel.textContent = getStudyScopeLabel(set, state.studyScope);
    dom.toggleStudySectionsBtn.disabled = false;
    dom.restartStudyBtn.textContent = isTroubleReviewScope() ? "Restart Trouble Round" : "Restart Round";
    renderStreakState();
    renderStudyModeControls();

    renderStudySectionManager();

    if (state.studyComplete) {
        const scopeLabel = state.studyScope.type === "section"
            ? "this section"
            : state.studyScope.type === "custom"
                ? state.studyScope.label.toLowerCase()
                : "this set";

        dom.studyProgressLabel.textContent = "Round complete";
        dom.cardQuestion.textContent = "Nice work.";
        dom.cardAnswer.textContent = troubleCardIdsInScope.length > 0
            ? "You can restart, jump into a trouble-only round, or head back to your library."
            : "Restart the round, switch sections, or head back to your library.";
        dom.flashcard.classList.remove("flipped");
        dom.flashcard.classList.remove("study-locked");
        dom.studyHint.hidden = true;
        dom.studyActions.hidden = true;
        dom.studyInteraction.hidden = true;
        dom.adaptiveHelpPanel.hidden = true;
        dom.studySummary.hidden = false;
        dom.reviewTroubleBtn.hidden = troubleCardIdsInScope.length === 0 || isTroubleReviewScope();
        dom.studySummaryText.textContent = buildStudySummaryText(masteredInScope, totalCards, scopeLabel);
        dispatchStudyContextChange(null);
        return;
    }

    const card = set.cards[state.currentCardIndex];

    if (!card) {
        state.studyComplete = true;
        renderStudyState();
        return;
    }

    dom.cardQuestion.textContent = card.question;
    dom.cardAnswer.textContent = card.answer;
    dom.studyProgressLabel.textContent = `${completedInScope} of ${totalCards} cleared this round`;
    prepareStudyCardPresentation(card);
    dom.studyHint.hidden = false;
    dom.studySummary.hidden = true;
    dom.reviewTroubleBtn.hidden = true;
    renderStudyInteraction(set, card);
    renderAdaptiveHelp(card);
    dispatchStudyContextChange(getStudyCardContext());
}

function renderStudyModeControls() {
    dom.studyModeButtons.forEach((button) => {
        const isActive = button.dataset.studyMode === state.studyMode;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-selected", String(isActive));
    });
}

function renderStreakState() {
    dom.currentStreakCount.textContent = String(state.currentStreak);
}

function buildStudySummaryText(masteredInScope, totalCards, scopeLabel) {
    const troubleCount = state.troublePile.length;
    const masteredCount = state.masteredPile.length;
    const troubleText = troubleCount > 0 ? ` ${troubleCount} card${troubleCount === 1 ? "" : "s"} landed in your trouble pile.` : "";
    const masteredText = masteredCount > 0 ? ` ${masteredCount} card${masteredCount === 1 ? "" : "s"} felt locked in.` : "";
    return `You mastered ${masteredInScope} of ${totalCards} card${totalCards === 1 ? "" : "s"} in ${scopeLabel}.${masteredText}${troubleText}`;
}

function countCompletedCardsInScope(set, cardIndexes) {
    const completedIds = new Set(state.sessionCompletedCardIds);

    return cardIndexes.reduce((count, cardIndex) => {
        const card = set.cards[cardIndex];
        return count + (card && completedIds.has(card.id) ? 1 : 0);
    }, 0);
}

function prepareStudyCardPresentation(card) {
    if (!card || state.activeCardId === card.id) {
        return;
    }

    state.activeCardId = card.id;
    state.roundStep += 1;
    state.roundPresentationCount += 1;
    card.timesSeen += 1;
    card.lastSeenIndex = state.roundStep;
    resetCurrentCardAttempt(card.id);
    state.typeAnswerValue = "";
    state.typeAnswerResult = null;
    state.multipleChoiceState = createEmptyMultipleChoiceState();
    state.adaptiveHelpState = createEmptyAdaptiveHelpState();
    dom.flashcard.classList.remove("flipped");
    void warmStudyModeState(card);
}

async function warmStudyModeState(card) {
    const set = getCurrentSet();

    if (!set || !card) {
        return;
    }

    if (state.studyMode === "multiple-choice") {
        state.multipleChoiceState = {
            status: "loading",
            options: [],
            feedback: "",
            selectedOption: "",
            isCorrect: null
        };
        renderStudyInteraction(set, card);

        const options = await getOrCreateDistractors(card, set);

        if (!isCurrentStudyCard(card.id)) {
            return;
        }

        const hasEnoughMultipleChoiceOptions = options.length >= MIN_MULTIPLE_CHOICE_DISTRACTORS + 1;

        state.multipleChoiceState = {
            status: hasEnoughMultipleChoiceOptions ? "ready" : "unavailable",
            options,
            feedback: hasEnoughMultipleChoiceOptions
                ? ""
                : "Multiple choice is not available for this card yet.",
            selectedOption: "",
            isCorrect: null
        };
        renderStudyInteraction(set, card);
    }

    if (card.hardCount >= 2) {
        await maybeUnlockAdaptiveHelp(card, set, { fromRender: true });
    }
}

function renderStudyInteraction(set, card) {
    const requiresSubmission = state.studyMode !== "flip";
    const hasSubmitted = hasSubmittedAttemptForCard(card);

    dom.studyInteraction.hidden = !requiresSubmission;
    dom.typeAnswerPanel.hidden = state.studyMode !== "type";
    dom.multipleChoicePanel.hidden = state.studyMode !== "multiple-choice";
    dom.studyActions.hidden = requiresSubmission && !hasSubmitted;

    if (state.studyMode === "flip") {
        dom.studyHint.textContent = "Flip the card, answer it in your head, then rate how it felt.";
        dom.flashcard.classList.remove("study-locked");
        return;
    }

    dom.flashcard.classList.remove("flipped");
    dom.flashcard.classList.add("study-locked");

    if (state.studyMode === "type") {
        renderTypeAnswerState(card);
        return;
    }

    renderMultipleChoiceState(card, set);
}

function renderTypeAnswerState(card) {
    const hasSubmitted = hasSubmittedAttemptForCard(card);
    const hasFeedback = Boolean(state.typeAnswerResult && state.typeAnswerResult.feedback);

    dom.studyHint.textContent = hasSubmitted
        ? (hasFeedback
            ? "Check the answer, then rate how solid that recall felt."
            : "This card already has a recorded attempt. Rate it when you're ready.")
        : "Type the answer from memory before you reveal it.";

    dom.typeAnswerInput.value = state.typeAnswerValue;
    dom.typeAnswerInput.disabled = hasSubmitted;
    dom.submitTypeAnswerBtn.disabled = hasSubmitted;

    if (!hasSubmitted) {
        dom.typeAnswerFeedback.hidden = true;
        dom.typeAnswerFeedback.textContent = "";
        delete dom.typeAnswerFeedback.dataset.tone;
        window.requestAnimationFrame(() => {
            if (state.studyMode === "type" && !state.studyComplete) {
                dom.typeAnswerInput.focus();
            }
        });
        return;
    }

    dom.flashcard.classList.add("flipped");

    if (!hasFeedback) {
        dom.typeAnswerFeedback.hidden = true;
        dom.typeAnswerFeedback.textContent = "";
        delete dom.typeAnswerFeedback.dataset.tone;
        return;
    }

    dom.typeAnswerFeedback.hidden = false;
    dom.typeAnswerFeedback.dataset.tone = state.typeAnswerResult.isCorrect ? "success" : "warning";
    dom.typeAnswerFeedback.textContent = state.typeAnswerResult.feedback;
}

function renderMultipleChoiceState(card, set) {
    const hasSubmitted = hasSubmittedAttemptForCard(card);

    if (state.multipleChoiceState.status === "idle") {
        dom.studyHint.textContent = "Building choices for this card...";
        dom.multipleChoiceStatus.textContent = "Preparing answer choices...";
        dom.multipleChoiceFeedback.hidden = true;
        dom.multipleChoiceOptions.innerHTML = "";
        dom.multipleChoiceOptions.appendChild(buildLoadingChoice());
        if (hasSubmitted) {
            dom.flashcard.classList.add("flipped");
        }
        return;
    }

    if (state.multipleChoiceState.status === "loading") {
        dom.studyHint.textContent = "Building choices for this card...";
        dom.multipleChoiceStatus.textContent = "Loading answer choices...";
        dom.multipleChoiceFeedback.hidden = true;
        dom.multipleChoiceOptions.innerHTML = "";
        dom.multipleChoiceOptions.appendChild(buildLoadingChoice());
        if (hasSubmitted) {
            dom.flashcard.classList.add("flipped");
        }
        return;
    }

    if (state.multipleChoiceState.status === "unavailable") {
        dom.studyHint.textContent = hasSubmitted
            ? "This card already has a recorded attempt. Rate it or switch modes."
            : "Multiple choice is unavailable here, but Flip and Type still work.";
        dom.multipleChoiceStatus.textContent = "This card does not have enough options yet.";
        dom.multipleChoiceFeedback.hidden = false;
        dom.multipleChoiceFeedback.dataset.tone = "warning";
        dom.multipleChoiceFeedback.textContent = state.multipleChoiceState.feedback;
        dom.multipleChoiceOptions.innerHTML = "";
        if (hasSubmitted) {
            dom.flashcard.classList.add("flipped");
        }
        return;
    }

    dom.studyHint.textContent = hasSubmitted
        ? (state.multipleChoiceState.status === "answered" && state.multipleChoiceState.feedback
            ? "Compare your pick with the answer, then rate the card."
            : "This card already has a recorded attempt. Rate it to continue.")
        : "Choose the best answer before you reveal the card.";
    dom.multipleChoiceStatus.textContent = hasSubmitted
        ? "Answer choices are locked for this card."
        : "Choose the best answer.";
    dom.multipleChoiceOptions.innerHTML = "";

    state.multipleChoiceState.options.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "study-mc-option";
        button.textContent = option;

        if (state.multipleChoiceState.status === "answered" || hasSubmitted) {
            button.disabled = true;

            if (normalizeAnswerText(option) === normalizeAnswerText(card.answer)) {
                button.classList.add("correct");
            } else if (state.multipleChoiceState.status === "answered" && option === state.multipleChoiceState.selectedOption) {
                button.classList.add("incorrect");
            }
        } else {
            button.addEventListener("click", () => submitMultipleChoiceAnswer(option, set, card));
        }

        dom.multipleChoiceOptions.appendChild(button);
    });

    if (hasSubmitted) {
        dom.flashcard.classList.add("flipped");
    }

    if (state.multipleChoiceState.status !== "answered" || !state.multipleChoiceState.feedback) {
        dom.multipleChoiceFeedback.hidden = true;
        dom.multipleChoiceFeedback.textContent = "";
        delete dom.multipleChoiceFeedback.dataset.tone;
        return;
    }

    dom.flashcard.classList.add("flipped");
    dom.multipleChoiceFeedback.hidden = false;
    dom.multipleChoiceFeedback.dataset.tone = state.multipleChoiceState.isCorrect ? "success" : "warning";
    dom.multipleChoiceFeedback.textContent = state.multipleChoiceState.feedback;
}

function buildLoadingChoice() {
    const loading = document.createElement("div");
    loading.className = "study-mc-option loading";
    loading.textContent = "Loading choices...";
    return loading;
}

function renderAdaptiveHelp(card) {
    if (!card || state.studyComplete) {
        dom.adaptiveHelpPanel.hidden = true;
        return;
    }

    if (card.mastered) {
        dom.adaptiveHelpPanel.hidden = true;
        dom.adaptiveHelpContent.innerHTML = "";
        dom.adaptiveHelpStatus.textContent = "";
        return;
    }

    const adaptiveHelp = card.aiSupport;

    if (!adaptiveHelp && card.hardCount < 2 && state.adaptiveHelpState.status !== "loading") {
        dom.adaptiveHelpPanel.hidden = true;
        return;
    }

    dom.adaptiveHelpPanel.hidden = false;
    dom.adaptiveHelpToggleBtn.hidden = false;
    dom.adaptiveHelpToggleBtn.setAttribute("aria-pressed", String(state.adaptiveHelpEnabled));
    dom.adaptiveHelpToggleBtn.textContent = state.adaptiveHelpEnabled
        ? "Adaptive AI Support On"
        : "Turn On Adaptive AI Support";
    dom.adaptiveHelpContent.innerHTML = "";

    if (state.adaptiveHelpState.status === "loading" && state.adaptiveHelpState.cardId === card.id) {
        dom.adaptiveHelpStatus.textContent = "Unlocking extra help for this trouble card...";
        return;
    }

    if (!adaptiveHelp && !state.adaptiveHelpEnabled) {
        dom.adaptiveHelpStatus.textContent = "Adaptive support is off. Turn it on before Quizzy sends this card to AI.";
        return;
    }

    if (!adaptiveHelp) {
        dom.adaptiveHelpStatus.textContent = "Adaptive help unlocks once AI is available for repeated hard cards.";
        return;
    }

    dom.adaptiveHelpStatus.textContent = `Saved once on ${formatDate(adaptiveHelp.generatedAt)} and reused for this card.`;

    buildAdaptiveHelpItem("Simpler explanation", adaptiveHelp.explanation);
    buildAdaptiveHelpItem("Mnemonic", adaptiveHelp.mnemonic);
    buildAdaptiveHelpItem("Real-world example", adaptiveHelp.example);
    buildAdaptiveHelpItem("Alternate question", adaptiveHelp.alternateQuestion);
}

function buildAdaptiveHelpItem(title, copy) {
    if (!copy) {
        return;
    }

    const item = document.createElement("article");
    item.className = "adaptive-help-item";

    const heading = document.createElement("h4");
    heading.textContent = title;

    const body = document.createElement("p");
    body.textContent = copy;

    item.append(heading, body);
    dom.adaptiveHelpContent.appendChild(item);
}

function toggleAdaptiveHelp() {
    state.adaptiveHelpEnabled = !state.adaptiveHelpEnabled;
    const set = getCurrentSet();
    const card = set && !state.studyComplete ? set.cards[state.currentCardIndex] : null;

    if (!card) {
        return;
    }

    renderAdaptiveHelp(card);

    if (state.adaptiveHelpEnabled && card.hardCount >= 2 && !card.aiSupport) {
        void maybeUnlockAdaptiveHelp(card, set, { fromRender: false });
    }
}

function changeStudyMode(nextMode) {
    if (!STUDY_MODE_OPTIONS.includes(nextMode) || state.studyMode === nextMode) {
        return;
    }

    const set = getCurrentSet();
    const card = set && !state.studyComplete ? set.cards[state.currentCardIndex] : null;
    const shouldWarmMultipleChoice = nextMode === "multiple-choice" && state.multipleChoiceState.status === "idle";

    clearTransientStudyModeState();
    state.studyMode = nextMode;

    renderStudyState();

    if (!card) {
        return;
    }

    if (nextMode === "type" && !hasSubmittedAttemptForCard(card)) {
        dom.typeAnswerInput.focus();
        return;
    }

    if (shouldWarmMultipleChoice) {
        void warmStudyModeState(card);
    }
}

function handleTypeAnswerKeydown(event) {
    if (event.key !== "Enter") {
        return;
    }

    event.preventDefault();
    submitTypeAnswer();
}

function submitTypeAnswer() {
    const set = getCurrentSet();
    const card = set && !state.studyComplete ? set.cards[state.currentCardIndex] : null;

    if (!card || hasSubmittedAttemptForCard(card)) {
        return;
    }

    const learnerAnswer = dom.typeAnswerInput.value;
    const comparison = compareAnswersLoosely(learnerAnswer, card.answer);

    state.typeAnswerValue = learnerAnswer;
    state.typeAnswerResult = {
        isCorrect: comparison.isCorrect,
        feedback: comparison.isCorrect
            ? `Nice recall. Correct answer: ${card.answer}`
            : `${comparison.isClose ? "Close." : "Not quite."} Correct answer: ${card.answer}`
    };
    markCardAttemptSubmitted(card, "type", comparison.isCorrect);

    renderStudyInteraction(set, card);
}

function submitMultipleChoiceAnswer(option, set, card) {
    if (!card || hasSubmittedAttemptForCard(card)) {
        return;
    }

    const isCorrect = normalizeAnswerText(option) === normalizeAnswerText(card.answer);

    state.multipleChoiceState = {
        ...state.multipleChoiceState,
        status: "answered",
        selectedOption: option,
        isCorrect,
        feedback: isCorrect
            ? "Correct. The answer matched the card."
            : `Correct answer: ${card.answer}`
    };
    markCardAttemptSubmitted(card, "multiple-choice", isCorrect);

    renderStudyInteraction(set, card);
}

function compareAnswersLoosely(userAnswer, correctAnswer) {
    const normalizedUser = normalizeAnswerText(userAnswer);
    const normalizedCorrect = normalizeAnswerText(correctAnswer);

    if (!normalizedUser) {
        return {
            isCorrect: false,
            isClose: false,
            score: 0
        };
    }

    if (normalizedUser === normalizedCorrect) {
        return {
            isCorrect: true,
            isClose: true,
            score: 1
        };
    }

    const similarity = calculateTextSimilarity(normalizedUser, normalizedCorrect);
    const oneContainsOther = normalizedCorrect.includes(normalizedUser) || normalizedUser.includes(normalizedCorrect);
    const lengthRatio = Math.min(normalizedUser.length, normalizedCorrect.length) / Math.max(normalizedUser.length, normalizedCorrect.length, 1);
    const isCorrect = similarity >= TYPE_SIMILARITY_THRESHOLD || (oneContainsOther && lengthRatio >= TYPE_SIMILARITY_THRESHOLD);

    return {
        isCorrect,
        isClose: similarity >= 0.55 || oneContainsOther,
        score: similarity
    };
}

function normalizeAnswerText(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ");
}

function calculateTextSimilarity(left, right) {
    const leftTokens = left.split(" ").filter(Boolean);
    const rightTokens = right.split(" ").filter(Boolean);
    const rightSet = new Set(rightTokens);
    const leftSet = new Set(leftTokens);
    const sharedTokens = leftTokens.filter((token) => rightSet.has(token));
    const coverage = leftTokens.length === 0 ? 0 : sharedTokens.length / leftTokens.length;
    const answerCoverage = rightTokens.length === 0 ? 0 : sharedTokens.length / rightTokens.length;
    const overlap = sharedTokens.length / Math.max(leftSet.size, rightSet.size, 1);
    return Math.max(coverage, answerCoverage, overlap);
}

function startTroubleReview() {
    const set = getCurrentSet();
    const troubleCardIdsInScope = getTroubleCardIdsInScope(set, state.studyScope.cardIndexes);

    if (!set || troubleCardIdsInScope.length === 0) {
        return;
    }

    const scopeCardIndexes = state.studyScope.cardIndexes.filter((cardIndex) => {
        const card = set.cards[cardIndex];
        return card && troubleCardIdsInScope.includes(card.id);
    });

    if (scopeCardIndexes.length === 0) {
        showToast("No trouble cards are available for a focused review yet.", "warning");
        return;
    }

    initializeStudySession(state.currentSetIndex, {
        type: "custom",
        label: "Trouble review",
        cardIndexes: scopeCardIndexes,
        includeAll: true
    }, {
        enterMode: false,
        preserveManagerOpen: true
    });

    showToast("Trouble-only review started.", "success");
}

async function getOrCreateDistractors(card, set) {
    invalidateCardCacheIfNeeded(card);

    const savedDistractors = validateDistractorList(card.aiCache.distractors, card, set);

    if (savedDistractors.length >= MIN_MULTIPLE_CHOICE_DISTRACTORS) {
        return buildMultipleChoiceOptions(card, savedDistractors.slice(0, MAX_MULTIPLE_CHOICE_DISTRACTORS));
    }

    const localDistractors = buildLocalDistractors(card, set);

    if (localDistractors.length >= MIN_MULTIPLE_CHOICE_DISTRACTORS) {
        buildCachedDistractorPayload(card, localDistractors.slice(0, MAX_MULTIPLE_CHOICE_DISTRACTORS));
        saveSets();
        return buildMultipleChoiceOptions(card, card.aiCache.distractors.slice(0, MAX_MULTIPLE_CHOICE_DISTRACTORS));
    }

    if (window.QuizzyAI && typeof window.QuizzyAI.getDistractorsForCard === "function") {
        try {
            const aiDistractors = await window.QuizzyAI.getDistractorsForCard({
                question: card.question,
                answer: card.answer
            });

            const validAiDistractors = validateDistractorList(aiDistractors, card, set);

            if (validAiDistractors.length >= MIN_MULTIPLE_CHOICE_DISTRACTORS) {
                buildCachedDistractorPayload(card, validAiDistractors.slice(0, MAX_MULTIPLE_CHOICE_DISTRACTORS));
                saveSets();
                return buildMultipleChoiceOptions(card, card.aiCache.distractors.slice(0, MAX_MULTIPLE_CHOICE_DISTRACTORS));
            }
        } catch (error) {
            console.error("Unable to generate distractors for this card.", error);
        }
    }

    const fallbackDistractors = buildFallbackDistractors(card, set);

    if (fallbackDistractors.length >= MIN_MULTIPLE_CHOICE_DISTRACTORS) {
        buildCachedDistractorPayload(card, fallbackDistractors.slice(0, MAX_MULTIPLE_CHOICE_DISTRACTORS));
        saveSets();
        return buildMultipleChoiceOptions(card, card.aiCache.distractors.slice(0, MAX_MULTIPLE_CHOICE_DISTRACTORS));
    }

    return [];
}

function buildLocalDistractors(card, set) {
    const profile = analyzeDistractorProfile(card.answer);
    const distractors = [
        ...buildNumericDistractors(profile),
        ...buildDateDistractors(profile)
    ];

    if (shouldUseSetBasedDistractors(profile)) {
        distractors.unshift(...buildTemplateDistractorsFromSet(card, set, profile));
        distractors.unshift(...buildSameDomainSetDistractors(card, set, profile));
    }

    return validateDistractorList(distractors, card, set, profile).slice(0, MAX_MULTIPLE_CHOICE_DISTRACTORS);
}

function buildFallbackDistractors(card, set) {
    return buildLocalDistractors(card, set);
}

function buildMultipleChoiceOptions(card, distractors) {
    const options = [card.answer, ...sanitizeDistractorList(distractors, card.answer).slice(0, MAX_MULTIPLE_CHOICE_DISTRACTORS)];
    return shuffleMultipleChoiceOptions(options);
}

function shuffleMultipleChoiceOptions(options) {
    const shuffled = options.slice();

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        const current = shuffled[index];
        shuffled[index] = shuffled[randomIndex];
        shuffled[randomIndex] = current;
    }

    return shuffled;
}

function analyzeDistractorProfile(answer) {
    const raw = String(answer || "").trim();
    const normalized = normalizeAnswerText(raw);
    const tokens = raw.split(/\s+/).filter(Boolean);
    const numeric = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : null;
    const yearMatch = raw.match(/^(1\d{3}|20\d{2}|21\d{2})$/);
    const date = parseSupportedDate(raw);
    const listParts = splitListAnswer(raw);

    return {
        raw,
        normalized,
        tokens,
        tokenCount: tokens.length,
        numeric,
        numericPrecision: getNumericPrecision(raw),
        isYear: Boolean(yearMatch),
        yearValue: yearMatch ? Number(yearMatch[1]) : null,
        date,
        listParts
    };
}

function validateDistractorList(values, card, set, profile = analyzeDistractorProfile(card.answer)) {
    const sanitized = sanitizeDistractorList(values, card.answer);
    const ranked = [];

    sanitized.forEach((candidate) => {
        if (!isValidDistractorCandidate(candidate, card, profile)) {
            return;
        }

        ranked.push({
            candidate,
            score: scoreDistractorCandidate(candidate, card, profile)
        });
    });

    return ranked
        .sort((left, right) => right.score - left.score)
        .map((entry) => entry.candidate)
        .slice(0, 6);
}

function isValidDistractorCandidate(candidate, card, profile) {
    if (!candidate || !profile.raw) {
        return false;
    }

    const candidateProfile = analyzeDistractorProfile(candidate);

    return isSameDistractorDomain(candidateProfile, profile)
        && hasReasonableDistractorLength(candidateProfile, profile)
        && !looksLikeQuestionLeak(candidate, card)
        && normalizeAnswerText(candidate) !== profile.normalized;
}

function isSameDistractorDomain(candidateProfile, answerProfile) {
    if (answerProfile.isYear) {
        return candidateProfile.isYear;
    }

    if (answerProfile.date) {
        return Boolean(candidateProfile.date);
    }

    if (answerProfile.numeric !== null) {
        return candidateProfile.numeric !== null;
    }

    if (answerProfile.listParts.length >= 2) {
        return candidateProfile.listParts.length >= 2;
    }

    if (answerProfile.tokenCount <= 1) {
        return candidateProfile.tokenCount <= 2 && !candidateProfile.date && candidateProfile.numeric === null;
    }

    return Math.abs(candidateProfile.tokenCount - answerProfile.tokenCount) <= 2;
}

function hasReasonableDistractorLength(candidateProfile, answerProfile) {
    const candidateLength = candidateProfile.raw.length;
    const answerLength = Math.max(answerProfile.raw.length, 1);
    const ratio = candidateLength / answerLength;

    if (answerProfile.isYear) {
        return candidateLength === 4;
    }

    if (answerProfile.date) {
        return ratio >= 0.7 && ratio <= 1.5;
    }

    if (answerProfile.numeric !== null) {
        return ratio >= 0.5 && ratio <= 1.5;
    }

    if (answerProfile.tokenCount <= 1) {
        return ratio >= 0.5 && ratio <= 1.8;
    }

    return ratio >= 0.6 && ratio <= 1.7;
}

function looksLikeQuestionLeak(candidate, card) {
    const normalizedCandidate = normalizeAnswerText(candidate);
    const normalizedQuestion = normalizeAnswerText(card && card.question);

    return Boolean(normalizedQuestion && normalizedQuestion === normalizedCandidate);
}

function scoreDistractorCandidate(candidate, card, answerProfile) {
    const candidateProfile = analyzeDistractorProfile(candidate);
    const lengthDelta = Math.abs(candidateProfile.raw.length - answerProfile.raw.length);
    const tokenDelta = Math.abs(candidateProfile.tokenCount - answerProfile.tokenCount);
    const lexicalSimilarity = calculateTextSimilarity(candidateProfile.normalized, answerProfile.normalized);
    let score = Math.max(0, 1 - (lengthDelta / Math.max(answerProfile.raw.length, 1)));

    score += Math.max(0, 1 - (tokenDelta / Math.max(answerProfile.tokenCount, 1)));
    score += Math.min(lexicalSimilarity, 0.65);

    if (answerProfile.numeric !== null && candidateProfile.numeric !== null) {
        score += 1 / (1 + Math.abs(candidateProfile.numeric - answerProfile.numeric));
    }

    if (answerProfile.isYear && candidateProfile.isYear) {
        score += 1 / (1 + Math.abs(candidateProfile.yearValue - answerProfile.yearValue));
    }

    if (answerProfile.date && candidateProfile.date) {
        const timeDifference = Math.abs(candidateProfile.date.value.getTime() - answerProfile.date.value.getTime());
        const dayDifference = timeDifference / (24 * 60 * 60 * 1000);
        score += 1 / (1 + dayDifference);
    }

    if (answerProfile.listParts.length >= 2 && candidateProfile.listParts.length === answerProfile.listParts.length) {
        score += 0.4;
    }

    return score;
}

function buildSameDomainSetDistractors(card, set, profile) {
    if (!set || !Array.isArray(set.cards)) {
        return [];
    }

    return set.cards
        .map((candidate) => candidate && typeof candidate.answer === "string" ? candidate.answer : "")
        .filter((answer) => normalizeAnswerText(answer) !== profile.normalized)
        .filter((answer) => isSameDistractorDomain(analyzeDistractorProfile(answer), profile))
        .sort((left, right) => scoreDistractorCandidate(right, card, profile) - scoreDistractorCandidate(left, card, profile));
}

function buildTemplateDistractorsFromSet(card, set, profile) {
    if (!set || !Array.isArray(set.cards) || profile.tokenCount < 2 || profile.tokenCount > 6) {
        return [];
    }

    const variants = [];

    set.cards.forEach((candidateCard) => {
        const candidateAnswer = candidateCard && typeof candidateCard.answer === "string" ? candidateCard.answer.trim() : "";
        const candidateProfile = analyzeDistractorProfile(candidateAnswer);

        if (!candidateAnswer
            || candidateProfile.tokenCount !== profile.tokenCount
            || normalizeAnswerText(candidateAnswer) === profile.normalized) {
            return;
        }

        const sharedTokens = candidateProfile.tokens.filter((token) => profile.tokens.includes(token));

        if (sharedTokens.length === 0) {
            return;
        }

        for (let index = 0; index < profile.tokens.length; index += 1) {
            if (!candidateProfile.tokens[index] || candidateProfile.tokens[index] === profile.tokens[index]) {
                continue;
            }

            const nextTokens = profile.tokens.slice();
            nextTokens[index] = candidateProfile.tokens[index];
            variants.push(nextTokens.join(" "));
        }
    });

    if (profile.listParts.length >= 2) {
        const delimiter = detectListDelimiter(profile.raw);

        if (delimiter) {
            for (let index = 0; index < profile.listParts.length; index += 1) {
                const nextParts = profile.listParts.slice();
                nextParts[index] = profile.listParts[(index + 1) % profile.listParts.length];
                variants.push(nextParts.join(`${delimiter} `));
            }
        }
    }

    return variants;
}

function shouldUseSetBasedDistractors(profile) {
    return profile.numeric !== null
        || profile.isYear
        || Boolean(profile.date)
        || profile.listParts.length >= 2
        || profile.tokenCount >= 2;
}

function buildNumericDistractors(profile) {
    if (profile.numeric === null || profile.date || profile.isYear) {
        return [];
    }

    const value = profile.numeric;
    const step = profile.numericPrecision > 0 ? Number((1 / (10 ** profile.numericPrecision)).toFixed(profile.numericPrecision)) : 1;
    const scale = Math.max(step, Math.abs(value) >= 10 ? Math.round(Math.abs(value) * 0.1) : step);
    const offsets = [step, scale, -step, -scale, step * 2, -step * 2];

    return offsets
        .map((offset) => formatNumericDistractor(value + offset, profile.numericPrecision))
        .filter(Boolean);
}

function buildDateDistractors(profile) {
    if (profile.isYear) {
        return [profile.yearValue - 1, profile.yearValue + 1, profile.yearValue - 5, profile.yearValue + 5]
            .map((value) => String(value));
    }

    if (!profile.date) {
        return [];
    }

    const offsets = [
        { years: -1 },
        { years: 1 },
        { days: -1 },
        { days: 1 },
        { months: 1 }
    ];

    return offsets
        .map((offset) => shiftDate(profile.date.value, offset))
        .map((value) => formatDateLike(value, profile.date.format))
        .filter(Boolean);
}

function getNumericPrecision(value) {
    const trimmed = String(value || "").trim();

    if (!trimmed.includes(".")) {
        return 0;
    }

    return trimmed.split(".")[1].length;
}

function formatNumericDistractor(value, precision) {
    if (!Number.isFinite(value)) {
        return "";
    }

    return precision > 0 ? value.toFixed(precision) : String(Math.round(value));
}

function splitListAnswer(value) {
    const delimiter = detectListDelimiter(value);

    if (!delimiter) {
        return [];
    }

    const parts = String(value || "")
        .split(delimiter)
        .map((part) => part.trim())
        .filter(Boolean);

    return parts.length >= 2 ? parts : [];
}

function detectListDelimiter(value) {
    if (String(value || "").includes(";")) {
        return ";";
    }

    if (String(value || "").includes(",")) {
        return ",";
    }

    if (String(value || "").includes("/")) {
        return "/";
    }

    return "";
}

function parseSupportedDate(value) {
    const trimmed = String(value || "").trim();
    let match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

    if (match) {
        return buildParsedDate(Number(match[1]), Number(match[2]), Number(match[3]), "iso");
    }

    match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    if (match) {
        return buildParsedDate(Number(match[3]), Number(match[1]), Number(match[2]), "slash");
    }

    match = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);

    if (match) {
        const monthIndex = getMonthIndex(match[1]);

        if (monthIndex > 0) {
            return buildParsedDate(Number(match[3]), monthIndex, Number(match[2]), "long");
        }
    }

    return null;
}

function buildParsedDate(year, month, day, format) {
    const value = new Date(year, month - 1, day);

    if (Number.isNaN(value.getTime())
        || value.getFullYear() !== year
        || value.getMonth() !== month - 1
        || value.getDate() !== day) {
        return null;
    }

    return {
        value,
        format
    };
}

function getMonthIndex(label) {
    const normalized = String(label || "").trim().toLowerCase();
    const months = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december"
    ];

    return months.findIndex((month) => month.startsWith(normalized)) + 1;
}

function shiftDate(date, offset) {
    const next = new Date(date.getTime());

    if (offset.years) {
        next.setFullYear(next.getFullYear() + offset.years);
    }

    if (offset.months) {
        next.setMonth(next.getMonth() + offset.months);
    }

    if (offset.days) {
        next.setDate(next.getDate() + offset.days);
    }

    return next;
}

function formatDateLike(date, format) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if (format === "iso") {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    if (format === "slash") {
        return `${month}/${day}/${year}`;
    }

    if (format === "long") {
        const monthName = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December"
        ][month - 1];

        return `${monthName} ${day}, ${year}`;
    }

    return "";
}

async function getOrCreateAdaptiveHelp(card) {
    invalidateCardCacheIfNeeded(card);

    if (card.aiSupport) {
        return card.aiSupport;
    }

    if (!window.QuizzyAI || typeof window.QuizzyAI.getAdaptiveHelpForCard !== "function") {
        return null;
    }

    try {
        const adaptiveHelp = await window.QuizzyAI.getAdaptiveHelpForCard({
            question: card.question,
            answer: card.answer
        });

        if (!adaptiveHelp) {
            return null;
        }

        buildCachedAdaptiveHelpPayload(card, {
            ...adaptiveHelp,
            generatedAt: new Date().toISOString()
        });
        saveSets();
        return card.aiSupport;
    } catch (error) {
        console.error("Unable to generate adaptive help for this card.", error);
        return null;
    }
}

async function maybeUnlockAdaptiveHelp(card, set, options = {}) {
    if (!card || card.hardCount < 2) {
        return;
    }

    if (!state.adaptiveHelpEnabled && !card.aiSupport) {
        if (isCurrentStudyCard(card.id)) {
            renderAdaptiveHelp(card);
        }
        return;
    }

    if (card.aiSupport) {
        if (isCurrentStudyCard(card.id)) {
            renderAdaptiveHelp(card);
        }
        return;
    }

    if (state.adaptiveHelpState.status === "loading" && state.adaptiveHelpState.cardId === card.id) {
        return;
    }

    state.adaptiveHelpState = {
        status: "loading",
        cardId: card.id,
        message: "Loading adaptive help..."
    };

    if (isCurrentStudyCard(card.id)) {
        renderAdaptiveHelp(card);
    }

    const adaptiveHelp = await getOrCreateAdaptiveHelp(card, set);

    if (!isCurrentStudyCard(card.id)) {
        return;
    }

    state.adaptiveHelpState = adaptiveHelp
        ? {
            status: "ready",
            cardId: card.id,
            message: "Adaptive help ready."
        }
        : {
            status: options.fromRender ? "idle" : "unavailable",
            cardId: card.id,
            message: "Adaptive help is unavailable right now."
        };

    renderAdaptiveHelp(card);
}

function handleStudyAiAvailabilityChange() {
    const set = getCurrentSet();
    const card = set && !state.studyComplete ? set.cards[state.currentCardIndex] : null;

    if (!card) {
        return;
    }

    void warmStudyModeState(card);
    renderAdaptiveHelp(card);
}

function triggerStreakPulse() {
    clearStreakPulse();
    dom.currentStreakCount.classList.add("is-pulsing");
    state.streakPulseTimeoutId = window.setTimeout(() => {
        clearStreakPulse();
    }, 380);
}

function clearStreakPulse() {
    if (state.streakPulseTimeoutId) {
        window.clearTimeout(state.streakPulseTimeoutId);
        state.streakPulseTimeoutId = 0;
    }

    if (dom.currentStreakCount) {
        dom.currentStreakCount.classList.remove("is-pulsing");
    }
}

function renderStudySectionManager() {
    const set = getCurrentSet();

    if (!set) {
        return;
    }

    dom.toggleStudySectionsBtn.textContent = state.studyManagerOpen ? "Hide Auto-Split" : "Auto-Split";
    dom.studySectionManager.hidden = !state.studyManagerOpen;
    dom.studyWholeSetBtn.disabled = state.studyScope.type === "full";
    dom.studySectionListMeta.textContent = set.studySections.length === 0
        ? "No saved sections yet."
        : `${set.studySections.length} saved section${set.studySections.length === 1 ? "" : "s"}.`;

    renderStudySectionSizeControls(set);
    renderStudySectionList(set);
}

function renderStudySectionSizeControls(set) {
    const defaultChunkSize = set.studyPrefs ? set.studyPrefs.defaultChunkSize : DEFAULT_CHUNK_SIZE;
    const customValue = Math.max(1, defaultChunkSize);

    dom.customSectionSizeInput.value = String(customValue);

    dom.sectionSizeButtons.forEach((button) => {
        const isActive = button.dataset.sectionSize === state.studySectionSizeMode;
        button.classList.toggle("active", isActive);
    });
}

function renderStudySectionList(set) {
    dom.studySectionList.innerHTML = "";

    if (set.studySections.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "study-section-list-empty";
        emptyState.textContent = "Create sections to save quick study chunks for this set.";
        dom.studySectionList.appendChild(emptyState);
        return;
    }

    set.studySections.forEach((section) => {
        const sectionCard = document.createElement("article");
        sectionCard.className = "study-section-list-item";

        if (state.studyScope.type === "section" && state.studyScope.sectionId === section.id) {
            sectionCard.classList.add("active");
        }

        const copy = document.createElement("div");
        copy.className = "study-section-item-copy";

        const title = document.createElement("h4");
        title.textContent = section.label;

        const range = document.createElement("p");
        range.className = "study-section-range";
        range.textContent = getStudySectionRangeText(section);

        const progress = document.createElement("p");
        progress.className = "study-section-progress";

        const masteredCount = countMasteredCards(set, section.cardIndexes);
        const dueCount = countDueCards(set, section.cardIndexes);
        const lastStudiedText = section.lastStudiedAt ? `Last studied ${formatDate(section.lastStudiedAt)}` : "Not studied yet";

        progress.textContent = `${masteredCount}/${section.cardIndexes.length} mastered | ${dueCount} due | ${lastStudiedText}`;

        copy.append(title, range, progress);

        const actions = document.createElement("div");
        actions.className = "study-section-item-actions";

        const studyButton = document.createElement("button");
        studyButton.type = "button";
        studyButton.className = state.studyScope.type === "section" && state.studyScope.sectionId === section.id
            ? "primary-btn compact-btn"
            : "secondary-btn compact-btn";
        studyButton.textContent = state.studyScope.type === "section" && state.studyScope.sectionId === section.id
            ? "Active Section"
            : "Study Section";
        studyButton.dataset.sectionAction = "study";
        studyButton.dataset.sectionId = section.id;
        studyButton.disabled = state.studyScope.type === "section" && state.studyScope.sectionId === section.id;

        actions.appendChild(studyButton);
        sectionCard.append(copy, actions);
        dom.studySectionList.appendChild(sectionCard);
    });
}

function getStudySectionRangeText(section) {
    if (!section || section.cardIndexes.length === 0) {
        return "No cards";
    }

    const firstCardNumber = section.cardIndexes[0] + 1;
    const lastCardNumber = section.cardIndexes[section.cardIndexes.length - 1] + 1;
    return `Cards ${firstCardNumber}-${lastCardNumber}`;
}

function handleComposerFocus() {
    if (dom.cardsList.value.trim() === "") {
        dom.cardsList.value = "Q: ";
        dom.cardsList.setSelectionRange(3, 3);
    }
}

function handleComposerKeydown(event) {
    if (event.key !== "Enter" || event.shiftKey) {
        return;
    }

    event.preventDefault();

    const cursorPosition = dom.cardsList.selectionStart;
    const content = dom.cardsList.value;
    const textBeforeCursor = content.slice(0, cursorPosition);
    const textAfterCursor = content.slice(cursorPosition);
    const prefix = getNextComposerPrefix(textBeforeCursor);
    const insertedText = `\n${prefix}`;

    dom.cardsList.value = `${textBeforeCursor}${insertedText}${textAfterCursor}`;

    const nextPosition = cursorPosition + insertedText.length;
    dom.cardsList.setSelectionRange(nextPosition, nextPosition);
}

function getNextComposerPrefix(textBeforeCursor) {
    const meaningfulLines = textBeforeCursor
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const lastLine = meaningfulLines[meaningfulLines.length - 1] || "";

    if (lastLine.startsWith("Q:")) {
        return "A: ";
    }

    return "Q: ";
}

function populateGeneratedDraft(title, cards) {
    const composerText = cards
        .map((card) => `Q: ${card.question}\nA: ${card.answer}`)
        .join("\n");

    if (title) {
        dom.setTitle.value = title;
    }

    dom.cardsList.value = composerText;
    switchPanel("create-panel");
    switchCreateTab("manual");
    setInlineMessage(dom.manualFormMessage, "AI draft added to the composer. Review it, tweak it, then save.", "success");
    dom.cardsList.focus();
    dom.cardsList.setSelectionRange(dom.cardsList.value.length, dom.cardsList.value.length);
}

function toggleStudySectionManager() {
    if (!getCurrentSet()) {
        return;
    }

    state.studyManagerOpen = !state.studyManagerOpen;
    clearInlineMessage(dom.studySectionsMessage);
    renderStudySectionManager();
}

function handleSectionSizeButtonClick(sizeKey) {
    const set = getCurrentSet();

    if (!set) {
        return;
    }

    state.studySectionSizeMode = sizeKey;

    if (sizeKey === "custom") {
        dom.customSectionSizeInput.focus();
    } else {
        set.studyPrefs.defaultChunkSize = Number(sizeKey);
        dom.customSectionSizeInput.value = String(Number(sizeKey));
        saveSets();
    }

    renderStudySectionManager();
}

function handleCustomSectionSizeChange() {
    const set = getCurrentSet();

    if (!set) {
        return;
    }

    const customSize = getCustomSectionSizeValue(set.cards.length);
    state.studySectionSizeMode = "custom";
    set.studyPrefs.defaultChunkSize = customSize;
    dom.customSectionSizeInput.value = String(customSize);
    saveSets();
    renderStudySectionManager();
}

function getSelectedSectionSize(maxCards) {
    if (state.studySectionSizeMode === "custom") {
        return getCustomSectionSizeValue(maxCards);
    }

    return Math.max(1, Number(state.studySectionSizeMode) || DEFAULT_CHUNK_SIZE);
}

function getCustomSectionSizeValue(maxCards) {
    const rawValue = Number(dom.customSectionSizeInput.value);
    const fallback = maxCards > 0 ? Math.min(DEFAULT_CHUNK_SIZE, maxCards) : DEFAULT_CHUNK_SIZE;

    if (!Number.isInteger(rawValue) || rawValue < 1) {
        return fallback;
    }

    return rawValue;
}

function createStudySections() {
    const set = getCurrentSet();

    if (!set) {
        return;
    }

    const chunkSize = getSelectedSectionSize(set.cards.length);

    if (set.cards.length === 0) {
        setInlineMessage(dom.studySectionsMessage, "This set does not have any cards to split yet.", "error");
        return;
    }

    const applySections = () => {
        set.studySections = buildStudySections(set.cards.length, chunkSize);
        set.studyPrefs.defaultChunkSize = chunkSize;
        set.studyPrefs.lastScopeType = "full";
        set.studyPrefs.lastSectionId = null;

        if (state.studyScope.type === "section" && !findStudySectionById(set, state.studyScope.sectionId)) {
            state.studyScope = resolveStudyScope(set, { type: "full", sectionId: null });
            state.studyQueue = buildStudyQueue(set, state.studyScope.cardIndexes, state.studyScope);
            state.currentCardIndex = state.studyQueue[0] ?? -1;
            state.studyComplete = state.studyQueue.length === 0;
            state.studyCompletionRecorded = false;
        }

        saveSets();
        renderDashboard();
        renderStudyState();
        setInlineMessage(
            dom.studySectionsMessage,
            `Saved ${set.studySections.length} section${set.studySections.length === 1 ? "" : "s"} with chunk size ${chunkSize}.`,
            "success"
        );
        showToast("Study sections saved for this set.", "success");
    };

    if (set.studySections.length > 0) {
        showConfirmDialog({
            title: "Replace saved sections?",
            message: "Creating new sections will replace the current saved section layout for this set.",
            confirmText: "Replace Sections",
            onConfirm: applySections
        });
        return;
    }

    applySections();
}

function buildStudySections(cardCount, chunkSize) {
    const sections = [];
    let partNumber = 1;

    for (let start = 0; start < cardCount; start += chunkSize) {
        const end = Math.min(start + chunkSize, cardCount);
        const cardIndexes = [];

        for (let cardIndex = start; cardIndex < end; cardIndex += 1) {
            cardIndexes.push(cardIndex);
        }

        sections.push({
            id: createStudySectionId(partNumber),
            label: `Part ${partNumber}`,
            cardIndexes,
            size: cardIndexes.length,
            createdAt: new Date().toISOString(),
            lastStudiedAt: null,
            completedCount: 0
        });

        partNumber += 1;
    }

    return sections;
}

function handleStudySectionListClick(event) {
    const button = event.target.closest("[data-section-action]");

    if (!button || button.dataset.sectionAction !== "study") {
        return;
    }

    activateStudyScope({
        type: "section",
        sectionId: button.dataset.sectionId
    });
}

function syncStudySectionSizeMode(set) {
    if (!set || !set.studyPrefs) {
        state.studySectionSizeMode = String(DEFAULT_CHUNK_SIZE);
        return;
    }

    const defaultChunkSize = Math.max(1, Number(set.studyPrefs.defaultChunkSize) || DEFAULT_CHUNK_SIZE);

    state.studySectionSizeMode = SECTION_SIZE_OPTIONS.includes(defaultChunkSize)
        ? String(defaultChunkSize)
        : "custom";
}

function getCurrentSet() {
    return state.cardSets[state.currentSetIndex] || null;
}

function findStudySectionById(set, sectionId) {
    if (!set || !Array.isArray(set.studySections)) {
        return null;
    }

    return set.studySections.find((section) => section.id === sectionId) || null;
}

function countMasteredCards(set, cardIndexes) {
    return cardIndexes.reduce((count, cardIndex) => {
        const card = set.cards[cardIndex];
        return count + (card && card.mastered ? 1 : 0);
    }, 0);
}

function countDueCards(set, cardIndexes) {
    const now = Date.now();

    return cardIndexes.reduce((count, cardIndex) => {
        const card = set.cards[cardIndex];

        if (!card) {
            return count;
        }

        return count + (card.nextReview.getTime() <= now ? 1 : 0);
    }, 0);
}

function getStudyScopeLabel(set, scope) {
    if (scope.type === "custom" && scope.label) {
        return scope.label;
    }

    if (scope.type === "section") {
        const section = findStudySectionById(set, scope.sectionId);

        if (section) {
            return `Section: ${section.label} (${getStudySectionRangeText(section)})`;
        }
    }

    return "Whole set";
}

function setInlineMessage(element, message, tone = "info") {
    element.hidden = false;
    element.dataset.tone = tone;
    element.textContent = message;
}

function clearInlineMessage(element) {
    element.hidden = true;
    element.textContent = "";
    delete element.dataset.tone;
}

function showToast(message, tone = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${tone}`;
    toast.textContent = message;
    dom.toastStack.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 3400);
}

function formatDate(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "unknown date";
    }

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    }).format(date);
}

function sanitizeFilename(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "flashcards";
}

function getDateStamp() {
    return new Date().toISOString().split("T")[0];
}

function getStudyCardContext() {
    const set = getCurrentSet();

    if (!set || state.studyComplete) {
        return null;
    }

    const card = set.cards[state.currentCardIndex];

    if (!card) {
        return null;
    }

    const currentPosition = Math.max(Math.min(state.roundPresentationCount, state.studyScope.cardIndexes.length) - 1, 0);

    return {
        setTitle: set.title,
        cardIndex: currentPosition,
        totalCards: state.studyScope.cardIndexes.length,
        question: card.question,
        answer: card.answer
    };
}

function dispatchStudyContextChange(context) {
    document.dispatchEvent(new CustomEvent("quizzy:study-card-change", {
        detail: context
    }));
}

function recordStudyAiExchange(entry) {
    const set = getCurrentSet();

    if (!set || state.studyComplete) {
        return false;
    }

    const card = set.cards[state.currentCardIndex];

    if (!card || !entry || typeof entry.userQuestion !== "string" || typeof entry.aiAnswer !== "string") {
        return false;
    }

    const userQuestion = entry.userQuestion.trim();
    const aiAnswer = entry.aiAnswer.trim();

    if (!userQuestion || !aiAnswer) {
        return false;
    }

    if (!Array.isArray(card.aiHelpHistory)) {
        card.aiHelpHistory = [];
    }

    card.aiHelpHistory.unshift({
        userQuestion,
        aiAnswer,
        createdAt: new Date().toISOString()
    });
    card.aiHelpHistory = card.aiHelpHistory.slice(0, MAX_AI_HISTORY_ENTRIES);

    saveSets();
    renderDashboard();
    return true;
}

function sanitizeAiHelpHistory(entries) {
    if (!Array.isArray(entries)) {
        return [];
    }

    return entries
        .filter((entry) => entry && typeof entry.userQuestion === "string" && typeof entry.aiAnswer === "string")
        .map((entry) => ({
            userQuestion: entry.userQuestion.trim().slice(0, MAX_CARD_TEXT_LENGTH),
            aiAnswer: entry.aiAnswer.trim().slice(0, MAX_CARD_TEXT_LENGTH),
            createdAt: getValidTimestamp(entry.createdAt)
        }))
        .filter((entry) => entry.userQuestion && entry.aiAnswer)
        .slice(0, MAX_AI_HISTORY_ENTRIES);
}

function countSetAiHistoryEntries(set) {
    if (!set || !Array.isArray(set.cards)) {
        return 0;
    }

    return set.cards.reduce((total, card) => {
        const entries = Array.isArray(card.aiHelpHistory) ? card.aiHelpHistory.length : 0;
        return total + entries;
    }, 0);
}

function buildAiHistorySection(set, entryCount) {
    const details = document.createElement("details");
    details.className = "set-ai-history";

    const summary = document.createElement("summary");
    summary.textContent = `AI helper history (${entryCount})`;
    details.appendChild(summary);

    const content = document.createElement("div");
    content.className = "set-ai-history-content";

    set.cards.forEach((card, cardIndex) => {
        if (!Array.isArray(card.aiHelpHistory) || card.aiHelpHistory.length === 0) {
            return;
        }

        const cardSection = document.createElement("section");
        cardSection.className = "set-ai-card";

        const cardHeading = document.createElement("h5");
        cardHeading.textContent = `Card ${cardIndex + 1}`;

        const question = document.createElement("p");
        question.className = "set-ai-card-question";
        question.textContent = `Q: ${card.question}`;

        const answer = document.createElement("p");
        answer.className = "set-ai-card-answer";
        answer.textContent = `A: ${card.answer}`;

        cardSection.append(cardHeading, question, answer);

        card.aiHelpHistory.forEach((entry) => {
            const exchange = document.createElement("article");
            exchange.className = "set-ai-entry";

            const meta = document.createElement("p");
            meta.className = "set-ai-entry-meta";
            meta.textContent = `Asked ${formatDateTime(entry.createdAt)}`;

            const userQuestion = document.createElement("p");
            userQuestion.className = "set-ai-entry-user";
            userQuestion.textContent = `You asked: ${entry.userQuestion}`;

            const aiAnswer = document.createElement("p");
            aiAnswer.className = "set-ai-entry-answer";
            aiAnswer.textContent = `AI answered: ${entry.aiAnswer}`;

            exchange.append(meta, userQuestion, aiAnswer);
            cardSection.appendChild(exchange);
        });

        content.appendChild(cardSection);
    });

    details.appendChild(content);
    return details;
}

function formatDateTime(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "at an unknown time";
    }

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    }).format(date);
}

function createStudySectionId(seed) {
    return `section-${Date.now()}-${seed}-${Math.floor(Math.random() * 100000)}`;
}

function getValidDate(dateValue, fallbackDate) {
    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? fallbackDate : date;
}

function getValidDateOrNull(dateValue) {
    if (!dateValue) {
        return null;
    }

    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getValidTimestamp(dateValue) {
    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function getValidTimestampOrNull(dateValue) {
    if (!dateValue) {
        return null;
    }

    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function validateSetDraft(title, cards) {
    const normalizedTitle = typeof title === "string" ? title.trim() : "";

    if (!normalizedTitle) {
        return "Give your set a title before saving it.";
    }

    if (normalizedTitle.length > MAX_SET_TITLE_LENGTH) {
        return `Keep the set title under ${MAX_SET_TITLE_LENGTH} characters.`;
    }

    if (!Array.isArray(cards) || cards.length === 0) {
        return "Add at least one valid flashcard before saving.";
    }

    if (cards.length > MAX_CARDS_PER_SET) {
        return `Keep each set to ${MAX_CARDS_PER_SET} cards or fewer.`;
    }

    const hasInvalidCard = cards.some((card) => (
        !card
        || typeof card.question !== "string"
        || typeof card.answer !== "string"
        || !card.question.trim()
        || !card.answer.trim()
        || card.question.trim().length > MAX_CARD_TEXT_LENGTH
        || card.answer.trim().length > MAX_CARD_TEXT_LENGTH
    ));

    if (hasInvalidCard) {
        return `Each question and answer must be present and stay under ${MAX_CARD_TEXT_LENGTH} characters.`;
    }

    return null;
}
