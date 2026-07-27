/**
 * Bundled clinical vocabulary for the free-text suggestion engine
 * (see useClinicalSuggestions.ts / TypeaheadTextField.tsx).
 *
 * Deliberately a plain, local word list rather than a licensed terminology
 * database (SNOMED CT isn't reliably free outside member countries; RxNorm/
 * ICD-11 already have dedicated sources elsewhere in the app) — this covers
 * general SOAP/exam/surgical/postop vocabulary that has no other catalog to
 * draw from, so suggestions still work with no network connection.
 */

export const CLINICAL_TERMS: string[] = [
  // Symptoms / chief complaints
  'fever', 'cough', 'headache', 'nausea', 'vomiting', 'diarrhea', 'dizziness',
  'fatigue', 'malaise', 'chills', 'rigors', 'dyspnea', 'tachypnea', 'tachycardia',
  'bradycardia', 'hypertension', 'hypotension', 'palpitations', 'syncope',
  'presyncope', 'dysuria', 'hematuria', 'hematemesis', 'hemoptysis', 'melena',
  'hematochezia', 'jaundice', 'pruritus', 'rash', 'edema', 'cyanosis', 'pallor',
  'diaphoresis', 'anorexia', 'insomnia', 'polyuria', 'polydipsia', 'polyphagia',
  'dysphagia', 'odynophagia', 'dyspepsia', 'constipation', 'myalgia', 'arthralgia',
  'paresthesia', 'numbness', 'weakness', 'seizure', 'tremor', 'vertigo',
  'tinnitus', 'epistaxis', 'otalgia', 'rhinorrhea', 'hoarseness', 'photophobia',
  'phonophobia', 'orthopnea', 'claudication',

  // Exam findings / general descriptors
  'auscultation', 'palpation', 'percussion', 'inspection', 'tenderness',
  'rebound', 'guarding', 'rigidity', 'distension', 'hepatomegaly',
  'splenomegaly', 'lymphadenopathy', 'murmur', 'rales', 'rhonchi', 'wheeze',
  'wheezing', 'crackles', 'stridor', 'bruit', 'thrill', 'gallop', 'tachypneic',
  'afebrile', 'febrile', 'diaphoretic', 'jaundiced', 'icteric', 'cachectic',
  'ambulatory', 'lethargic', 'somnolent', 'obtunded', 'comatose', 'unresponsive',
  'alert', 'oriented', 'coherent', 'nontender', 'nondistended', 'unremarkable',
  'bilaterally', 'symmetric', 'erythema', 'erythematous', 'induration',
  'ecchymosis', 'excoriation', 'lesion', 'ulceration', 'discharge', 'exudate',

  // Anatomy
  'abdomen', 'thorax', 'cranium', 'cervical', 'thoracic', 'lumbar', 'sacral',
  'epigastric', 'hypogastric', 'periumbilical', 'inguinal', 'axillary',
  'popliteal', 'clavicle', 'sternum', 'scapula', 'femur', 'tibia', 'fibula',
  'humerus', 'mandible', 'maxilla', 'larynx', 'pharynx', 'trachea', 'bronchus',
  'esophagus', 'duodenum', 'jejunum', 'ileum', 'cecum', 'sigmoid', 'rectum',
  'urethra', 'ureter', 'bladder', 'prostate', 'uterus', 'ovary', 'cervix',
  'vagina', 'scrotum', 'testis', 'epididymis', 'peritoneum', 'mesentery',
  'omentum', 'diaphragm', 'pericardium', 'myocardium', 'endocardium',

  // Surgical / operative
  'incision', 'excision', 'resection', 'anastomosis', 'ligation',
  'cauterization', 'debridement', 'hemostasis', 'laparotomy', 'laparoscopy',
  'appendectomy', 'cholecystectomy', 'herniorrhaphy', 'mastectomy',
  'hysterectomy', 'nephrectomy', 'splenectomy', 'thoracotomy', 'craniotomy',
  'tracheostomy', 'colostomy', 'ileostomy', 'suture', 'sutured', 'staple',
  'stapled', 'drain', 'drainage', 'dissection', 'retraction', 'adhesion',
  'adhesiolysis', 'hemostat', 'electrocautery', 'insufflation', 'trocar',
  'specimen', 'biopsy', 'subcuticular', 'perioperative', 'intraoperative',
  'postoperative', 'preoperative', 'hemostatic', 'irrigation', 'closure',

  // Anesthesia
  'anesthesia', 'anaesthesia', 'anesthetic', 'anaesthetic', 'spinal',
  'epidural', 'sedation', 'intubation', 'extubation', 'endotracheal',
  'laryngoscopy', 'propofol', 'ketamine', 'fentanyl', 'midazolam', 'lidocaine',
  'bupivacaine', 'succinylcholine', 'rocuronium', 'anesthesiologist',
  'anesthetist', 'analgesia', 'analgesic',

  // Postop / discharge planning
  'antiemetic', 'antipyretic', 'anticoagulant', 'thromboprophylaxis',
  'ambulation', 'mobilization', 'physiotherapy', 'rehabilitation', 'discharge',
  'discharged', 'complications', 'uneventful', 'stable', 'recovery',
  'monitoring', 'observation',

  // Route / frequency
  'oral', 'intravenous', 'intramuscular', 'subcutaneous', 'sublingual',
  'topical', 'antihypertensive', 'antidiabetic', 'bronchodilator', 'diuretic',
  'corticosteroid', 'antihistamine', 'prophylaxis',

  // Common diagnosis-adjacent terms
  'infection', 'inflammation', 'fracture', 'sprain', 'strain', 'laceration',
  'contusion', 'abscess', 'cellulitis', 'sepsis', 'anemia', 'dehydration',
  'malnutrition', 'hypoglycemia', 'hyperglycemia', 'hypoxia', 'hypoxemia',
  'ischemia', 'infarction', 'hemorrhage', 'thrombosis', 'embolism',
  'obstruction', 'perforation', 'rupture', 'hernia', 'malignant', 'benign',
  'metastasis', 'carcinoma', 'adenoma', 'neoplasm',
];
