class CardSet {
    constructor(title, cards) {
        this.title = title;
        this.cards = cards;
        this.created = new Date();
        this.lastStudied = null;
    }
}

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
    masteredCards: 0,
    studyComplete: false,
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
    dom.studyHint = document.getElementById("studyHint");
    dom.studyActions = document.getElementById("studyActions");
    dom.ratingButtons = Array.from(document.querySelectorAll("[data-rating]"));
    dom.exitStudyBtn = document.getElementById("exitStudyBtn");
    dom.restartStudyBtn = document.getElementById("restartStudyBtn");
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
        getStudyCardContext
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
    set.created = rawSet.created ? new Date(rawSet.created) : new Date();
    set.lastStudied = rawSet.lastStudied ? new Date(rawSet.lastStudied) : null;
    return set;
}

function hydrateCard(rawCard) {
    const card = new Card(rawCard.question || "", rawCard.answer || "");
    card.level = Number(rawCard.level) || 0;
    card.attempts = Number(rawCard.attempts) || 0;
    card.mastered = Boolean(rawCard.mastered);
    card.nextReview = rawCard.nextReview ? new Date(rawCard.nextReview) : new Date();
    return card;
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
            info.append(title, subhead, meta);

            const actions = document.createElement("div");
            actions.className = "set-actions";

            const studyButton = buildActionButton("Study Now", "primary-btn", "study", index);
            const exportButton = buildActionButton("Export", "action-text-btn", "export", index);
            const deleteButton = buildActionButton("Delete", "action-text-btn delete", "delete", index);

            actions.append(studyButton, exportButton, deleteButton);
            card.append(info, actions);
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
        delete dom.resumeRecentBtn.dataset.index;
        return;
    }

    dom.recentSetTitle.textContent = mostRecent.set.title;
    dom.recentSetMeta.textContent = `Studied ${formatDate(mostRecent.set.lastStudied)} • ${mostRecent.set.cards.length} cards`;
    dom.resumeRecentBtn.disabled = false;
    dom.resumeRecentBtn.dataset.index = String(mostRecent.index);
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

    if (!Number.isNaN(index)) {
        startStudySet(index);
    }
}

function exportAllSets() {
    if (state.cardSets.length === 0) {
        showToast("There are no sets to export yet.", "warning");
        return;
    }

    downloadJson(
        `flashcard-sets-${getDateStamp()}.json`,
        {
            version: "1.0",
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
            version: "1.0",
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

    clearInlineMessage(dom.importMessage);

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
        try {
            const importedData = JSON.parse(loadEvent.target.result);

            if (!validateImportedData(importedData)) {
                throw new Error("Please choose a Quizzy JSON export with valid sets.");
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
    if (!data || data.version !== "1.0" || !Array.isArray(data.sets)) {
        return false;
    }

    return data.sets.every((set) => {
        if (!set || typeof set.title !== "string" || !Array.isArray(set.cards)) {
            return false;
        }

        return set.cards.every((card) => (
            card
            && typeof card.question === "string"
            && typeof card.answer === "string"
            && card.question.trim() !== ""
            && card.answer.trim() !== ""
        ));
    });
}

function handleImportedSets(importedSets) {
    importedSets.forEach((importedSet) => {
        let title = importedSet.title;
        let duplicateCount = 1;

        while (state.cardSets.some((set) => set.title === title)) {
            title = `${importedSet.title} (${duplicateCount})`;
            duplicateCount += 1;
        }

        const cards = importedSet.cards.map((card) => {
            const hydrated = new Card(card.question, card.answer);
            hydrated.level = Number(card.level) || 0;
            hydrated.attempts = Number(card.attempts) || 0;
            hydrated.mastered = Boolean(card.mastered);
            hydrated.nextReview = card.nextReview ? new Date(card.nextReview) : new Date();
            return hydrated;
        });

        const newSet = new CardSet(title, cards);
        newSet.created = importedSet.created ? new Date(importedSet.created) : new Date();
        newSet.lastStudied = importedSet.lastStudied ? new Date(importedSet.lastStudied) : null;

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
            saveSets();
            renderDashboard();
            showToast("Set deleted.", "info");
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

function startStudySet(index) {
    const set = state.cardSets[index];

    if (!set) {
        showToast("That set could not be found.", "error");
        return;
    }

    state.currentSetIndex = index;
    state.masteredCards = 0;
    state.studyComplete = false;
    set.lastStudied = new Date();
    resetStudyProgress(set.cards);
    shuffleCards(set.cards);
    state.currentCardIndex = findNextStudyCardIndex(0);
    saveSets();
    renderDashboard();
    enterStudyMode();
    renderStudyState();
    dom.flashcard.focus();
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
    state.masteredCards = 0;
    state.studyComplete = false;
    switchPanel(returnPanel);
    renderStudyState();
}

function restartSession() {
    const set = getCurrentSet();

    if (!set) {
        return;
    }

    state.masteredCards = 0;
    state.studyComplete = false;
    resetStudyProgress(set.cards);
    shuffleCards(set.cards);
    state.currentCardIndex = findNextStudyCardIndex(0);
    saveSets();
    renderStudyState();
}

function resetStudyProgress(cards) {
    cards.forEach((card) => {
        card.level = 0;
        card.attempts = 0;
        card.mastered = false;
        card.nextReview = new Date();
    });
}

function shuffleCards(cards) {
    for (let index = cards.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [cards[index], cards[randomIndex]] = [cards[randomIndex], cards[index]];
    }
}

function getCurrentSet() {
    return state.cardSets[state.currentSetIndex] || null;
}

function findNextStudyCardIndex(startIndex) {
    const set = getCurrentSet();

    if (!set || set.cards.length === 0) {
        return -1;
    }

    const total = set.cards.length;
    const normalizedStart = ((startIndex % total) + total) % total;

    for (let offset = 0; offset < total; offset += 1) {
        const currentIndex = (normalizedStart + offset) % total;

        if (!set.cards[currentIndex].mastered) {
            return currentIndex;
        }
    }

    return -1;
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

    if (difficulty === 3) {
        currentCard.level += 1;
    } else if (difficulty === 1) {
        currentCard.level = Math.max(0, currentCard.level - 1);
    }

    const hoursUntilNextReview = Math.pow(2, Math.max(currentCard.level, 0));
    currentCard.nextReview = new Date(Date.now() + hoursUntilNextReview * 60 * 60 * 1000);

    if (currentCard.level >= 3 && !currentCard.mastered) {
        currentCard.mastered = true;
        state.masteredCards += 1;
    }

    if (state.masteredCards >= set.cards.length) {
        state.studyComplete = true;
        saveSets();
        renderStudyState();
        return;
    }

    state.currentCardIndex = findNextStudyCardIndex(state.currentCardIndex + 1);

    if (state.currentCardIndex === -1) {
        state.studyComplete = true;
    }

    saveSets();
    renderStudyState();
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
        dom.studySummary.hidden = true;
        dom.studyActions.hidden = false;
        dom.studyHint.hidden = false;
        dom.flashcard.classList.remove("flipped");
        dispatchStudyContextChange(null);
        return;
    }

    const totalCards = set.cards.length;
    const remainingCards = Math.max(totalCards - state.masteredCards, 0);
    const progressRatio = totalCards === 0 ? 0 : state.masteredCards / totalCards;

    dom.studySetTitle.textContent = set.title;
    dom.remainingCount.textContent = String(remainingCards);
    dom.studyProgressFill.style.width = `${progressRatio * 100}%`;

    if (state.studyComplete) {
        dom.studyProgressLabel.textContent = "Session complete";
        dom.cardQuestion.textContent = "Nice work.";
        dom.cardAnswer.textContent = "Take another pass or head back to your library.";
        dom.flashcard.classList.remove("flipped");
        dom.studyHint.hidden = true;
        dom.studyActions.hidden = true;
        dom.studySummary.hidden = false;
        dom.studySummaryText.textContent = `You mastered ${totalCards} card${totalCards === 1 ? "" : "s"} in this round.`;
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
    dom.studyProgressLabel.textContent = `${state.masteredCards} of ${totalCards} mastered`;
    dom.flashcard.classList.remove("flipped");
    dom.studyHint.hidden = false;
    dom.studyActions.hidden = false;
    dom.studySummary.hidden = true;
    dispatchStudyContextChange(getStudyCardContext());
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

    return {
        setTitle: set.title,
        cardIndex: state.currentCardIndex,
        totalCards: set.cards.length,
        question: card.question,
        answer: card.answer
    };
}

function dispatchStudyContextChange(context) {
    document.dispatchEvent(new CustomEvent("quizzy:study-card-change", {
        detail: context
    }));
}
