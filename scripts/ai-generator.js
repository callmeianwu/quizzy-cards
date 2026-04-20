const AI_STORAGE_KEY = "openai_api_key";
const AI_CHAT_MODEL = "gpt-4o-mini";

const studyHelper = {
    contextKey: "",
    isLoading: false,
    isOpen: false,
    dom: {}
};

document.addEventListener("DOMContentLoaded", initializeAiGenerator);

function initializeAiGenerator() {
    const saveApiKeyBtn = document.getElementById("saveApiKeyBtn");
    const generateAiBtn = document.getElementById("generateAiBtn");
    const countButtons = Array.from(document.querySelectorAll(".ai-count-btn"));

    saveApiKeyBtn.addEventListener("click", saveApiKey);
    generateAiBtn.addEventListener("click", generateCardsWithAI);

    countButtons.forEach((button) => {
        button.addEventListener("click", () => {
            countButtons.forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
        });
    });

    initializeStudyHelper();
    updateSavedKeyStatus();
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

function saveApiKey() {
    const apiKeyInput = document.getElementById("aiApiKey");
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        setAiMessage("Enter a valid API key before saving it.", "error");
        apiKeyInput.focus();
        return;
    }

    localStorage.setItem(AI_STORAGE_KEY, apiKey);
    apiKeyInput.value = "";
    updateSavedKeyStatus();
    setAiMessage("API key saved in this browser. You are ready to generate a draft.", "success");

    if (window.QuizzyApp) {
        window.QuizzyApp.showToast("API key saved for AI drafting.", "success");
    }
}

function updateSavedKeyStatus() {
    const savedKey = localStorage.getItem(AI_STORAGE_KEY);
    const status = document.getElementById("aiKeyStatus");
    const input = document.getElementById("aiApiKey");

    if (savedKey) {
        status.textContent = "API key saved in this browser. Paste a new one anytime to replace it.";
        input.placeholder = "Saved locally in this browser";
    } else {
        status.textContent = "No API key saved in this browser yet.";
        input.placeholder = "Paste your API key";
    }

    syncStudyHelperWithContext(getCurrentStudyContext());
}

async function generateCardsWithAI() {
    const apiKey = localStorage.getItem(AI_STORAGE_KEY);
    const title = document.getElementById("setTitle").value.trim();
    const prompt = document.getElementById("aiPrompt").value.trim();
    const progress = document.getElementById("aiProgress");
    const success = document.getElementById("aiSuccess");
    const generateButton = document.getElementById("generateAiBtn");

    clearAiMessage();
    success.hidden = true;

    if (!apiKey) {
        setAiMessage("Save your OpenAI API key before generating cards.", "error");
        return;
    }

    if (!title) {
        setAiMessage("Add a set title first so your generated draft has somewhere to land.", "error");
        document.getElementById("setTitle").focus();
        return;
    }

    if (!prompt) {
        setAiMessage("Describe what you want to study before generating a draft.", "error");
        document.getElementById("aiPrompt").focus();
        return;
    }

    progress.hidden = false;
    generateButton.disabled = true;

    try {
        const selectedCountButton = document.querySelector(".ai-count-btn.active");
        const cardCount = selectedCountButton ? selectedCountButton.dataset.count : "10";
        const cards = await fetchFlashcardsFromAI(apiKey, prompt, cardCount);

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
    } finally {
        generateButton.disabled = false;
    }
}

async function askStudyHelper() {
    if (!studyHelper.dom.container || studyHelper.isLoading) {
        return;
    }

    const apiKey = localStorage.getItem(AI_STORAGE_KEY);
    const learnerQuestion = studyHelper.dom.questionInput.value.trim();
    const context = getCurrentStudyContext();

    if (!apiKey) {
        setStudyHelperStatus("Save your OpenAI API key in AI Generate to use this helper.", "warning");
        studyHelper.dom.questionInput.disabled = true;
        studyHelper.dom.askButton.disabled = true;
        return;
    }

    if (!context) {
        setStudyHelperStatus("Open a study card to ask the AI for help.", "warning");
        return;
    }

    if (!learnerQuestion) {
        setStudyHelperStatus("Type a question for this card first.", "warning");
        studyHelper.dom.questionInput.focus();
        return;
    }

    const requestContextKey = buildStudyContextKey(context);

    studyHelper.isLoading = true;
    studyHelper.dom.questionInput.disabled = true;
    studyHelper.dom.askButton.disabled = true;
    studyHelper.dom.askButton.textContent = "Thinking...";
    setStudyHelperStatus("Reading this card and preparing a quick explanation...", "info");

    try {
        const answer = await fetchStudyHelpFromAI(apiKey, learnerQuestion, context);

        if (studyHelper.contextKey !== requestContextKey) {
            return;
        }

        studyHelper.dom.response.textContent = answer;
        studyHelper.dom.response.hidden = false;
        setStudyHelperStatus(`Answer ready for card ${context.cardIndex + 1} of ${context.totalCards}.`, "success");
    } catch (error) {
        console.error("Study helper failed.", error);
        setStudyHelperStatus(`Could not get AI help: ${error.message}`, "error");
    } finally {
        studyHelper.isLoading = false;
        studyHelper.dom.askButton.textContent = "Ask AI";
        syncStudyHelperWithContext(getCurrentStudyContext());
    }
}

async function fetchFlashcardsFromAI(apiKey, prompt, cardCount) {
    const countInstruction = cardCount === "auto"
        ? "Generate the number of flashcards that best fits the topic."
        : `Generate exactly ${cardCount} flashcards.`;

    const content = await requestChatCompletion(apiKey, [
        {
            role: "system",
            content: [
                "You create accurate study flashcards.",
                countInstruction,
                "Return only flashcards in this exact format:",
                "Q: [Question]",
                "A: [Answer]"
            ].join("\n")
        },
        {
            role: "user",
            content: prompt
        }
    ], 0.6);

    return parseCardsFromResponse(content);
}

async function fetchStudyHelpFromAI(apiKey, learnerQuestion, context) {
    const content = await requestChatCompletion(apiKey, [
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
                `Set title: ${context.setTitle}`,
                `Card number: ${context.cardIndex + 1} of ${context.totalCards}`,
                `Card question: ${context.question}`,
                `Card answer: ${context.answer}`,
                `Learner question: ${learnerQuestion}`
            ].join("\n")
        }
    ], 0.4);

    if (!content.trim()) {
        throw new Error("The AI response came back empty.");
    }

    return content.trim();
}

async function requestChatCompletion(apiKey, messages, temperature) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: AI_CHAT_MODEL,
            temperature,
            messages
        })
    });

    if (!response.ok) {
        let message = "The AI request failed.";

        try {
            const errorData = await response.json();
            message = errorData.error && errorData.error.message ? errorData.error.message : message;
        } catch (error) {
            console.error("Unable to parse AI error response.", error);
        }

        throw new Error(message);
    }

    const data = await response.json();
    const content = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : "";

    return typeof content === "string" ? content : "";
}

function syncStudyHelperWithContext(context) {
    if (!studyHelper.dom.container) {
        return;
    }

    const hasSavedKey = Boolean(localStorage.getItem(AI_STORAGE_KEY));
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

    if (!hasSavedKey) {
        studyHelper.dom.questionInput.disabled = true;
        studyHelper.dom.askButton.disabled = true;
        studyHelper.dom.askButton.textContent = "Ask AI";
        setStudyHelperStatus("Save your OpenAI API key in AI Generate to use this helper.", "warning");
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
