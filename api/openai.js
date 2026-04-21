const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";
const MAX_BODY_BYTES = 20_000;
const MAX_GENERATE_PROMPT_LENGTH = 2_500;
const MAX_STUDY_QUESTION_LENGTH = 600;
const MAX_CONTEXT_FIELD_LENGTH = 2_000;
const ALLOWED_COUNTS = new Set(["5", "10", "15", "20", "auto"]);

export default async function handler(request, response) {
    if (request.method === "GET") {
        return sendJson(response, {
            configured: Boolean(process.env.OPENAI_API_KEY)
        });
    }

    if (request.method !== "POST") {
        return sendJson(response, {
            error: "Method not allowed."
        }, 405);
    }

    if (!isAllowedOrigin(request)) {
        return sendJson(response, {
            error: "This AI endpoint only accepts same-origin browser requests."
        }, 403);
    }

    const contentLength = Number(request.headers["content-length"] || 0);

    if (contentLength > MAX_BODY_BYTES) {
        return sendJson(response, {
            error: "Request payload is too large."
        }, 413);
    }

    const apiKey = readApiKey(request);

    if (!apiKey) {
        return sendJson(response, {
            error: "AI service is not configured on the server."
        }, 503);
    }

    try {
        const payload = readJsonBody(request);
        const { mode, messages, temperature } = buildOpenAiRequest(payload);
        const content = await requestOpenAi(apiKey, messages, temperature);

        return sendJson(response, {
            mode,
            content
        });
    } catch (error) {
        const status = Number(error.statusCode) || 400;

        return sendJson(response, {
            error: error.message || "The AI request failed."
        }, status);
    }
}

function buildOpenAiRequest(payload) {
    const mode = payload && typeof payload.mode === "string" ? payload.mode : "";

    if (mode === "generate") {
        return {
            mode,
            temperature: 0.6,
            messages: buildGenerateMessages(payload)
        };
    }

    if (mode === "study-help") {
        return {
            mode,
            temperature: 0.4,
            messages: buildStudyHelpMessages(payload)
        };
    }

    if (mode === "distractors") {
        return {
            mode,
            temperature: 0.5,
            messages: buildDistractorMessages(payload)
        };
    }

    if (mode === "adaptive-help") {
        return {
            mode,
            temperature: 0.5,
            messages: buildAdaptiveHelpMessages(payload)
        };
    }

    throw createHttpError("Unsupported AI request mode.", 400);
}

function buildGenerateMessages(payload) {
    const prompt = readBoundedString(payload && payload.prompt, "Study topic", MAX_GENERATE_PROMPT_LENGTH);
    const cardCount = String(payload && payload.cardCount ? payload.cardCount : "10");

    if (!ALLOWED_COUNTS.has(cardCount)) {
        throw createHttpError("Unsupported AI draft size.", 400);
    }

    const countInstruction = cardCount === "auto"
        ? "Generate the number of flashcards that best fits the topic."
        : `Generate exactly ${cardCount} flashcards.`;

    return [
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
    ];
}

function buildStudyHelpMessages(payload) {
    const learnerQuestion = readBoundedString(
        payload && payload.learnerQuestion,
        "Learner question",
        MAX_STUDY_QUESTION_LENGTH
    );
    const context = payload && typeof payload.context === "object" ? payload.context : null;

    if (!context) {
        throw createHttpError("Study card context is required.", 400);
    }

    const setTitle = readBoundedString(context.setTitle, "Set title", 140);
    const question = readBoundedString(context.question, "Card question", MAX_CONTEXT_FIELD_LENGTH);
    const answer = readBoundedString(context.answer, "Card answer", MAX_CONTEXT_FIELD_LENGTH);
    const cardIndex = Number(context.cardIndex);
    const totalCards = Number(context.totalCards);

    if (!Number.isInteger(cardIndex) || cardIndex < 0 || !Number.isInteger(totalCards) || totalCards < 1) {
        throw createHttpError("Study card position is invalid.", 400);
    }

    return [
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
                `Set title: ${setTitle}`,
                `Card number: ${cardIndex + 1} of ${totalCards}`,
                `Card question: ${question}`,
                `Card answer: ${answer}`,
                `Learner question: ${learnerQuestion}`
            ].join("\n")
        }
    ];
}

function buildDistractorMessages(payload) {
    const card = readCardPayload(payload);

    return [
        {
            role: "system",
            content: [
                "Generate 3 incorrect but plausible answers for this flashcard.",
                "They must be the same type/category as the correct answer and commonly confused with it.",
                "Do not include jokes or unrelated items.",
                "Return only a JSON array of three short strings.",
                "Do not include the correct answer.",
                "Keep distractors concise and classroom-appropriate."
            ].join("\n")
        },
        {
            role: "user",
            content: [
                `Question: ${card.question}`,
                `Correct answer: ${card.answer}`
            ].join("\n")
        }
    ];
}

function buildAdaptiveHelpMessages(payload) {
    const card = readCardPayload(payload);

    return [
        {
            role: "system",
            content: [
                "You create concise support for a student who is struggling with a flashcard.",
                "Return only valid JSON with these string fields: explanation, mnemonic, example, alternateQuestion.",
                "Keep each field practical and brief."
            ].join("\n")
        },
        {
            role: "user",
            content: [
                `Question: ${card.question}`,
                `Correct answer: ${card.answer}`
            ].join("\n")
        }
    ];
}

function readCardPayload(payload) {
    const card = payload && typeof payload.card === "object" ? payload.card : null;

    if (!card) {
        throw createHttpError("Card context is required.", 400);
    }

    return {
        question: readBoundedString(card.question, "Card question", MAX_CONTEXT_FIELD_LENGTH),
        answer: readBoundedString(card.answer, "Card answer", MAX_CONTEXT_FIELD_LENGTH)
    };
}

async function requestOpenAi(apiKey, messages, temperature) {
    const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            temperature,
            messages
        })
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

        throw createHttpError(message, response.status);
    }

    const content = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : "";

    if (typeof content !== "string" || !content.trim()) {
        throw createHttpError("The AI response came back empty.", 502);
    }

    return content.trim();
}

function isAllowedOrigin(request) {
    const origin = request.headers.origin;

    if (!origin) {
        return false;
    }

    try {
        const originUrl = new URL(origin);
        const host = request.headers["x-forwarded-host"] || request.headers.host;
        const protocol = request.headers["x-forwarded-proto"] || "https";

        if (!host) {
            return false;
        }

        return originUrl.origin === `${protocol}://${host}`;
    } catch (error) {
        return false;
    }
}

function readApiKey(request) {
    const headerValue = request.headers["x-openai-api-key"];

    if (typeof headerValue === "string" && headerValue.trim()) {
        return headerValue.trim();
    }

    return process.env.OPENAI_API_KEY || "";
}

function readJsonBody(request) {
    if (request.body && typeof request.body === "object") {
        return request.body;
    }

    if (typeof request.body === "string") {
        try {
            return JSON.parse(request.body);
        } catch (error) {
            throw createHttpError("Request body must be valid JSON.", 400);
        }
    }

    throw createHttpError("Request body must be valid JSON.", 400);
}

function readBoundedString(value, fieldName, maxLength) {
    if (typeof value !== "string") {
        throw createHttpError(`${fieldName} must be a string.`, 400);
    }

    const normalized = value.trim();

    if (!normalized) {
        throw createHttpError(`${fieldName} is required.`, 400);
    }

    if (normalized.length > maxLength) {
        throw createHttpError(`${fieldName} is too long.`, 400);
    }

    return normalized;
}

function createHttpError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function sendJson(response, payload, status = 200) {
    response.status(status);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.send(JSON.stringify(payload));
}
