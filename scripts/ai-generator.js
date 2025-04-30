// API Key handling
function saveApiKey() {
    // Get key from either old input or new modern input
    const apiKey = document.getElementById('aiApiKey')?.value?.trim() || 
                  document.getElementById('apiKey')?.value?.trim();
                  
    if (apiKey) {
        localStorage.setItem('openai_api_key', apiKey);
        
        // Show success indicator on whichever button was clicked
        const saveButton = document.activeElement || document.querySelector('.save-key-btn') || document.querySelector('.ai-btn');
        const originalText = saveButton.innerHTML;
        saveButton.innerHTML = '<i class="fas fa-check"></i> Saved!';
        
        // If it's the modern button, use its original style
        if (saveButton.classList.contains('ai-btn')) {
            saveButton.style.background = 'linear-gradient(135deg, #48bb78, #38a169)';
        } else {
            saveButton.style.background = 'linear-gradient(135deg, #38b2ac, #4fd1c5)';
        }
        
        setTimeout(() => {
            saveButton.innerHTML = originalText;
            if (saveButton.classList.contains('ai-btn')) {
                saveButton.style.background = 'linear-gradient(135deg, #6e8efb, #a777e3)';
            } else {
                saveButton.style.background = 'linear-gradient(135deg, #38b2ac, #4fd1c5)';
            }
        }, 2000);
        
        // Mask both inputs if they exist
        if (document.getElementById('apiKey')) document.getElementById('apiKey').value = '••••••••';
        if (document.getElementById('aiApiKey')) document.getElementById('aiApiKey').value = '••••••••';
    } else {
        alert('Please enter a valid API key');
    }
}

// Toggle AI section visibility (keep for backward compatibility)
document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggleAiSection');
    const aiSection = document.getElementById('aiSection');
    
    if (toggleButton && aiSection) {
        toggleButton.addEventListener('click', function() {
            aiSection.classList.toggle('active');
            
            if (aiSection.classList.contains('active')) {
                aiSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }
    
    // Set up count button functionality
    const countButtons = document.querySelectorAll('.count-btn, .ai-count-btn');
    countButtons.forEach(button => {
        button.addEventListener('click', function() {
            const group = this.classList.contains('count-btn') ? '.count-btn' : '.ai-count-btn';
            document.querySelectorAll(group).forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Load API key on page load
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) {
        if (document.getElementById('apiKey')) document.getElementById('apiKey').value = '••••••••';
        if (document.getElementById('aiApiKey')) document.getElementById('aiApiKey').value = '••••••••';
    }
});

// Generate cards with AI
async function generateCardsWithAI() {
    const apiKey = localStorage.getItem('openai_api_key');
    if (!apiKey) {
        alert('Please save your OpenAI API key first');
        return;
    }
    
    // Check both old and new UI elements for values
    const title = document.getElementById('aiSetTitle')?.value?.trim();
    const prompt = document.getElementById('aiPrompt')?.value?.trim();
    
    if (!title) {
        alert('Please enter a title for your flashcard set');
        return;
    }
    
    if (!prompt) {
        alert('Please describe what you want to study');
        return;
    }
    
    // Get card count from selected button - check both UIs
    let cardCount = 10; // default
    const oldActiveBtn = document.querySelector('.count-btn.active');
    const newActiveBtn = document.querySelector('.ai-count-btn.active');
    
    if (newActiveBtn) {
        cardCount = parseInt(newActiveBtn.dataset.count);
    } else if (oldActiveBtn) {
        cardCount = parseInt(oldActiveBtn.dataset.count);
    }
    
    // Show loading state in modern UI if available
    const modernProgress = document.getElementById('aiProgress');
    const modernSuccess = document.getElementById('aiSuccess');
    const oldSpinner = document.getElementById('loadingSpinner');
    
    if (modernProgress) modernProgress.style.display = 'block';
    if (modernSuccess) modernSuccess.style.display = 'none';
    if (oldSpinner) oldSpinner.style.display = 'flex';
    
    try {
        const cards = await fetchFlashcardsFromAI(apiKey, prompt, cardCount);
        if (cards.length > 0) {
            createCardSetFromAI(title, cards);
            
            // Clear inputs in both UIs
            if (document.getElementById('aiSetTitle')) document.getElementById('aiSetTitle').value = '';
            if (document.getElementById('aiPrompt')) document.getElementById('aiPrompt').value = '';
            
            // Show success in modern UI
            if (modernProgress && modernSuccess) {
                modernProgress.style.display = 'none';
                modernSuccess.style.display = 'flex';
                
                setTimeout(() => {
                    if (modernSuccess) modernSuccess.style.display = 'none';
                    toggleAiSection(); // Close the AI section
                    document.getElementById('your-sets').scrollIntoView({ behavior: 'smooth' });
                }, 2000);
            }
            
            // If using old UI, show success there too
            if (oldSpinner) {
                oldSpinner.innerHTML = `
                    <div style="font-size: 40px; color: #48bb78; margin-bottom: 10px;">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="generating-text">
                        Successfully generated ${cards.length} flashcards!
                    </div>
                `;
                
                setTimeout(() => {
                    if (oldSpinner) {
                        oldSpinner.style.display = 'none';
                        oldSpinner.innerHTML = `
                            <div class="generating-animation">
                                <div class="dot-flashing"></div>
                            </div>
                            <div class="generating-text">AI is creating your perfect study cards...</div>
                        `;
                    }
                    
                    // Close old AI section if it exists
                    const oldAiSection = document.querySelector('.ai-generation-section');
                    if (oldAiSection && oldAiSection.classList.contains('active')) {
                        oldAiSection.classList.remove('active');
                    }
                    
                    document.getElementById('your-sets').scrollIntoView({ behavior: 'smooth' });
                }, 2000);
            }
        } else {
            alert('Failed to generate cards. Please try a different prompt.');
            if (modernProgress) modernProgress.style.display = 'none';
            if (oldSpinner) oldSpinner.style.display = 'none';
        }
    } catch (error) {
        console.error('Error generating cards:', error);
        alert('Error generating cards: ' + error.message);
        if (modernProgress) modernProgress.style.display = 'none';
        if (oldSpinner) oldSpinner.style.display = 'none';
    }
}

async function fetchFlashcardsFromAI(apiKey, prompt, cardCount) {
    const systemPrompt = `You are a helpful assistant that creates flashcards for studying. 
    Generate exactly ${cardCount} flashcards in the exact format shown below, with each card having a question and answer:
    
    Q: [Question 1]
    A: [Answer 1]
    
    Q: [Question 2]
    A: [Answer 2]
    
    Only respond with the flashcards in this exact format. Make the content accurate, educational, and useful for studying.`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    return parseCardsFromResponse(content);
}

function parseCardsFromResponse(content) {
    const cards = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].startsWith('Q:') && lines[i + 1].startsWith('A:')) {
            const question = lines[i].substring(2).trim();
            const answer = lines[i + 1].substring(2).trim();
            cards.push(new Card(question, answer));
            i++;
        }
    }
    
    return cards;
}

function createCardSetFromAI(title, cards) {
    const newSet = new CardSet(title, cards);
    cardSets.push(newSet);
    saveSets();
    updateSetList();
}
