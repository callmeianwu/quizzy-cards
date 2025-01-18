 class Card {
    constructor(question, answer) {
        this.question = question;
        this.answer = answer;
        this.level = 0;
        this.nextReview = new Date();
        this.attempts = 0;
        this.mastered = false;
    }
}