const fs = require('fs');
let code = fs.readFileSync('public/dashboard.html', 'utf-8');

const stopButtonHtml = '<button id="stop" class="button stop-btn hidden" type="button">Opreste Job</button>';

code = code.replace('<button id="resume" class="secondary hidden" type="button">Reluare dupa verificare</button>', '<button id="resume" class="secondary hidden" type="button">Reluare dupa verificare</button>\n          ' + stopButtonHtml);

fs.writeFileSync('public/dashboard.html', code);
