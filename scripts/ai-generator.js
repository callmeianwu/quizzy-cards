const AI_STORAGE_KEY = "openai_api_key";

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

    updateSavedKeyStatus();
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

async function fetchFlashcardsFromAI(apiKey, prompt, cardCount) {
    const countInstruction = cardCount === "auto"
        ? "Generate the number of flashcards that best fits the topic."
        : `Generate exactly ${cardCount} flashcards.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.6,
            messages: [
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
            ]
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

    return parseCardsFromResponse(content);
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
