import path from "node:path";
import { runScenario } from "./rcaRunner.js";
import { config } from "../config.js";

async function main() {
  const jobDir = path.join(config.dataDir, "manual-test");
  const row = {
    nr_inmatriculare: "B123ABC",
    vin: "WBA1234567890ABCD",
    stare_legala: "Înmatriculat",
    transfer_proprietate: "Nu",
    tip_auto: "Autoturism",
    combustibil: "Benzină",
    marca: "BMW",
    model: "320D XDRIVE",
    serie_civ: "A123456",
    an_fabricatie: "2015",
    masa_maxima_kg: "2000",
    cilindree_cm3: "1995",
    putere_kw: "140",
    nr_locuri: "5",
    prima_inmatriculare: "15.06.2015",
    nr_km: "150000",
    tip_persoana: "Persoană fizică",
    nume: "Popescu",
    prenume: "Ion",
    cnp: "1900101410011",
    telefon: "0722123456",
    email: "ion.popescu@example.com",
    judet: "București",
    localitate: "Bucuresti Sectorul 1",
    adresa: "Strada Mare nr 1",
    cod_postal: "010001",
    serie_ci: "RX",
    numar_ci: "123456",
    data_permis: "10.10.2000",
    bonus_malus: "B0",
    conducator_principal_acelasi: "Da",
    data_start_polita: "01.10.2026",
    durata_luni: "12 luni",
    decontare_directa: "Nu",
    tip_utilizare: "Personal", observatii: ""
  };
  
  console.log("Running scenario...");
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: config.headless });
  try {
    const result = await runScenario(browser, row as any, jobDir);
    console.log("Result:", result);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
