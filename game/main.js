import { UnfairFlipEngine } from './engine.js';

const flipButton = document.getElementById('flip-btn');
const balanceDisplay = document.getElementById('balance-display');
const shopBalanceDisplay = document.getElementById('shop-balance-display');
const shopContainer = document.getElementById('shop-container');
const canvas = document.getElementById('coin-canvas');
const ctx = canvas.getContext('2d');

const mainGameView = document.getElementById('main-game-view');
const shopPageView = document.getElementById('shop-page-view');
const shopOpenBtn = document.getElementById('shop-open-btn');
const shopCloseBtn = document.getElementById('shop-close-btn');

const statsModal = document.getElementById('stats-modal');
const statsToggleBtn = document.getElementById('stats-toggle-btn');
const statsCloseBtn = document.getElementById('stats-close-btn');
const statsData = document.getElementById('stats-data');
const logStream = document.getElementById('log-stream');
const streakBanner = document.getElementById('streak-banner');

let game;
let isFlipping = false;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function play8BitSound(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type === 'error' ? 'sawtooth' : 'square';
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'jump') {
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.08);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'land-win') {
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.setValueAtTime(900, now + 0.06);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  } else if (type === 'land-lose') {
    osc.frequency.setValueAtTime(120, now);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'buy') {
    osc.frequency.setValueAtTime(1000, now);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.04);
    osc.start(now);
    osc.stop(now + 0.04);
  } else if (type === 'error') {
    osc.frequency.setValueAtTime(90, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  } else if (type === 'victory') {
    osc.frequency.setValueAtTime(523, now);
    osc.frequency.setValueAtTime(659, now + 0.1);
    osc.frequency.setValueAtTime(784, now + 0.2);
    osc.frequency.setValueAtTime(1046, now + 0.3);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  }
}

function triggerCoinFlip() {
  if (isFlipping) return;
  if (document.body.classList.contains("hidden")) document.body.classList.remove("hidden");

  play8BitSound('jump');
  const result = game.flip();

  let flipSpeedMs = 1800;
  const speedLevel = game.playerState.upgrades.autoFlipperLevel;
  if (speedLevel > 0) {
    flipSpeedMs = Math.max(300, 1800 - (speedLevel * 150));
  }

  playFlipAnimation(result, flipSpeedMs, () => {
    pushLog(result.isHeads ? 'HEADS' : 'TAILS');
    updateUI();
    flipButton.disabled = false;

    if (result.isHeads) {
      play8BitSound('land-win');
    } else {
      play8BitSound('land-lose');
    }

    if (result.gameWon) {
      play8BitSound('victory');
      alert('MAXIMUM WIN STREAK! YOU BEAT THE MACHINE!');
    }
  });
}

async function initGame() {
  try {
    const response = await fetch('./game/data.json');
    const gameData = await response.json();

    game = new UnfairFlipEngine(gameData.gameConfig);

    window.cmd = function (commandString) {
      if (!commandString) return "NO COMMAND";
      const args = commandString.trim().split(" ");
      const base = args[0];
      if (base === "/coin") {
        const action = args[1];
        const value = parseFloat(args[2]);
        if (action === "give") {
          game.playerState.balance += value;
          updateUI();
          return "BALANCE UPDATED BY " + value;
        }
        if (action === "worth") {
          const tiers = game.config.upgrades.coinWorth.tiers;
          const currentLevel = game.playerState.upgrades.coinWorthLevel;
          const currentTierIndex = Math.min(currentLevel - 1, tiers.length - 1);
          tiers[currentTierIndex].worth = value;
          updateUI();
          return "COIN WORTH SET TO " + value;
        }
        if (action === "streak") {
          game.playerState.streak = parseInt(value);
          updateUI();
          return "STREAK SET TO " + value;
        }
      }
      return "INVALID COMMAND";
    };

    buildShopUI(gameData.gameConfig.upgrades);
    updateUI();

    shopOpenBtn.addEventListener('click', () => {
      mainGameView.style.display = 'none';
      shopPageView.classList.remove('page-hidden');
      updateUI();
    });

    shopCloseBtn.addEventListener('click', () => {
      shopPageView.classList.add('page-hidden');
      mainGameView.style.display = 'flex';
      updateUI();
    });

    statsToggleBtn.addEventListener('click', () => {
      renderStats();
      statsModal.classList.remove('modal-hidden');
    });

    statsCloseBtn.addEventListener('click', () => {
      statsModal.classList.add('modal-hidden');
    });

    // Click listener
    flipButton.addEventListener('click', triggerCoinFlip);

    // Keyboard listener for Spacebar
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        // Prevent default browser actions (like scrolling down the page)
        e.preventDefault();

        // Only allow flipping if the shop UI and stats UI are closed
        const isShopOpen = !shopPageView.classList.contains('page-hidden');
        const isStatsOpen = !statsModal.classList.contains('modal-hidden');

        if (!isShopOpen && !isStatsOpen) {
          triggerCoinFlip();
        }
      }
    });

  } catch (error) {
    console.error("Failed to load JSON data:", error);
  }
}

function pushLog(text) {
  const item = document.createElement('div');
  item.className = 'log-item';
  item.innerText = text;
  if (text === 'HEADS') {
    item.style.color = '#FFF';
  } else {
    item.style.color = '#444';
  }
  logStream.appendChild(item);
  if (logStream.children.length > 18) {
    logStream.removeChild(logStream.firstChild);
  }
}

function renderStats() {
  const chance = (game.getCurrentHeadChance() * 100).toFixed(1);
  const worth = game.getCurrentCoinWorth();
  const b2bLevel = game.playerState.upgrades.b2bBonusLevel;
  statsData.innerHTML = `
    TOTAL FLIPS: ${game.playerState.totalFlips}<br>
    HEADS TOTAL: ${game.playerState.headsFlipped}<br>
    CURRENT STREAK: ${game.playerState.streak}<br>
    MAX STREAK: ${game.playerState.maxStreak} / 20<br>
    HEAD CHANCE: ${chance}%<br>
    COIN VALUE: $${worth.toFixed(2)}<br>
    B2B LEVEL: ${b2bLevel}
  `;
}

function buildShopUI(upgrades) {
  shopContainer.innerHTML = '';

  for (const key in upgrades) {
    const upgrade = upgrades[key];

    const itemDiv = document.createElement('div');
    itemDiv.className = 'shop-item';

    const title = document.createElement('h3');
    title.innerText = upgrade.name;

    const buyBtn = document.createElement('button');
    buyBtn.id = `buy-${upgrade.id}`;

    const tooltipDiv = document.createElement('div');
    tooltipDiv.id = `tooltip-${upgrade.id}`;
    tooltipDiv.className = 'retro-tooltip';

    const handleFlip = () => {
      if (game.buyUpgrade(upgrade.id)) {
        play8BitSound('buy');
        updateUI();
      } else {
        play8BitSound('error');
      }
    }

    buyBtn.addEventListener('click', handleFlip);

    itemDiv.addEventListener('mousemove', (e) => {
      const rect = itemDiv.getBoundingClientRect();
      const x = e.clientX - rect.left;
      tooltipDiv.style.left = (x + 10) + 'px';
    });

    itemDiv.appendChild(title);
    itemDiv.appendChild(buyBtn);
    itemDiv.appendChild(tooltipDiv);
    shopContainer.appendChild(itemDiv);
  }
}

function updateUI() {
  balanceDisplay.innerText = `$${game.playerState.balance.toFixed(2)}`;
  shopBalanceDisplay.innerText = `$${game.playerState.balance.toFixed(2)}`;
  streakBanner.innerText = `STREAK: ${game.playerState.streak} / 20`;

  const coinLevel = game.playerState.upgrades.coinWorthLevel;
  const tiers = game.config.upgrades.coinWorth.tiers;
  const currentCoinName = tiers[Math.min(coinLevel - 1, tiers.length - 1)].name;
  flipButton.innerText = `FLIP ${currentCoinName.toUpperCase()}!`;

  const upgrades = game.config.upgrades;
  for (const key in upgrades) {
    const upgrade = upgrades[key];
    const btn = document.getElementById(`buy-${upgrade.id}`);
    const tooltip = document.getElementById(`tooltip-${upgrade.id}`);

    if (btn && tooltip) {
      const currentPrice = game.getUpgradePrice(upgrade.id);
      let tooltipText = "";

      if (upgrade.id === 'coinWorth') {
        const currentWorth = game.getCurrentCoinWorth();
        tooltipText = `UPGRADE COIN VALUE\nCURRENT: ${currentCoinName} ($${currentWorth.toFixed(2)})`;

        if (coinLevel < upgrade.tiers.length) {
          btn.innerText = `GET ${upgrade.tiers[coinLevel].name.toUpperCase()} ($${currentPrice.toFixed(2)})`;
          btn.disabled = game.playerState.balance < currentPrice;
        } else {
          btn.innerText = `MAX TIER`;
          btn.disabled = true;
        }
      } else if (upgrade.id === 'headChance') {
        const currentChance = (game.getCurrentHeadChance() * 100).toFixed(0);
        tooltipText = `UPGRADE WEIGHTS\nCURRENT HEAD CHANCE: ${currentChance}%`;
        btn.innerText = `BUY ($${currentPrice.toFixed(2)})`;
        btn.disabled = game.playerState.balance < currentPrice;
      } else if (upgrade.id === 'autoFlipper') {
        const currentLevel = game.playerState.upgrades.autoFlipperLevel;
        tooltipText = `UPGRADE SPEED CONTROLS\nCURRENT LEVEL: ${currentLevel}`;
        btn.innerText = `BUY ($${currentPrice.toFixed(2)})`;
        btn.disabled = game.playerState.balance < currentPrice;
      } else if (upgrade.id === 'b2bBonus') {
        const currentLevel = game.playerState.upgrades.b2bBonusLevel;
        const rate = (upgrade.multiplierPerLevel * 100).toFixed(0);
        tooltipText = `B2B STREAK MULTIPLIER\nCURRENT LEVEL: ${currentLevel}\n+${rate}% BONUS PER STREAK VALUE`;
        btn.innerText = `BUY ($${currentPrice.toFixed(2)})`;
        btn.disabled = game.playerState.balance < currentPrice;
      }

      tooltip.innerText = tooltipText;
    }
  }
}

function drawCoin(scaleY, isHeads, offsetY = 0, progress = 0) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const heightFactor = Math.sin(progress * Math.PI);
  const shadowWidth = Math.floor(50 - (heightFactor * 25));
  const shadowHeight = Math.floor(8 - (heightFactor * 4));

  ctx.fillStyle = '#333';
  ctx.fillRect(centerX - shadowWidth / 2, centerY + 50, shadowWidth, shadowHeight);

  ctx.save();
  ctx.translate(centerX, centerY + offsetY);
  ctx.scale(1, scaleY);

  if (Math.abs(scaleY) < 0.8) {
    ctx.fillStyle = '#555';
    ctx.fillRect(-30, -30, 60, 80);
    ctx.fillRect(-40, -20, 80, 60);
  }

  ctx.fillStyle = '#FFF';
  ctx.fillRect(-30, -40, 60, 80);
  ctx.fillRect(-40, -30, 80, 60);

  ctx.fillStyle = '#000';
  ctx.fillRect(-25, -35, 50, 70);
  ctx.fillRect(-35, -25, 70, 50);

  if (Math.abs(scaleY) > 0.1) {
    ctx.fillStyle = '#FFF';
    ctx.font = '20px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.scale(1, Math.sign(scaleY));
    ctx.fillText(isHeads ? 'H' : 'T', 0, 0);
  }

  ctx.restore();
}

function playFlipAnimation(result, durationMs, onComplete) {
  isFlipping = true;
  flipButton.disabled = true;

  const startTime = performance.now();
  const totalSpins = 4;
  const jumpHeight = -100;
  const targetFPS = 12;

  let lastDrawnFrame = -1;

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    let progress = elapsed / durationMs;

    if (progress >= 1) progress = 1;

    const currentFrame = Math.floor(progress * (durationMs / 1000) * targetFPS);

    if (currentFrame > lastDrawnFrame || progress === 1) {
      lastDrawnFrame = currentFrame;

      const rawAngle = progress * (Math.PI * totalSpins) + (result.isHeads ? 0 : Math.PI);
      const snappedAngle = Math.round(rawAngle / (Math.PI / 4)) * (Math.PI / 4);

      let scaleY = Math.cos(snappedAngle);

      const rawOffsetY = Math.sin(progress * Math.PI) * jumpHeight;
      const offsetY = Math.round(rawOffsetY / 4) * 4;

      const showingHeads = scaleY > 0 ? result.isHeads : !result.isHeads;

      drawCoin(scaleY, showingHeads, offsetY, progress);
    }

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      drawCoin(1, result.isHeads, 0, 0);
      isFlipping = false;
      onComplete();
    }
  }

  requestAnimationFrame(step);
}

document.fonts.ready.then(() => drawCoin(1, true, 0, 0));

initGame();