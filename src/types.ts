export const scenarioColumns = [
  "nr_inmatriculare",
  "vin",
  "stare_legala",
  "transfer_proprietate",
  "tip_auto",
  "combustibil",
  "marca",
  "model",
  "serie_civ",
  "an_fabricatie",
  "masa_maxima_kg",
  "cilindree_cm3",
  "putere_kw",
  "nr_locuri",
  "prima_inmatriculare",
  "nr_km",
  "tip_persoana",
  "nume",
  "prenume",
  "cnp",
  "telefon",
  "email",
  "judet",
  "localitate",
  "adresa",
  "serie_ci",
  "numar_ci",
  "data_permis",
  "bonus_malus",
  "conducator_principal_acelasi",
  "data_start_polita",
  "durata_luni",
  "decontare_directa",
  "cod_postal",
  "tip_utilizare",
  "observatii"
] as const;

export type ScenarioColumn = (typeof scenarioColumns)[number];
export type ScenarioRow = Record<ScenarioColumn, string>;

export type Offer = {
  insurer: string;
  price: string;
  details?: string;
};

export type ScenarioResult = {
  status: "success" | "failed" | "waiting_for_manual_action";
  error?: string;
  reference?: string;
  minOffer?: string;
  offers: Offer[];
};

export type JobStatus =
  | "queued"
  | "running"
  | "waiting_for_manual_action"
  | "completed"
  | "failed";

export type JobProgress = {
  id: string;
  status: JobStatus;
  provider?: string;
  total: number;
  processed: number;
  currentRow?: number;
  message?: string;
  resultPath?: string;
  error?: string;
  recentResults: Array<{
    row: number;
    status: ScenarioResult["status"];
    offerCount: number;
    minOffer?: string;
    error?: string;
  }>;
};
