function generateCNP(year, month, day, sex, countyId) {
    let s = sex === 'M' ? (year >= 2000 ? 5 : 1) : (year >= 2000 ? 6 : 2);
    let yy = year.toString().slice(-2);
    let mm = month.toString().padStart(2, '0');
    let dd = day.toString().padStart(2, '0');
    let cc = countyId.toString().padStart(2, '0');
    let nnn = '001';
    let base = `${s}${yy}${mm}${dd}${cc}${nnn}`;
    let c = '279146358279';
    let sum = 0;
    for (let i=0; i<12; i++) sum += parseInt(base[i]) * parseInt(c[i]);
    let check = sum % 11;
    if (check === 10) check = 1;
    return base + check;
}
console.log(generateCNP(1990, 1, 1, 'M', 41)); // Bucuresti
