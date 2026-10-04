export const rcaSelectors = {
  cookieEssentials: [
    "text='Acceptă toate'",
    "text='Doar esențiale'",
    "#cookiesAccept",
    "#cookiesReject",
    "button:has-text('Doar esențiale')"
  ],
  nextButtons: [
    "div#next_button",
    "button.next_button",
    "div.next_button:not(#terms_conditions_button)",
    "input[type='submit']",
    "button[type='submit']"
  ],
  challengeHints: [
    "text=/captcha/i",
    "text=/cloudflare/i",
    
    "iframe[src*='captcha']",
    "iframe[src*='turnstile']",
    ".cf-turnstile"
  ],
  offers: {
    cards: [
      "[data-testid*='offer']",
      ".offer",
      ".oferta",
      "table tbody tr",
      ".card:has-text('RON')"
    ],
    insurerInside: [
      "[data-testid*='insurer']",
      ".insurer",
      ".asigurator",
      "img[alt]",
      "strong",
      "td:nth-child(1)"
    ],
    priceInside: [
      "[data-testid*='price']",
      ".price",
      ".pret",
      "td:has-text('RON')",
      "text=/\\d+[\\.,]?\\d*\\s*(RON|lei)/i"
    ]
  },
  fields: {
    nr_inmatriculare: ["Nr. înmatriculare", "Nr. inmatriculare"],
    vin: ["Serie şasiu (VIN)", "Serie şasiu", "Serie sasiu", "VIN"],
    stare_legala: ["Stare legală", "Stare legala"],
    transfer_proprietate: ["Transfer de proprietate"],
    tip_auto: ["Tip auto"],
    combustibil: ["Tip combustibil", "Combustibil"],
    marca: ["Marca auto", "Marca"],
    model: ["Model auto", "Model"],
    serie_civ: ["Serie CIV", "CIV"],
    an_fabricatie: ["An fabricaţie", "An fabricatie"],
    masa_maxima_kg: ["Masa maximă (Kg)", "Masa maximă", "Masa maxima"],
    cilindree_cm3: ["Cilindree (cm3)", "Cilindree"],
    putere_kw: ["Putere (kw)", "Putere"],
    nr_locuri: ["Nr. locuri", "Numar locuri"],
    prima_inmatriculare: ["Prima înmatriculare", "Prima inmatriculare"],
    nr_km: ["Nr. km", "Kilometri"],
    tip_persoana: ["Tip persoană", "Tip persoana", "Asigurat"],
    nume: ["Nume"],
    prenume: ["Prenume"],
    cnp: ["CNP"],
    telefon: ["Telefon"],
    email: ["Email", "E-mail"],
    judet: ["Judeţ", "Județ", "Judet"],
    localitate: ["Localitate"],
    adresa: ["Strada", "Adresă", "Adresa"],
    serie_ci: ["Serie BI / CI", "Serie CI", "Serie act"],
    numar_ci: ["Număr BI / CI", "Număr CI", "Numar CI", "Număr act"],
    data_permis: ["Data permis", "Dată obţinere permis auto asigurat/utilizator", "Permis"],
    bonus_malus: ["Bonus-Malus", "Bonus Malus", "Clasa B/M"],
    data_start_polita: ["Dată start asigurare", "Data început", "Data inceput", "Start poliță", "De la ce dată dorești să înceapă valabilitatea poliței?"],
    durata_luni: ["Durata", "Perioadă de valabilitate", "Perioada"],
    decontare_directa: ["Decontare directă", "Decontare directa"],
    cod_postal: ["Cod poștal", "Cod poştal", "Cod postal"],
    tip_utilizare: ["Tip utilizare autovehicul"]
  }
} as const;
