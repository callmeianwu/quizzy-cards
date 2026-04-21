class CardSet {
    constructor(title, cards) {
        this.title = title;
        this.cards = cards;
        this.created = new Date();
        this.lastStudied = null;
        this.studySections = [];
        this.studyPrefs = createDefaultStudyPrefs();
    }
}

const EXPORT_VERSION = "1.1";
const DEFAULT_CHUNK_SIZE = 5;
const SECTION_SIZE_OPTIONS = [5, 10];
const MAX_SET_TITLE_LENGTH = 120;
const MAX_CARDS_PER_SET = 200;
const MAX_CARD_TEXT_LENGTH = 2000;
const MAX_AI_HISTORY_ENTRIES = 10;
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
    dom.remainingCount = document.getElementById("remainingCount");
    dom.studyProgressLabel = document.getElementById("studyProgressLabel");
    dom.studyProgressFill = document.getElementById("studyProgressFill");
    dom.studySetTitle = document.getElementById("studySetTitle");
    dom.studyScopeLabel = document.getElementById("studyScopeLabel");
    dom.studyHint = document.getElementById("studyHint");
    dom.studyActions = document.getElementById("studyActions");
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
    dom.ratingButtons.forEach((button) => {
        button.addEventListener("click", () => rateCard(Number(button.dataset.rating)));
    });
    dom.exitStudyBtn.addEventListener("click", () => exitStudyMode("library-panel"));
    dom.restartStudyBtn.addEventListener("click", restartSession);
    dom.studyAgainBtn.addEventListener("click", restartSession);
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
        recordStudyAiExchange
    };
}

function createDefaultStudyPrefs() {
    return {
        defaultChunkSize: DEFAULT_CHUNK_SIZE,
        lastSectionId: null,
        lastScopeType: "full"
    };
}

function createEmptyStudyScope() {
    return {
        type: "full",
        sectionId: null,
        cardIndexes: []
    };
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
    return set;
}

function hydrateCard(rawCard) {
    const card = new Card(rawCard.question || "", rawCard.answer || "");
    card.level = Math.max(0, Number(rawCard.level) || 0);
    card.attempts = Math.max(0, Number(rawCard.attempts) || 0);
    card.mastered = Boolean(rawCard.mastered);
    card.nextReview = getValidDate(rawCard.nextReview, new Date());
    card.aiHelpHistory = sanitizeAiHelpHistory(rawCard.aiHelpHistory);
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
    state.studyScope = resolvedScope;
    state.studyQueue = buildStudyQueue(set, resolvedScope.cardIndexes);
    state.currentCardIndex = state.studyQueue[0] ?? -1;
    state.studyComplete = state.studyQueue.length === 0;
    state.studyCompletionRecorded = false;
    state.studyManagerOpen = Boolean(options.preserveManagerOpen) ? state.studyManagerOpen : false;
    syncStudySectionSizeMode(set);

    set.lastStudied = new Date(nowIso);

    if (resolvedScope.type === "section") {
        const section = findStudySectionById(set, resolvedScope.sectionId);

        if (section) {
            section.lastStudiedAt = nowIso;
            set.studyPrefs.lastScopeType = "section";
            set.studyPrefs.lastSectionId = section.id;
        }
    } else {
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

    if (requestedScope && requestedScope.type === "section" && requestedScope.sectionId) {
        const section = findStudySectionById(set, requestedScope.sectionId);

        if (section) {
            return {
                type: "section",
                sectionId: section.id,
                cardIndexes: section.cardIndexes.slice()
            };
        }
    }

    return {
        type: "full",
        sectionId: null,
        cardIndexes: set.cards.map((_, cardIndex) => cardIndex)
    };
}

function buildStudyQueue(set, cardIndexes) {
    const now = Date.now();
    let queuedIndexes = cardIndexes.filter((cardIndex) => {
        const card = set.cards[cardIndex];
        return card && shouldIncludeCardInRound(card, now);
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
    switchPanel(returnPanel);
    renderStudyState();
}

function restartSession() {
    if (state.currentSetIndex < 0) {
        return;
    }

    initializeStudySession(state.currentSetIndex, state.studyScope, {
        enterMode: false,
        preserveManagerOpen: true
    });

    showToast("Round restarted without clearing your saved progress.", "info");
}

function flipFlashcard() {
    if (!getCurrentSet() || state.studyComplete) {
        return;
    }

    dom.flashcard.classList.toggle("flipped");
}

function rateCard(difficulty) {
    const set = getCurrentSet();

    if (!set || state.studyComplete) {
        return;
    }

    const currentCard = set.cards[state.currentCardIndex];

    if (!currentCard) {
        return;
    }

    currentCard.attempts += 1;
    currentCard.level = Math.max(0, currentCard.level + getLevelDeltaForDifficulty(difficulty));

    currentCard.mastered = currentCard.level >= 3;

    const hoursUntilNextReview = Math.pow(2, Math.max(currentCard.level, 0));
    currentCard.nextReview = new Date(Date.now() + hoursUntilNextReview * 60 * 60 * 1000);

    if (state.studyQueue[0] === state.currentCardIndex) {
        state.studyQueue.shift();
    } else {
        state.studyQueue = state.studyQueue.filter((cardIndex) => cardIndex !== state.currentCardIndex);
    }

    if (!currentCard.mastered) {
        state.studyQueue.push(state.currentCardIndex);
    }

    state.currentCardIndex = state.studyQueue[0] ?? -1;
    state.studyComplete = state.studyQueue.length === 0;

    if (state.studyComplete) {
        finalizeCompletedStudySession(set);
    }

    saveSets();
    renderDashboard();
    renderStudyState();
}

function getLevelDeltaForDifficulty(difficulty) {
    if (difficulty === 3) {
        return 2;
    }

    if (difficulty === 2) {
        return 1;
    }

    return -1;
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
        dom.remainingCount.textContent = "0";
        dom.studyProgressLabel.textContent = "Ready to begin";
        dom.studyProgressFill.style.width = "0%";
        dom.studyScopeLabel.textContent = "Whole set";
        dom.studySummary.hidden = true;
        dom.studyActions.hidden = false;
        dom.studyHint.hidden = false;
        dom.flashcard.classList.remove("flipped");
        dom.toggleStudySectionsBtn.disabled = true;
        dom.toggleStudySectionsBtn.textContent = "Auto-Split";
        dom.studySectionManager.hidden = true;
        clearInlineMessage(dom.studySectionsMessage);
        dispatchStudyContextChange(null);
        return;
    }

    const totalCards = state.studyScope.cardIndexes.length;
    const remainingCards = state.studyQueue.length;
    const masteredInScope = countMasteredCards(set, state.studyScope.cardIndexes);
    const progressRatio = totalCards === 0 ? 0 : masteredInScope / totalCards;

    dom.studySetTitle.textContent = set.title;
    dom.remainingCount.textContent = String(remainingCards);
    dom.studyProgressFill.style.width = `${progressRatio * 100}%`;
    dom.studyScopeLabel.textContent = getStudyScopeLabel(set, state.studyScope);
    dom.toggleStudySectionsBtn.disabled = false;

    renderStudySectionManager();

    if (state.studyComplete) {
        const scopeLabel = state.studyScope.type === "section" ? "this section" : "this set";

        dom.studyProgressLabel.textContent = "Round complete";
        dom.cardQuestion.textContent = "Nice work.";
        dom.cardAnswer.textContent = "Restart the round, switch sections, or head back to your library.";
        dom.flashcard.classList.remove("flipped");
        dom.studyHint.hidden = true;
        dom.studyActions.hidden = true;
        dom.studySummary.hidden = false;
        dom.studySummaryText.textContent = `You mastered ${masteredInScope} of ${totalCards} card${totalCards === 1 ? "" : "s"} in ${scopeLabel}.`;
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
    dom.studyProgressLabel.textContent = `${masteredInScope} of ${totalCards} mastered`;
    dom.flashcard.classList.remove("flipped");
    dom.studyHint.hidden = false;
    dom.studyActions.hidden = false;
    dom.studySummary.hidden = true;
    dispatchStudyContextChange(getStudyCardContext());
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
            state.studyQueue = buildStudyQueue(set, state.studyScope.cardIndexes);
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

    const currentPosition = Math.max(state.studyScope.cardIndexes.length - state.studyQueue.length, 0);

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
