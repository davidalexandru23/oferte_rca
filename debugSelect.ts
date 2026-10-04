const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();

const wanted = ["Inmatriculat", "Benzina", "ASTRA H"];
const availableSets = [
  ['Alegeţi tipul auto', 'Autoturism', 'Înmatriculat'],
  ['Alegeţi tip combustibil', 'Benzină', 'Motorină'],
  ['Alegeţi modelul auto', 'Meriva', 'Astra', 'Astra J', 'Astra GTC']
];

for (let i = 0; i < wanted.length; i++) {
  const w = wanted[i];
  const items = availableSets[i];
  const value = normalize(w);
  const option = items.find((item) => {
    const text = normalize(item);
    if (text.includes(value)) return true;
    if (value.startsWith(text) && text.length >= 4) return true;
    return false;
  });
  console.log(`Wanted: "${w}" -> Found: "${option}"`);
}
