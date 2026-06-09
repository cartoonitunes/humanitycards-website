/* data.js — HumanityCards catalogue + game data.
   The on-chain contract defines 239 "human" slots (2018 genesis).
   Not all are minted; FIGURES below are the minted/catalogued humans.
   Scarcity is spoken in SUPPLY COUNTS only — never tiers.            */
(function () {
  var CA = "0xbc9b96e7aa6afea664f9d5fdda168518ee20f2cc";
  var DEP = "13 MAR 2018";

  // [name, bornYear]  (negative = BCE). Curated real figures.
  var RAW = [
    ["Imhotep",-2650],["Hammurabi",-1810],["Hatshepsut",-1507],["Akhenaten",-1380],
    ["Nefertiti",-1370],["Tutankhamun",-1341],["Ramesses II",-1303],["Moses",-1391],
    ["Homer",-800],["Zoroaster",-1000],["Lao Tzu",-601],["Siddhartha Gautama",-563],
    ["Confucius",-551],["Sun Tzu",-544],["Pythagoras",-570],["Cyrus the Great",-600],
    ["Darius I",-550],["Aeschylus",-525],["Sophocles",-497],["Herodotus",-484],
    ["Socrates",-470],["Hippocrates",-460],["Pericles",-495],["Plato",-428],
    ["Aristotle",-384],["Euclid",-325],["Archimedes",-287],["Ashoka",-304],
    ["Qin Shi Huang",-259],["Hannibal",-247],["Diogenes",-412],["Epicurus",-341],
    ["Cicero",-106],["Julius Caesar",-100],["Cleopatra",-69],["Virgil",-70],
    ["Augustus",-63],["Seneca",-4],["Boudica",30],["Trajan",53],
    ["Marcus Aurelius",121],["Galen",129],["Ptolemy",100],["Plutarch",46],
    ["Hypatia",360],["Constantine",272],["Augustine of Hippo",354],["Attila",406],
    ["Justinian I",482],["Muhammad",570],["Charlemagne",742],["Al-Khwarizmi",780],
    ["Harun al-Rashid",763],["Alfred the Great",849],["Avicenna",980],["Leif Erikson",970],
    ["William the Conqueror",1028],["Omar Khayyam",1048],["El Cid",1043],["Saladin",1137],
    ["Genghis Khan",1162],["Francis of Assisi",1181],["Rumi",1207],["Kublai Khan",1215],
    ["Thomas Aquinas",1225],["Marco Polo",1254],["Dante Alighieri",1265],["Giotto",1267],
    ["William Wallace",1270],["Ibn Battuta",1304],["Petrarch",1304],["Ibn Khaldun",1332],
    ["Geoffrey Chaucer",1343],["Tamerlane",1336],["Brunelleschi",1377],["Donatello",1386],
    ["Joan of Arc",1412],["Johannes Gutenberg",1400],["Cosimo de' Medici",1389],["Lorenzo de' Medici",1449],
    ["Leonardo da Vinci",1452],["Christopher Columbus",1451],["Amerigo Vespucci",1454],["Vasco da Gama",1460],
    ["Niccolo Machiavelli",1469],["Albrecht Durer",1471],["Nicolaus Copernicus",1473],["Michelangelo",1475],
    ["Ferdinand Magellan",1480],["Martin Luther",1483],["Raphael",1483],["Babur",1483],
    ["Erasmus",1466],["Thomas More",1478],["Suleiman the Magnificent",1494],["Hernan Cortes",1485],
    ["Nostradamus",1503],["John Calvin",1509],["Titian",1488],["Akbar",1542],
    ["Elizabeth I",1533],["Francis Drake",1540],["Miguel de Cervantes",1547],["Tycho Brahe",1546],
    ["Giordano Bruno",1548],["Walter Raleigh",1552],["Francis Bacon",1561],["Galileo Galilei",1564],
    ["William Shakespeare",1564],["Johannes Kepler",1571],["Caravaggio",1571],["Peter Paul Rubens",1577],
    ["Thomas Hobbes",1588],["Rene Descartes",1596],["Diego Velazquez",1599],["Oliver Cromwell",1599],
    ["Rembrandt",1606],["Christiaan Huygens",1629],["Baruch Spinoza",1632],["John Locke",1632],
    ["Antonie van Leeuwenhoek",1632],["Robert Hooke",1635],["Louis XIV",1638],["Isaac Newton",1643],
    ["Gottfried Leibniz",1646],["Edmond Halley",1656],["Peter the Great",1672],["Antonio Vivaldi",1678],
    ["Johann Sebastian Bach",1685],["Voltaire",1694],["Benjamin Franklin",1706],["Carl Linnaeus",1707],
    ["Leonhard Euler",1707],["David Hume",1711],["Jean-Jacques Rousseau",1712],["Adam Smith",1723],
    ["Immanuel Kant",1724],["Catherine the Great",1729],["George Washington",1732],["Joseph Haydn",1732],
    ["James Watt",1736],["Thomas Jefferson",1743],["Antoine Lavoisier",1743],["Edward Jenner",1749],
    ["Johann Wolfgang von Goethe",1749],["Wolfgang Amadeus Mozart",1756],["Mary Wollstonecraft",1759],["Maximilien Robespierre",1758],
    ["Napoleon Bonaparte",1769],["Georg Hegel",1770],["Ludwig van Beethoven",1770],["Carl Friedrich Gauss",1777],
    ["Simon Bolivar",1783],["Lord Byron",1788],["Arthur Schopenhauer",1788],["Michael Faraday",1791],
    ["Charles Babbage",1791],["Samuel Morse",1791],["Franz Schubert",1797],["Victor Hugo",1802],
    ["Charles Darwin",1809],["Abraham Lincoln",1809],["Frederic Chopin",1810],["Charles Dickens",1812],
    ["Richard Wagner",1813],["Soren Kierkegaard",1813],["Ada Lovelace",1815],["Karl Marx",1818],
    ["Queen Victoria",1819],["Florence Nightingale",1820],["Fyodor Dostoevsky",1821],["Gregor Mendel",1822],
    ["Louis Pasteur",1822],["Leo Tolstoy",1828],["James Clerk Maxwell",1831],["Dmitri Mendeleev",1834],
    ["Mark Twain",1835],["Claude Monet",1840],["Pyotr Tchaikovsky",1840],["Auguste Rodin",1840],
    ["Friedrich Nietzsche",1844],["Thomas Edison",1847],["Alexander Graham Bell",1847],["Wilhelm Rontgen",1845],
    ["Vincent van Gogh",1853],["Nikola Tesla",1856],["Sigmund Freud",1856],["Booker T. Washington",1856],
    ["Max Planck",1858],["Pierre Curie",1859],["Henry Ford",1863],["Marie Curie",1867],
    ["Wilbur Wright",1867],["Mahatma Gandhi",1869],["Henri Matisse",1869],["Vladimir Lenin",1870],
    ["Maria Montessori",1870],["Ernest Rutherford",1871],["Marcel Proust",1871],["Bertrand Russell",1872],
    ["Guglielmo Marconi",1874],["Winston Churchill",1874],["Carl Jung",1875],["Albert Einstein",1879],
    ["Pablo Picasso",1881],["Emmy Noether",1882],["Franklin D. Roosevelt",1882],["Igor Stravinsky",1882],
    ["John Maynard Keynes",1883],["Niels Bohr",1885],["Georgia O'Keeffe",1887],["Erwin Schrodinger",1887],
    ["Srinivasa Ramanujan",1887],["Edwin Hubble",1889],["Charlie Chaplin",1889],["Agatha Christie",1890],
    ["Dwight Eisenhower",1890],["J.R.R. Tolkien",1892],["Mao Zedong",1893],["Amelia Earhart",1897],
    ["Louis Armstrong",1901],["Linus Pauling",1901],["Walt Disney",1901],["Werner Heisenberg",1901],
    ["George Orwell",1903],["John von Neumann",1903],["Robert Oppenheimer",1904],["Salvador Dali",1904],
    ["Jean-Paul Sartre",1905],["Grace Hopper",1906],["Kurt Godel",1906],["Frida Kahlo",1907],
    ["Jacques Cousteau",1910],["Alan Turing",1912],["Jackson Pollock",1912],["Rosa Parks",1913],
    ["Jonas Salk",1914],["Claude Shannon",1916],["John F. Kennedy",1917],["Nelson Mandela",1918],
    ["Richard Feynman",1918],["Katherine Johnson",1918],["Isaac Asimov",1920],["Rosalind Franklin",1920],
    ["Maya Angelou",1928],["James Watson",1928],["Che Guevara",1928],["Martin Luther King Jr.",1929],
    ["Neil Armstrong",1930],["Buzz Aldrin",1930],["Jane Goodall",1934],["Yuri Gagarin",1934],
    ["Carl Sagan",1934],["Tenzin Gyatso",1935],["Bob Dylan",1941],["Stephen Hawking",1942],
    ["Muhammad Ali",1942],["Jimi Hendrix",1942],["Steve Wozniak",1950],["Tim Berners-Lee",1955],
    ["Steve Jobs",1955],["Bill Gates",1955],["Hal Finney",1956],["Nick Szabo",1964],
    ["Vitalik Buterin",1994],["Satoshi Nakamoto",2008]
  ];

  // The 7 mythic 1-of-1 chase cards.
  var UNIQUES = {
    "Satoshi Nakamoto":1,"Leonardo da Vinci":1,"Cleopatra":1,"Genghis Khan":1,
    "Marie Curie":1,"Alan Turing":1,"Hypatia":1
  };
  // A few low-supply scarce humans (between unique and the common 50).
  var SCARCE = {
    "Vitalik Buterin":3,"Hal Finney":3,"Nikola Tesla":5,"Albert Einstein":5,
    "Ada Lovelace":7,"William Shakespeare":7,"Isaac Newton":7,"Napoleon Bonaparte":10,
    "Julius Caesar":10,"Joan of Arc":10,"Galileo Galilei":15,"Charles Darwin":15,
    "Confucius":25,"Plato":25,"Aristotle":25,"Nelson Mandela":12,"Nick Szabo":8,
    "Mahatma Gandhi":20,"Martin Luther King Jr.":18,"Frida Kahlo":20,"Cyrus the Great":25
  };

  // tiny deterministic RNG (mulberry32-ish) seeded by string
  function seed(str){var h=1779033703^str.length;for(var i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return((h^=h>>>16)>>>0)/4294967296;};}

  var HUMANS_TOTAL = 239;
  // Trim the catalogue to exactly the contract's 239 human slots
  // (drop 27 unreferenced figures; everything cited elsewhere is kept).
  var REMOVE = {"Aeschylus":1,"Sophocles":1,"Herodotus":1,"Diogenes":1,"Epicurus":1,
    "Virgil":1,"Seneca":1,"Boudica":1,"Trajan":1,"Galen":1,"Ptolemy":1,"Plutarch":1,
    "Attila":1,"Justinian I":1,"Harun al-Rashid":1,"Leif Erikson":1,"El Cid":1,
    "Omar Khayyam":1,"Petrarch":1,"Geoffrey Chaucer":1,"Giotto":1,"William Wallace":1,
    "Ibn Battuta":1,"Brunelleschi":1,"Donatello":1,"Cosimo de' Medici":1,"Lorenzo de' Medici":1};
  RAW = RAW.filter(function (r) { return !REMOVE[r[0]]; });
  var FIGURES = RAW.map(function (row, i) {
    var name = row[0], born = row[1];
    var rnd = seed(name);
    var maxSupply = UNIQUES[name] || SCARCE[name] || 50;
    // minted: most humans are barely minted (the contract is mostly dormant).
    var cap = maxSupply >= 25 ? 6 : maxSupply >= 10 ? 4 : Math.min(maxSupply, 3);
    var minted = maxSupply <= 1 ? 1 : 1 + Math.floor(rnd() * rnd() * cap);
    if (minted > maxSupply) minted = maxSupply;
    var st = function () { return 30 + Math.floor(rnd() * 70); };
    var b = (window.HCX_BIOS && window.HCX_BIOS[name]) || null;
    return {
      humanId: i + 1,
      name: name,
      born: born,
      role: b ? b[0] : null,
      bio: b ? b[1] : null,
      maxSupply: maxSupply,
      minted: minted,
      // a representative token (lowest serial) for display
      cardId: 1000 + i * 17 + Math.floor(rnd() * 11),
      contract: CA,
      deployed: DEP,
      stats: { influence: st(), intellect: st(), dominion: st(), legacy: st() }
    };
  });

  function byName(n){ return FIGURES.filter(function(f){return f.name===n;})[0]; }
  function byId(id){ return FIGURES.filter(function(f){return f.humanId===id;})[0]; }
  function eraLabel(y){ return y < 0 ? Math.abs(y) + " BCE" : y + " CE"; }

  // The connected-wallet collection: a believable owned set (humanId + serial).
  var OWNED = [
    {name:"Marcus Aurelius",cardId:1742}, {name:"Ada Lovelace",cardId:2461},
    {name:"Vitalik Buterin",cardId:9921}, {name:"Cleopatra",cardId:1}, // a 1-of-1 pull
    {name:"Nikola Tesla",cardId:8806}, {name:"Confucius",cardId:1233},
    {name:"Hypatia is not owned placeholder",cardId:0,skip:true},
    {name:"Leonardo da Vinci is chase",cardId:0,skip:true},
    {name:"Galileo Galilei",cardId:3344}, {name:"Joan of Arc",cardId:1190},
    {name:"Mary Wollstonecraft",cardId:4002}, {name:"Sun Tzu",cardId:551},
    {name:"Charles Darwin",cardId:2900}, {name:"Frida Kahlo",cardId:6610},
    {name:"Plato",cardId:980}, {name:"Mahatma Gandhi",cardId:5521}
  ].filter(function(o){return !o.skip;}).map(function(o){
    var f = byName(o.name); if(!f) return null;
    return Object.assign({}, f, { cardId:o.cardId, owned:true });
  }).filter(Boolean);

  // totals for the stat bar (computed → internally consistent)
  var cardsMinted = FIGURES.reduce(function(a,f){return a+f.minted;},0);
  var uniques = FIGURES.filter(function(f){return f.maxSupply<=1;}).length;

  // Today's Timeline puzzle: 5 figures to order by birth year.
  var TIMELINE_TODAY = ["Cleopatra","Leonardo da Vinci","Isaac Newton","Ada Lovelace","Alan Turing"]
    .map(byName).filter(Boolean);

  window.HCX = {
    CA: CA, DEP: DEP,
    HUMANS_TOTAL: HUMANS_TOTAL,
    FIGURES: FIGURES,
    OWNED: OWNED,
    TIMELINE_TODAY: TIMELINE_TODAY,
    stats: { humans: HUMANS_TOTAL, minted: FIGURES.length, cardsMinted: cardsMinted, uniques: uniques, genesis: 2018 },
    byName: byName, byId: byId, eraLabel: eraLabel, seed: seed
  };
})();
