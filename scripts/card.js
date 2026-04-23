class Card {
    constructor(question, answer) {
        this.id = createCardId();
        this.question = question;
        this.answer = answer;
        this.level = 0;
        this.nextReview = new Date();
        this.attempts = 0;
        this.mastered = false;
        this.aiHelpHistory = [];
        this.difficultyScore = 0;
        this.timesSeen = 0;
        this.lastSeenIndex = -1;
        this.hardCount = 0;
        this.easyCount = 0;
        this.needsEasyConfirmation = false;
        this.cachedDistractors = [];
        this.cachedCloze = "";
        this.aiSupport = null;
        this.contentHash = createCardContentHash(question, answer);
        this.aiCache = {
            version: 1,
            contentHash: this.contentHash,
            distractors: [],
            cloze: "",
            adaptiveHelp: null
        };
    }
}

function createCardId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `card-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createCardContentHash(question, answer) {
    return [question, answer]
        .map((value) => String(value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " "))
        .join("::");
}
