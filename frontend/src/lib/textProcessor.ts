const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
  'ought', 'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i',
  'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them',
  'his', 'her', 'their', 'what', 'which', 'who', 'whom', 'how', 'when',
  'where', 'why', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'not', 'only', 'same', 'so', 'than',
  'too', 'very', 's', 't', 'just', 'don', 'now', 'as', 'up', 'out',
  'about', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'each', 'here', 'there', 'then', 'once',
  // Russian stop words
  'и', 'в', 'на', 'с', 'по', 'для', 'от', 'до', 'из', 'за', 'к', 'о',
  'об', 'при', 'под', 'над', 'без', 'через', 'между', 'около', 'после',
  'перед', 'во', 'со', 'не', 'ни', 'но', 'а', 'или', 'что', 'как',
  'это', 'то', 'так', 'же', 'ли', 'бы', 'уже', 'ещё', 'еще', 'тоже',
  'также', 'если', 'когда', 'где', 'кто', 'чем', 'чего', 'чему',
  'которые', 'который', 'которая', 'которое', 'которых', 'которому',
  'все', 'всё', 'всех', 'всем', 'всеми', 'свой', 'своя', 'своё', 'своих',
  'этот', 'эта', 'эти', 'этих', 'этому', 'тот', 'та', 'те', 'тех',
  'он', 'она', 'они', 'его', 'её', 'их', 'им', 'ими', 'нас', 'нам',
  'вас', 'вам', 'мы', 'вы', 'я', 'мне', 'меня', 'тебе', 'тебя',
  'себя', 'себе', 'был', 'была', 'были', 'быть', 'есть', 'нет',
  'можно', 'нужно', 'надо', 'очень', 'более', 'менее', 'самый',
  'самая', 'самое', 'самые', 'другой', 'другая', 'другие', 'другого',
]);

/**
 * Tokenize a text string into an array of word tokens.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

/**
 * Normalize a single token: lowercase, remove non-alphanumeric characters.
 */
export function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, '');
}

/**
 * Remove stop words from a token array.
 */
export function removeStopWords(tokens: string[]): string[] {
  return tokens.filter(t => !STOP_WORDS.has(t) && t.length > 1);
}

/**
 * Full pipeline: tokenize, normalize, remove stop words.
 */
export function processText(text: string): string[] {
  const tokens = tokenize(text);
  const normalized = tokens.map(normalizeToken).filter(t => t.length > 1);
  return removeStopWords(normalized);
}
