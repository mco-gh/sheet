// The instruments you can pick, and the words that mean "this score is for it" in
// the descriptions IMSLP, Mutopia and the Internet Archive give their scores.
// `not` lists phrases that contain a term but mean something else.

export const INSTRUMENTS = [
  { id: 'piano', name: 'Piano', hue: 340, terms: ['piano', 'pianoforte', 'keyboard', 'pf'], try: ['Für Elise', 'Moonlight Sonata', 'Gymnopédie', 'The Entertainer', 'Clair de lune'] },
  { id: 'guitar', name: 'Guitar', hue: 25, terms: ['guitar'], not: ['bass guitar'], try: ['Greensleeves', 'Romance', 'Lágrima', 'Asturias', 'Scarborough Fair'] },
  { id: 'voice', name: 'Voice', hue: 280, terms: ['voice', 'vocal', 'song', 'soprano', 'mezzo', 'alto', 'tenor', 'baritone', 'singer'], not: ['alto saxophone', 'tenor saxophone', 'baritone saxophone', 'alto clarinet', 'alto flute', 'tenor trombone', 'alto recorder', 'tenor recorder', 'songs without words'], try: ['Amazing Grace', 'Danny Boy', 'Ave Maria', 'Shenandoah', 'Silent Night'] },
  { id: 'violin', name: 'Violin', hue: 8, terms: ['violin', 'fiddle'], try: ['Canon in D', 'Meditation', 'Ave Maria', 'Humoresque', 'Ashokan Farewell'] },
  { id: 'cello', name: 'Cello', hue: 200, terms: ['cello', 'violoncello', "'cello"], try: ['The Swan', 'Prelude', 'Ave Maria', 'Elegy', 'Canon in D'] },
  { id: 'viola', name: 'Viola', hue: 255, terms: ['viola'], not: ['viola da gamba', "viola d'amore"], try: ['Ave Maria', 'Canon in D', 'Air', 'Greensleeves'] },
  { id: 'bass', name: 'Double bass', hue: 220, terms: ['double bass', 'contrabass', 'string bass', 'double-bass'], try: ['The Elephant', 'Canon in D', 'Air'] },
  { id: 'flute', name: 'Flute', hue: 170, terms: ['flute', 'piccolo'], not: ['alto flute'], try: ['Syrinx', 'Greensleeves', 'Badinerie', 'Danny Boy', 'Ode to Joy'] },
  { id: 'clarinet', name: 'Clarinet', hue: 150, terms: ['clarinet'], try: ['Ode to Joy', 'Greensleeves', 'Danny Boy', 'Amazing Grace'] },
  { id: 'oboe', name: 'Oboe', hue: 95, terms: ['oboe', 'cor anglais', 'english horn'], try: ['Gabriel', 'Air', 'Greensleeves'] },
  { id: 'bassoon', name: 'Bassoon', hue: 40, terms: ['bassoon'], try: ['Air', 'Hall of the Mountain King'] },
  { id: 'sax', name: 'Saxophone', hue: 45, terms: ['saxophone', 'sax'], try: ['Amazing Grace', 'Greensleeves', 'The Entertainer', 'Danny Boy'] },
  { id: 'trumpet', name: 'Trumpet', hue: 52, terms: ['trumpet', 'cornet', 'flugelhorn'], try: ['Trumpet Voluntary', 'Amazing Grace', 'When the Saints', 'Ode to Joy'] },
  { id: 'trombone', name: 'Trombone', hue: 30, terms: ['trombone'], try: ['Amazing Grace', 'Ode to Joy', 'Danny Boy'] },
  { id: 'horn', name: 'French horn', hue: 15, terms: ['french horn', 'horn'], not: ['english horn', 'basset horn', 'basset-horn'], try: ['Ave Maria', 'Nocturne', 'Amazing Grace'] },
  { id: 'tuba', name: 'Tuba', hue: 235, terms: ['tuba', 'euphonium'], try: ['Amazing Grace', 'Ode to Joy'] },
  { id: 'recorder', name: 'Recorder', hue: 120, terms: ['recorder'], try: ['Greensleeves', 'Ode to Joy', 'Amazing Grace', 'Canon in D'] },
  { id: 'harp', name: 'Harp', hue: 300, terms: ['harp'], try: ['Greensleeves', 'Danny Boy', 'Clair de lune'] },
  { id: 'organ', name: 'Organ', hue: 265, terms: ['organ', 'harmonium'], try: ['Toccata and Fugue', 'Ave Maria', 'Amazing Grace', 'Jesu, Joy'] },
  { id: 'ukulele', name: 'Ukulele', hue: 185, terms: ['ukulele', 'uke'], try: ['Amazing Grace', 'Aloha Oe', 'Greensleeves'] },
  { id: 'mandolin', name: 'Mandolin', hue: 60, terms: ['mandolin'], try: ['Greensleeves', 'Ashokan Farewell', 'Concerto'] },
  { id: 'banjo', name: 'Banjo', hue: 35, terms: ['banjo'], try: ['Oh! Susanna', 'Camptown Races'] },
  { id: 'accordion', name: 'Accordion', hue: 355, terms: ['accordion'], try: ['Greensleeves', 'La Cumparsita'] },
  { id: 'choir', name: 'Choir', hue: 290, terms: ['choir', 'chorus', 'satb', 'ssa', 'ttbb', 'mixed voices', 'choral'], try: ['Hallelujah', 'Ave verum corpus', 'Amazing Grace', 'Silent Night'] },
];

export const byId = new Map(INSTRUMENTS.map((i) => [i.id, i]));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\']/g, '\\$&');
const patterns = new Map(INSTRUMENTS.map((i) => [i.id, {
  yes: new RegExp(`(^|[^a-z])(${i.terms.map(esc).join('|')})(e?s)?(?![a-z])`, 'i'),
  no: i.not ? new RegExp(`(${i.not.map(esc).join('|')})`, 'gi') : null,
}]));

// Does this description (e.g. "for violin, piano") mention the instrument?
export function mentions(id, text = '') {
  const p = patterns.get(id);
  if (!p) return false;
  const clean = p.no ? text.replace(p.no, ' ') : text;
  return p.yes.test(clean);
}

// A description that is only this instrument, such as "piano", "guitar solo" or "2 flutes".
export function isSolo(id, text = '') {
  const rest = text.toLowerCase()
    .replace(patterns.get(id).yes, ' ')
    .replace(/\b(solo|alone|unaccompanied|\d+|one|two|three|four|or|duet|duo|trio|quartet|ensemble|for|and)\b|[^a-z]+/g, ' ')
    .trim();
  return mentions(id, text) && rest === '';
}
