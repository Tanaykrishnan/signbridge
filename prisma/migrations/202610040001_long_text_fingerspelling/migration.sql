ALTER TABLE "TranslationHistory" ALTER COLUMN "sourceText" TYPE VARCHAR(5000);
ALTER TABLE "TranslationHistory" ADD COLUMN "outputMode" TEXT NOT NULL DEFAULT 'isl';
ALTER TABLE "TranslationHistory" ADD CONSTRAINT "TranslationHistory_outputMode_check"
  CHECK ("outputMode" IN ('isl', 'asl-fingerspelling'));
