const AI_PROXY_ENDPOINT = "/api/openai";
const CLIENT_AI_STORAGE_KEY = "quizzy_client_openai_api_key";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const AI_CHAT_MODEL = "gpt-4o-mini";
const MAX_GENERATE_PROMPT_LENGTH = 2500;
const MAX_STUDY_QUESTION_LENGTH = 600;

const studyHelper = {
    contextKey: "",
    isLoading: false,
    isOpen: false,
    dom: {}
};

const aiService = {
    serverAvailable: false,
    available: false,
    mode: "none",
    message: "Checking AI setup...",
    tone: "info"
};

document.addEventListener("DOMContentLoaded", initializeAiGenerator);

async function initializeAiGenerator() {
    const keyForm = document.getElementById("apiKeyForm");
    const clearKeyBtn = document.getElementById("clearApiKeyBtn");
    const generateAiBtn = document.getElementById("generateAiBtn");
    const countButtons = Array.from(document.querySelectorAll("[data-count]"));

    if (keyForm) {
        keyForm.addEventListener("submit", handleApiKeySubmit);
    }

    if (clearKeyBtn) {
        clearKeyBtn.addEventListener("click", clearClientApiKey);
    }

    generateAiBtn.addEventListener("click", generateCardsWithAI);

    countButtons.forEach((button) => {
        button.addEventListener("click", () => {
            countButtons.forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
        });
    });

    initializeStudyHelper();
    updateApiKeyInputState();
    await refreshAiAvailability();
}

function handleApiKeySubmit(event) {
    event.preventDefault();
    saveClientApiKey();
}

function saveClientApiKey() {
    const input = document.getElementById("aiApiKey");
    const apiKey = input.value.trim();

    if (!apiKey) {
        setAiMessage("Paste your OpenAI API key first.", "error");
        input.focus();
        return;
    }

    sessionStorage.setItem(CLIENT_AI_STORAGE_KEY, apiKey);
    input.value = "";
    setAiMessage("Your key is ready to use in this tab.", "success");
    updateApiKeyInputState();
    refreshAiAvailability();
}

function clearClientApiKey() {
    sessionStorage.removeItem(CLIENT_AI_STORAGE_KEY);
    updateApiKeyInputState();
    setAiMessage("Your key was removed from this tab.", "info");
    refreshAiAvailability();
}

function updateApiKeyInputState() {
    const input = document.getElementById("aiApiKey");
    const clearButton = document.getElementById("clearApiKeyBtn");
    const helpText = document.getElementById("aiKeyHelp");
    const hasClientKey = Boolean(getClientApiKey());

    if (input) {
        input.placeholder = hasClientKey
            ? "A tab-only key is active"
            : "Paste your own OpenAI API key";
    }

    if (clearButton) {
        clearButton.disabled = !hasClientKey;
    }

    if (helpText) {
        helpText.textContent = hasClientKey
            ? "Your key is only saved in this tab."
            : "Optional: use your own key in this tab only. It disappears when you close the tab.";
    }
}

async function generateCardsWithAI() {
    const title = document.getElementById("setTitle").value.trim();
    const prompt = document.getElementById("aiPrompt").value.trim();
    const progress = document.getElementById("aiProgress");
    const success = document.getElementById("aiSuccess");
    const generateButton = document.getElementById("generateAiBtn");

    clearAiMessage();
    success.hidden = true;

    if (!title) {
        setAiMessage("Add a set title first so your generated draft has somewhere to land.", "error");
        document.getElementById("setTitle").focus();
        return;
    }

    if (title.length > 120) {
        setAiMessage("Keep the set title under 120 characters.", "error");
        document.getElementById("setTitle").focus();
        return;
    }

    if (!prompt) {
        setAiMessage("Describe what you want to study before generating a draft.", "error");
        document.getElementById("aiPrompt").focus();
        return;
    }

    if (prompt.length > MAX_GENERATE_PROMPT_LENGTH) {
        setAiMessage(`Keep the study topic under ${MAX_GENERATE_PROMPT_LENGTH} characters.`, "error");
        document.getElementById("aiPrompt").focus();
        return;
    }

    if (!(await ensureAiServiceAvailable())) {
        setAiMessage(aiService.message, aiService.tone === "success" ? "info" : aiService.tone);
        return;
    }

    progress.hidden = false;
    generateButton.disabled = true;

    try {
        const selectedCountButton = document.querySelector("[data-count].active");
        const cardCount = selectedCountButton ? selectedCountButton.dataset.count : "10";
        const cards = await fetchFlashcardsFromAI(prompt, cardCount);

        if (!cards.length) {
            throw new Error("The AI response did not contain any usable cards.");
        }

        if (window.QuizzyApp) {
            window.QuizzyApp.populateGeneratedDraft(title, cards);
            window.QuizzyApp.showToast("AI draft added to the composer.", "success");
        }

        document.getElementById("aiPrompt").value = "";
        progress.hidden = true;
        success.hidden = false;
    } catch (error) {
        console.error("AI generation failed.", error);
        progress.hidden = true;
        setAiMessage(`Could not generate cards: ${error.message}`, "error");
        await refreshAiAvailability();
    } finally {
        generateButton.disabled = !aiService.available;
    }
}

async function askStudyHelper() {
    if (!studyHelper.dom.container || studyHelper.isLoading) {
        return;
    }

    const learnerQuestion = studyHelper.dom.questionInput.value.trim();
    const context = getCurrentStudyContext();

    if (!context) {
        setStudyHelperStatus("Open a study card to ask the AI for help.", "warning");
        return;
    }

    if (!learnerQuestion) {
        setStudyHelperStatus("Type a question for this card first.", "warning");
        studyHelper.dom.questionInput.focus();
        return;
    }

    if (learnerQuestion.length > MAX_STUDY_QUESTION_LENGTH) {
        setStudyHelperStatus(`Keep your question under ${MAX_STUDY_QUESTION_LENGTH} characters.`, "warning");
        studyHelper.dom.questionInput.focus();
        return;
    }

    if (!(await ensureAiServiceAvailable())) {
        setStudyHelperStatus(aiService.message, aiService.tone === "success" ? "info" : aiService.tone);
        return;
    }

    const requestContextKey = buildStudyContextKey(context);

    studyHelper.isLoading = true;
    studyHelper.dom.questionInput.disabled = true;
    studyHelper.dom.askButton.disabled = true;
    studyHelper.dom.askButton.textContent = "Thinking...";
    setStudyHelperStatus("Reading this card and preparing a quick explanation...", "info");

    try {
        const answer = await fetchStudyHelpFromAI(learnerQuestion, context);

        if (studyHelper.contextKey !== requestContextKey) {
            return;
        }

        if (window.QuizzyApp && typeof window.QuizzyApp.recordStudyAiExchange === "function") {
            window.QuizzyApp.recordStudyAiExchange({
                userQuestion: learnerQuestion,
                aiAnswer: answer
            });
        }

        studyHelper.dom.response.textContent = answer;
        studyHelper.dom.response.hidden = false;
        setStudyHelperStatus(`Answer ready for card ${context.cardIndex + 1} of ${context.totalCards}.`, "success");
    } catch (error) {
        console.error("Study helper failed.", error);
        setStudyHelperStatus(`Could not get AI help: ${error.message}`, "error");
        await refreshAiAvailability();
    } finally {
        studyHelper.isLoading = false;
        studyHelper.dom.askButton.textContent = "Ask AI";
        syncStudyHelperWithContext(getCurrentStudyContext());
    }
}

async function fetchFlashcardsFromAI(prompt, cardCount) {
    const content = await requestAi({
        mode: "generate",
        prompt,
        cardCount
    });

    return parseCardsFromResponse(content);
}

async function fetchStudyHelpFromAI(learnerQuestion, context) {
    const content = await requestAi({
        mode: "study-help",
        learnerQuestion,
        context
    });

    if (!content.trim()) {
        throw new Error("The AI response came back empty.");
    }

    return content.trim();
}

async function requestAi(payload) {
    const clientApiKey = getClientApiKey();

    if (clientApiKey && window.location.protocol === "file:") {
        return requestDirectOpenAi(clientApiKey, payload);
    }

    return requestServerOpenAi(payload, clientApiKey);
}

async function requestServerOpenAi(payload, clientApiKey = "") {
    const headers = {
        "Content-Type": "application/json"
    };

    if (clientApiKey) {
        headers["X-OpenAI-Api-Key"] = clientApiKey;
    }

    const response = await fetch(AI_PROXY_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
    });

    let data = null;

    try {
        data = await response.json();
    } catch (error) {
        data = null;
    }

    if (!response.ok) {
        const message = data && data.error ? data.error : "The AI request failed.";
        throw new Error(message);
    }

    return data && typeof data.content === "string" ? data.content : "";
}

async function requestDirectOpenAi(apiKey, payload) {
    const requestBody = buildDirectOpenAiBody(payload);
    const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    let data = null;

    try {
        data = await response.json();
    } catch (error) {
        data = null;
    }

    if (!response.ok) {
        const message = data && data.error && data.error.message
            ? data.error.message
            : "The AI request failed.";

        if (response.status === 401 || response.status === 403) {
            sessionStorage.removeItem(CLIENT_AI_STORAGE_KEY);
            updateApiKeyInputState();
        }

        throw new Error(message);
    }

    const content = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : "";

    return typeof content === "string" ? content : "";
}

function buildDirectOpenAiBody(payload) {
    if (payload.mode === "generate") {
        return {
            model: AI_CHAT_MODEL,
            temperature: 0.6,
            messages: [
                {
                    role: "system",
                    content: [
                        "You create accurate study flashcards.",
                        payload.cardCount === "auto"
                            ? "Generate the number of flashcards that best fits the topic."
                            : `Generate exactly ${payload.cardCount} flashcards.`,
                        "Return only flashcards in this exact format:",
                        "Q: [Question]",
                        "A: [Answer]"
                    ].join("\n")
                },
                {
                    role: "user",
                    content: payload.prompt
                }
            ]
        };
    }

    if (payload.mode === "study-help") {
        return {
            model: AI_CHAT_MODEL,
            temperature: 0.4,
            messages: [
                {
                    role: "system",
                    content: [
                        "You are a concise study helper inside a flashcard app.",
                        "Use the provided card question and card answer as the anchor context for every reply.",
                        "Keep the response practical and easy to study.",
                        "When useful, include one short example, analogy, or memory trick.",
                        "Do not ignore or contradict the card answer unless the user explicitly asks you to critique it."
                    ].join("\n")
                },
                {
                    role: "user",
                    content: [
                        `Set title: ${payload.context.setTitle}`,
                        `Card number: ${payload.context.cardIndex + 1} of ${payload.context.totalCards}`,
                        `Card question: ${payload.context.question}`,
                        `Card answer: ${payload.context.answer}`,
                        `Learner question: ${payload.learnerQuestion}`
                    ].join("\n")
                }
            ]
        };
    }

    throw new Error("Unsupported AI request mode.");
}

function syncStudyHelperWithContext(context) {
    if (!studyHelper.dom.container) {
        return;
    }

    const nextContextKey = context ? buildStudyContextKey(context) : "";
    const contextChanged = nextContextKey !== studyHelper.contextKey;

    studyHelper.contextKey = nextContextKey;

    if (contextChanged) {
        studyHelper.dom.questionInput.value = "";
        studyHelper.dom.response.hidden = true;
        studyHelper.dom.response.textContent = "";
    }

    if (!context) {
        studyHelper.isOpen = false;
        studyHelper.dom.questionInput.disabled = true;
        studyHelper.dom.askButton.disabled = true;
        studyHelper.dom.askButton.textContent = "Ask AI";
        setStudyHelperStatus("Finish or restart a study round to ask about another card.", "info");
        renderStudyHelperVisibility();
        return;
    }

    if (!aiService.available) {
        studyHelper.dom.questionInput.disabled = true;
        studyHelper.dom.askButton.disabled = true;
        studyHelper.dom.askButton.textContent = "Ask AI";
        setStudyHelperStatus(aiService.message, aiService.tone === "success" ? "info" : aiService.tone);
        renderStudyHelperVisibility();
        return;
    }

    if (studyHelper.isLoading) {
        renderStudyHelperVisibility();
        return;
    }

    studyHelper.dom.questionInput.disabled = false;
    studyHelper.dom.askButton.disabled = false;
    studyHelper.dom.askButton.textContent = "Ask AI";

    if (contextChanged || !studyHelper.dom.response.textContent.trim()) {
        setStudyHelperStatus(
            `Card ${context.cardIndex + 1} of ${context.totalCards} is loaded. Ask for a simpler explanation, example, or memory trick.`,
            "info"
        );
    }

    renderStudyHelperVisibility();
}

function getCurrentStudyContext() {
    if (!window.QuizzyApp || typeof window.QuizzyApp.getStudyCardContext !== "function") {
        return null;
    }

    return window.QuizzyApp.getStudyCardContext();
}

function buildStudyContextKey(context) {
    return [
        context.setTitle,
        context.cardIndex,
        context.question,
        context.answer
    ].join("::");
}

function parseCardsFromResponse(content) {
    const cards = [];
    const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    for (let index = 0; index < lines.length; index += 1) {
        const questionLine = lines[index];
        const answerLine = lines[index + 1];

        if (!questionLine.startsWith("Q:") || !answerLine || !answerLine.startsWith("A:")) {
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

function setStudyHelperStatus(message, tone = "info") {
    if (!studyHelper.dom.status) {
        return;
    }

    studyHelper.dom.status.dataset.tone = tone;
    studyHelper.dom.status.textContent = message;
}

function renderStudyHelperVisibility() {
    if (!studyHelper.dom.container || !studyHelper.dom.toggleButton) {
        return;
    }

    const hasContext = Boolean(studyHelper.contextKey);

    studyHelper.dom.toggleButton.disabled = !hasContext;
    studyHelper.dom.toggleButton.textContent = studyHelper.isOpen ? "Hide AI Helper" : "Open AI Helper";
    studyHelper.dom.toggleButton.setAttribute("aria-expanded", String(studyHelper.isOpen));
    studyHelper.dom.container.hidden = !studyHelper.isOpen;
}

async function refreshAiAvailability() {
    updateApiKeyInputState();

    const hasClientKey = Boolean(getClientApiKey());

    if (hasClientKey) {
        setAiAvailability(
            true,
            "You are using your own OpenAI key in this tab only.",
            "success",
            "client"
        );
        return true;
    }

    if (window.location.protocol === "file:") {
        setAiAvailability(
            false,
            "To use AI here, paste your own OpenAI key above.",
            "warning",
            "none"
        );
        return false;
    }

    try {
        const response = await fetch(AI_PROXY_ENDPOINT, {
            method: "GET",
            cache: "no-store"
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data && data.error ? data.error : "The AI status check failed.");
        }

        if (data && data.configured) {
            setAiAvailability(
                true,
                "AI is ready to use. You can also paste your own OpenAI key if you want.",
                "success",
                "server"
            );
            return true;
        }
    } catch (error) {
        console.error("Unable to verify server AI availability.", error);
    }

    setAiAvailability(
        false,
        "AI is not set up yet. Paste your own OpenAI key above to use it in this tab.",
        "warning",
        "none"
    );
    return false;
}

async function ensureAiServiceAvailable() {
    if (aiService.available) {
        return true;
    }

    return refreshAiAvailability();
}

function setAiAvailability(isAvailable, message, tone, mode) {
    const status = document.getElementById("aiKeyStatus");
    const generateButton = document.getElementById("generateAiBtn");

    aiService.serverAvailable = mode === "server";
    aiService.available = isAvailable;
    aiService.mode = mode;
    aiService.message = message;
    aiService.tone = tone;

    if (status) {
        status.dataset.tone = tone;
        status.textContent = message;
    }

    if (generateButton) {
        generateButton.disabled = !isAvailable;
    }

    syncStudyHelperWithContext(getCurrentStudyContext());
}

function initializeStudyHelper() {
    studyHelper.dom.container = document.getElementById("studyAiHelper");

    if (!studyHelper.dom.container) {
        return;
    }

    studyHelper.dom.status = document.getElementById("studyAiStatus");
    studyHelper.dom.questionInput = document.getElementById("studyAiQuestion");
    studyHelper.dom.askButton = document.getElementById("askStudyAiBtn");
    studyHelper.dom.response = document.getElementById("studyAiResponse");
    studyHelper.dom.toggleButton = document.getElementById("toggleStudyAiBtn");

    studyHelper.dom.toggleButton.addEventListener("click", toggleStudyHelperVisibility);
    studyHelper.dom.askButton.addEventListener("click", askStudyHelper);
    studyHelper.dom.questionInput.addEventListener("keydown", handleStudyHelperKeydown);
    document.addEventListener("quizzy:study-card-change", handleStudyContextChange);

    syncStudyHelperWithContext(getCurrentStudyContext());
}

function handleStudyHelperKeydown(event) {
    if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) {
        return;
    }

    event.preventDefault();
    askStudyHelper();
}

function handleStudyContextChange(event) {
    syncStudyHelperWithContext(event.detail || null);
}

function toggleStudyHelperVisibility() {
    const context = getCurrentStudyContext();

    if (!context) {
        return;
    }

    studyHelper.isOpen = !studyHelper.isOpen;
    renderStudyHelperVisibility();

    if (studyHelper.isOpen && !studyHelper.dom.questionInput.disabled) {
        studyHelper.dom.questionInput.focus();
    }
}

function getClientApiKey() {
    return sessionStorage.getItem(CLIENT_AI_STORAGE_KEY) || "";
}

function setAiMessage(message, tone) {
    const messageElement = document.getElementById("aiFormMessage");

    if (window.QuizzyApp) {
        window.QuizzyApp.setInlineMessage(messageElement, message, tone);
        return;
    }

    messageElement.hidden = false;
    messageElement.textContent = message;
}

function clearAiMessage() {
    const messageElement = document.getElementById("aiFormMessage");

    if (window.QuizzyApp) {
        window.QuizzyApp.clearInlineMessage(messageElement);
        return;
    }

    messageElement.hidden = true;
    messageElement.textContent = "";
}
