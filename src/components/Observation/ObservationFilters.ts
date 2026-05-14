// ---------------------------------------------------------------------------
// Types & constants for ObservationsPanel filters.
// Kept in a separate file so ObservationsPanel.tsx only exports React
// components — required for Vite / React Fast Refresh to work correctly.
// ---------------------------------------------------------------------------

export type ObservationFilter = {
    /** Tab label shown in the UI */
    label: string;

    /**
     * FHIR category codes to match (e.g. 'vital-signs', 'laboratory').
     * At least one must match. Omit to allow any category.
     */
    categories?: string[];

    /**
     * LOINC or SNOMED codes to match against the observation's code.coding.
     * At least one must match. Omit to allow any code.
     */
    codes?: string[];

    /**
     * Keywords matched case-insensitively against the observation's code text
     * and coding display values. At least one must match. Omit to skip.
     */
    keywords?: string[];

    /**
     * Only include observations recorded on or after this date (day-level, inclusive).
     */
    after?: Date;

    /**
     * Only include observations recorded on or before this date (day-level, inclusive).
     */
    before?: Date;
};

export const LABS = {
    CRP:          { label: "CRP",          loincs: ['1988-5', '14959-1', '71426-1'],  keywords: ['c reactive protein', 'crp']},
    ESR:          { label: "ESR",          loincs: ['30341-2', '4537-7'],             keywords: ['erythrocyte sedimentation', 'esr', 'sed rate', 'sedimentation rate']},
    Albumin:      { label: "Albumin",      loincs: ['1751-7', '3519-7', '2862-1'],    keywords: ['albumin']},
    Calprotectin: { label: "Calprotectin", loincs: ['35896-1', '27818-8'],            keywords: ['calprotectin']},
    Hemoglobin:   { label: "Hemoglobin",   loincs: ['718-7', '20509-6'],              keywords: ['hemoglobin', 'haemoglobin']},
    Platelets:    { label: "Platelets",    loincs: ['777-3', '26515-7'],              keywords: ['platelet']},
    Weight:       { label: "Weight",       loincs: ['29463-7', '3141-9'],             keywords: ['body weight', 'weight']},
    Height:       { label: "Height",       loincs: ['8302-2', '3137-7'],              keywords: ['body height', 'height']},
    BMI:          { label: "BMI",          loincs: ['39156-5'],                       keywords: ['body mass index', 'bmi']},
    PreAlbumin:   { label: "PreAlbumin",   loincs: ['1809-3', '2857-1'],              keywords: ['prealbumin', 'pre-albumin', 'transthyretin']},
    PCT:          { label: "PCT",          loincs: ['33959-8', '75241-0', '44372-3'], keywords: ['procalcitonin', 'pct']},
    Ferritin:     { label: "Ferritin",     loincs: ['2276-4', '20567-4'],             keywords: ['ferritin']},
    VitaminD:     { label: "Vitamin D",    loincs: ['35365-7', '1989-3', '14635-7'],  keywords: ['vitamin d', '25-oh', '25-hydroxyvitamin']},
    VitaminB12:   { label: "Vitamin B12",  loincs: ['2132-9', '14685-2'],             keywords: ['vitamin b12', 'cobalamin', 'b-12']},
    WBC:          { label: "WBC",          loincs: ['6690-2', '26464-8'],             keywords: ['white blood cell', 'leukocyte', 'wbc']},
    RBC:          { label: "RBC",          loincs: ['789-8', '26453-1'],              keywords: ['red blood cell', 'erythrocyte', 'rbc']},
    Hematocrit:   { label: "Hematocrit",   loincs: ['4544-3', '20570-8'],             keywords: ['hematocrit', 'haematocrit', 'hct', 'packed cell']},
    MCV:          { label: "MCV",          loincs: ['787-2', '30428-7'],              keywords: ['mean corpuscular volume', 'mcv']},
    MCH:          { label: "MCH",          loincs: ['785-6', '28539-5'],              keywords: ['mean corpuscular hemoglobin', 'mch']},
    MCHC:         { label: "MCHC",         loincs: ['786-4', '28540-3'],              keywords: ['mchc', 'mean corpuscular hemoglobin concentration']},
    RDW:          { label: "RDW",          loincs: ['788-0', '21000-5'],              keywords: ['red cell distribution width', 'rdw']},
    Neutrophils:  { label: "Neutrophils",  loincs: ['751-8', '26499-4'],              keywords: ['neutrophil']},
    Lymphocytes:  { label: "Lymphocytes",  loincs: ['731-0', '26478-8'],              keywords: ['lymphocyte']},
    Monocytes:    { label: "Monocytes",    loincs: ['742-7', '26484-6'],              keywords: ['monocyte']},
    Eosinophils:  { label: "Eosinophils",  loincs: ['711-2', '26449-9'],              keywords: ['eosinophil']},
    Basophils:    { label: "Basophils",    loincs: ['704-7', '26444-0'],              keywords: ['basophil']},
    MPV:          { label: "MPV",          loincs: ['32623-4', '28542-9'],            keywords: ['mean platelet volume', 'mpv']},
    ALT:          { label: "ALT",          loincs: ['1742-6', '1743-4'],              keywords: ['alanine aminotransferase', 'alt', 'sgpt']},
    AST:          { label: "AST",          loincs: ['1920-8', '30239-8'],             keywords: ['aspartate aminotransferase', 'ast', 'sgot']},
} as const;

export const FILTERS: Record<string, ObservationFilter> = {
    All:      { label: 'All' },
    Vitals:   { label: 'Vitals',   categories: ['vital-signs'] },
    Labs:     { label: 'Labs',     categories: ['laboratory'] },
    Social:   { label: 'Social',   categories: ['social-history'] },
    Activity: { label: 'Activity', categories: ['activity'] },
    IBD: {
        label   : 'IBD',
        keywords: Object.keys(LABS).map(key => LABS[key as keyof typeof LABS].keywords).flat(),
        codes   : Object.keys(LABS).map(key => LABS[key as keyof typeof LABS].loincs).flat(),
    },
};
