const fs = require('fs');
let code = fs.readFileSync('src/automation/selectors.ts', 'utf-8');

code = code.replace('nume: ["Nume"],', 'nume: ["Nume", "Nume asigurat", "Nume/Denumire", "Nume/Denumire firmă", "Nume/Denumire firma", "Nume asigurat / Denumire companie"],');
code = code.replace('prenume: ["Prenume"],', 'prenume: ["Prenume", "Prenume asigurat", "Prenume (optional)", "Prenume (sau CUI)", "Prenume/C.U.I.", "Prenume asigurat / C.U.I. companie"],');
code = code.replace('cnp: ["CNP"],', 'cnp: ["CNP", "C.N.P.", "CNP/CUI", "CNP asigurat / C.U.I. companie", "Cod Numeric Personal", "Cod Numeric Personal / CUI"],');
code = code.replace('telefon: ["Telefon"],', 'telefon: ["Telefon", "Număr de telefon", "Numar de telefon", "Nr. Telefon", "Telefon mobil"],');
code = code.replace('email: ["Email", "E-mail"],', 'email: ["Email", "E-mail", "Adresa de email", "Adresă de e-mail", "Adresa de e-mail"],');
code = code.replace('adresa: ["Strada", "Adresă", "Adresa"],', 'adresa: ["Strada", "Adresă", "Adresa", "Adresa completă", "Adresa completa", "Strada, număr, bloc", "Adresa din talon"],');

fs.writeFileSync('src/automation/selectors.ts', code);
