# relationships.py — historical edges between roster figures, for the
# Assassination game.
#
# Each edge: (winner, type, loser, note)
#   winner/loser are ROSTER display names (validated against roster.py at build)
#   type ∈ KILLED | DEFEATED | SUCCEEDED | OPPOSED | INFLUENCED
#
# Semantics, from the WINNER's side:
#   KILLED     — winner killed the loser, or ordered / directly caused the death
#   DEFEATED   — winner beat the loser in war, politics or a documented contest
#   SUCCEEDED  — winner took the loser's throne, office or mantle
#   OPPOSED    — documented antagonist; winner is the side that history (or the
#                authored note) gives the upper hand to
#   INFLUENCED — winner taught, mentored, patronised or demonstrably shaped the
#                loser ("the master outranks the pupil")
#
# In-game: playing the winner against the loser is an instant strike.

EDGES = [
    # ---- Rome ----
    ("Augustus", "DEFEATED", "Mark Antony", "Actium, 31 BCE — Antony's fleet broke and he fell on his sword"),
    ("Augustus", "DEFEATED", "Cleopatra", "Took Alexandria in 30 BCE; she chose the asp over his triumph"),
    ("Augustus", "SUCCEEDED", "Caesar", "Named heir in Caesar's will; finished what the dictator started"),
    ("Caesar", "DEFEATED", "Pompey", "Pharsalus, 48 BCE — the Republic died on that field"),
    ("Mark Antony", "KILLED", "Cicero", "Proscribed him in 43 BCE; the orator's head was nailed to the Rostra"),
    ("Crassus", "DEFEATED", "Spartacus", "Crushed the slave revolt in 71 BCE and crucified 6,000 along the Appian Way"),
    ("Pompey", "DEFEATED", "Spartacus", "Mopped up the fleeing remnant — and claimed the credit"),
    ("Sulla", "INFLUENCED", "Pompey", "His young protégé — 'Magnus' was Sulla's mocking gift"),
    ("Sulla", "INFLUENCED", "Caesar", "Showed Rome a general could seize it — a lesson Caesar perfected"),
    ("Scipio Africanus", "DEFEATED", "Hannibal", "Zama, 202 BCE — the only battle Hannibal ever lost that mattered"),
    ("Hamilcar", "INFLUENCED", "Hannibal", "His father, who made the boy swear eternal enmity to Rome"),
    ("Tiberius", "SUCCEEDED", "Augustus", "Adopted heir to the first emperor"),
    ("Caligula", "SUCCEEDED", "Tiberius", "Rome cheered the new prince — for about six months"),
    ("Claudius", "SUCCEEDED", "Caligula", "Found behind a curtain by the Praetorians after the assassination"),
    ("Nero", "SUCCEEDED", "Claudius", "Step-son and heir; Claudius died of a suspicious mushroom dish"),
    ("Vespasian", "SUCCEEDED", "Nero", "Won the Year of the Four Emperors that followed Nero's fall"),
    ("Titus", "SUCCEEDED", "Vespasian", "First Roman emperor to succeed his own father"),

    # ---- Greece & Persia ----
    ("Socrates", "INFLUENCED", "Plato", "The master whose trial and death Plato never stopped writing about"),
    ("Plato", "INFLUENCED", "Aristotle", "Twenty years his student at the Academy"),
    ("Aristotle", "INFLUENCED", "Alexander The Great", "Hired by Philip II to tutor the boy who would take the world"),
    ("Pythagoras", "INFLUENCED", "Plato", "Pythagorean number-mysticism runs all through the dialogues"),
    ("Pythagoras", "INFLUENCED", "Euclid", "The Elements enshrined the Pythagoreans' geometry"),
    ("Homer", "INFLUENCED", "Alexander The Great", "Slept with the Iliad under his pillow, annotated by Aristotle"),
    ("Alexander The Great", "SUCCEEDED", "Cyrus The Great", "Seized the Persian throne Cyrus founded — and honoured his tomb"),
    ("Zoroastre", "INFLUENCED", "Cyrus The Great", "His faith became the religion of the empire Cyrus built"),
    ("Alexander The Great", "INFLUENCED", "Caesar", "Caesar wept at his statue: at my age he had conquered the world"),
    ("Caesar", "INFLUENCED", "Napoleon", "The model autocrat — Napoleon wrote a history of his wars"),

    # ---- China & India ----
    ("Lao Tseu", "INFLUENCED", "Confucius", "Tradition has Confucius consulting the old master on ritual"),
    ("Confucius", "INFLUENCED", "Mencius", "Mencius studied under his grandson's school and carried the doctrine"),
    ("Goazu of Han", "SUCCEEDED", "Qin Shi Huang", "His Han dynasty rose from the wreck of the Qin"),
    ("Buddha", "OPPOSED", "Mahavira", "Rival teachers of the same śramaṇa age in the same Ganges plain"),
    ("Buddha", "INFLUENCED", "Ashoka", "After Kalinga, the emperor turned to the Buddha's path"),
    ("Mao Zedong", "INFLUENCED", "Xi Jinping", "Rules the party — and the cult of the leader — that Mao built"),

    # ---- Abrahamic line ----
    ("Abraham", "INFLUENCED", "Moses", "The covenant Moses renewed at Sinai began with Abraham"),
    ("Moses", "INFLUENCED", "Jesus", "The Law and the prophets Jesus said he came to fulfil"),
    ("Moses", "INFLUENCED", "Muhammad", "Musa, the prophet most often named in the Quran"),
    ("Abraham", "INFLUENCED", "Muhammad", "Islam traces itself to Abraham through Ishmael"),
    ("David", "INFLUENCED", "Jesus", "'Son of David' — the messianic line ran through his house"),
    ("Moses", "OPPOSED", "Ramesses II", "Tradition casts Ramesses as the pharaoh of the Exodus"),
    ("Moses", "OPPOSED", "Ramesses the Great", "Same king, second card — the plagues still win"),
    ("Jesus", "INFLUENCED", "Paul the Apostle", "The road to Damascus turned the persecutor into the apostle"),
    ("Paul the Apostle", "INFLUENCED", "Augustine of Hippo", "Tolle lege — it was Paul's epistle that converted him"),
    ("Plato", "INFLUENCED", "Augustine of Hippo", "Neoplatonism gave Augustine his philosophical frame"),
    ("Jesus", "INFLUENCED", "Constantin", "In hoc signo vinces — the cross he conquered under"),
    ("Constantin", "INFLUENCED", "Justinian", "Justinian ruled — and rebuilt — the city Constantine founded"),
    ("Muhammad", "INFLUENCED", "Omar ibn al-Khattab", "Companion of the Prophet from the early days at Mecca"),
    ("Omar ibn al-Khattab", "SUCCEEDED", "Muhammad", "Second caliph of the community the Prophet founded"),
    ("Zoroastre", "INFLUENCED", "Mani", "Mani claimed to complete what Zoroaster began"),
    ("Jesus", "INFLUENCED", "Mani", "Mani styled himself the apostle of Jesus Christ"),

    # ---- Ancient Egypt ----
    ("Khufu", "SUCCEEDED", "Snofru", "Took his father's perfected pyramid design to Giza"),
    ("Imhotep", "INFLUENCED", "Snofru", "Sneferu's true pyramids stand on Imhotep's stepped shoulders"),

    # ---- Medieval & Renaissance ----
    ("Clovis I", "INFLUENCED", "Charlemagne", "Charlemagne inherited the Frankish kingdom Clovis founded"),
    ("Charlemagne", "INFLUENCED", "Napoleon", "Napoleon invoked him at his own imperial coronation"),
    ("Gengis Khan", "INFLUENCED", "Marco Polo", "The Pax Mongolica he built was the road Polo travelled"),
    ("Marco Polo", "INFLUENCED", "Christopher Columbus", "Columbus sailed with an annotated copy of Polo's Travels"),
    ("Gutenberg", "INFLUENCED", "Martin Luther", "The press made the Theses a continental event in weeks"),
    ("Martin Luther", "INFLUENCED", "John Calvin", "Calvin's Geneva systematised the revolt Luther started"),
    ("Martin Luther", "OPPOSED", "Erasmus", "Their free-will debate split humanism from Reformation"),
    ("Erasmus", "INFLUENCED", "Martin Luther", "Erasmus laid the egg that Luther hatched, as the friars said"),
    ("Isebella I of Castile", "INFLUENCED", "Christopher Columbus", "Her crown jewels — and her gamble — funded the voyage"),
    ("Christopher Columbus", "INFLUENCED", "Cortes", "Cortés sailed in the wake Columbus opened"),
    ("Pizarro", "KILLED", "Atahualpa", "Took his ransom in gold, then garrotted him anyway, 1533"),
    ("Michelangelo", "OPPOSED", "Da Vinci", "Florence's famous rivalry — the duelling battle cartoons of 1504"),
    ("Elizabeth I", "INFLUENCED", "Shakespeare", "His company played her court; his England was hers"),
    ("Charles II", "SUCCEEDED", "Charles I", "Restored in 1660 to the throne his father lost to the axe"),
    ("Henry IV", "INFLUENCED", "Louis XIV", "His grandfather — the Bourbon throne Louis made absolute"),

    # ---- Scientific lineage ----
    ("Euclid", "INFLUENCED", "Newton", "The Principia is written in the geometry of the Elements"),
    ("Galileo", "INFLUENCED", "Newton", "'If I have seen further, it is by standing on the shoulders of giants'"),
    ("Kepler", "INFLUENCED", "Newton", "Kepler's three laws fell out of Newton's gravitation"),
    ("Francis Bacon", "INFLUENCED", "Newton", "The Royal Society ran on Bacon's method; Newton ran the Society"),
    ("Newton", "INFLUENCED", "Voltaire", "Voltaire carried Newton's physics to the continent"),
    ("Lavoisier", "INFLUENCED", "John Dalton", "Dalton's atoms gave Lavoisier's elements their mechanism"),
    ("John Dalton", "INFLUENCED", "Rutherford", "From atoms as fact to atoms split open"),
    ("Faraday", "INFLUENCED", "Maxwell", "Maxwell turned Faraday's fields into four equations"),
    ("Maxwell", "INFLUENCED", "Einstein", "'I stand not on Newton's shoulders but on Maxwell's' — Einstein"),
    ("Max Planck", "INFLUENCED", "Einstein", "The quantum Einstein ran with — and the editor who published him"),
    ("Newton", "INFLUENCED", "Einstein", "The mechanics relativity had to break"),
    ("Einstein", "OPPOSED", "Heisenberg", "'God does not play dice' — he never accepted uncertainty"),
    ("Rontgen", "INFLUENCED", "Marie Curie", "His X-rays set off the radioactivity hunt she won twice"),
    ("Nikola Tesla", "DEFEATED", "Thomas Edison", "AC beat DC in the War of the Currents"),
    ("Nikola Tesla", "DEFEATED", "Marconi", "The radio patent fight the US Supreme Court settled Tesla's way in 1943"),
    ("Malthus", "INFLUENCED", "Darwin", "Reading Malthus 'for amusement' gave Darwin the struggle for existence"),
    ("Adam Smith", "INFLUENCED", "Malthus", "Political economy's founder set the terms Malthus argued in"),

    # ---- Enlightenment → Revolution ----
    ("Voltaire", "OPPOSED", "Jean-Jacques Rousseau", "The Enlightenment's most famous feud — wit against feeling"),
    ("Jean-Jacques Rousseau", "INFLUENCED", "Robespierre", "Robespierre kept the Social Contract like scripture"),
    ("Robespierre", "KILLED", "Marie Antoinette", "The Terror's tribunal sent her to the guillotine, October 1793"),
    ("Robespierre", "KILLED", "Lavoisier", "'The Republic has no need of savants' — guillotined, May 1794"),
    ("Napoleon", "SUCCEEDED", "Robespierre", "Picked up the Revolution the Terror had decapitated"),
    ("Beethoven", "OPPOSED", "Napoleon", "Scratched out the Eroica's dedication when he crowned himself"),

    # ---- Marx → the revolutions ----
    ("Adam Smith", "INFLUENCED", "Karl Marx", "Capital is one long argument with the Wealth of Nations"),
    ("Karl Marx", "INFLUENCED", "Lenin", "What Is To Be Done was Marx rewritten for Russia"),
    ("Karl Marx", "INFLUENCED", "Mao Zedong", "Marxism with Chinese characteristics, peasant edition"),
    ("Lenin", "INFLUENCED", "Mao Zedong", "The vanguard-party model Mao imported and outgrew"),
    ("Lenin", "INFLUENCED", "Ho Chi Min", "Joined the Comintern in Paris; Leninism was his road home"),
    ("Karl Marx", "INFLUENCED", "Che Guevara", "The doctor's bookshelf that became a rifle"),
    ("Fidel Castro", "INFLUENCED", "Che Guevara", "Met in Mexico City, 1955; the Granma sailed with both"),
    ("Mao Zedong", "INFLUENCED", "Pol Pot", "The Great Leap, replayed in Cambodia as Year Zero"),
    ("Lenin", "KILLED", "Nicholas II", "The Bolsheviks shot the Romanovs at Yekaterinburg, July 1918"),
    ("Stalin", "SUCCEEDED", "Lenin", "Outmanoeuvred every rival for the dead leader's mantle"),
    ("Stalin", "KILLED", "Trotsky", "An NKVD ice axe found him in Mexico City, 1940"),
    ("Stalin", "INFLUENCED", "Kim Il Sung", "Moscow picked him, trained him, and installed him in Pyongyang"),
    ("Kim Jung Il", "SUCCEEDED", "Kim Il Sung", "Communism's first hereditary throne, 1994"),
    ("Kim Jung Un", "SUCCEEDED", "Kim Jung Il", "Third Kim on the throne, 2011"),
    ("Lenin", "DEFEATED", "Enver Pasha", "Enver died charging Red Army troops in Tajikistan, 1922"),

    # ---- World Wars ----
    ("Victoria", "INFLUENCED", "William II", "His grandmother — he held her hand as she died"),
    ("William II", "OPPOSED", "Nicholas II", "'Willy' and 'Nicky' — cousins whose telegrams failed to stop 1914"),
    ("Hindenburg", "DEFEATED", "Nicholas II", "Tannenberg, 1914 — two Russian armies destroyed"),
    ("Hitler", "SUCCEEDED", "Hindenburg", "Merged the presidency into the Führer's office on his death"),
    ("Hitler", "DEFEATED", "Chamberlain", "Munich, 1938 — 'peace for our time' lasted eleven months"),
    ("Churchill", "SUCCEEDED", "Chamberlain", "Took over in May 1940, as the Panzers rolled into France"),
    ("Mussolini", "INFLUENCED", "Hitler", "Fascism marched on Rome a decade before Munich's beer hall"),
    ("Stalin", "DEFEATED", "Hitler", "Stalingrad to Berlin — the Eastern Front broke the Reich"),
    ("Churchill", "DEFEATED", "Hitler", "Never surrendered; outlasted him from the Battle of Britain to the bunker"),
    ("Franklin D Roosevelt", "DEFEATED", "Hitler", "The arsenal of democracy he built buried the Reich"),
    ("Franklin D Roosevelt", "DEFEATED", "Hideki Tojo", "Midway to Saipan — Tojo fell with the island, 1944"),
    ("Emperor Hirohito", "INFLUENCED", "Hideki Tojo", "The emperor in whose name Tojo made war"),
    ("Turing", "DEFEATED", "Hitler", "Bletchley's break into Enigma helped sink the Reich"),
    ("Einstein", "INFLUENCED", "Franklin D Roosevelt", "His 1939 letter set the bomb program in motion"),
    ("Ataturk", "DEFEATED", "Churchill", "Gallipoli, 1915 — the disaster that nearly ended Churchill's career"),
    ("Ataturk", "OPPOSED", "Enver Pasha", "Rivals for the Turkish future; Kemal barred him from it"),
    ("Charles de Gaulle", "DEFEATED", "Philippe Petain", "Vichy fell; his old mentor was condemned in his court"),
    ("Charles de Gaulle", "INFLUENCED", "Jean Moulin", "His envoy, parachuted home to unify the Resistance"),
    ("Hitler", "KILLED", "Jean Moulin", "Died under Gestapo torture without giving a single name, 1943"),

    # ---- Decolonisation & civil rights ----
    ("Gandhi", "OPPOSED", "Churchill", "Churchill sneered at the 'half-naked fakir'; the fakir won India"),
    ("Gandhi", "INFLUENCED", "Nehru", "His chosen political heir"),
    ("Gandhi", "INFLUENCED", "Martin Luther King", "Satyagraha became the playbook of Montgomery and Selma"),
    ("Gandhi", "INFLUENCED", "Mandela", "Nonviolence first; Mandela began as a Gandhian"),
    ("Ali Jinnah", "OPPOSED", "Gandhi", "One man's independence was the other's partition"),
    ("Malcolm X", "OPPOSED", "Martin Luther King", "'The ballot or the bullet' against the dream"),
    ("Malcolm X", "INFLUENCED", "Muhammad Ali", "Mentor who brought the champ into the Nation of Islam"),

    # ---- Cold War → today ----
    ("Mao Zedong", "DEFEATED", "Chiang Kai Shek", "Won the civil war in 1949; Chiang withdrew to Taiwan"),
    ("Fidel Castro", "DEFEATED", "Kennedy", "Bay of Pigs, 1961 — the invasion collapsed on the beach"),
    ("Ronald Reagan", "OPPOSED", "Gorbatchev", "'Tear down this wall' — and within years it fell"),
    ("Merkel", "DEFEATED", "Tsipras", "The 2015 bailout standoff ended on her terms"),
    ("Merkel", "OPPOSED", "Putin", "The chancellor who spoke his Russian and never blinked"),
    ("Theodore Roosevelt", "INFLUENCED", "Franklin D Roosevelt", "Fifth cousin, idol, and the template for the job"),
    ("Jefferson", "INFLUENCED", "Abraham Lincoln", "'All men are created equal' — Lincoln's favourite sentence"),
    ("Washington", "INFLUENCED", "Simon Bolivar", "The Liberator kept a portrait of him — sent by Lafayette"),
    ("Simon Bolivar", "INFLUENCED", "Chavez", "The 'Bolivarian revolution' wore his name and his sword"),
    ("Victoria", "INFLUENCED", "Elizabeth II", "Great-great-grandmother — whose record reign Elizabeth broke"),
    ("Obama", "KILLED", "Ben Laden", "Ordered the Abbottabad raid, May 2011"),
    ("Ben Laden", "OPPOSED", "George W. Bush", "September 11 defined the Bush presidency"),
    ("George W. Bush", "DEFEATED", "Saddam Hussein", "The 2003 invasion ended in a spider hole and a gallows"),
    ("George Bush", "DEFEATED", "Saddam Hussein", "Desert Storm, 1991 — Kuwait freed in 100 hours of ground war"),
    ("George Bush", "INFLUENCED", "George W. Bush", "Father and 41st president"),
    ("Obama", "SUCCEEDED", "George W. Bush", "The 2008 election turned the page"),
    ("Trump", "SUCCEEDED", "Obama", "2016 — and much of his politics was the undoing of Obama's"),
    ("Trump", "DEFEATED", "Hillary Clinton", "The 2016 upset nobody's model predicted"),
    ("Sarkozy", "DEFEATED", "Gaddafi", "Led the 2011 intervention that toppled him"),
    ("Putin", "INFLUENCED", "Kadyrov", "The Kremlin's man in Grozny — appointed, funded, protected"),
    ("Putin", "INFLUENCED", "Bashar al Assad", "Propped up his rule for a decade, then gave him asylum"),
    ("Erdogan", "DEFEATED", "Bashar al Assad", "Backed the offensive that finally toppled Damascus in 2024"),
    ("Ali Khamenei", "OPPOSED", "Saddam Hussein", "Eight years of the Iran–Iraq war"),
    ("Netanyahu", "OPPOSED", "Ali Khamenei", "The shadow war that keeps breaking into the open"),
    ("Xi Jinping", "DEFEATED", "Jack Ma", "Criticised the regulators; the IPO died and Ma went quiet"),

    # ---- Arts & letters ----
    ("Bach", "INFLUENCED", "Mozart", "Discovering Bach's fugues in Vienna changed Mozart's writing"),
    ("Mozart", "INFLUENCED", "Beethoven", "Beethoven came to Vienna to study in Mozart's shadow"),
    ("Van Gogh", "INFLUENCED", "Picasso", "The Blue Period is unthinkable without him"),
    ("Shakespeare", "INFLUENCED", "Charles Dickens", "The national playwright behind the national novelist"),
    ("Edgar Allan Poe", "INFLUENCED", "Stephen King", "King calls him the master every horror writer descends from"),
    ("Elvis Presley", "INFLUENCED", "John Lennon", "'Before Elvis, there was nothing'"),
    ("John Lennon", "INFLUENCED", "Freddie Mercury", "Queen grew up on the Beatles; Mercury wrote a tribute on his death"),

    # ---- Money & code ----
    ("Warren Buffet", "INFLUENCED", "Bill Gates", "Bridge partner, mentor, and the model for the Giving Pledge"),
    ("Steve Jobs", "OPPOSED", "Bill Gates", "Thirty years of the industry's defining rivalry"),
    ("Satoshi Nakamoto", "INFLUENCED", "Vitalik Buterin", "Bitcoin was the proof of concept Ethereum generalised"),
]
