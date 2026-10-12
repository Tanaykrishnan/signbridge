CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "authSubject" TEXT UNIQUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "PhraseEntry" ("id" TEXT PRIMARY KEY, "text" TEXT NOT NULL, "category" TEXT NOT NULL, "review" TEXT NOT NULL, "payload" JSONB NOT NULL);
CREATE TABLE "SignAsset" ("id" TEXT PRIMARY KEY, "clip" TEXT NOT NULL, "review" TEXT NOT NULL, "available" BOOLEAN NOT NULL DEFAULT false, "payload" JSONB NOT NULL);
CREATE TABLE "TranslationHistory" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "sourceText" VARCHAR(500) NOT NULL, "phraseId" TEXT REFERENCES "PhraseEntry"("id") ON DELETE SET NULL, "status" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "Favorite" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "phraseId" TEXT NOT NULL REFERENCES "PhraseEntry"("id") ON DELETE CASCADE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("userId", "phraseId"));
CREATE INDEX "PhraseEntry_category_review_idx" ON "PhraseEntry"("category", "review");
CREATE INDEX "TranslationHistory_userId_createdAt_idx" ON "TranslationHistory"("userId", "createdAt");
CREATE INDEX "Favorite_userId_createdAt_idx" ON "Favorite"("userId", "createdAt");
