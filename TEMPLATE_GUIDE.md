# Ghid de Completare a Fișierului Excel (.xlsx) pentru Asigurare_Check

Acest document descrie structura așteptată a fișierului `.xlsx` folosit pentru automatizarea ofertelor RCA. Sistemul acceptă exclusiv fișiere cu extensia `.xlsx` sau `.csv`, având pe prima linie un cap de tabel (header) cu denumirile exacte ale coloanelor de mai jos. 

> **Important:**
> - Rândul 1 trebuie să conțină **exact denumirile coloanelor** (header-ul), fără spații la început/sfârșit, scrise cu litere mici (exact cum apar în lista de mai jos).
> - Coloanele nu trebuie neapărat să fie într-o ordine strictă, dar denumirea lor trebuie să fie identică cu cea specificată.
> - Datele calendaristice trebuie formatate în Excel ca *Text* (ex: `15.06.2015`) sau ca format *Date* valid. Sistemul convertește automat formatele de tip *Date* interne din Excel în `ZZ.LL.AAAA`.

---

## Detalierea Coloanelor

Mai jos este lista completă a coloanelor. Este recomandat să descărcați template-ul generat din interfața de web (`/template.xlsx`) pentru a avea automat structura completă.

### 1. Date Autovehicul

- **`nr_inmatriculare`**: Numărul de înmatriculare (ex: `B123ABC`). Opțional, lăsați gol sau puneți o liniuță `-` dacă e cazul, deși site-ul preferă numărul exact.
- **`vin`**: Seria de șasiu, lungime standard 17 caractere. Obligatoriu.
- **`stare_legala`**: Status înmatriculare. Valori acceptate: `Inmatriculat`, `In vederea inmatricularii`.
- **`transfer_proprietate`**: Este transfer de proprietate? Valori acceptate: `Da` sau `Nu`.
- **`tip_auto`**: Categoria vehiculului (ex: `Autoturism`, `Autoutilitara`, `Motocicleta`, `Remorca`, `Semiremorca`).
- **`combustibil`**: Tipul combustibilului (ex: `Benzina`, `Motorina`, `Hibrid`, `Electric`, `GPL`).
- **`marca`**: Marca auto (ex: `BMW`, `OPEL`, `DACIA`).
- **`model`**: Modelul auto exact. Pentru o rată mare de succes, recomandam valoarea curățată de detalii excesive, de ex. `Astra` în loc de `ASTRA H` (robotul va folosi autocomplete/match parțial).
- **`serie_civ`**: Seria Cărții de Identitate a Vehiculului (ex: `J125354` sau `A123456`).
- **`an_fabricatie`**: Anul de fabricație (format 4 cifre: `2011`, `2020`).
- **`masa_maxima_kg`**: Masa maximă admisă în Kg (ex: `1765`).
- **`cilindree_cm3`**: Capacitatea cilindrică (ex: `1598`, `1995`).
- **`putere_kw`**: Puterea motorului exprimată în kW (ex: `85`, `140`).
- **`nr_locuri`**: Numărul maxim de locuri (ex: `5`).
- **`prima_inmatriculare`**: Data primei înmatriculări a vehiculului (pe plan mondial). Format sugerat: `ZZ.LL.AAAA` (ex: `21.10.2011`).
- **`nr_km`**: Kilometrajul curent estimativ (ex: `110000`).

### 2. Date Proprietar / Asigurat

- **`tip_persoana`**: Tipul asiguratului. Valori acceptate: `fizica` (pentru Persoană fizică) sau `juridica` (pentru Persoană juridică).
- **`nume`**: Numele de familie (sau numele firmei).
- **`prenume`**: Prenumele.
- **`cnp`**: Codul Numeric Personal (13 cifre) sau CUI-ul firmei.
- **`telefon`**: Număr de telefon (ex: `0721000000`).
- **`email`**: O adresă de email validă.
- **`judet`**: Județul de domiciliu / sediu (ex: `Bucuresti`, `Ilfov`, `Cluj`). Fără diacritice este perfect acceptabil.
- **`localitate`**: Localitatea sau Sectorul (ex: `Bucuresti Sectorul 1` sau `Cluj-Napoca`).
- **`adresa`**: Adresa (stradă, număr, bloc, etc).
- **`serie_ci`**: Seria actului de identitate (ex: `MB`, `RX`).
- **`numar_ci`**: Numărul actului de identitate (format de regulă din 6 cifre, ex: `123456`).
- **`data_permis`**: Data obținerii permisului de conducere. Format sugerat: `ZZ.LL.AAAA` (ex: `24.04.2023`).
- **`cod_postal`**: Codul poștal (opțional în funcție de adresă, dar recomandat; 6 cifre, ex: `012345`).

### 3. Detalii Poliță

- **`bonus_malus`**: Clasa anterioară de Bonus/Malus, dacă o știți (ex: `B8`, `B4`, `M2`). Sistemul va încerca s-o ajusteze automat pe site.
- **`conducator_principal_acelasi`**: Este proprietarul principalul conducător auto? Valori acceptate: `Da` sau `Nu`.
- **`data_start_polita`**: Data de la care intră în vigoare viitoarea poliță RCA. Format: `ZZ.LL.AAAA` (ex: `25.09.2026`).
- **`durata_luni`**: Durata poliței în luni. Valori tipice: `6` sau `12`.
- **`decontare_directa`**: Doriți adăugarea clauzei de decontare directă? Valori acceptate: `Da` sau `Nu`.
- **`tip_utilizare`**: Tipul de utilizare. Majoritatea sunt implicit pe `In interes personal`. Opțional.
- **`observatii`**: Câmp liber pentru uz intern; robotul ignoră această coloană.

---

## Erori frecvente și bune practici

1. **Spații invizibile**: Aveți grijă să nu existe spații la sfârșitul valorilor, în special în câmpuri precum Seria de șasiu sau CNP.
2. **Denumirea modelelor auto**: Site-ul Asigurari.ro folosește liste restrânse de modele. Scrieți modelul cât mai "curat" (ex: folosiți "Astra" în loc de "Opel Astra Hatchback", robotul va căuta un match parțial automat).
3. **Diacritice**: Puteți folosi sau omite diacriticele (ex: "Buzau" vs "Buzău"). Robotul este pregătit să standardizeze denumirile intern înainte de a le introduce în site.
4. **Câmpuri necompletate**: Lăsați celula goală dacă nu aveți o valoare (în special pentru opționale ca `observatii`).

Dacă ați respectat pașii de mai sus, încărcarea fișierului în aplicație ar trebui să parcurgă perfect toți pașii.
