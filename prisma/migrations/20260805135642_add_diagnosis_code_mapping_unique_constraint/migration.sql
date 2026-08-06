-- AddUniqueConstraint
-- Table is empty at the time of this migration (DiagnosisCodeMapping was
-- just added in the prior migration and never populated), so this is safe.
CREATE UNIQUE INDEX "diagnosis_code_mappings_sourceSystem_sourceCode_targetSyst_key" ON "diagnosis_code_mappings"("sourceSystem", "sourceCode", "targetSystem", "targetCode");
