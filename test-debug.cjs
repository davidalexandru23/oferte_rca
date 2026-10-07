const { getStep2Html } = require('./dist/src/automation/debugHtml.js');
getStep2Html().then(html => {
  console.log(html.length);
  if (html.includes("Access denied")) console.log("Blocked!");
}).catch(console.error);
