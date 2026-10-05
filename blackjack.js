// ===== Game State =====
let deck = [];
let playerHand = [];
let dealerHand = [];
let playerBalance = 1000;
let currentBet = 0;
let gameActive = false;
let gameOver = false;
let isAnimating = false;
let hiddenCardEl = null;

// ===== DOM Elements =====
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
const shoeEl = document.getElementById('shoe');

const suits = ['♠', '♥', '♦', '♣'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// ===== SOUND ENGINE (Web Audio API, no files needed) =====
let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

document.addEventListener('click', () => getAudioCtx(), { once: true });

// Card slide "swish" on every deal
function playSwish() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const dur = 0.18;
    const size = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
        const t = i / size;
        data[i] = (Math.random() * 2 - 1) * Math.pow(t, 0.6) * (1 - t) * 2.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400 + Math.random() * 800;
    bp.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    src.connect(bp).connect(gain).connect(ctx.destination);
    src.start();
}

// Chip clink when placing bets
function playClink() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [2400, 3300, 4700].forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f + Math.random() * 200;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.12 / (i + 1), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.012);
        osc.stop(now + 0.12);
    });
}

function playTone(freq, start, dur, type, vol) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
}

function playWinSound()       { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => playTone(f, i * 0.12, 0.35, 'triangle', 0.2)); }
function playLoseSound()      { [392, 329.63, 261.63].forEach((f, i) => playTone(f, i * 0.18, 0.4, 'sawtooth', 0.08)); }
function playPushSound()      { [440, 440].forEach((f, i) => playTone(f, i * 0.22, 0.25, 'sine', 0.15)); }
function playBlackjackSound() { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => playTone(f, i * 0.09, 0.4, 'square', 0.08)); }

// ===== DECK LOGIC =====
function createDeck() {
    deck = [];
    for (const suit of suits) {
        for (const value of values) {
            deck.push({ suit, value });
        }
    }
    return deck;
}

function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function dealCard() {
    if (deck.length < 15) {
        const fresh = createDeck();
        shuffleDeck();
        deck = deck.concat(fresh);
    }
    return deck.pop();
}

function calculateHandValue(hand) {
    let value = 0, aces = 0;
    for (const card of hand) {
        if (card.value === 'A') { aces++; value += 11; }
        else if (['K', 'Q', 'J'].includes(card.value)) value += 10;
        else value += parseInt(card.value);
    }
    while (value > 21 && aces > 0) { value -= 10; aces--; }
    return value;
}

function getCardValue(card) {
    if (card.value === 'A') return '1/11';
    if (['K', 'Q', 'J'].includes(card.value)) return '10';
    return card.value;
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ===== CARD ELEMENTS & ANIMATIONS =====
function cardFaceHTML(card) {
    const isFace = ['J', 'Q', 'K'].includes(card.value);
    return '<div class="card-top"><span>' + card.value + '</span><span>' + card.suit + '</span></div>' +
           '<div class="card-center">' + (isFace ? card.value + card.suit : card.suit) + '</div>' +
           '<div class="card-bottom"><span>' + card.value + '</span><span>' + card.suit + '</span></div>';
}

// Start position = the shoe, computed relative to each card's final slot
function getShoeStartTransform(targetEl) {
    if (!shoeEl || !targetEl) return 'translate(-40vw, -30vh)';
    const s = shoeEl.getBoundingClientRect();
    const t = targetEl.getBoundingClientRect();
    const dx = (s.left + s.width / 2) - (t.left + t.width / 2);
    const dy = (s.top + s.height / 2) - (t.top + t.height / 2);
    return 'translate(' + dx + 'px, ' + dy + 'px)';
}

function createCardElement(card) {
    const el = document.createElement('div');
    const isRed = card.suit === '♥' || card.suit === '♦';
    const isFace = ['J', 'Q', 'K'].includes(card.value);
    el.className = 'card ' + (isRed ? 'red' : 'black') + (isFace ? ' face-card' : '');
    el.innerHTML = cardFaceHTML(card);
    return el;
}

function createHiddenCardElement() {
    const el = document.createElement('div');
    el.className = 'card card-back';
    return el;
}

// Fly a card from the shoe into its slot; resolves when animation ends
function animateDeal(cardEl, wrapperEl) {
    return new Promise(resolve => {
        wrapperEl.appendChild(cardEl);
        cardEl.style.setProperty('--deal-start', getShoeStartTransform(cardEl));
        cardEl.classList.add('dealing');
        playSwish();
        let finished = false;
        const done = (e) => {
            if (finished) return;
            if (e && e.target !== cardEl) return;
            finished = true;
            cardEl.removeEventListener('animationend', done);
            cardEl.classList.remove('dealing');
            cardEl.classList.add('settled');
            cardEl.style.removeProperty('--deal-start');
            resolve();
        };
        cardEl.addEventListener('animationend', done);
        setTimeout(done, 800); // safety fallback
    });
}

// Seamless 3D flip of the dealer's hole card
async function revealDealerCard() {
    if (!hiddenCardEl) return;
    const card = dealerHand[1];
    const isRed = card.suit === '♥' || card.suit === '♦';
    const isFace = ['J', 'Q', 'K'].includes(card.value);
    const el = hiddenCardEl;
    hiddenCardEl = null;

    el.classList.remove('card-back', 'dealing');
    el.style.padding = '0';
    el.innerHTML =
        '<div class="flip-inner">' +
            '<div class="card-face card-back"></div>' +
            '<div class="card-face card-front ' + (isRed ? 'red' : 'black') + (isFace ? ' face-card' : '') + '">' +
                cardFaceHTML(card) +
            '</div>' +
        '</div>';
    playSwish();
    await sleep(560);

    const revealedEl = createCardElement(card);
    revealedEl.classList.add('settled');
    el.replaceWith(revealedEl);
    updateScores(true);
}

// ===== SCORE DISPLAY =====
function updateScores(revealDealer) {
    playerScoreEl.textContent = calculateHandValue(playerHand);
    if (revealDealer) {
        dealerScoreEl.textContent = calculateHandValue(dealerHand);
    } else if (dealerHand.length > 0) {
        dealerScoreEl.textContent = getCardValue(dealerHand[0]) + ' + ?';
    } else {
        dealerScoreEl.textContent = '';
    }
}

// ===== CHIP BETTING SYSTEM (stacking on table) =====
const chipStackEl = document.createElement('div');
chipStackEl.className = 'chip-stack';
document.querySelector('.table-area').appendChild(chipStackEl);

function stackClassFor(v) {
    if (v >= 500) return 'chip-500';
    if (v >= 100) return 'chip-100';
    if (v >= 50) return 'chip-50';
    if (v >= 25) return 'chip-25';
    return 'chip-10';
}

function addChipToStack(value) {
    const ghost = document.createElement('div');
    ghost.className = 'stack-chip ' + stackClassFor(value);
    const count = chipStackEl.children.length;
    ghost.style.bottom = Math.min(count, 14) * 4 + 'px';
    ghost.innerHTML = '<span>$' + value + '</span>';
    chipStackEl.appendChild(ghost);
    playClink();
}

function clearChipStack() {
    chipStackEl.innerHTML = '';
}

function updateChipAvailability() {
    document.querySelectorAll('.chip').forEach(chip => {
        const v = parseInt(chip.dataset.value);
        chip.classList.toggle('disabled-chip', playerBalance < v);
    });
}

document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
        if (gameActive || isAnimating) return;
        const betValue = parseInt(chip.dataset.value);
        if (playerBalance >= betValue) {
            playerBalance -= betValue;
            currentBet += betValue;
            addChipToStack(betValue);
            updateBalanceDisplay();
            updateChipAvailability();
            dealBtn.disabled = false;
        }
    });
});

clearBetBtn.addEventListener('click', () => {
    if (gameActive || isAnimating) return;
    playerBalance += currentBet;
    currentBet = 0;
    clearChipStack();
    updateBalanceDisplay();
    updateChipAvailability();
    dealBtn.disabled = true;
});

function updateBalanceDisplay() {
    playerBalanceEl.textContent = playerBalance;
    currentBetEl.textContent = currentBet;
}

// ===== GAME FLOW =====
// Casino-style initial deal: Player -> Dealer -> Player -> Dealer(face-down)
dealBtn.addEventListener('click', async () => {
    if (currentBet === 0 || gameActive || isAnimating) return;

    isAnimating = true;
    gameActive = true;
    gameOver = false;
    bettingControls.style.display = 'none';
    gameActions.style.display = 'flex';
    newGameBtn.style.display = 'none';
    messageEl.textContent = '';
    messageEl.className = 'message-area';

    if (deck.length < 15) {
        createDeck();
        shuffleDeck();
    }

    playerHand = [];
    dealerHand = [];
    playerHandEl.innerHTML = '';
    dealerHandEl.innerHTML = '';
    hiddenCardEl = null;
    playerScoreEl.textContent = '';
    dealerScoreEl.textContent = '';

    await sleep(300);

    // 1. Player card 1 (face up)
    playerHand.push(dealCard());
    await animateDeal(createCardElement(playerHand[0]), playerHandEl);
    updateScores(false);

    // 2. Dealer card 1 (face up)
    dealerHand.push(dealCard());
    await animateDeal(createCardElement(dealerHand[0]), dealerHandEl);
    updateScores(false);

    // 3. Player card 2 (face up)
    playerHand.push(dealCard());
    await animateDeal(createCardElement(playerHand[1]), playerHandEl);
    updateScores(false);

    // 4. Dealer card 2 (FACE DOWN)
    dealerHand.push(dealCard());
    hiddenCardEl = createHiddenCardElement();
    await animateDeal(hiddenCardEl, dealerHandEl);
    updateScores(false);

    isAnimating = false;

    const playerScore = calculateHandValue(playerHand);
    const dealerScore = calculateHandValue(dealerHand);
    if (playerScore === 21 || dealerScore === 21) {
        hitBtn.disabled = true;
        standBtn.disabled = true;
        doubleBtn.disabled = true;
        await sleep(400);
        handleBlackjack();
    } else {
        doubleBtn.disabled = playerBalance < currentBet;
    }
});

async function handleBlackjack() {
    await revealDealerCard();
    const dealerScore = calculateHandValue(dealerHand);
    const playerBJ = calculateHandValue(playerHand) === 21;
    const dealerBJ = dealerScore === 21;

    if (playerBJ && dealerBJ) {
        messageEl.textContent = 'Both have Blackjack! Push!';
        messageEl.className = 'message-area push';
        playerBalance += currentBet;
        playPushSound();
    } else if (playerBJ) {
        messageEl.textContent = 'BLACKJACK! You win 3:2!';
        messageEl.className = 'message-area win';
        playerBalance += currentBet + Math.floor(currentBet * 1.5);
        playBlackjackSound();
    } else {
        messageEl.textContent = 'Dealer has Blackjack! You lose!';
        messageEl.className = 'message-area lose';
        playLoseSound();
    }
    endGame();
}

// Hit - append only the new card (no re-render flicker)
hitBtn.addEventListener('click', async () => {
    if (!gameActive || gameOver || isAnimating) return;
    isAnimating = true;
    doubleBtn.disabled = true;
    hitBtn.disabled = true;

    playerHand.push(dealCard());
    await animateDeal(createCardElement(playerHand[playerHand.length - 1]), playerHandEl);
    updateScores(false);

    isAnimating = false;
    const playerScore = calculateHandValue(playerHand);

    if (playerScore > 21) {
        hitBtn.disabled = true;
        standBtn.disabled = true;
        await revealDealerCard();
        messageEl.textContent = 'Bust! You lose!';
        messageEl.className = 'message-area lose';
        playLoseSound();
        endGame();
    } else if (playerScore === 21) {
        await stand();
    } else {
        hitBtn.disabled = false;
    }
});

standBtn.addEventListener('click', () => stand());

async function stand() {
    if (!gameActive || gameOver) return;
    hitBtn.disabled = true;
    standBtn.disabled = true;
    doubleBtn.disabled = true;

    await revealDealerCard();

    let dealerScore = calculateHandValue(dealerHand);
    while (dealerScore < 17) {
        await sleep(350);
        dealerHand.push(dealCard());
        await animateDeal(createCardElement(dealerHand[dealerHand.length - 1]), dealerHandEl);
        dealerScore = calculateHandValue(dealerHand);
        updateScores(true);
    }

    determineWinner();
}

doubleBtn.addEventListener('click', async () => {
    if (!gameActive || gameOver || isAnimating || playerBalance < currentBet) return;
    isAnimating = true;

    playerBalance -= currentBet;
    currentBet *= 2;
    addChipToStack(currentBet / 2);
    updateBalanceDisplay();

    playerHand.push(dealCard());
    await animateDeal(createCardElement(playerHand[playerHand.length - 1]), playerHandEl);
    updateScores(false);
    isAnimating = false;

    if (calculateHandValue(playerHand) > 21) {
        await revealDealerCard();
        messageEl.textContent = 'Bust! You lose!';
        messageEl.className = 'message-area lose';
        playLoseSound();
        endGame();
    } else {
        await stand();
    }
});

function determineWinner() {
    const playerScore = calculateHandValue(playerHand);
    const dealerScore = calculateHandValue(dealerHand);

    if (dealerScore > 21) {
        messageEl.textContent = 'Dealer busts! You win!';
        messageEl.className = 'message-area win';
        playerBalance += currentBet * 2;
        playWinSound();
    } else if (playerScore > dealerScore) {
        messageEl.textContent = 'You win!';
        messageEl.className = 'message-area win';
        playerBalance += currentBet * 2;
        playWinSound();
    } else if (playerScore < dealerScore) {
        messageEl.textContent = 'Dealer wins!';
        messageEl.className = 'message-area lose';
        playLoseSound();
    } else {
        messageEl.textContent = "Push! It's a tie!";
        messageEl.className = 'message-area push';
        playerBalance += currentBet;
        playPushSound();
    }
    endGame();
}

function endGame() {
    gameActive = false;
    gameOver = true;
    currentBet = 0;
    clearChipStack();
    updateBalanceDisplay();
    updateChipAvailability();
    newGameBtn.style.display = 'block';
    gameActions.style.display = 'none';

    if (playerBalance <= 0) {
        messageEl.textContent = 'Game Over! Out of chips!';
        messageEl.className = 'message-area lose';
        newGameBtn.textContent = 'Reset Game';
        newGameBtn.onclick = resetGame;
    } else {
        newGameBtn.textContent = 'New Game';
        newGameBtn.onclick = startNewGame;
    }
}

function startNewGame() {
    playerHand = [];
    dealerHand = [];
    hiddenCardEl = null;
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
    updateChipAvailability();
}

function resetGame() {
    playerBalance = 1000;
    startNewGame();
}

// Initialize
updateBalanceDisplay();
updateChipAvailability();
