// Game State
let deck = [];
let playerHand = [];
let dealerHand = [];
let playerBalance = 1000;
let currentBet = 0;
let gameActive = false;
let gameOver = false;

// DOM Elements
const playerBalanceEl = document.getElementById('player-balance');
const currentBetEl = document.getElementById('current-bet-amount');
const playerHandEl = document.querySelector('#player-hand .cards-wrapper');
const dealerHandEl = document.querySelector('#dealer-hand .cards-wrapper');
const playerScoreEl = document.getElementById('player-score');
const dealerScoreEl = document.getElementById('dealer-score');
const messageEl = document.getElementById('game-message');
const bettingControls = document.getElementById('betting-controls');
const gameActions = document.getElementById('game-actions');
const newGameBtn = document.getElementById('new-game-btn');
const dealBtn = document.getElementById('deal-btn');
const clearBetBtn = document.getElementById('clear-bet');
const hitBtn = document.getElementById('hit-btn');
const standBtn = document.getElementById('stand-btn');
const doubleBtn = document.getElementById('double-btn');

// Card suits and values
const suits = ['♠', '♥', '♦', '♣'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Create a new deck
function createDeck() {
    deck = [];
    for (let suit of suits) {
        for (let value of values) {
            deck.push({ suit, value });
        }
    }
    return deck;
}

// Shuffle the deck using Fisher-Yates algorithm
function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// Deal a card from the deck
function dealCard() {
    if (deck.length === 0) {
        createDeck();
        shuffleDeck();
    }
    return deck.pop();
}

// Calculate hand value
function calculateHandValue(hand) {
    let value = 0;
    let aces = 0;

    for (let card of hand) {
        if (card.value === 'A') {
            aces++;
            value += 11;
        } else if (['K', 'Q', 'J'].includes(card.value)) {
            value += 10;
        } else {
            value += parseInt(card.value);
        }
    }

    // Adjust for aces if needed
    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }

    return value;
}

// Create card HTML element
function createCardElement(card, isHidden = false) {
    const cardEl = document.createElement('div');
    
    if (isHidden) {
        cardEl.className = 'card card-back';
        return cardEl;
    }

    const isRed = card.suit === '♥' || card.suit === '♦';
    cardEl.className = `card ${isRed ? 'red' : 'black'}`;
    
    cardEl.innerHTML = `
        <div class="card-top">
            <span>${card.value}</span>
            <span>${card.suit}</span>
        </div>
        <div class="card-center">${card.suit}</div>
        <div class="card-bottom">
            <span>${card.value}</span>
            <span>${card.suit}</span>
        </div>
    `;
    
    return cardEl;
}

// Render hands with animation delay
async function renderHands(revealDealer = false) {
    playerHandEl.innerHTML = '';
    dealerHandEl.innerHTML = '';

    // Render player's hand
    for (let i = 0; i < playerHand.length; i++) {
        await sleep(200);
        const cardEl = createCardElement(playerHand[i]);
        playerHandEl.appendChild(cardEl);
    }

    // Render dealer's hand
    for (let i = 0; i < dealerHand.length; i++) {
        await sleep(200);
        if (i === 1 && !revealDealer) {
            const cardEl = createCardElement(dealerHand[i], true);
            cardEl.id = 'hidden-card';
            dealerHandEl.appendChild(cardEl);
        } else {
            const cardEl = createCardElement(dealerHand[i]);
            dealerHandEl.appendChild(cardEl);
        }
    }

    updateScores(revealDealer);
}

// Update score displays
function updateScores(revealDealer = false) {
    const playerScore = calculateHandValue(playerHand);
    playerScoreEl.textContent = playerScore;

    if (revealDealer) {
        const dealerScore = calculateHandValue(dealerHand);
        dealerScoreEl.textContent = dealerScore;
    } else {
        // Only show value of first card
        const firstCardValue = getCardValue(dealerHand[0]);
        dealerScoreEl.textContent = firstCardValue;
    }
}

// Get value of a single card
function getCardValue(card) {
    if (card.value === 'A') {
        return '1/11';
    } else if (['K', 'Q', 'J'].includes(card.value)) {
        return '10';
    }
    return card.value;
}

// Sleep function for animations
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Chip betting system
document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
        if (gameActive) return;
        
        const betValue = parseInt(chip.dataset.value);
        if (playerBalance >= betValue) {
            playerBalance -= betValue;
            currentBet += betValue;
            updateBalanceDisplay();
            dealBtn.disabled = false;
        }
    });
});

// Clear bet
clearBetBtn.addEventListener('click', () => {
    if (gameActive) return;
    
    playerBalance += currentBet;
    currentBet = 0;
    updateBalanceDisplay();
    dealBtn.disabled = true;
});

// Update balance display
function updateBalanceDisplay() {
    playerBalanceEl.textContent = playerBalance;
    currentBetEl.textContent = currentBet;
}

// Deal button
dealBtn.addEventListener('click', async () => {
    if (currentBet === 0 || gameActive) return;
    
    gameActive = true;
    gameOver = false;
    bettingControls.style.display = 'none';
    gameActions.style.display = 'flex';
    newGameBtn.style.display = 'none';
    messageEl.textContent = '';
    messageEl.className = 'message-area';
    
    // Create and shuffle deck
    createDeck();
    shuffleDeck();
    
    // Clear hands
    playerHand = [];
    dealerHand = [];
    
    // Deal initial cards with animation
    await sleep(500);
    
    // Player's first card
    playerHand.push(dealCard());
    await renderHands(false);
    
    await sleep(300);
    
    // Dealer's first card
    dealerHand.push(dealCard());
    await renderHands(false);
    
    await sleep(300);
    
    // Player's second card
    playerHand.push(dealCard());
    await renderHands(false);
    
    await sleep(300);
    
    // Dealer's second card (hidden)
    dealerHand.push(dealCard());
    await renderHands(false);
    
    // Check for blackjack
    const playerScore = calculateHandValue(playerHand);
    if (playerScore === 21) {
        handleBlackjack();
    }
    
    // Disable double down if not enough chips
    if (playerBalance < currentBet) {
        doubleBtn.disabled = true;
    } else {
        doubleBtn.disabled = false;
    }
});

// Handle player blackjack
async function handleBlackjack() {
    await revealDealerCard();
    const dealerScore = calculateHandValue(dealerHand);
    
    if (dealerScore === 21) {
        // Push
        messageEl.textContent = "Both have Blackjack! Push!";
        messageEl.className = 'message-area push';
        playerBalance += currentBet;
    } else {
        // Player wins with blackjack (3:2 payout)
        messageEl.textContent = "Blackjack! You win!";
        messageEl.className = 'message-area win';
        playerBalance += currentBet + Math.floor(currentBet * 1.5);
    }
    
    endGame();
}

// Hit button
hitBtn.addEventListener('click', async () => {
    if (!gameActive || gameOver) return;
    
    doubleBtn.disabled = true;
    
    playerHand.push(dealCard());
    await renderHands(false);
    
    const playerScore = calculateHandValue(playerHand);
    
    if (playerScore > 21) {
        await revealDealerCard();
        messageEl.textContent = "Bust! You lose!";
        messageEl.className = 'message-area lose';
        endGame();
    } else if (playerScore === 21) {
        await stand();
    }
});

// Stand button
standBtn.addEventListener('click', stand);

async function stand() {
    if (!gameActive || gameOver) return;
    
    hitBtn.disabled = true;
    standBtn.disabled = true;
    doubleBtn.disabled = true;
    
    await revealDealerCard();
    
    // Dealer draws until 17 or higher
    let dealerScore = calculateHandValue(dealerHand);
    while (dealerScore < 17) {
        await sleep(500);
        dealerHand.push(dealCard());
        await renderHands(true);
        dealerScore = calculateHandValue(dealerHand);
    }
    
    determineWinner();
}

// Double down button
doubleBtn.addEventListener('click', async () => {
    if (!gameActive || gameOver || playerBalance < currentBet) return;
    
    // Double the bet
    playerBalance -= currentBet;
    currentBet *= 2;
    updateBalanceDisplay();
    
    // Deal one card and stand
    playerHand.push(dealCard());
    await renderHands(false);
    
    const playerScore = calculateHandValue(playerHand);
    
    if (playerScore > 21) {
        await revealDealerCard();
        messageEl.textContent = "Bust! You lose!";
        messageEl.className = 'message-area lose';
        endGame();
    } else {
        await stand();
    }
});

// Reveal dealer's hidden card
async function revealDealerCard() {
    const hiddenCardEl = document.getElementById('hidden-card');
    if (hiddenCardEl) {
        hiddenCardEl.remove();
    }
    await renderHands(true);
}

// Determine winner
function determineWinner() {
    const playerScore = calculateHandValue(playerHand);
    const dealerScore = calculateHandValue(dealerHand);
    
    if (dealerScore > 21) {
        messageEl.textContent = "Dealer busts! You win!";
        messageEl.className = 'message-area win';
        playerBalance += currentBet * 2;
    } else if (playerScore > dealerScore) {
        messageEl.textContent = "You win!";
        messageEl.className = 'message-area win';
        playerBalance += currentBet * 2;
    } else if (playerScore < dealerScore) {
        messageEl.textContent = "Dealer wins!";
        messageEl.className = 'message-area lose';
    } else {
        messageEl.textContent = "Push! It's a tie!";
        messageEl.className = 'message-area push';
        playerBalance += currentBet;
    }
    
    endGame();
}

// End game
function endGame() {
    gameActive = false;
    gameOver = true;
    currentBet = 0;
    updateBalanceDisplay();
    newGameBtn.style.display = 'block';
    gameActions.style.display = 'none';
    
    // Check if player is out of money
    if (playerBalance <= 0) {
        messageEl.textContent = "Game Over! Out of chips!";
        messageEl.className = 'message-area lose';
        newGameBtn.textContent = "Reset Game";
        newGameBtn.onclick = resetGame;
    } else {
        newGameBtn.textContent = "New Game";
        newGameBtn.onclick = startNewGame;
    }
}

// Start new game
function startNewGame() {
    playerHand = [];
    dealerHand = [];
    playerHandEl.innerHTML = '';
    dealerHandEl.innerHTML = '';
    playerScoreEl.textContent = '';
    dealerScoreEl.textContent = '';
    messageEl.textContent = 'Place your bet to start!';
    messageEl.className = 'message-area';
    bettingControls.style.display = 'block';
    gameActions.style.display = 'none';
    newGameBtn.style.display = 'none';
    dealBtn.disabled = true;
    hitBtn.disabled = false;
    standBtn.disabled = false;
    doubleBtn.disabled = false;
    currentBet = 0;
    updateBalanceDisplay();
}

// Reset game (when player runs out of money)
function resetGame() {
    playerBalance = 1000;
    startNewGame();
}

// Initialize
updateBalanceDisplay();
