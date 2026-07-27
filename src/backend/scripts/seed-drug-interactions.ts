/**
 * Seeds the DrugInteraction table with a curated, offline, static set of
 * well-documented drug-drug interactions relevant to general/family
 * practice, OB, and pharmacy dispensing in a resource-limited setting.
 *
 * Not a claim of pharmacological completeness — same pragmatic-reviewable-list
 * spirit as drug-class-groups.ts. Names use standard generic/INN nomenclature
 * so the existing contains-based matching in drug-interaction-checker.service.ts
 * catches them regardless of which exact formulary entries are in use.
 *
 * Run with: npx ts-node src/backend/scripts/seed-drug-interactions.ts
 */
import { PrismaClient, AlertSeverity } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedInteraction {
  drug1: string;
  drug2: string;
  severity: AlertSeverity;
  description: string;
  clinicalEffect?: string;
  management?: string;
}

const INTERACTIONS: SeedInteraction[] = [
  // Anticoagulants / antiplatelets
  { drug1: 'Warfarin', drug2: 'Aspirin', severity: 'CRITICAL', description: 'Additive anticoagulant/antiplatelet effect', clinicalEffect: 'Significantly increased bleeding risk', management: 'Avoid combination unless specifically indicated and monitored' },
  { drug1: 'Warfarin', drug2: 'Ibuprofen', severity: 'CRITICAL', description: 'NSAID displaces warfarin and impairs platelet function', clinicalEffect: 'Increased GI and systemic bleeding risk', management: 'Avoid; use paracetamol for analgesia instead' },
  { drug1: 'Warfarin', drug2: 'Diclofenac', severity: 'CRITICAL', description: 'NSAID displaces warfarin and impairs platelet function', clinicalEffect: 'Increased bleeding risk', management: 'Avoid; use paracetamol instead' },
  { drug1: 'Warfarin', drug2: 'Metronidazole', severity: 'CRITICAL', description: 'Metronidazole inhibits warfarin metabolism (CYP2C9)', clinicalEffect: 'Markedly increased INR and bleeding risk', management: 'Avoid or reduce warfarin dose with close INR monitoring' },
  { drug1: 'Warfarin', drug2: 'Ciprofloxacin', severity: 'WARNING', description: 'Fluoroquinolone potentiates warfarin effect', clinicalEffect: 'Elevated INR', management: 'Monitor INR closely if combination necessary' },
  { drug1: 'Warfarin', drug2: 'Amoxicillin', severity: 'WARNING', description: 'Broad-spectrum antibiotics can potentiate warfarin via gut flora suppression', clinicalEffect: 'Elevated INR', management: 'Monitor INR during and after antibiotic course' },
  { drug1: 'Warfarin', drug2: 'Rifampicin', severity: 'WARNING', description: 'Rifampicin strongly induces warfarin metabolism', clinicalEffect: 'Reduced anticoagulant effect', management: 'Increase INR monitoring frequency; dose adjustment likely needed' },
  { drug1: 'Warfarin', drug2: 'Fluconazole', severity: 'CRITICAL', description: 'Azole antifungal inhibits warfarin metabolism', clinicalEffect: 'Markedly increased INR and bleeding risk', management: 'Avoid or reduce dose with close INR monitoring' },
  { drug1: 'Aspirin', drug2: 'Clopidogrel', severity: 'WARNING', description: 'Additive antiplatelet effect (often intentional in dual therapy)', clinicalEffect: 'Increased bleeding risk', management: 'Confirm indication (e.g. post-ACS); monitor for bleeding' },
  { drug1: 'Aspirin', drug2: 'Ibuprofen', severity: 'WARNING', description: 'Ibuprofen can blunt aspirin\'s cardioprotective antiplatelet effect and adds GI risk', clinicalEffect: 'Reduced cardioprotection, increased GI bleeding', management: 'Space doses or use alternative analgesic' },
  { drug1: 'Heparin', drug2: 'Aspirin', severity: 'WARNING', description: 'Additive anticoagulant/antiplatelet effect', clinicalEffect: 'Increased bleeding risk', management: 'Monitor closely' },

  // ACE-inhibitors / ARBs / diuretics / potassium
  { drug1: 'Lisinopril', drug2: 'Spironolactone', severity: 'CRITICAL', description: 'Combined potassium-sparing effect', clinicalEffect: 'Risk of severe hyperkalemia', management: 'Monitor serum potassium closely; avoid in renal impairment' },
  { drug1: 'Enalapril', drug2: 'Spironolactone', severity: 'CRITICAL', description: 'Combined potassium-sparing effect', clinicalEffect: 'Risk of severe hyperkalemia', management: 'Monitor serum potassium closely' },
  { drug1: 'Lisinopril', drug2: 'Potassium Chloride', severity: 'WARNING', description: 'ACE inhibitor reduces potassium excretion', clinicalEffect: 'Risk of hyperkalemia', management: 'Monitor serum potassium' },
  { drug1: 'Losartan', drug2: 'Spironolactone', severity: 'CRITICAL', description: 'Combined potassium-sparing effect (ARB + potassium-sparing diuretic)', clinicalEffect: 'Risk of severe hyperkalemia', management: 'Monitor serum potassium closely' },
  { drug1: 'Lisinopril', drug2: 'Ibuprofen', severity: 'WARNING', description: 'NSAID reduces renal prostaglandins, blunting ACE-inhibitor effect', clinicalEffect: 'Reduced antihypertensive effect, risk of acute kidney injury', management: 'Avoid regular NSAID use; monitor renal function and BP' },
  { drug1: 'Lisinopril', drug2: 'Diclofenac', severity: 'WARNING', description: 'NSAID reduces renal prostaglandins, blunting ACE-inhibitor effect', clinicalEffect: 'Reduced antihypertensive effect, risk of acute kidney injury', management: 'Avoid regular NSAID use; monitor renal function' },
  { drug1: 'Furosemide', drug2: 'Gentamicin', severity: 'CRITICAL', description: 'Additive ototoxicity and nephrotoxicity', clinicalEffect: 'Increased risk of hearing loss and renal injury', management: 'Avoid combination if possible; monitor renal function and hearing' },
  { drug1: 'Hydrochlorothiazide', drug2: 'Lithium', severity: 'CRITICAL', description: 'Thiazide diuretics reduce lithium clearance', clinicalEffect: 'Risk of lithium toxicity', management: 'Avoid or monitor lithium levels closely' },
  { drug1: 'Furosemide', drug2: 'Digoxin', severity: 'WARNING', description: 'Diuretic-induced hypokalemia increases digoxin toxicity risk', clinicalEffect: 'Risk of digoxin toxicity/arrhythmia', management: 'Monitor potassium and digoxin levels' },
  { drug1: 'Amlodipine', drug2: 'Simvastatin', severity: 'WARNING', description: 'Amlodipine inhibits CYP3A4 metabolism of simvastatin', clinicalEffect: 'Increased risk of myopathy/rhabdomyolysis at higher statin doses', management: 'Limit simvastatin to 20mg/day with amlodipine' },

  // Antidiabetics
  { drug1: 'Metformin', drug2: 'Contrast Media', severity: 'CRITICAL', description: 'Risk of contrast-induced nephropathy leading to metformin accumulation', clinicalEffect: 'Risk of lactic acidosis', management: 'Hold metformin before/after contrast studies per protocol' },
  { drug1: 'Glibenclamide', drug2: 'Co-trimoxazole', severity: 'CRITICAL', description: 'Sulfonamide potentiates sulfonylurea hypoglycemic effect', clinicalEffect: 'Risk of severe hypoglycemia', management: 'Monitor blood glucose closely; consider alternative antibiotic' },
  { drug1: 'Glibenclamide', drug2: 'Fluconazole', severity: 'WARNING', description: 'Azole inhibits sulfonylurea metabolism', clinicalEffect: 'Increased hypoglycemia risk', management: 'Monitor blood glucose' },
  { drug1: 'Insulin', drug2: 'Prednisolone', severity: 'WARNING', description: 'Corticosteroids antagonize insulin action', clinicalEffect: 'Hyperglycemia, may require insulin dose adjustment', management: 'Monitor blood glucose during steroid therapy' },
  { drug1: 'Metformin', drug2: 'Furosemide', severity: 'INFO', description: 'Diuretic may affect glycemic control indirectly', clinicalEffect: 'Mild glucose elevation', management: 'Routine glucose monitoring' },
  { drug1: 'Gliclazide', drug2: 'Co-trimoxazole', severity: 'CRITICAL', description: 'Sulfonamide potentiates sulfonylurea hypoglycemic effect', clinicalEffect: 'Risk of severe hypoglycemia', management: 'Monitor blood glucose closely' },

  // Antibiotics / antifungals / antimalarials
  { drug1: 'Ciprofloxacin', drug2: 'Theophylline', severity: 'CRITICAL', description: 'Fluoroquinolone inhibits theophylline metabolism', clinicalEffect: 'Risk of theophylline toxicity (seizures, arrhythmia)', management: 'Avoid or monitor theophylline levels' },
  { drug1: 'Ciprofloxacin', drug2: 'Antacids', severity: 'WARNING', description: 'Divalent cations chelate fluoroquinolones', clinicalEffect: 'Reduced antibiotic absorption/efficacy', management: 'Separate dosing by at least 2 hours' },
  { drug1: 'Erythromycin', drug2: 'Simvastatin', severity: 'CRITICAL', description: 'Macrolide inhibits CYP3A4 metabolism of statin', clinicalEffect: 'Risk of rhabdomyolysis', management: 'Avoid combination or suspend statin during antibiotic course' },
  { drug1: 'Clarithromycin', drug2: 'Simvastatin', severity: 'CRITICAL', description: 'Macrolide inhibits CYP3A4 metabolism of statin', clinicalEffect: 'Risk of rhabdomyolysis', management: 'Avoid combination or suspend statin during antibiotic course' },
  { drug1: 'Azithromycin', drug2: 'Chloroquine', severity: 'WARNING', description: 'Additive QT-prolonging effect', clinicalEffect: 'Risk of arrhythmia (torsades de pointes)', management: 'Use with caution; ECG monitoring if risk factors present' },
  { drug1: 'Fluconazole', drug2: 'Simvastatin', severity: 'WARNING', description: 'Azole inhibits statin metabolism', clinicalEffect: 'Increased myopathy risk', management: 'Consider temporary statin suspension during antifungal course' },
  { drug1: 'Rifampicin', drug2: 'Oral Contraceptive', severity: 'CRITICAL', description: 'Rifampicin induces hepatic metabolism of estrogen/progestin', clinicalEffect: 'Contraceptive failure risk', management: 'Advise additional barrier contraception during and after rifampicin course' },
  { drug1: 'Rifampicin', drug2: 'Nevirapine', severity: 'WARNING', description: 'Rifampicin induces metabolism of NNRTIs', clinicalEffect: 'Reduced antiretroviral efficacy', management: 'Dose adjustment or alternative anti-TB regimen per guidelines' },
  { drug1: 'Isoniazid', drug2: 'Phenytoin', severity: 'WARNING', description: 'Isoniazid inhibits phenytoin metabolism', clinicalEffect: 'Risk of phenytoin toxicity', management: 'Monitor phenytoin levels' },
  { drug1: 'Metronidazole', drug2: 'Alcohol', severity: 'WARNING', description: 'Disulfiram-like reaction', clinicalEffect: 'Flushing, nausea, vomiting, palpitations', management: 'Advise complete alcohol avoidance during and 48h after treatment' },
  { drug1: 'Doxycycline', drug2: 'Antacids', severity: 'WARNING', description: 'Divalent/trivalent cations chelate tetracyclines', clinicalEffect: 'Reduced antibiotic absorption', management: 'Separate dosing by at least 2-3 hours' },
  { drug1: 'Doxycycline', drug2: 'Iron', severity: 'WARNING', description: 'Iron chelates tetracyclines', clinicalEffect: 'Reduced antibiotic absorption', management: 'Separate dosing by at least 2-3 hours' },
  { drug1: 'Amoxicillin', drug2: 'Allopurinol', severity: 'INFO', description: 'Increased incidence of skin rash reported with combination', clinicalEffect: 'Higher risk of maculopapular rash', management: 'Monitor for rash; not a contraindication' },
  { drug1: 'Artemether + Lumefantrine', drug2: 'Fluconazole', severity: 'WARNING', description: 'Additive QT-prolonging effect', clinicalEffect: 'Risk of arrhythmia', management: 'Use with caution; avoid in patients with known QT prolongation' },
  { drug1: 'Quinine', drug2: 'Chloroquine', severity: 'CRITICAL', description: 'Additive cardiotoxicity and QT prolongation', clinicalEffect: 'Risk of severe arrhythmia', management: 'Avoid concurrent use' },

  // CNS / psychiatric / antiepileptic
  { drug1: 'Fluoxetine', drug2: 'Tramadol', severity: 'CRITICAL', description: 'Additive serotonergic effect', clinicalEffect: 'Risk of serotonin syndrome and lowered seizure threshold', management: 'Avoid combination or use with extreme caution' },
  { drug1: 'Sertraline', drug2: 'Tramadol', severity: 'CRITICAL', description: 'Additive serotonergic effect', clinicalEffect: 'Risk of serotonin syndrome', management: 'Avoid combination or use with extreme caution' },
  { drug1: 'Fluoxetine', drug2: 'Amitriptyline', severity: 'WARNING', description: 'SSRI inhibits tricyclic antidepressant metabolism', clinicalEffect: 'Increased TCA levels and toxicity risk', management: 'Monitor for anticholinergic/cardiac toxicity; consider dose reduction' },
  { drug1: 'Phenelzine', drug2: 'Fluoxetine', severity: 'CRITICAL', description: 'MAOI + SSRI combination', clinicalEffect: 'Risk of life-threatening serotonin syndrome', management: 'Contraindicated; require washout period between agents' },
  { drug1: 'Diazepam', drug2: 'Tramadol', severity: 'WARNING', description: 'Additive CNS and respiratory depression', clinicalEffect: 'Risk of sedation and respiratory depression', management: 'Use lowest effective doses; monitor closely' },
  { drug1: 'Diazepam', drug2: 'Morphine', severity: 'CRITICAL', description: 'Additive CNS and respiratory depression', clinicalEffect: 'Risk of severe sedation, respiratory depression, death', management: 'Avoid combination unless closely monitored; consider dose reduction' },
  { drug1: 'Phenytoin', drug2: 'Fluconazole', severity: 'WARNING', description: 'Azole inhibits phenytoin metabolism', clinicalEffect: 'Risk of phenytoin toxicity', management: 'Monitor phenytoin levels' },
  { drug1: 'Carbamazepine', drug2: 'Oral Contraceptive', severity: 'WARNING', description: 'Carbamazepine induces hepatic metabolism of estrogen/progestin', clinicalEffect: 'Contraceptive failure risk', management: 'Advise additional barrier contraception' },
  { drug1: 'Sodium Valproate', drug2: 'Aspirin', severity: 'WARNING', description: 'Aspirin displaces valproate from protein binding and inhibits metabolism', clinicalEffect: 'Increased free valproate levels, toxicity risk', management: 'Monitor for valproate toxicity' },
  { drug1: 'Haloperidol', drug2: 'Fluoxetine', severity: 'WARNING', description: 'SSRI inhibits haloperidol metabolism; additive QT effect', clinicalEffect: 'Increased extrapyramidal effects and QT prolongation risk', management: 'Monitor for EPS and ECG changes' },

  // Cardiac
  { drug1: 'Digoxin', drug2: 'Amiodarone', severity: 'CRITICAL', description: 'Amiodarone inhibits digoxin clearance', clinicalEffect: 'Risk of digoxin toxicity', management: 'Reduce digoxin dose by ~50%; monitor levels' },
  { drug1: 'Digoxin', drug2: 'Verapamil', severity: 'WARNING', description: 'Verapamil reduces digoxin clearance', clinicalEffect: 'Increased digoxin levels, toxicity risk', management: 'Monitor digoxin levels; consider dose reduction' },
  { drug1: 'Digoxin', drug2: 'Furosemide', severity: 'WARNING', description: 'Diuretic-induced hypokalemia potentiates digoxin toxicity', clinicalEffect: 'Risk of arrhythmia', management: 'Monitor potassium and digoxin levels' },
  { drug1: 'Amiodarone', drug2: 'Simvastatin', severity: 'WARNING', description: 'Amiodarone inhibits statin metabolism', clinicalEffect: 'Increased myopathy risk', management: 'Limit simvastatin dose or use alternative statin' },
  { drug1: 'Beta-blocker', drug2: 'Verapamil', severity: 'CRITICAL', description: 'Additive negative chronotropic/inotropic effect', clinicalEffect: 'Risk of severe bradycardia, heart block, hypotension', management: 'Avoid IV combination; use oral combination cautiously with monitoring' },
  { drug1: 'Propranolol', drug2: 'Verapamil', severity: 'CRITICAL', description: 'Additive negative chronotropic/inotropic effect', clinicalEffect: 'Risk of severe bradycardia, heart block', management: 'Avoid combination or use with close cardiac monitoring' },
  { drug1: 'Propranolol', drug2: 'Salbutamol', severity: 'WARNING', description: 'Non-selective beta-blocker antagonizes beta-agonist bronchodilation', clinicalEffect: 'Reduced bronchodilator efficacy, risk of bronchospasm', management: 'Avoid non-selective beta-blockers in asthma/COPD patients' },

  // Steroids / immunosuppressants / methotrexate
  { drug1: 'Methotrexate', drug2: 'Ibuprofen', severity: 'CRITICAL', description: 'NSAID reduces renal clearance of methotrexate', clinicalEffect: 'Risk of methotrexate toxicity (bone marrow suppression)', management: 'Avoid NSAIDs with high-dose methotrexate; caution with low-dose' },
  { drug1: 'Methotrexate', drug2: 'Co-trimoxazole', severity: 'CRITICAL', description: 'Additive antifolate effect', clinicalEffect: 'Risk of severe bone marrow suppression', management: 'Avoid combination' },
  { drug1: 'Prednisolone', drug2: 'Ibuprofen', severity: 'WARNING', description: 'Additive GI mucosal toxicity', clinicalEffect: 'Increased risk of peptic ulceration/GI bleeding', management: 'Co-prescribe gastroprotection (e.g. PPI) if combination necessary' },
  { drug1: 'Prednisolone', drug2: 'Diclofenac', severity: 'WARNING', description: 'Additive GI mucosal toxicity', clinicalEffect: 'Increased risk of peptic ulceration/GI bleeding', management: 'Co-prescribe gastroprotection if combination necessary' },

  // Anti-TB / antivirals
  { drug1: 'Rifampicin', drug2: 'Metformin', severity: 'INFO', description: 'Rifampicin may reduce metformin plasma levels', clinicalEffect: 'Possible reduced glycemic control', management: 'Monitor blood glucose during anti-TB therapy' },
  { drug1: 'Rifampicin', drug2: 'Prednisolone', severity: 'WARNING', description: 'Rifampicin induces corticosteroid metabolism', clinicalEffect: 'Reduced steroid efficacy', management: 'May require increased steroid dose' },
  { drug1: 'Efavirenz', drug2: 'Rifampicin', severity: 'INFO', description: 'Rifampicin may reduce efavirenz levels', clinicalEffect: 'Possible reduced antiretroviral efficacy at standard dose', management: 'Follow national ART/TB co-treatment dosing guidance' },

  // Opioids / respiratory
  { drug1: 'Morphine', drug2: 'Diazepam', severity: 'CRITICAL', description: 'Additive CNS and respiratory depression', clinicalEffect: 'Risk of severe sedation, respiratory depression, death', management: 'Avoid combination unless closely monitored' },
  { drug1: 'Tramadol', drug2: 'Fluoxetine', severity: 'CRITICAL', description: 'Additive serotonergic effect and lowered seizure threshold', clinicalEffect: 'Risk of serotonin syndrome and seizures', management: 'Avoid combination' },
  { drug1: 'Codeine', drug2: 'Diazepam', severity: 'WARNING', description: 'Additive CNS and respiratory depression', clinicalEffect: 'Risk of sedation and respiratory depression', management: 'Use lowest effective doses; monitor closely' },

  // Anticholinergic / GI
  { drug1: 'Omeprazole', drug2: 'Clopidogrel', severity: 'WARNING', description: 'Omeprazole inhibits CYP2C19 activation of clopidogrel', clinicalEffect: 'Reduced antiplatelet efficacy', management: 'Consider pantoprazole or H2-blocker as alternative gastroprotection' },
  { drug1: 'Omeprazole', drug2: 'Ketoconazole', severity: 'WARNING', description: 'Reduced gastric acidity impairs ketoconazole absorption', clinicalEffect: 'Reduced antifungal efficacy', management: 'Separate dosing or use alternative antifungal' },

  // Obstetric / contraceptive relevant
  { drug1: 'Oral Contraceptive', drug2: 'Griseofulvin', severity: 'WARNING', description: 'Griseofulvin induces hepatic metabolism of contraceptive hormones', clinicalEffect: 'Contraceptive failure risk', management: 'Advise additional barrier contraception' },
  { drug1: 'Methyldopa', drug2: 'Iron', severity: 'INFO', description: 'Iron may reduce methyldopa absorption', clinicalEffect: 'Reduced antihypertensive effect', management: 'Separate dosing by 2 hours' },
  { drug1: 'Magnesium Sulfate', drug2: 'Nifedipine', severity: 'CRITICAL', description: 'Additive calcium-channel blocking / neuromuscular effect', clinicalEffect: 'Risk of profound hypotension and respiratory depression', management: 'Use with extreme caution in pre-eclampsia management; monitor closely' },

  // Miscellaneous common primary-care combinations
  { drug1: 'Allopurinol', drug2: 'Azathioprine', severity: 'CRITICAL', description: 'Allopurinol inhibits xanthine oxidase metabolism of azathioprine', clinicalEffect: 'Risk of severe bone marrow suppression', management: 'Reduce azathioprine dose by 75% or avoid combination' },
  { drug1: 'Simvastatin', drug2: 'Gemfibrozil', severity: 'CRITICAL', description: 'Gemfibrozil markedly increases statin levels', clinicalEffect: 'High risk of rhabdomyolysis', management: 'Avoid combination; consider fenofibrate if fibrate needed' },
  { drug1: 'Theophylline', drug2: 'Erythromycin', severity: 'WARNING', description: 'Macrolide inhibits theophylline metabolism', clinicalEffect: 'Risk of theophylline toxicity', management: 'Monitor theophylline levels' },
  { drug1: 'Lithium', drug2: 'Lisinopril', severity: 'WARNING', description: 'ACE inhibitor reduces lithium renal clearance', clinicalEffect: 'Risk of lithium toxicity', management: 'Monitor lithium levels' },
  { drug1: 'Lithium', drug2: 'Ibuprofen', severity: 'WARNING', description: 'NSAID reduces lithium renal clearance', clinicalEffect: 'Risk of lithium toxicity', management: 'Avoid regular NSAID use; monitor lithium levels' },
];

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('No tenant found. Please seed the DB first.');
    return;
  }
  const tenantId = tenant.id;

  let created = 0;
  let skipped = 0;

  for (const interaction of INTERACTIONS) {
    const exists = await prisma.drugInteraction.findFirst({
      where: {
        tenantId,
        OR: [
          { drug1: interaction.drug1, drug2: interaction.drug2 },
          { drug1: interaction.drug2, drug2: interaction.drug1 },
        ],
      },
    });

    if (exists) {
      skipped++;
      continue;
    }

    await prisma.drugInteraction.create({
      data: {
        tenantId,
        drug1: interaction.drug1,
        drug2: interaction.drug2,
        severity: interaction.severity,
        description: interaction.description,
        clinicalEffect: interaction.clinicalEffect,
        management: interaction.management,
        source: 'Curated - general/family practice reference',
        lastVerified: new Date(),
      },
    });
    created++;
  }

  console.log(`Drug interactions seeded: ${created} created, ${skipped} already existed.`);
}

main().finally(() => prisma.$disconnect());
