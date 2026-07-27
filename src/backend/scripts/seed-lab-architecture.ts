import { PrismaClient } from '@prisma/client';
export interface LabResultItem {
  parameter: string;
  value: string;
  unit: string;
  referenceMin?: number;
  referenceMax?: number;
  referenceRange?: string;
}

export const LAB_TEMPLATES: Record<string, LabResultItem[]> = {
  // Hematology
  'LAB-FBC': [
    { parameter: 'White Blood Cells (WBC)', value: '', unit: 'x10³/µL', referenceMin: 4.5, referenceMax: 11.0 },
    { parameter: 'Red Blood Cells (RBC)', value: '', unit: 'x10⁶/µL', referenceMin: 4.5, referenceMax: 5.5 },
    { parameter: 'Hemoglobin (Hb)', value: '', unit: 'g/dL', referenceMin: 13.0, referenceMax: 17.0 },
    { parameter: 'Hematocrit (PCV)', value: '', unit: '%', referenceMin: 38, referenceMax: 50 },
    { parameter: 'Mean Corpuscular Volume (MCV)', value: '', unit: 'fL', referenceMin: 80, referenceMax: 100 },
    { parameter: 'Mean Corpuscular Hemoglobin (MCH)', value: '', unit: 'pg', referenceMin: 27, referenceMax: 32 },
    { parameter: 'MCHC', value: '', unit: 'g/dL', referenceMin: 32, referenceMax: 36 },
    { parameter: 'Platelets', value: '', unit: 'x10³/µL', referenceMin: 150, referenceMax: 400 },
    { parameter: 'Lymphocytes', value: '', unit: '%', referenceMin: 20, referenceMax: 40 },
    { parameter: 'Neutrophils', value: '', unit: '%', referenceMin: 40, referenceMax: 75 },
    { parameter: 'Monocytes', value: '', unit: '%', referenceMin: 2, referenceMax: 10 },
    { parameter: 'Eosinophils', value: '', unit: '%', referenceMin: 1, referenceMax: 6 },
    { parameter: 'Basophils', value: '', unit: '%', referenceMin: 0, referenceMax: 1 },
  ],
  'LAB-PCV': [
    { parameter: 'Packed Cell Volume (PCV)', value: '', unit: '%', referenceMin: 38, referenceMax: 50 },
  ],
  'LAB-ESR': [
    { parameter: 'Erythrocyte Sedimentation Rate (ESR)', value: '', unit: 'mm/hr', referenceMin: 0, referenceMax: 20 },
  ],
  'LAB-MP': [
    { parameter: 'Malaria Parasite', value: '', unit: '', referenceRange: 'Not Seen' },
  ],
  'LAB-COAG': [
    { parameter: 'Prothrombin Time (PT)', value: '', unit: 'sec', referenceMin: 11, referenceMax: 13.5 },
    { parameter: 'Activated Partial Thromboplastin Time (APTT)', value: '', unit: 'sec', referenceMin: 30, referenceMax: 40 },
    { parameter: 'International Normalized Ratio (INR)', value: '', unit: '', referenceMin: 0.8, referenceMax: 1.1 },
  ],
  'LAB-BLOODGROUP': [
    { parameter: 'ABO Blood Group', value: '', unit: '', referenceRange: 'A, B, AB, O' },
    { parameter: 'Rhesus (Rh) Factor', value: '', unit: '', referenceRange: 'Positive, Negative' },
  ],
  'LAB-GENOTYPE': [
    { parameter: 'Hemoglobin Genotype', value: '', unit: '', referenceRange: 'AA, AS, SS, AC, SC' },
  ],
  'LAB-COOMBS': [
    { parameter: 'Direct Coombs Test', value: '', unit: '', referenceRange: 'Negative' },
    { parameter: 'Indirect Coombs Test', value: '', unit: '', referenceRange: 'Negative' },
  ],

  // Clinical Chemistry
  'LAB-EUCR': [
    { parameter: 'Sodium (Na+)', value: '', unit: 'mmol/L', referenceMin: 135, referenceMax: 145 },
    { parameter: 'Potassium (K+)', value: '', unit: 'mmol/L', referenceMin: 3.5, referenceMax: 5.1 },
    { parameter: 'Chloride (Cl-)', value: '', unit: 'mmol/L', referenceMin: 98, referenceMax: 107 },
    { parameter: 'Bicarbonate (HCO3-)', value: '', unit: 'mmol/L', referenceMin: 22, referenceMax: 28 },
    { parameter: 'Urea', value: '', unit: 'mg/dL', referenceMin: 15, referenceMax: 45 },
    { parameter: 'Creatinine', value: '', unit: 'mg/dL', referenceMin: 0.6, referenceMax: 1.2 },
  ],
  'LAB-LFT': [
    { parameter: 'Total Bilirubin', value: '', unit: 'mg/dL', referenceMin: 0.1, referenceMax: 1.2 },
    { parameter: 'Direct (Conjugated) Bilirubin', value: '', unit: 'mg/dL', referenceMin: 0.0, referenceMax: 0.3 },
    { parameter: 'AST (SGOT)', value: '', unit: 'U/L', referenceMin: 8, referenceMax: 48 },
    { parameter: 'ALT (SGPT)', value: '', unit: 'U/L', referenceMin: 7, referenceMax: 55 },
    { parameter: 'Alkaline Phosphatase (ALP)', value: '', unit: 'U/L', referenceMin: 40, referenceMax: 129 },
    { parameter: 'Total Protein', value: '', unit: 'g/dL', referenceMin: 6.6, referenceMax: 8.7 },
    { parameter: 'Albumin', value: '', unit: 'g/dL', referenceMin: 3.5, referenceMax: 5.2 },
  ],
  'LAB-BILIRUBIN': [
    { parameter: 'Total Bilirubin', value: '', unit: 'mg/dL', referenceMin: 0.1, referenceMax: 1.2 },
    { parameter: 'Direct (Conjugated) Bilirubin', value: '', unit: 'mg/dL', referenceMin: 0.0, referenceMax: 0.3 },
    { parameter: 'Indirect Bilirubin', value: '', unit: 'mg/dL', referenceMin: 0.1, referenceMax: 0.9 },
  ],
  'LAB-LIPID': [
    { parameter: 'Total Cholesterol', value: '', unit: 'mg/dL', referenceMax: 200 },
    { parameter: 'High-Density Lipoprotein (HDL)', value: '', unit: 'mg/dL', referenceMin: 40 },
    { parameter: 'Low-Density Lipoprotein (LDL)', value: '', unit: 'mg/dL', referenceMax: 100 },
    { parameter: 'Triglycerides', value: '', unit: 'mg/dL', referenceMax: 150 },
  ],
  'LAB-CHOL': [
    { parameter: 'Total Cholesterol', value: '', unit: 'mg/dL', referenceMax: 200 },
  ],
  'LAB-RBS': [
    { parameter: 'Random Blood Sugar (RBS)', value: '', unit: 'mg/dL', referenceMin: 70, referenceMax: 140 },
  ],
  'LAB-FBS': [
    { parameter: 'Fasting Blood Sugar (FBS)', value: '', unit: 'mg/dL', referenceMin: 70, referenceMax: 100 },
  ],
  'LAB-GLUCOSE': [
    { parameter: 'Glucose', value: '', unit: 'mg/dL', referenceMin: 70, referenceMax: 140 },
  ],
  'LAB-HBA1C': [
    { parameter: 'Hemoglobin A1c (HbA1c)', value: '', unit: '%', referenceMin: 4.0, referenceMax: 5.6 },
  ],
  'LAB-URICACID': [
    { parameter: 'Uric Acid', value: '', unit: 'mg/dL', referenceMin: 3.4, referenceMax: 7.0 },
  ],
  'LAB-CALCIUM': [
    { parameter: 'Total Calcium', value: '', unit: 'mg/dL', referenceMin: 8.6, referenceMax: 10.3 },
  ],
  'LAB-PHOSPHORUS': [
    { parameter: 'Phosphorus', value: '', unit: 'mg/dL', referenceMin: 2.5, referenceMax: 4.5 },
  ],
  'LAB-MAGNESIUM': [
    { parameter: 'Magnesium', value: '', unit: 'mg/dL', referenceMin: 1.7, referenceMax: 2.2 },
  ],
  'LAB-AMYLASE': [
    { parameter: 'Serum Amylase', value: '', unit: 'U/L', referenceMin: 28, referenceMax: 100 },
  ],
  'LAB-LIPASE': [
    { parameter: 'Serum Lipase', value: '', unit: 'U/L', referenceMin: 13, referenceMax: 60 },
  ],
  'LAB-CKMB': [
    { parameter: 'Creatine Kinase-MB (CK-MB)', value: '', unit: 'ng/mL', referenceMin: 0, referenceMax: 3.0 },
  ],
  'LAB-TROPONIN': [
    { parameter: 'Troponin I', value: '', unit: 'ng/mL', referenceMin: 0, referenceMax: 0.04 },
  ],
  'LAB-DDIMER': [
    { parameter: 'D-Dimer', value: '', unit: 'ng/mL DDU', referenceMin: 0, referenceMax: 250 },
  ],
  'LAB-CRP': [
    { parameter: 'C-Reactive Protein (CRP)', value: '', unit: 'mg/L', referenceMin: 0, referenceMax: 5.0 },
  ],
  'LAB-RF': [
    { parameter: 'Rheumatoid Factor (RF)', value: '', unit: 'IU/mL', referenceMin: 0, referenceMax: 14 },
  ],

  // Endocrinology / Hormones
  'LAB-THYROID': [
    { parameter: 'Thyroid Stimulating Hormone (TSH)', value: '', unit: 'µIU/mL', referenceMin: 0.4, referenceMax: 4.0 },
    { parameter: 'Free T3', value: '', unit: 'pg/mL', referenceMin: 2.3, referenceMax: 4.2 },
    { parameter: 'Free T4', value: '', unit: 'ng/dL', referenceMin: 0.9, referenceMax: 1.7 },
  ],
  'LAB-FSH': [
    { parameter: 'Follicle-Stimulating Hormone (FSH)', value: '', unit: 'mIU/mL', referenceRange: 'Phase Dependent' },
  ],
  'LAB-LH': [
    { parameter: 'Luteinizing Hormone (LH)', value: '', unit: 'mIU/mL', referenceRange: 'Phase Dependent' },
  ],
  'LAB-PROLACTIN': [
    { parameter: 'Prolactin', value: '', unit: 'ng/mL', referenceMin: 4.8, referenceMax: 23.3 },
  ],
  'LAB-PSA': [
    { parameter: 'Total Prostate Specific Antigen (PSA)', value: '', unit: 'ng/mL', referenceMin: 0, referenceMax: 4.0 },
  ],
  'LAB-BHCG': [
    { parameter: 'Beta-Human Chorionic Gonadotropin (B-HCG)', value: '', unit: 'mIU/mL', referenceRange: 'Negative (<5)' },
  ],
  'LAB-HORMONE': [
    { parameter: 'Follicle-Stimulating Hormone (FSH)', value: '', unit: 'mIU/mL', referenceRange: 'Phase Dependent' },
    { parameter: 'Luteinizing Hormone (LH)', value: '', unit: 'mIU/mL', referenceRange: 'Phase Dependent' },
    { parameter: 'Prolactin', value: '', unit: 'ng/mL', referenceMin: 4.8, referenceMax: 23.3 },
    { parameter: 'Estradiol (E2)', value: '', unit: 'pg/mL', referenceRange: 'Phase Dependent' },
    { parameter: 'Progesterone', value: '', unit: 'ng/mL', referenceRange: 'Phase Dependent' },
    { parameter: 'Testosterone', value: '', unit: 'ng/dL', referenceRange: 'Gender/Age Dependent' },
  ],
  'LAB-FP': [ // Female Profile
    { parameter: 'Follicle-Stimulating Hormone (FSH)', value: '', unit: 'mIU/mL', referenceRange: 'Phase Dependent' },
    { parameter: 'Luteinizing Hormone (LH)', value: '', unit: 'mIU/mL', referenceRange: 'Phase Dependent' },
    { parameter: 'Prolactin', value: '', unit: 'ng/mL', referenceMin: 4.8, referenceMax: 23.3 },
  ],

  // Microbiology & Parasitology
  'LAB-WIDAL': [
    { parameter: 'Salmonella Typhi O', value: '', unit: 'Titer', referenceRange: '< 1:80' },
    { parameter: 'Salmonella Typhi H', value: '', unit: 'Titer', referenceRange: '< 1:80' },
    { parameter: 'Salmonella Paratyphi A', value: '', unit: 'Titer', referenceRange: '< 1:80' },
    { parameter: 'Salmonella Paratyphi B', value: '', unit: 'Titer', referenceRange: '< 1:80' },
  ],
  'LAB-HPYLORI': [
    { parameter: 'H. Pylori Antigen', value: '', unit: '', referenceRange: 'Negative' },
  ],
  'LAB-URINALYSIS': [
    { parameter: 'Color', value: '', unit: '', referenceRange: 'Pale Yellow' },
    { parameter: 'Appearance', value: '', unit: '', referenceRange: 'Clear' },
    { parameter: 'pH', value: '', unit: '', referenceMin: 4.5, referenceMax: 8.0 },
    { parameter: 'Specific Gravity', value: '', unit: '', referenceMin: 1.005, referenceMax: 1.030 },
    { parameter: 'Protein', value: '', unit: '', referenceRange: 'Negative' },
    { parameter: 'Glucose', value: '', unit: '', referenceRange: 'Negative' },
    { parameter: 'Ketones', value: '', unit: '', referenceRange: 'Negative' },
    { parameter: 'Bilirubin', value: '', unit: '', referenceRange: 'Negative' },
    { parameter: 'Urobilinogen', value: '', unit: 'mg/dL', referenceMin: 0.2, referenceMax: 1.0 },
    { parameter: 'Nitrite', value: '', unit: '', referenceRange: 'Negative' },
    { parameter: 'Leukocyte Esterase', value: '', unit: '', referenceRange: 'Negative' },
  ],
  'LAB-URINE-MCS': [
    { parameter: 'Pus Cells', value: '', unit: '/HPF', referenceRange: '0 - 5' },
    { parameter: 'Epithelial Cells', value: '', unit: '/HPF', referenceRange: 'Few' },
    { parameter: 'Red Blood Cells (RBC)', value: '', unit: '/HPF', referenceRange: '0 - 2' },
    { parameter: 'Casts', value: '', unit: '', referenceRange: 'Absent' },
    { parameter: 'Crystals', value: '', unit: '', referenceRange: 'Absent' },
    { parameter: 'Culture', value: '', unit: '', referenceRange: 'No Growth' },
    { parameter: 'Sensitivity', value: '', unit: '', referenceRange: 'N/A' },
  ],
  'LAB-HVS': [
    { parameter: 'Pus Cells', value: '', unit: '/HPF', referenceRange: '0 - 5' },
    { parameter: 'Epithelial Cells', value: '', unit: '/HPF', referenceRange: 'Moderate' },
    { parameter: 'Red Blood Cells (RBC)', value: '', unit: '/HPF', referenceRange: 'Absent' },
    { parameter: 'Yeast Cells', value: '', unit: '', referenceRange: 'Absent' },
    { parameter: 'Trichomonas vaginalis', value: '', unit: '', referenceRange: 'Absent' },
    { parameter: 'Culture', value: '', unit: '', referenceRange: 'Normal Flora' },
    { parameter: 'Sensitivity', value: '', unit: '', referenceRange: 'N/A' },
  ],
  'LAB-ECS': [
    { parameter: 'Pus Cells', value: '', unit: '/HPF', referenceRange: '0 - 5' },
    { parameter: 'Epithelial Cells', value: '', unit: '/HPF', referenceRange: 'Moderate' },
    { parameter: 'Red Blood Cells (RBC)', value: '', unit: '/HPF', referenceRange: 'Absent' },
    { parameter: 'Yeast Cells', value: '', unit: '', referenceRange: 'Absent' },
    { parameter: 'Trichomonas vaginalis', value: '', unit: '', referenceRange: 'Absent' },
    { parameter: 'Culture', value: '', unit: '', referenceRange: 'No Growth' },
    { parameter: 'Sensitivity', value: '', unit: '', referenceRange: 'N/A' },
  ],
  'LAB-STOOL-MCS': [
    { parameter: 'Macroscopy (Color/Consistency)', value: '', unit: '', referenceRange: 'Brown/Formed' },
    { parameter: 'Pus Cells', value: '', unit: '/HPF', referenceRange: 'Absent' },
    { parameter: 'Red Blood Cells', value: '', unit: '/HPF', referenceRange: 'Absent' },
    { parameter: 'Ova, Cysts & Parasites', value: '', unit: '', referenceRange: 'Not Seen' },
    { parameter: 'Culture', value: '', unit: '', referenceRange: 'Normal Flora' },
    { parameter: 'Sensitivity', value: '', unit: '', referenceRange: 'N/A' },
  ],
  'LAB-BLOOD-CULTURE': [
    { parameter: 'Culture (Aerobic)', value: '', unit: '', referenceRange: 'No Growth' },
    { parameter: 'Culture (Anaerobic)', value: '', unit: '', referenceRange: 'No Growth' },
    { parameter: 'Sensitivity', value: '', unit: '', referenceRange: 'N/A' },
  ],
  'LAB-AFB': [
    { parameter: 'Acid-Fast Bacilli (AFB)', value: '', unit: '', referenceRange: 'Negative' },
  ],
  'LAB-OCCULT': [
    { parameter: 'Fecal Occult Blood', value: '', unit: '', referenceRange: 'Negative' },
  ],
  'LAB-SFA': [
    { parameter: 'Volume', value: '', unit: 'mL', referenceMin: 1.5, referenceMax: 5.0 },
    { parameter: 'Appearance', value: '', unit: '', referenceRange: 'Greyish-white, Opaque' },
    { parameter: 'Liquefaction Time', value: '', unit: 'mins', referenceMax: 60 },
    { parameter: 'Viscosity', value: '', unit: '', referenceRange: 'Normal' },
    { parameter: 'pH', value: '', unit: '', referenceMin: 7.2, referenceMax: 8.0 },
    { parameter: 'Sperm Concentration', value: '', unit: 'x10⁶/mL', referenceMin: 15 },
    { parameter: 'Total Sperm Count', value: '', unit: 'x10⁶/ejaculate', referenceMin: 39 },
    { parameter: 'Progressive Motility', value: '', unit: '%', referenceMin: 32 },
    { parameter: 'Normal Morphology', value: '', unit: '%', referenceMin: 4 },
  ],

  // Serology & Immunology
  'LAB-PT': [
    { parameter: 'Pregnancy Test (Serum/Urine)', value: '', unit: '', referenceRange: 'Negative' },
  ],
  'LAB-HBSAG': [
    { parameter: 'Hepatitis B Surface Antigen (HBsAg)', value: '', unit: '', referenceRange: 'Negative' },
  ],
  'LAB-HCV': [
    { parameter: 'Hepatitis C Virus (HCV) Antibody', value: '', unit: '', referenceRange: 'Negative' },
  ],
  'LAB-HAV': [
    { parameter: 'Hepatitis A Virus (HAV) IgM', value: '', unit: '', referenceRange: 'Negative' },
    { parameter: 'Hepatitis A Virus (HAV) IgG', value: '', unit: '', referenceRange: 'Negative' },
  ],
  'LAB-RVS': [
    { parameter: 'Retroviral Screening (HIV 1 & 2)', value: '', unit: '', referenceRange: 'Negative' },
  ],
  'LAB-VDRL': [
    { parameter: 'VDRL / Syphilis', value: '', unit: '', referenceRange: 'Non-Reactive' },
  ],

  // Cytology / Pathology
  'LAB-PAP': [
    { parameter: 'Specimen Adequacy', value: '', unit: '', referenceRange: 'Satisfactory' },
    { parameter: 'General Categorization', value: '', unit: '', referenceRange: 'Negative for Intraepithelial Lesion or Malignancy' },
    { parameter: 'Interpretation / Result', value: '', unit: '', referenceRange: 'Normal' },
  ],

  // Imaging / Others (Logged in Lab for Billing but reported here)
  'LAB-US': [
    { parameter: 'Ultrasound Scan Report', value: '', unit: '', referenceRange: 'Normal Findings' },
    { parameter: 'Conclusion', value: '', unit: '', referenceRange: 'N/A' },
  ],
  'LAB-TVS': [
    { parameter: 'Transvaginal Scan Report', value: '', unit: '', referenceRange: 'Normal Findings' },
    { parameter: 'Conclusion', value: '', unit: '', referenceRange: 'N/A' },
  ],
};

const prisma = new PrismaClient();
const TENANT_SLUG = 'st-stephen-hospital';

const LAB_TESTS_WITH_PRICES = [
  { name: 'Seminal Fluid Analysis (S.F.A)', code: 'LAB-SFA', price: 8000 },
  { name: 'H-Pylori', code: 'LAB-HPYLORI', price: 3000 },
  { name: 'Serum Bilirubin (SB, TB)', code: 'LAB-BILIRUBIN', price: 4000 },
  { name: 'Thyroid profile (Testosterone, T3, T4)', code: 'LAB-THYROID', price: 12500 },
  { name: 'High Vaginal Swab (HVS)', code: 'LAB-HVS', price: 5000 },
  { name: 'Endocervical Swab (ECS)', code: 'LAB-ECS', price: 5000 },
  { name: 'Ultrasound (US)', code: 'LAB-US', price: 5000 },
  { name: 'Urine/mcs', code: 'LAB-URINE-MCS', price: 5000 },
  { name: 'Transvaginal Scan (TVS)', code: 'LAB-TVS', price: 10000 },
  { name: 'FSH', code: 'LAB-FSH', price: 12500 },
  { name: 'LH', code: 'LAB-LH', price: 12500 },
  { name: 'Prolactin', code: 'LAB-PROLACTIN', price: 12500 },
  { name: 'Full Blood Count (FBC)', code: 'LAB-FBC', price: 5000 },
  { name: 'Malaria Parasite (MP)', code: 'LAB-MP', price: 2000 },
  { name: 'Packed Cell Volume (PCV)', code: 'LAB-PCV', price: 2000 },
  { name: 'WIDAL', code: 'LAB-WIDAL', price: 3000 },
  { name: 'Random Blood Sugar (RBS)', code: 'LAB-RBS', price: 2000 },
  { name: 'Fasting Blood Sugar (FBS)', code: 'LAB-FBS', price: 2000 },
  { name: 'Erythrocyte Sedimentation Rate (ESR)', code: 'LAB-ESR', price: 4000 },
  { name: 'Pregnancy Test (PT)', code: 'LAB-PT', price: 2000 },
  { name: 'HBSAg (Hepatitis B)', code: 'LAB-HBSAG', price: 2000 },
  { name: 'HCV (Hepatitis C)', code: 'LAB-HCV', price: 2000 },
  { name: 'H/A (Hepatitis A)', code: 'LAB-HAV', price: 2000 },
  { name: 'Retroviral Screening (RVS)', code: 'LAB-RVS', price: 4000 },
  { name: 'VDRL', code: 'LAB-VDRL', price: 2000 },
  { name: 'Cholesterol (CHOL)', code: 'LAB-CHOL', price: 5000 },
  { name: 'Lipid Profile', code: 'LAB-LIPID', price: 20000 },
  { name: 'F/P profile', code: 'LAB-FP', price: 15000 },
  { name: 'Prostate Specific Antigen (PSA)', code: 'LAB-PSA', price: 15000 },
  { name: 'Beta-HCG (B-HCG)', code: 'LAB-BHCG', price: 15000 },
  { name: 'Liver Function Test (LFT)', code: 'LAB-LFT', price: 20000 },
  { name: 'Glucose', code: 'LAB-GLUCOSE', price: 20000 },
  { name: 'Hormone Profile', code: 'LAB-HORMONE', price: 50000 }
];

const ADDITIONAL_LAB_TESTS = [
  { name: 'Urinalysis', code: 'LAB-URINALYSIS', price: 0 },
  { name: 'E/U/Cr (Electrolytes, Urea, Creatinine)', code: 'LAB-EUCR', price: 0 },
  { name: 'Uric Acid', code: 'LAB-URICACID', price: 0 },
  { name: 'Calcium', code: 'LAB-CALCIUM', price: 0 },
  { name: 'Phosphorus', code: 'LAB-PHOSPHORUS', price: 0 },
  { name: 'Magnesium', code: 'LAB-MAGNESIUM', price: 0 },
  { name: 'Serum Amylase', code: 'LAB-AMYLASE', price: 0 },
  { name: 'Serum Lipase', code: 'LAB-LIPASE', price: 0 },
  { name: 'CK-MB', code: 'LAB-CKMB', price: 0 },
  { name: 'Troponin I/T', code: 'LAB-TROPONIN', price: 0 },
  { name: 'D-Dimer', code: 'LAB-DDIMER', price: 0 },
  { name: 'Coagulation Profile (PT/APTT/INR)', code: 'LAB-COAG', price: 0 },
  { name: 'Blood Culture', code: 'LAB-BLOOD-CULTURE', price: 0 },
  { name: 'Sputum AFB', code: 'LAB-AFB', price: 0 },
  { name: 'Stool Microscopy', code: 'LAB-STOOL-MCS', price: 0 },
  { name: 'Occult Blood', code: 'LAB-OCCULT', price: 0 },
  { name: 'Pap Smear', code: 'LAB-PAP', price: 0 },
  { name: 'C-Reactive Protein (CRP)', code: 'LAB-CRP', price: 0 },
  { name: 'Rheumatoid Factor (RF)', code: 'LAB-RF', price: 0 },
  { name: 'HbA1c', code: 'LAB-HBA1C', price: 0 },
  { name: 'ABO/Rh Blood Grouping', code: 'LAB-BLOODGROUP', price: 0 },
  { name: 'Genotype', code: 'LAB-GENOTYPE', price: 0 },
  { name: 'Coombs Test', code: 'LAB-COOMBS', price: 0 }
];

async function main() {
  console.log('Seeding Lab Architecture...');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG }
  });

  if (!tenant) {
    console.error('Tenant not found. Run main seed script first.');
    process.exit(1);
  }

  const allTests = [...LAB_TESTS_WITH_PRICES, ...ADDITIONAL_LAB_TESTS];
  let createdCount = 0;

  for (const test of allTests) {
    // 1. Create or Update Service Catalog (Billing)
    const existingCatalog = await prisma.serviceCatalog.findUnique({
      where: {
        tenantId_serviceCode: {
          tenantId: tenant.id,
          serviceCode: test.code
        }
      }
    });

    if (existingCatalog) {
      await prisma.serviceCatalog.update({
        where: { id: existingCatalog.id },
        data: {
          serviceName: test.name,
          basePrice: test.price,
          category: 'LAB_TEST'
        }
      });
    } else {
      await prisma.serviceCatalog.create({
        data: {
          tenantId: tenant.id,
          serviceCode: test.code,
          serviceName: test.name,
          basePrice: test.price,
          category: 'LAB_TEST',
          isActive: true
        }
      });
    }

    // 2. Create or Update Lab Dictionary (Clinical)
    // @ts-ignore - Temporary fix for schema alignment
    let dictionary = await prisma.labDictionary.findUnique({
      where: {
        tenantId_testCode: {
          tenantId: tenant.id,
          testCode: test.code
        }
      }
    });

    if (!dictionary) {
      // @ts-ignore - Temporary fix for schema alignment
      dictionary = await prisma.labDictionary.create({
        data: {
          tenantId: tenant.id,
          testCode: test.code,
          testName: test.name,
          isActive: true
        }
      });
    } else {
      // @ts-ignore - Temporary fix for schema alignment
      dictionary = await prisma.labDictionary.update({
        where: { id: dictionary.id },
        data: { testName: test.name }
      });
    }

    // 3. Create Lab Parameters and Reference Ranges based on WHO Template
    const templateParams = LAB_TEMPLATES[test.code] || [{ parameter: 'Result', value: '', unit: '', referenceRange: '' }];
    
    // Clear old parameters to avoid duplicates during re-seeding
    // @ts-ignore - Temporary fix for schema alignment
    await prisma.labParameter.deleteMany({
      // @ts-ignore
      where: { labDictionaryId: dictionary.id }
    });

    for (let i = 0; i < templateParams.length; i++) {
      const tp = templateParams[i];
      // let valueType = 'NUMERIC';
      // if (tp.referenceRange && isNaN(Number(tp.referenceRange.charAt(0)))) {
      //   valueType = 'CATEGORICAL';
      // }

      // @ts-ignore - Temporary fix for schema alignment
      const param = await prisma.labParameter.create({
        data: {
          tenantId: tenant.id,
          // labDictionaryId: dictionary.id,
          name: tp.parameter,
          unit: tp.unit || null,
          // valueType: valueType,
          // orderIndex: i
        }
      });

      // Insert Reference Range
      if (tp.referenceMin !== undefined || tp.referenceMax !== undefined || tp.referenceRange) {
        // @ts-ignore - Temporary fix for schema alignment
        await prisma.labReferenceRange.create({
          data: {
            parameterId: param.id,
            minNumeric: tp.referenceMin !== undefined ? Number(tp.referenceMin) : null,
            maxNumeric: tp.referenceMax !== undefined ? Number(tp.referenceMax) : null,
            textRange: tp.referenceRange || null,
          }
        });
      }
    }
    
    createdCount++;
  }

  console.log(`Successfully mapped ${createdCount} tests into the relational WHO architecture.`);
}

main()
  .catch(e => {
    console.error('Failed to seed lab architecture:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
