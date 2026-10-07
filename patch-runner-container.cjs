const fs = require('fs');
let code = fs.readFileSync('src/automation/rcaRunner.ts', 'utf-8');

code = code.replace(
  "const container = element.closest('.broker_form_field_small, .broker_form_field, .form-group, .form-group-flex, .row');",
  "const container = element.closest('.broker_form_field_small, .broker_form_field, .form-group, .form-group-flex, .row, .col-sm-6, .col-md-6, .mb-3, .mb-4, .input-group, div[class*=\"col-\"]');"
);

fs.writeFileSync('src/automation/rcaRunner.ts', code);
