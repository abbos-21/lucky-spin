-- CreateTable
CREATE TABLE "User" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "username" TEXT,
    "firstName" TEXT,
    "photoUrl" TEXT,
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "tonBalance" REAL NOT NULL DEFAULT 0,
    "tonWithdrawn" REAL NOT NULL DEFAULT 0,
    "totalPointsEarned" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastSpinDate" TEXT,
    "adSpinsToday" INTEGER NOT NULL DEFAULT 0,
    "adScoreBoost" BOOLEAN NOT NULL DEFAULT false,
    "streakShield" BOOLEAN NOT NULL DEFAULT false,
    "trustScore" INTEGER NOT NULL DEFAULT 50,
    "deviceFingerprint" TEXT,
    "activeDays" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TEXT,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "tonAddress" TEXT,
    "lastWithdrawAt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" BIGINT NOT NULL,
    "adType" TEXT NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,
    "sessionId" TEXT,
    "fingerprintHash" TEXT,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "settlementDate" TEXT,
    "viewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailySettlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "totalRevenue" REAL NOT NULL,
    "userShareUsd" REAL NOT NULL,
    "totalPoints" INTEGER NOT NULL,
    "pointValueUsd" REAL NOT NULL,
    "tonPriceUsd" REAL NOT NULL,
    "pointValueTon" REAL NOT NULL,
    "usersSettled" INTEGER NOT NULL,
    "totalTonPaid" REAL NOT NULL,
    "settledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" BIGINT NOT NULL,
    "tonAddress" TEXT NOT NULL,
    "amountTon" REAL NOT NULL,
    "fee" REAL NOT NULL DEFAULT 0.005,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "failReason" TEXT,
    "reviewNote" TEXT,
    "trustScoreAt" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TEXT,
    "confirmedAt" TEXT,
    CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpinLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" BIGINT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "rewardValue" TEXT NOT NULL,
    "isAdSpin" BOOLEAN NOT NULL DEFAULT false,
    "spunAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpinLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MiniGameScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" BIGINT NOT NULL,
    "gameType" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rawScore" INTEGER NOT NULL,
    "isBoosted" BOOLEAN NOT NULL DEFAULT false,
    "playedDate" TEXT NOT NULL,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MiniGameScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserCollectible" (
    "userId" BIGINT NOT NULL,
    "collectibleId" TEXT NOT NULL,
    "obtainedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "collectibleId"),
    CONSTRAINT "UserCollectible_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Referral" (
    "referrerId" BIGINT NOT NULL,
    "referredId" BIGINT NOT NULL,
    "bonusAwarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("referrerId", "referredId"),
    CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Referral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdminLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AdView_userId_viewedAt_idx" ON "AdView"("userId", "viewedAt");

-- CreateIndex
CREATE INDEX "AdView_settled_viewedAt_idx" ON "AdView"("settled", "viewedAt");

-- CreateIndex
CREATE INDEX "AdView_userId_adType_viewedAt_idx" ON "AdView"("userId", "adType", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailySettlement_date_key" ON "DailySettlement"("date");

-- CreateIndex
CREATE INDEX "Withdrawal_userId_idx" ON "Withdrawal"("userId");

-- CreateIndex
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");

-- CreateIndex
CREATE INDEX "SpinLog_userId_spunAt_idx" ON "SpinLog"("userId", "spunAt");

-- CreateIndex
CREATE INDEX "MiniGameScore_playedDate_score_idx" ON "MiniGameScore"("playedDate", "score");

-- CreateIndex
CREATE UNIQUE INDEX "MiniGameScore_userId_playedDate_key" ON "MiniGameScore"("userId", "playedDate");
