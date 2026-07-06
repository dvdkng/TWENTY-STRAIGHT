export class UnfairFlipEngine {
  constructor(loadedConfig) {
    this.playerState = {
      balance: 0,
      totalFlips: 0,
      headsFlipped: 0,
      streak: 0,
      maxStreak: 0,
      upgrades: {
        coinWorthLevel: 1,
        headChanceLevel: 1,
        autoFlipperLevel: 0,
        b2bBonusLevel: 0
      },
      perksUnlocked: {
        luckyCharm: false,
        heavyTails: false
      },
      abilities: {
        midasTouchReady: true,
        timeWarpReady: true
      }
    };

    this.config = loadedConfig;
    this.activeEffects = { midasTouch: false };
  }

  getCurrentHeadChance() {
    let chance = this.config.baseSettings.baseHeadChance;
    chance += (this.playerState.upgrades.headChanceLevel - 1) * this.config.upgrades.headChance.chanceIncreasePerLevel;

    if (this.playerState.perksUnlocked.luckyCharm) {
      chance += this.config.perks.luckyCharm.chanceIncrease;
    }

    return Math.min(chance, this.config.upgrades.headChance.maxChance);
  }

  getCurrentCoinWorth() {
    const Tiers = this.config.upgrades.coinWorth.tiers;
    const level = this.playerState.upgrades.coinWorthLevel;
    const currentTierIndex = Math.min(level - 1, Tiers.length - 1);
    let worth = Tiers[currentTierIndex].worth;

    if (this.activeEffects.midasTouch) {
      worth *= 10;
    }

    return worth;
  }

  getUpgradePrice(upgradeId) {
    const upgradeConfig = this.config.upgrades[upgradeId];
    const currentLevel = this.playerState.upgrades[`${upgradeId}Level`];
    const rawPrice = upgradeConfig.basePrice * Math.pow(upgradeConfig.priceMultiplier, currentLevel - 1);

    return Math.round(rawPrice * 100) / 100;
  }

  flip() {
    this.playerState.totalFlips++;
    const currentChance = this.getCurrentHeadChance();
    const currentWorth = this.getCurrentCoinWorth();

    const roll = Math.random();
    const isHeads = (roll < currentChance) || this.activeEffects.midasTouch;

    let earned = 0;

    if (isHeads) {
      this.playerState.headsFlipped++;
      this.playerState.streak++;
      if (this.playerState.streak > this.playerState.maxStreak) {
        this.playerState.maxStreak = this.playerState.streak;
      }
      earned = currentWorth;
      if (this.playerState.streak > 1) {
        const b2bLevel = this.playerState.upgrades.b2bBonusLevel;
        const bonusFactor = this.config.upgrades.b2bBonus.multiplierPerLevel;
        earned *= (1 + (b2bLevel * bonusFactor * (this.playerState.streak - 1)));
      }
    } else {
      this.playerState.streak = 0;
      if (this.playerState.perksUnlocked.heavyTails) {
        earned = currentWorth * this.config.perks.heavyTails.pityMultiplier;
        if (earned < 0.01 && currentWorth > 0) earned = 0.01;
      }
    }

    earned = Math.round(earned * 100) / 100;
    this.playerState.balance += earned;
    this.playerState.balance = Math.round(this.playerState.balance * 100) / 100;

    let gameWon = false;
    if (this.playerState.streak >= 20) {
      gameWon = true;
    }

    return {
      isHeads: isHeads,
      earned: earned,
      newBalance: this.playerState.balance,
      currentStreak: this.playerState.streak,
      gameWon: gameWon
    };
  }

  buyUpgrade(upgradeId) {
    const price = this.getUpgradePrice(upgradeId);
    if (this.playerState.balance >= price) {
      this.playerState.balance -= price;
      this.playerState.balance = Math.round(this.playerState.balance * 100) / 100;
      this.playerState.upgrades[`${upgradeId}Level`]++;
      return true;
    }
    return false;
  }
}