-- CreateTable
CREATE TABLE "diagnosis_code_mappings" (
    "id" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "targetSystem" TEXT NOT NULL,
    "targetCode" TEXT NOT NULL,
    "mapKind" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnosis_code_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diagnosis_code_mappings_sourceSystem_sourceCode_idx" ON "diagnosis_code_mappings"("sourceSystem", "sourceCode");
