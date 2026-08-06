/**
 * Update DHIS2 Config DTO
 */

export interface UpdateDhis2ConfigDto {
  dhis2Enabled?: boolean;
  dhis2BaseUrl?: string;
  dhis2Username?: string;
  dhis2Password?: string; // blank/omitted = keep the existing encrypted value
  dhis2OrgUnitId?: string;
  dhis2DataElementTotalVisits?: string;
  dhis2DataElementPediatricUnder5?: string;
  dhis2DataElementSevereMalnutrition?: string;
  dhis2DataElementLiveBirths?: string;
  dhis2DataElementSeverePostpartumHemorrhage?: string;
  dhis2CategoryOptionCombo?: string;
}
