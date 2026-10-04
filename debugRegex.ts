function escapeRegexWithDiacritics(value: string) {
  let escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const charMap: Record<string, string> = {
    'a': '[aăâAĂÂ]', 'A': '[aăâAĂÂ]',
    'i': '[iîIÎ]', 'I': '[iîIÎ]',
    's': '[sșşSȘŞ]', 'S': '[sșşSȘŞ]',
    't': '[tțţTȚŢ]', 'T': '[tțţTȚŢ]'
  };
  return escaped.split('').map(c => charMap[c] || c).join('');
}

console.log(escapeRegexWithDiacritics("Inmatriculat"));
console.log(escapeRegexWithDiacritics("fizica"));
