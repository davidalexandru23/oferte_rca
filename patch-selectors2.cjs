const fs = require('fs');
let code = fs.readFileSync('src/automation/selectors.ts', 'utf-8');

code = code.replace('judet: ["Judeţ", "Județ", "Judet"],', 'judet: ["Judeţ", "Județ", "Judet", "Judeţ / Sector", "Judet / Sector", "Județ / Sector", "Judeţ/Sector", "Judet/Sector"],');
code = code.replace('numar_ci: ["Număr BI / CI", "Număr CI", "Numar CI", "Număr act"],', 'numar_ci: ["Număr BI / CI", "Număr CI", "Numar CI", "Număr act", "Numar act", "Număr document", "Numar document", "Serie / Număr C.I."],');

fs.writeFileSync('src/automation/selectors.ts', code);
