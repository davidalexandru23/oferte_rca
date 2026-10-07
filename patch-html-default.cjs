const fs = require('fs');
let code = fs.readFileSync('public/dashboard.html', 'utf-8');

code = code.replace(
  '<option value="asigurari.ro">asigurari.ro</option>\\n            <option value="asigurari-oneste.ro">asigurari-oneste.ro</option>',
  '<option value="asigurari-oneste.ro">asigurari-oneste.ro</option>\\n            <option value="asigurari.ro">asigurari.ro</option>'
);

fs.writeFileSync('public/dashboard.html', code);
