-- CreateTable
CREATE TABLE `Stock` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `symbol` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NULL,
    `exchange` VARCHAR(191) NOT NULL DEFAULT 'NSE',
    `series` VARCHAR(191) NOT NULL DEFAULT 'EQ',
    `isin` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Stock_symbol_key`(`symbol`),
    INDEX `Stock_symbol_idx`(`symbol`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TradingDay` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tradingDate` DATETIME(3) NOT NULL,
    `marketStatus` ENUM('PRE_MARKET', 'OPEN', 'CLOSED') NOT NULL DEFAULT 'CLOSED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TradingDay_tradingDate_key`(`tradingDate`),
    INDEX `TradingDay_tradingDate_idx`(`tradingDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CsvUpload` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `originalFilename` VARCHAR(191) NOT NULL,
    `storedFilename` VARCHAR(191) NOT NULL,
    `reportType` ENUM('MOST_ACTIVE_VOLUME', 'MOST_ACTIVE_VALUE', 'VOLUME_GAINERS', 'WEEK52_HIGH', 'WEEK52_LOW', 'TOP_GAINERS', 'TOP_LOSERS', 'LARGE_DEALS', 'NEEDS_REVIEW') NOT NULL,
    `tradingDate` DATETIME(3) NULL,
    `filenameDate` DATETIME(3) NULL,
    `detectedDate` DATETIME(3) NULL,
    `uploadVersion` INTEGER NOT NULL DEFAULT 1,
    `analysisType` ENUM('EOD', 'PRE_MARKET', 'INTRADAY', 'PARTIAL') NOT NULL DEFAULT 'EOD',
    `uploadStatus` ENUM('PENDING', 'DETECTED', 'PROCESSED', 'FAILED', 'DUPLICATE', 'NEEDS_REVIEW') NOT NULL DEFAULT 'PENDING',
    `rowCount` INTEGER NOT NULL DEFAULT 0,
    `validRows` INTEGER NOT NULL DEFAULT 0,
    `invalidRows` INTEGER NOT NULL DEFAULT 0,
    `checksum` VARCHAR(191) NOT NULL,
    `errorMessage` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,

    INDEX `CsvUpload_detectedDate_idx`(`detectedDate`),
    INDEX `CsvUpload_reportType_idx`(`reportType`),
    INDEX `CsvUpload_filenameDate_idx`(`filenameDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MostActiveVolume` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tradingDate` DATETIME(3) NOT NULL,
    `uploadId` INTEGER NOT NULL,
    `stockId` INTEGER NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `openPrice` DECIMAL(18, 4) NULL,
    `highPrice` DECIMAL(18, 4) NULL,
    `lowPrice` DECIMAL(18, 4) NULL,
    `previousClose` DECIMAL(18, 4) NULL,
    `ltp` DECIMAL(18, 4) NULL,
    `changePercent` DECIMAL(10, 4) NULL,
    `volume` BIGINT NULL,
    `turnover` DECIMAL(24, 4) NULL,
    `corporateAction` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MostActiveVolume_tradingDate_idx`(`tradingDate`),
    INDEX `MostActiveVolume_stockId_idx`(`stockId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MostActiveValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tradingDate` DATETIME(3) NOT NULL,
    `uploadId` INTEGER NOT NULL,
    `stockId` INTEGER NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `openPrice` DECIMAL(18, 4) NULL,
    `highPrice` DECIMAL(18, 4) NULL,
    `lowPrice` DECIMAL(18, 4) NULL,
    `previousClose` DECIMAL(18, 4) NULL,
    `ltp` DECIMAL(18, 4) NULL,
    `changePercent` DECIMAL(10, 4) NULL,
    `volume` BIGINT NULL,
    `turnover` DECIMAL(24, 4) NULL,
    `corporateAction` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MostActiveValue_tradingDate_idx`(`tradingDate`),
    INDEX `MostActiveValue_stockId_idx`(`stockId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolumeGainer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tradingDate` DATETIME(3) NOT NULL,
    `uploadId` INTEGER NOT NULL,
    `stockId` INTEGER NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `securityName` VARCHAR(191) NULL,
    `todayVolume` BIGINT NULL,
    `avgVolume1w` BIGINT NULL,
    `volumeChange1w` DECIMAL(10, 4) NULL,
    `avgVolume2w` BIGINT NULL,
    `volumeChange2w` DECIMAL(10, 4) NULL,
    `todayLtp` DECIMAL(18, 4) NULL,
    `todayChangePercent` DECIMAL(10, 4) NULL,
    `todayTurnover` DECIMAL(24, 4) NULL,
    `volumeRatio1w` DECIMAL(12, 4) NULL,
    `volumeRatio2w` DECIMAL(12, 4) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VolumeGainer_tradingDate_idx`(`tradingDate`),
    INDEX `VolumeGainer_stockId_idx`(`stockId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Week52High` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tradingDate` DATETIME(3) NOT NULL,
    `uploadId` INTEGER NOT NULL,
    `stockId` INTEGER NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `series` VARCHAR(191) NULL,
    `ltp` DECIMAL(18, 4) NULL,
    `changePercent` DECIMAL(10, 4) NULL,
    `new52wHigh` DECIMAL(18, 4) NULL,
    `previousHigh` DECIMAL(18, 4) NULL,
    `previousHighDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Week52High_tradingDate_idx`(`tradingDate`),
    INDEX `Week52High_stockId_idx`(`stockId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Week52Low` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tradingDate` DATETIME(3) NOT NULL,
    `uploadId` INTEGER NOT NULL,
    `stockId` INTEGER NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `series` VARCHAR(191) NULL,
    `ltp` DECIMAL(18, 4) NULL,
    `changePercent` DECIMAL(10, 4) NULL,
    `new52wLow` DECIMAL(18, 4) NULL,
    `previousLow` DECIMAL(18, 4) NULL,
    `previousLowDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Week52Low_tradingDate_idx`(`tradingDate`),
    INDEX `Week52Low_stockId_idx`(`stockId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TopGainer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tradingDate` DATETIME(3) NOT NULL,
    `uploadId` INTEGER NOT NULL,
    `stockId` INTEGER NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `openPrice` DECIMAL(18, 4) NULL,
    `highPrice` DECIMAL(18, 4) NULL,
    `lowPrice` DECIMAL(18, 4) NULL,
    `previousClose` DECIMAL(18, 4) NULL,
    `ltp` DECIMAL(18, 4) NULL,
    `changePercent` DECIMAL(10, 4) NULL,
    `volume` BIGINT NULL,
    `turnover` DECIMAL(24, 4) NULL,
    `corporateAction` VARCHAR(191) NULL,
    `rank` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TopGainer_tradingDate_idx`(`tradingDate`),
    INDEX `TopGainer_stockId_idx`(`stockId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TopLoser` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tradingDate` DATETIME(3) NOT NULL,
    `uploadId` INTEGER NOT NULL,
    `stockId` INTEGER NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `openPrice` DECIMAL(18, 4) NULL,
    `highPrice` DECIMAL(18, 4) NULL,
    `lowPrice` DECIMAL(18, 4) NULL,
    `previousClose` DECIMAL(18, 4) NULL,
    `ltp` DECIMAL(18, 4) NULL,
    `changePercent` DECIMAL(10, 4) NULL,
    `volume` BIGINT NULL,
    `turnover` DECIMAL(24, 4) NULL,
    `corporateAction` VARCHAR(191) NULL,
    `rank` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TopLoser_tradingDate_idx`(`tradingDate`),
    INDEX `TopLoser_stockId_idx`(`stockId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LargeDeal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tradingDate` DATETIME(3) NOT NULL,
    `uploadId` INTEGER NOT NULL,
    `stockId` INTEGER NOT NULL,
    `tradeDate` DATETIME(3) NULL,
    `filenameDate` DATETIME(3) NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `securityName` VARCHAR(191) NULL,
    `clientName` VARCHAR(191) NULL,
    `buySell` VARCHAR(191) NOT NULL,
    `quantityTraded` BIGINT NULL,
    `tradePrice` DECIMAL(18, 4) NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LargeDeal_tradeDate_idx`(`tradeDate`),
    INDEX `LargeDeal_stockId_idx`(`stockId`),
    INDEX `LargeDeal_tradingDate_idx`(`tradingDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyStockMetric` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tradingDate` DATETIME(3) NOT NULL,
    `stockId` INTEGER NOT NULL,
    `openPrice` DECIMAL(18, 4) NULL,
    `highPrice` DECIMAL(18, 4) NULL,
    `lowPrice` DECIMAL(18, 4) NULL,
    `previousClose` DECIMAL(18, 4) NULL,
    `ltp` DECIMAL(18, 4) NULL,
    `changePercent` DECIMAL(10, 4) NULL,
    `volume` BIGINT NULL,
    `turnover` DECIMAL(24, 4) NULL,
    `avgVolume1w` BIGINT NULL,
    `avgVolume2w` BIGINT NULL,
    `volumeRatio1w` DECIMAL(12, 4) NULL,
    `volumeRatio2w` DECIMAL(12, 4) NULL,
    `isMostActiveVolume` BOOLEAN NOT NULL DEFAULT false,
    `isMostActiveValue` BOOLEAN NOT NULL DEFAULT false,
    `isVolumeGainer` BOOLEAN NOT NULL DEFAULT false,
    `is52wHigh` BOOLEAN NOT NULL DEFAULT false,
    `is52wLow` BOOLEAN NOT NULL DEFAULT false,
    `isTopGainer` BOOLEAN NOT NULL DEFAULT false,
    `isTopLoser` BOOLEAN NOT NULL DEFAULT false,
    `bulkBuyQuantity` BIGINT NOT NULL DEFAULT 0,
    `bulkSellQuantity` BIGINT NOT NULL DEFAULT 0,
    `bulkNetQuantity` BIGINT NOT NULL DEFAULT 0,
    `dayRange` DECIMAL(18, 4) NULL,
    `closePosition` DECIMAL(10, 4) NULL,
    `sourceCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DailyStockMetric_tradingDate_stockId_idx`(`tradingDate`, `stockId`),
    INDEX `DailyStockMetric_stockId_idx`(`stockId`),
    UNIQUE INDEX `DailyStockMetric_tradingDate_stockId_key`(`tradingDate`, `stockId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyStockScore` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `analysisRunId` INTEGER NOT NULL,
    `tradingDate` DATETIME(3) NOT NULL,
    `stockId` INTEGER NOT NULL,
    `activityVolumeScore` DECIMAL(8, 2) NOT NULL,
    `activityValueScore` DECIMAL(8, 2) NOT NULL,
    `volumeExpansionScore` DECIMAL(8, 2) NOT NULL,
    `momentumScore` DECIMAL(8, 2) NOT NULL,
    `week52Score` DECIMAL(8, 2) NOT NULL,
    `gainerScore` DECIMAL(8, 2) NOT NULL,
    `loserScore` DECIMAL(8, 2) NOT NULL,
    `liquidityScore` DECIMAL(8, 2) NOT NULL,
    `largeDealScore` DECIMAL(8, 2) NOT NULL,
    `priceActionScore` DECIMAL(8, 2) NOT NULL,
    `riskPenalty` DECIMAL(8, 2) NOT NULL,
    `rawScore` DECIMAL(10, 4) NOT NULL,
    `normalizedScore` DECIMAL(6, 2) NOT NULL,
    `rank` INTEGER NULL,
    `classification` ENUM('A_PLUS', 'A', 'B', 'C', 'D') NOT NULL,
    `signals` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DailyStockScore_tradingDate_normalizedScore_idx`(`tradingDate`, `normalizedScore`),
    INDEX `DailyStockScore_stockId_idx`(`stockId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalysisRun` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tradingDate` DATETIME(3) NOT NULL,
    `analysisType` ENUM('EOD', 'PRE_MARKET', 'INTRADAY', 'PARTIAL') NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL') NOT NULL DEFAULT 'PENDING',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `filesExpected` INTEGER NOT NULL DEFAULT 8,
    `filesReceived` INTEGER NOT NULL DEFAULT 0,
    `stocksAnalyzed` INTEGER NOT NULL DEFAULT 0,
    `errorCount` INTEGER NOT NULL DEFAULT 0,
    `warningCount` INTEGER NOT NULL DEFAULT 0,
    `errorMessage` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AnalysisRun_tradingDate_idx`(`tradingDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TradeSetup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `analysisRunId` INTEGER NOT NULL,
    `tradingDate` DATETIME(3) NOT NULL,
    `stockId` INTEGER NOT NULL,
    `setupType` VARCHAR(191) NULL,
    `status` ENUM('BUY_SETUP', 'WATCH', 'WAIT_FOR_BREAKOUT', 'WAIT_FOR_PULLBACK', 'CHASE_RISK', 'AVOID', 'INSUFFICIENT_DATA', 'NO_TRADE') NOT NULL,
    `currentPrice` DECIMAL(18, 4) NULL,
    `breakoutLevel` DECIMAL(18, 4) NULL,
    `entryLow` DECIMAL(18, 4) NULL,
    `entryHigh` DECIMAL(18, 4) NULL,
    `stopLoss` DECIMAL(18, 4) NULL,
    `target1` DECIMAL(18, 4) NULL,
    `target2` DECIMAL(18, 4) NULL,
    `riskPerShare` DECIMAL(18, 4) NULL,
    `reward1PerShare` DECIMAL(18, 4) NULL,
    `reward2PerShare` DECIMAL(18, 4) NULL,
    `riskReward1` DECIMAL(8, 2) NULL,
    `riskReward2` DECIMAL(8, 2) NULL,
    `capitalAvailable` DECIMAL(18, 2) NULL,
    `riskPercent` DECIMAL(6, 2) NULL,
    `maximumRisk` DECIMAL(18, 2) NULL,
    `recommendedQuantity` INTEGER NULL,
    `capitalUsed` DECIMAL(18, 2) NULL,
    `maximumLoss` DECIMAL(18, 2) NULL,
    `triggerCondition` VARCHAR(191) NULL,
    `invalidationCondition` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NULL,
    `warnings` JSON NULL,
    `confidenceScore` DECIMAL(6, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TradeSetup_tradingDate_idx`(`tradingDate`),
    INDEX `TradeSetup_stockId_idx`(`stockId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyWatchlist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tradingDate` DATETIME(3) NOT NULL,
    `nextTradingDate` DATETIME(3) NULL,
    `analysisRunId` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DailyWatchlist_analysisRunId_key`(`analysisRunId`),
    INDEX `DailyWatchlist_tradingDate_idx`(`tradingDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WatchlistItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `watchlistId` INTEGER NOT NULL,
    `stockId` INTEGER NOT NULL,
    `rank` INTEGER NOT NULL,
    `score` DECIMAL(6, 2) NULL,
    `status` ENUM('BUY_SETUP', 'WATCH', 'WAIT_FOR_BREAKOUT', 'WAIT_FOR_PULLBACK', 'CHASE_RISK', 'AVOID', 'INSUFFICIENT_DATA', 'NO_TRADE') NOT NULL,
    `tradeSetupId` INTEGER NULL,
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WatchlistItem_watchlistId_rank_idx`(`watchlistId`, `rank`),
    INDEX `WatchlistItem_stockId_idx`(`stockId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemSetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `valueType` VARCHAR(191) NOT NULL DEFAULT 'string',
    `description` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SystemSetting_key_key`(`key`),
    INDEX `SystemSetting_key_idx`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaperTrade` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockId` INTEGER NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `entryDate` DATETIME(3) NOT NULL,
    `entryPrice` DECIMAL(18, 4) NOT NULL,
    `stopLoss` DECIMAL(18, 4) NOT NULL,
    `target1` DECIMAL(18, 4) NULL,
    `target2` DECIMAL(18, 4) NULL,
    `quantity` INTEGER NOT NULL,
    `exitDate` DATETIME(3) NULL,
    `exitPrice` DECIMAL(18, 4) NULL,
    `profitLoss` DECIMAL(18, 4) NULL,
    `result` VARCHAR(20) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PaperTrade_stockId_idx`(`stockId`),
    INDEX `PaperTrade_entryDate_idx`(`entryDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MostActiveVolume` ADD CONSTRAINT `MostActiveVolume_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `Stock`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MostActiveValue` ADD CONSTRAINT `MostActiveValue_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `Stock`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolumeGainer` ADD CONSTRAINT `VolumeGainer_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `Stock`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Week52High` ADD CONSTRAINT `Week52High_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `Stock`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Week52Low` ADD CONSTRAINT `Week52Low_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `Stock`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TopGainer` ADD CONSTRAINT `TopGainer_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `Stock`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TopLoser` ADD CONSTRAINT `TopLoser_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `Stock`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LargeDeal` ADD CONSTRAINT `LargeDeal_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `Stock`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyStockMetric` ADD CONSTRAINT `DailyStockMetric_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `Stock`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyStockScore` ADD CONSTRAINT `DailyStockScore_analysisRunId_fkey` FOREIGN KEY (`analysisRunId`) REFERENCES `AnalysisRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyStockScore` ADD CONSTRAINT `DailyStockScore_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `Stock`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TradeSetup` ADD CONSTRAINT `TradeSetup_analysisRunId_fkey` FOREIGN KEY (`analysisRunId`) REFERENCES `AnalysisRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TradeSetup` ADD CONSTRAINT `TradeSetup_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `Stock`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyWatchlist` ADD CONSTRAINT `DailyWatchlist_analysisRunId_fkey` FOREIGN KEY (`analysisRunId`) REFERENCES `AnalysisRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WatchlistItem` ADD CONSTRAINT `WatchlistItem_watchlistId_fkey` FOREIGN KEY (`watchlistId`) REFERENCES `DailyWatchlist`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WatchlistItem` ADD CONSTRAINT `WatchlistItem_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `Stock`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WatchlistItem` ADD CONSTRAINT `WatchlistItem_tradeSetupId_fkey` FOREIGN KEY (`tradeSetupId`) REFERENCES `TradeSetup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaperTrade` ADD CONSTRAINT `PaperTrade_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `Stock`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
