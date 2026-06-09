/* data.js — HumanityCards catalogue + game data, from the REAL 2018 contract.
   Source of truth for humanId / name / maxSupply is the on-chain roster
   (humanity-cards-roster.md). Minted counts are a snapshot fallback here and
   are refreshed live from the contract by hcx-chain.js (getHumanInfo).
   Scarcity is spoken in SUPPLY COUNTS only — never tiers.                  */
(function () {
  var CA = "0xbc9B96E7Aa6AFEA664f9D5fdDa168518eE20f2Cc";          // original (mining)
  var WRAPPER = "0xf6f722590af5f791f68d0ed88d27b72dde1c70ca";       // ERC-721 wrapper (ownership)
  var DEP = "13 MAR 2018";

  // [humanId, name, maxSupply, mintedSnapshot, bornYear(-=BCE), influence, controversy]
  var RAW = [
    [0,"Moses",1,1,-1391,95,55],
    [1,"Confucius",30,0,-551,93,35],
    [2,"Einstein",20,3,1879,97,40],
    [3,"Paul the Apostle",100,1,5,85,50],
    [4,"Christopher Columbus",30,1,1451,82,80],
    [5,"Jesus",1,1,-4,100,70],
    [6,"Galileo",200,0,1564,95,50],
    [7,"Gutenberg",200,0,1400,90,30],
    [8,"Lavoisier",100,3,1743,80,30],
    [9,"Constantin",50,0,272,82,50],
    [10,"James Watt",100,1,1736,80,30],
    [11,"Faraday",100,0,1791,85,30],
    [12,"Maxwell",100,0,1831,88,25],
    [13,"Muhammad",1,1,570,100,75],
    [14,"Buddha",5,5,-563,97,30],
    [15,"Cai Lun",100,3,50,72,25],
    [16,"Aristotle",20,1,-384,95,35],
    [17,"Euclid",100,0,-323,85,25],
    [18,"Newton",50,0,1643,97,40],
    [19,"Darwin",50,0,1809,95,55],
    [20,"Qin Shi Huang",50,0,-259,85,70],
    [21,"Augustus",20,0,-63,90,50],
    [22,"Leonidas",10,7,-540,75,40],
    [23,"Martin Luther",50,0,1483,88,65],
    [24,"Washington",30,0,1732,88,45],
    [25,"Karl Marx",10,7,1818,90,80],
    [26,"Goazu of Han",30,1,-256,65,50],
    [27,"Gengis Khan",5,4,1162,94,85],
    [28,"Adam Smith",100,4,1723,85,35],
    [29,"Shakespeare",30,2,1564,95,30],
    [30,"John Dalton",100,0,1766,75,25],
    [31,"Alexander The Great",3,2,-356,96,55],
    [32,"Napoleon",3,1,1769,95,72],
    [33,"Thomas Edison",100,0,1847,85,60],
    [34,"Mansa Musa",30,0,1280,65,30],
    [35,"Morton",100,0,1819,45,35],
    [36,"Marconi",100,0,1874,75,40],
    [37,"Hitler",5,4,1889,90,100],
    [38,"Plato",20,1,-428,93,35],
    [39,"Malcolm X",100,3,1925,78,60],
    [40,"Bell",100,1,1847,78,40],
    [41,"Fleming",100,1,1881,82,30],
    [42,"Socrates",10,9,-470,92,45],
    [43,"Beethoven",10,8,1770,90,35],
    [44,"Heisenberg",100,0,1901,85,45],
    [45,"David",30,0,-1000,75,45],
    [46,"Simon Bolivar",100,2,1783,78,45],
    [47,"Descartes",100,2,1596,88,40],
    [48,"Michelangelo",50,1,1475,93,30],
    [49,"Urban II",50,1,1035,58,60],
    [50,"Omar ibn al-Khattab",50,0,584,72,50],
    [51,"Ashoka",50,1,-304,75,40],
    [52,"Augustine of Hippo",50,0,354,80,40],
    [53,"Harvey",100,1,1578,70,30],
    [54,"Rutherford",100,0,1871,82,30],
    [55,"John Calvin",100,1,1509,72,55],
    [56,"Idi Amin",100,1,1925,55,90],
    [57,"Max Planck",50,0,1858,85,25],
    [58,"Pinochet",50,2,1915,55,85],
    [59,"Nikolaus Otto",100,1,1832,60,25],
    [60,"Pizarro",50,1,1478,58,82],
    [61,"Cortes",50,1,1485,65,85],
    [62,"Jefferson",100,0,1743,85,55],
    [63,"Isebella I of Castile",100,0,1451,65,60],
    [64,"Stalin",5,4,1878,88,98],
    [65,"William the Conqueror",10,7,1028,78,60],
    [66,"Freud",100,3,1856,85,60],
    [67,"Edward Jenner",100,0,1749,78,30],
    [68,"Rontgen",100,1,1845,78,30],
    [69,"Bach",50,0,1685,90,25],
    [70,"Lao Tseu",30,0,-570,85,35],
    [71,"Voltaire",50,0,1694,85,50],
    [72,"Kepler",100,0,1571,82,30],
    [73,"Chiang Kai Shek",50,0,1887,68,65],
    [74,"Euler",100,0,1707,85,25],
    [75,"Jean-Jacques Rousseau",50,0,1712,85,50],
    [76,"Machiavelli",20,0,1469,80,65],
    [77,"Malthus",100,2,1766,68,50],
    [78,"Kennedy",30,1,1917,82,55],
    [79,"Hideki Tojo",30,2,1884,60,85],
    [80,"Mani",30,0,216,45,55],
    [81,"Lenin",30,0,1870,88,85],
    [82,"Sui Wendi",100,2,541,62,40],
    [83,"Vasco da Gama",50,0,1460,62,55],
    [84,"Cyrus The Great",20,0,-600,82,40],
    [85,"Peter The Great",50,1,1672,78,55],
    [86,"Mao Zedong",10,5,1893,90,92],
    [87,"Francis Bacon",100,2,1561,78,40],
    [88,"Henry Ford",100,1,1863,82,55],
    [89,"Mencius",100,2,-372,72,30],
    [90,"Zoroastre",30,0,-628,72,45],
    [91,"Elizabeth I",50,2,1533,82,45],
    [92,"Gorbatchev",30,1,1931,78,55],
    [93,"Menes",30,0,-3100,55,40],
    [94,"Charlemagne",30,0,748,85,50],
    [95,"Homer",100,1,-800,85,35],
    [96,"Justinian",50,0,482,72,45],
    [97,"Mahavira",50,0,-599,65,30],
    [98,"Trump",200,13,1946,85,90],
    [99,"Xi Jinping",200,0,1953,82,70],
    [100,"Macron",200,2,1977,65,55],
    [101,"Kim Jung Un",100,2,1984,60,85],
    [102,"Merkel",200,2,1954,78,45],
    [103,"Obama",200,5,1961,85,55],
    [104,"Mussolini",30,0,1883,78,90],
    [105,"Pol Pot",30,0,1925,65,97],
    [106,"Chavez",100,2,1954,60,75],
    [107,"Mandela",100,1,1918,90,40],
    [108,"Gaddafi",100,0,1942,65,85],
    [109,"Zuckerberg",200,1,1984,80,65],
    [110,"Jeff Bezos",100,1,1964,80,60],
    [111,"Steve Jobs",200,3,1955,90,55],
    [112,"Bill Gates",200,4,1955,88,55],
    [113,"Joan of Arc",20,0,1412,78,50],
    [114,"Marie Antoinette",50,4,1755,65,55],
    [115,"Caesar",5,4,-100,95,65],
    [116,"Larry Page",100,1,1973,75,45],
    [117,"Sergey Brin",100,3,1973,75,45],
    [118,"Putin",100,0,1952,85,80],
    [119,"Cleopatra",10,7,-69,85,55],
    [120,"Mark Antony",50,1,-83,65,55],
    [121,"Pompey",50,1,-106,65,50],
    [122,"Crassus",50,0,-115,58,60],
    [123,"Spartacus",10,7,-103,72,50],
    [124,"Sulla",100,2,-138,62,65],
    [125,"Cicero",100,2,-106,80,40],
    [126,"Charles de Gaulle",50,1,1890,78,50],
    [127,"Churchill",30,1,1874,88,55],
    [128,"Hillary Clinton",200,2,1947,70,70],
    [129,"John Rockefeller",100,0,1839,80,65],
    [130,"Mugabe",200,2,1924,55,85],
    [131,"Kadyrov",200,1,1976,45,80],
    [132,"Mauricio Macri",100,1,1959,40,50],
    [133,"Elizabeth II",200,1,1926,82,35],
    [134,"Philippe of Belgium",100,0,1960,38,30],
    [135,"George W. Bush",200,1,1946,72,70],
    [136,"George Bush",100,1,1924,68,55],
    [137,"Michel Temer",100,1,1940,38,55],
    [138,"Fidel Castro",100,1,1926,78,80],
    [139,"Tsipras",100,1,1974,40,50],
    [140,"Ali Khamenei",100,1,1939,65,70],
    [141,"Saddam Hussein",100,0,1937,72,90],
    [142,"Netanyahu",100,0,1949,65,70],
    [143,"Mohammed VI",100,1,1963,45,40],
    [144,"Felipe VI",100,2,1968,45,35],
    [145,"Bashar al Assad",200,4,1965,60,90],
    [146,"Erdogan",200,1,1954,70,70],
    [147,"Satoshi Nakamoto",3,3,1975,85,60],
    [148,"Attila",10,7,406,78,82],
    [149,"Nero",30,0,37,70,85],
    [150,"Hannibal",10,8,-247,82,55],
    [151,"Vlad the Impaler",30,2,1431,60,85],
    [152,"Scipio Africanus",50,0,-236,65,40],
    [153,"Hamilcar",50,1,-275,55,45],
    [154,"Abraham",3,2,-1800,88,50],
    [155,"Vitalik Buterin",50,27,1994,80,35],
    [156,"Suleiman the Magnificent",10,8,1494,80,45],
    [157,"Ataturk",50,0,1881,80,50],
    [158,"Michael Jackson",100,1,1958,85,65],
    [159,"Elvis Presley",100,0,1935,82,40],
    [160,"John Lennon",100,1,1940,82,45],
    [161,"Freddie Mercury",100,0,1946,82,40],
    [162,"Berlusconi",200,1,1936,60,70],
    [163,"Mozart",50,0,1756,93,30],
    [164,"Ramesses II",30,0,-1303,72,45],
    [165,"Nefertiti",50,0,-1370,62,35],
    [166,"Tutankhamun",50,0,-1341,68,30],
    [167,"Clovis I",50,1,466,58,50],
    [168,"Elon Musk",100,17,1971,85,70],
    [169,"Atahualpa",50,0,1502,50,45],
    [170,"Nikola Tesla",10,8,1856,90,40],
    [171,"Abraham Lincoln",10,8,1809,90,40],
    [172,"Marie Curie",100,1,1867,90,30],
    [173,"Kim Jung Il",100,0,1941,55,85],
    [174,"Kim Il Sung",50,1,1912,65,85],
    [175,"Shaka Zulu",30,0,1787,65,65],
    [176,"Muhammad Ali",50,0,1942,82,50],
    [177,"Konrad Adenauer",100,1,1876,65,40],
    [178,"Alfred The Great",100,2,849,60,35],
    [179,"Black Beard",20,0,1680,60,70],
    [180,"Al Capone",30,0,1899,60,80],
    [181,"Pablo Escobar",50,0,1949,65,88],
    [182,"Caligula",50,0,12,60,88],
    [183,"Chamberlain",100,0,1869,55,60],
    [184,"Charles I",100,2,1600,58,55],
    [185,"Charles II",100,1,1630,55,45],
    [186,"Claudius",50,1,-10,62,45],
    [187,"Da Vinci",10,8,1452,95,30],
    [188,"Margaret Thatcher",50,0,1925,78,65],
    [189,"Charles Dickens",100,2,1812,82,30],
    [190,"Erasmus",100,2,1466,72,40],
    [191,"Freud",100,1,1856,85,60],
    [192,"Gandhi",10,8,1869,92,45],
    [193,"Che Guevara",30,0,1928,75,80],
    [194,"Stephen Hawking",100,4,1942,88,35],
    [195,"Henry IV",50,1,1553,62,45],
    [196,"Hindenburg",100,1,1847,58,55],
    [197,"Ho Chi Min",100,1,1890,72,65],
    [198,"Emperor Hirohito",50,0,1901,70,65],
    [199,"Imhotep",100,1,-2650,60,30],
    [200,"Ali Jinnah",100,2,1876,70,55],
    [201,"Khufu",100,0,-2600,62,35],
    [202,"Martin Luther King",30,0,1929,90,45],
    [203,"Louis XIV",50,0,1638,82,55],
    [204,"Jean Moulin",100,1,1899,45,35],
    [205,"Nehru",100,0,1889,75,45],
    [206,"Nicholas II",50,1,1868,60,55],
    [207,"Alfred Nobel",100,1,1833,75,40],
    [208,"Philippe Petain",100,0,1856,50,75],
    [209,"Picasso",100,1,1881,92,45],
    [210,"Marco Polo",200,1,1254,72,40],
    [211,"Pythagoras",50,2,-570,82,35],
    [212,"Ramesses the Great",50,0,-1303,70,45],
    [213,"Ronald Reagan",100,0,1911,80,55],
    [214,"Jack the Ripper",50,0,1855,45,85],
    [215,"Robespierre",100,0,1758,68,75],
    [216,"Franklin D Roosevelt",50,1,1882,88,45],
    [217,"Theodore Roosevelt",100,1,1858,82,50],
    [218,"Enver Pasha",50,1,1881,45,80],
    [219,"Snofru",100,2,-2600,50,30],
    [220,"Yahya Khan",50,0,1917,40,70],
    [221,"Tiberius",30,1,-42,65,60],
    [222,"Titus",100,3,39,58,40],
    [223,"Trotsky",50,1,1879,75,70],
    [224,"Turing",50,0,1912,90,35],
    [225,"Van Gogh",50,2,1853,90,35],
    [226,"Vespasian",50,0,9,58,40],
    [227,"Victoria",50,1,1819,80,50],
    [228,"William Wallace",100,1,1270,65,45],
    [229,"William II",100,5,1859,60,60],
    [230,"Jack Ma",200,4,1964,72,55],
    [231,"Warren Buffet",200,4,1930,80,40],
    [232,"Stephen King",100,1,1947,75,35],
    [233,"Edgar Allan Poe",100,1,1809,78,40],
    [234,"Tolkien",100,1,1892,82,30],
    [235,"Ram Nath Kovind",200,1,1945,40,35],
    [236,"Sarkozy",100,1,1955,55,55],
    [237,"Ben Laden",30,0,1957,75,98],
    [238,"Ponzi",200,1,1882,55,80]
  ];

  // tiny deterministic RNG (mulberry32-ish) seeded by string
  function seed(str){var h=1779033703^str.length;for(var i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return((h^=h>>>16)>>>0)/4294967296;};}
  function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}

  // Map a real-roster name onto the curated bios.js keys where they differ.
  var BIO_ALIAS = {
    "Gengis Khan":"Genghis Khan","Da Vinci":"Leonardo da Vinci","Caesar":"Julius Caesar",
    "Buddha":"Siddhartha Gautama","Napoleon":"Napoleon Bonaparte","Newton":"Isaac Newton",
    "Lao Tseu":"Lao Tzu","Cyrus The Great":"Cyrus the Great","Martin Luther King":"Martin Luther King Jr.",
    "Beethoven":"Ludwig van Beethoven","Machiavelli":"Niccolo Machiavelli","Cortes":"Hernan Cortes",
    "Christopher Columbus":"Christopher Columbus","Suleiman the Magnificent":"Suleiman the Magnificent",
    "Marie Curie":"Marie Curie","Nikola Tesla":"Nikola Tesla","Mao Zedong":"Mao Zedong",
    "Karl Marx":"Karl Marx","Vitalik Buterin":"Vitalik Buterin","Satoshi Nakamoto":"Satoshi Nakamoto",
    "Galileo":"Galileo Galilei","Shakespeare":"William Shakespeare","Darwin":"Charles Darwin",
    "Einstein":"Albert Einstein","Gandhi":"Mahatma Gandhi","Mandela":"Nelson Mandela",
    "Steve Jobs":"Steve Jobs","Bill Gates":"Bill Gates","Turing":"Alan Turing",
    "Abraham Lincoln":"Abraham Lincoln","Marco Polo":"Marco Polo","Joan of Arc":"Joan of Arc",
    "William the Conqueror":"William the Conqueror","Charlemagne":"Charlemagne","Gutenberg":"Johannes Gutenberg",
    "Michelangelo":"Michelangelo","Voltaire":"Voltaire","Stephen Hawking":"Stephen Hawking",
    "Pythagoras":"Pythagoras","Euclid":"Euclid","Socrates":"Socrates","Plato":"Plato",
    "Aristotle":"Aristotle","Confucius":"Confucius","Cleopatra":"Cleopatra","Hannibal":"Hannibal",
    "Muhammad":"Muhammad","Moses":"Moses","Vasco da Gama":"Vasco da Gama","Augustine of Hippo":"Augustine of Hippo",
    "Constantin":"Constantine","Justinian":"Justinian I","Ramesses II":"Ramesses II","Nefertiti":"Nefertiti",
    "Tutankhamun":"Tutankhamun","Attila":"Attila","Imhotep":"Imhotep","Adam Smith":"Adam Smith",
    "Descartes":"Rene Descartes","Lavoisier":"Antoine Lavoisier","Faraday":"Michael Faraday",
    "Picasso":"Pablo Picasso","Van Gogh":"Vincent van Gogh","Mozart":"Wolfgang Amadeus Mozart",
    "Bach":"Johann Sebastian Bach","Che Guevara":"Che Guevara"
  };
  var BIOS = window.HCX_BIOS || {};
  function bioFor(name){ var key = BIO_ALIAS[name] || name; return BIOS[key] || null; }

  function eraWeight(born){ // 0..1, older = higher
    return clamp((2024 - born) / 4600, 0, 1);
  }

  var FIGURES = RAW.map(function (row, i) {
    var humanId = row[0], name = row[1], maxSupply = row[2], minted = row[3],
        born = row[4], inf = row[5], con = row[6];
    var rnd = seed(name);
    var b = bioFor(name);
    var ew = eraWeight(born);
    // Stats grounded in real attributes (deterministic, differentiated 30-99).
    var influence = clamp(inf, 30, 99);
    var intellect = clamp(30 + Math.floor(rnd() * 70), 30, 99);
    var dominion = clamp(con, 30, 99);
    var legacy = clamp(Math.round(inf * 0.55 + ew * 100 * 0.45), 30, 99);
    return {
      humanId: humanId,
      name: name,
      born: born,
      role: b ? b[0] : null,
      bio: b ? b[1] : null,
      maxSupply: maxSupply,
      minted: minted,                       // refreshed live by hcx-chain.js
      cardId: 1000 + humanId * 17 + Math.floor(rnd() * 11),
      contract: CA,
      deployed: DEP,
      stats: { influence: influence, intellect: intellect, dominion: dominion, legacy: legacy }
    };
  });

  var byId_ = {}, byName_ = {};
  FIGURES.forEach(function (f) { byId_[f.humanId] = f; byName_[f.name] = f; });
  function byName(n){ return byName_[n] || null; }
  function byId(id){ return byId_[id] || null; }
  function eraLabel(y){ return y < 0 ? Math.abs(y) + " BCE" : y + " CE"; }

  function recomputeStats() {
    window.HCX.stats.cardsMinted = FIGURES.reduce(function(a,f){return a+f.minted;},0);
    window.HCX.stats.uniques = FIGURES.filter(function(f){return f.maxSupply<=1;}).length;
    window.HCX.stats.minted = FIGURES.length;
  }

  // The connected-wallet collection — empty until hcx-chain reads the wrapper.
  var OWNED = [];

  // Today's Timeline puzzle: 5 real figures with distinct birth years.
  var TIMELINE_TODAY = ["Cleopatra","Da Vinci","Newton","Napoleon","Einstein"].map(byName).filter(Boolean);

  window.HCX = {
    CA: CA, WRAPPER: WRAPPER, DEP: DEP,
    HUMANS_TOTAL: FIGURES.length,
    FIGURES: FIGURES,
    OWNED: OWNED,
    TIMELINE_TODAY: TIMELINE_TODAY,
    stats: { humans: FIGURES.length, minted: FIGURES.length,
      cardsMinted: FIGURES.reduce(function(a,f){return a+f.minted;},0),
      uniques: FIGURES.filter(function(f){return f.maxSupply<=1;}).length, genesis: 2018 },
    byName: byName, byId: byId, eraLabel: eraLabel, seed: seed, recomputeStats: recomputeStats
  };
})();
