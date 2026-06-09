# HumanityCards data pipeline report

Fetched from en.wikipedia.org + wikidata.org on **2026-06-09**. Rebuild with `python3 pipeline/build_data.py` (add `--offline` to reuse the cache).

## Stat methodology

| Stat | Source | Normalisation |
|---|---|---|
| influence | ½ Wikipedia article bytes + ½ language-edition count (Wikidata sitelinks, cf. MIT Pantheon) | each log min-maxed, blended, scaled 30-100 |
| legacy | years since death (Wikidata P570) | log, min-max to 40-100; living = 30-46 by age |
| dominion | curated category base + per-figure override | (see pipeline/roster.py) |
| intellect | curated category base + per-figure override | (see pipeline/roster.py) |
| controversy | Talk: page + /Archive* byte total | log, min-max to 5-100 |

## Year-source warnings

- Leonidas: no year-precision Wikidata birth, using curated -540
- Lao Tseu: Wikidata born -604 vs curated -571 — using Wikidata
- Lao Tseu: no year-precision Wikidata death, using curated -471
- Vasco da Gama: Wikidata born 1469 vs curated 1460 — using Wikidata
- Menes: no year-precision Wikidata birth, using curated -3150
- Homer: no year-precision Wikidata birth, using curated -800
- Homer: no year-precision Wikidata death, using curated -701
- Satoshi Nakamoto: no year-precision Wikidata birth, using curated 1975
- Attila: Wikidata born 395 vs curated 406 — using Wikidata
- Imhotep: no year-precision Wikidata birth, using curated -2650
- Imhotep: no year-precision Wikidata death, using curated -2600
- Khufu: no year-precision Wikidata birth, using curated -2620
- Pythagoras: Wikidata born -582 vs curated -570 — using Wikidata
- Jack the Ripper: no year-precision Wikidata birth, using curated 1855
- Jack the Ripper: no year-precision Wikidata death, using curated 1910
- Snofru: no year-precision Wikidata birth, using curated -2649

## Full table

| id | name | article | bytes | langs | talk | born | died | inf | int | dom | leg | con |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 158 | Michael Jackson | Michael Jackson | 347422 | 282 | 6148254 | 1958 | 2009 | 99 | 58 | 50 | 60 | 82 |
| 98 | Trump | Donald Trump | 362507 | 262 | 37051273 | 1946 | living | 98 | 65 | 90 | 46 | 100 |
| 103 | Obama | Barack Obama | 398461 | 256 | 16716011 | 1961 | living | 98 | 65 | 90 | 43 | 92 |
| 5 | Jesus | Jesus | 278248 | 282 | 16003065 | -7 | 30 | 96 | 88 | 90 | 93 | 92 |
| 118 | Putin | Vladimir Putin | 295802 | 233 | 2984956 | 1952 | living | 94 | 65 | 85 | 46 | 75 |
| 135 | George W. Bush | George W. Bush | 343448 | 216 | 7551767 | 1946 | living | 94 | 65 | 88 | 46 | 84 |
| 2 | Einstein | Albert Einstein | 235102 | 237 | 3005642 | 1879 | 1955 | 92 | 100 | 45 | 70 | 75 |
| 14 | Buddha | The Buddha | 255270 | 216 | 2000159 | -563 | -483 | 91 | 90 | 85 | 95 | 70 |
| 18 | Newton | Isaac Newton | 224716 | 238 | 819908 | 1642 | 1727 | 91 | 100 | 45 | 80 | 61 |
| 21 | Augustus | Augustus | 243802 | 214 | 535163 | -63 | 14 | 90 | 82 | 93 | 93 | 57 |
| 31 | Alexander The Great | Alexander the Great | 223207 | 220 | 2342762 | -356 | -323 | 90 | 85 | 97 | 94 | 72 |
| 37 | Hitler | Adolf Hitler | 182054 | 248 | 7154263 | 1889 | 1945 | 90 | 55 | 92 | 71 | 83 |
| 99 | Xi Jinping | Xi Jinping | 359956 | 160 | 311340 | 1953 | living | 90 | 65 | 92 | 46 | 52 |
| 107 | Mandela | Nelson Mandela | 207093 | 234 | 716341 | 1918 | 2013 | 90 | 80 | 60 | 58 | 60 |
| 157 | Ataturk | Mustafa Kemal Atatürk | 240779 | 212 | 1417758 | 1881 | 1938 | 90 | 80 | 70 | 71 | 67 |
| 202 | Martin Luther King | Martin Luther King Jr. | 305037 | 187 | 1186359 | 1929 | 1968 | 90 | 82 | 55 | 69 | 65 |
| 168 | Elon Musk | Elon Musk | 343780 | 162 | 3992211 | 1971 | living | 89 | 85 | 75 | 40 | 77 |
| 213 | Ronald Reagan | Ronald Reagan | 174272 | 250 | 3302439 | 1911 | 2004 | 89 | 65 | 90 | 62 | 76 |
| 4 | Christopher Columbus | Christopher Columbus | 199034 | 215 | 2377240 | 1451 | 1506 | 88 | 60 | 70 | 84 | 72 |
| 13 | Muhammad | Muhammad | 184627 | 229 | 13334532 | 571 | 632 | 88 | 85 | 95 | 91 | 90 |
| 25 | Karl Marx | Karl Marx | 204087 | 215 | 1485438 | 1818 | 1883 | 88 | 94 | 55 | 75 | 67 |
| 32 | Napoleon | Napoleon | 186112 | 221 | 1471609 | 1769 | 1821 | 88 | 88 | 95 | 77 | 67 |
| 64 | Stalin | Joseph Stalin | 214083 | 210 | 3640667 | 1878 | 1953 | 88 | 55 | 95 | 70 | 77 |
| 81 | Lenin | Vladimir Lenin | 199577 | 213 | 1387172 | 1870 | 1924 | 88 | 85 | 88 | 72 | 67 |
| 100 | Macron | Emmanuel Macron | 298345 | 167 | 157613 | 1977 | living | 88 | 65 | 62 | 38 | 45 |
| 133 | Elizabeth II | Elizabeth II | 199785 | 215 | 5532315 | 1926 | 2022 | 88 | 58 | 80 | 50 | 81 |
| 146 | Erdogan | Recep Tayyip Erdoğan | 363060 | 149 | 379005 | 1954 | living | 88 | 65 | 65 | 45 | 54 |
| 16 | Aristotle | Aristotle | 158725 | 232 | 615252 | -384 | -322 | 87 | 99 | 38 | 94 | 59 |
| 19 | Darwin | Charles Darwin | 174662 | 213 | 2162752 | 1809 | 1882 | 87 | 97 | 40 | 75 | 71 |
| 78 | Kennedy | John F. Kennedy | 238547 | 179 | 990710 | 1917 | 1963 | 87 | 65 | 88 | 69 | 63 |
| 102 | Merkel | Angela Merkel | 260137 | 174 | 571663 | 1954 | living | 87 | 85 | 70 | 45 | 58 |
| 128 | Hillary Clinton | Hillary Clinton | 325138 | 148 | 6035536 | 1947 | living | 87 | 62 | 60 | 46 | 82 |
| 142 | Netanyahu | Benjamin Netanyahu | 367867 | 133 | 430491 | 1949 | living | 87 | 65 | 55 | 46 | 55 |
| 159 | Elvis Presley | Elvis Presley | 220346 | 189 | 4772455 | 1935 | 1977 | 87 | 58 | 48 | 67 | 79 |
| 187 | Da Vinci | Leonardo da Vinci | 140875 | 243 | 708118 | 1452 | 1519 | 87 | 100 | 40 | 84 | 60 |
| 192 | Gandhi | Mahatma Gandhi | 189796 | 208 | 2166309 | 1869 | 1948 | 87 | 85 | 70 | 71 | 71 |
| 62 | Jefferson | Thomas Jefferson | 239916 | 165 | 7193137 | 1743 | 1826 | 86 | 90 | 80 | 77 | 83 |
| 66 | Freud | Sigmund Freud | 198954 | 192 | 1745588 | 1856 | 1939 | 86 | 92 | 40 | 71 | 69 |
| 69 | Bach | Johann Sebastian Bach | 158145 | 223 | 1209713 | 1685 | 1750 | 86 | 94 | 35 | 79 | 65 |
| 112 | Bill Gates | Bill Gates | 223145 | 180 | 638749 | 1955 | living | 86 | 90 | 75 | 45 | 59 |
| 127 | Churchill | Winston Churchill | 207005 | 183 | 1552763 | 1874 | 1965 | 86 | 85 | 85 | 69 | 68 |
| 138 | Fidel Castro | Fidel Castro | 271378 | 157 | 2182150 | 1926 | 2016 | 86 | 75 | 55 | 56 | 71 |
| 188 | Margaret Thatcher | Margaret Thatcher | 276237 | 156 | 1640339 | 1925 | 2013 | 86 | 65 | 78 | 58 | 68 |
| 191 | Freud | Sigmund Freud | 198954 | 192 | 1745588 | 1856 | 1939 | 86 | 92 | 40 | 71 | 69 |
| 225 | Van Gogh | Vincent van Gogh | 152594 | 218 | 1021854 | 1853 | 1890 | 86 | 82 | 35 | 74 | 64 |
| 237 | Ben Laden | Osama bin Laden | 276964 | 150 | 1480601 | 1957 | 2011 | 86 | 65 | 50 | 59 | 67 |
| 24 | Washington | George Washington | 145717 | 217 | 4641028 | 1732 | 1799 | 85 | 75 | 80 | 78 | 79 |
| 29 | Shakespeare | William Shakespeare | 127612 | 237 | 2320315 | 1564 | 1616 | 85 | 96 | 35 | 82 | 72 |
| 86 | Mao Zedong | Mao Zedong | 184211 | 185 | 1201663 | 1893 | 1976 | 85 | 75 | 95 | 67 | 65 |
| 106 | Chavez | Hugo Chávez | 292223 | 142 | 3796924 | 1954 | 2013 | 85 | 65 | 50 | 58 | 77 |
| 111 | Steve Jobs | Steve Jobs | 207803 | 173 | 858921 | 1955 | 2011 | 85 | 85 | 70 | 59 | 62 |
| 115 | Caesar | Julius Caesar | 146046 | 217 | 645515 | -100 | -44 | 85 | 85 | 90 | 94 | 59 |
| 145 | Bashar al Assad | Bashar al-Assad | 353587 | 123 | 311712 | 1965 | living | 85 | 55 | 45 | 42 | 52 |
| 162 | Berlusconi | Silvio Berlusconi | 332829 | 131 | 518247 | 1936 | 2023 | 85 | 62 | 55 | 48 | 57 |
| 171 | Abraham Lincoln | Abraham Lincoln | 160004 | 208 | 2485205 | 1809 | 1865 | 85 | 85 | 85 | 76 | 73 |
| 176 | Muhammad Ali | Muhammad Ali | 300817 | 140 | 602161 | 1942 | 2016 | 85 | 65 | 45 | 56 | 58 |
| 189 | Charles Dickens | Charles Dickens | 192823 | 177 | 596355 | 1812 | 1870 | 85 | 86 | 35 | 75 | 58 |
| 193 | Che Guevara | Che Guevara | 209861 | 176 | 2618408 | 1928 | 1967 | 85 | 68 | 45 | 69 | 73 |
| 205 | Nehru | Jawaharlal Nehru | 243019 | 154 | 574091 | 1889 | 1964 | 85 | 65 | 70 | 69 | 58 |
| 216 | Franklin D Roosevelt | Franklin D. Roosevelt | 177085 | 190 | 917973 | 1882 | 1945 | 85 | 65 | 92 | 71 | 63 |
| 1 | Confucius | Confucius | 115906 | 239 | 200019 | -551 | -479 | 84 | 92 | 75 | 95 | 47 |
| 6 | Galileo | Galileo Galilei | 140270 | 210 | 1062783 | 1564 | 1642 | 84 | 97 | 40 | 82 | 64 |
| 23 | Martin Luther | Martin Luther | 157814 | 199 | 2475176 | 1483 | 1546 | 84 | 78 | 70 | 83 | 73 |
| 104 | Mussolini | Benito Mussolini | 214514 | 155 | 631087 | 1883 | 1945 | 84 | 55 | 72 | 71 | 59 |
| 119 | Cleopatra | Cleopatra | 222848 | 157 | 547898 | -69 | -30 | 84 | 80 | 65 | 94 | 57 |
| 126 | Charles de Gaulle | Charles de Gaulle | 177506 | 174 | 187840 | 1890 | 1970 | 84 | 65 | 78 | 68 | 47 |
| 136 | George Bush | George H. W. Bush | 204725 | 159 | 446072 | 1924 | 2018 | 84 | 65 | 88 | 55 | 55 |
| 223 | Trotsky | Leon Trotsky | 270176 | 140 | 309098 | 1879 | 1940 | 84 | 88 | 55 | 71 | 52 |
| 3 | Paul the Apostle | Paul the Apostle | 204943 | 154 | 1027005 | 5 | 66 | 83 | 80 | 70 | 93 | 64 |
| 108 | Gaddafi | Muammar Gaddafi | 232840 | 146 | 1003562 | 1942 | 2011 | 83 | 55 | 50 | 59 | 63 |
| 163 | Mozart | Wolfgang Amadeus Mozart | 109453 | 231 | 1122509 | 1756 | 1791 | 83 | 95 | 35 | 78 | 65 |
| 194 | Stephen Hawking | Stephen Hawking | 201752 | 154 | 554383 | 1942 | 2018 | 83 | 96 | 40 | 55 | 57 |
| 209 | Picasso | Pablo Picasso | 127570 | 212 | 239609 | 1881 | 1973 | 83 | 88 | 35 | 68 | 49 |
| 43 | Beethoven | Ludwig van Beethoven | 108854 | 219 | 778310 | 1770 | 1827 | 82 | 94 | 35 | 77 | 61 |
| 52 | Augustine of Hippo | Augustine of Hippo | 179498 | 165 | 330040 | 354 | 430 | 82 | 92 | 55 | 92 | 52 |
| 71 | Voltaire | Voltaire | 146569 | 179 | 259181 | 1694 | 1778 | 82 | 92 | 38 | 79 | 50 |
| 113 | Joan of Arc | Joan of Arc | 186540 | 161 | 1251446 | 1412 | 1431 | 82 | 65 | 45 | 85 | 66 |
| 141 | Saddam Hussein | Saddam Hussein | 228485 | 136 | 1621827 | 1937 | 2006 | 82 | 55 | 55 | 61 | 68 |
| 161 | Freddie Mercury | Freddie Mercury | 194109 | 152 | 668908 | 1946 | 1991 | 82 | 58 | 45 | 65 | 59 |
| 217 | Theodore Roosevelt | Theodore Roosevelt | 209684 | 146 | 708345 | 1858 | 1919 | 82 | 65 | 85 | 73 | 60 |
| 236 | Sarkozy | Nicolas Sarkozy | 188113 | 153 | 226954 | 1955 | living | 82 | 62 | 60 | 45 | 48 |
| 33 | Thomas Edison | Thomas Edison | 119220 | 193 | 459032 | 1847 | 1931 | 81 | 88 | 45 | 72 | 56 |
| 47 | Descartes | René Descartes | 132134 | 182 | 170336 | 1596 | 1650 | 81 | 97 | 38 | 82 | 46 |
| 51 | Ashoka | Ashoka | 153274 | 164 | 240490 | -304 | -232 | 81 | 60 | 82 | 94 | 49 |
| 75 | Jean-Jacques Rousseau | Jean-Jacques Rousseau | 156722 | 162 | 139820 | 1712 | 1778 | 81 | 90 | 38 | 79 | 44 |
| 101 | Kim Jung Un | Kim Jong Un | 198648 | 146 | 1314670 | 1984 | living | 81 | 55 | 45 | 35 | 66 |
| 140 | Ali Khamenei | Ali Khamenei | 217928 | 135 | 825905 | 1939 | 2026 | 81 | 65 | 65 | 40 | 62 |
| 160 | John Lennon | John Lennon | 193781 | 143 | 1307013 | 1940 | 1980 | 81 | 58 | 48 | 67 | 66 |
| 172 | Marie Curie | Marie Curie | 119444 | 197 | 599040 | 1867 | 1934 | 81 | 96 | 40 | 72 | 58 |
| 190 | Erasmus | Erasmus | 324263 | 104 | 208134 | 1466 | 1536 | 81 | 90 | 38 | 83 | 48 |
| 224 | Turing | Alan Turing | 155388 | 165 | 479319 | 1912 | 1954 | 81 | 98 | 36 | 70 | 56 |
| 0 | Moses | Moses | 132213 | 169 | 815396 | -1393 | -1273 | 80 | 75 | 70 | 97 | 61 |
| 9 | Constantin | Constantine the Great | 182562 | 141 | 387575 | 272 | 337 | 80 | 60 | 85 | 92 | 54 |
| 27 | Gengis Khan | Genghis Khan | 116560 | 181 | 1259857 | 1162 | 1227 | 80 | 62 | 100 | 87 | 66 |
| 76 | Machiavelli | Niccolò Machiavelli | 154695 | 158 | 192018 | 1469 | 1527 | 80 | 90 | 35 | 84 | 47 |
| 92 | Gorbatchev | Mikhail Gorbachev | 139951 | 160 | 178527 | 1931 | 2022 | 80 | 65 | 85 | 50 | 46 |
| 170 | Nikola Tesla | Nikola Tesla | 131367 | 175 | 3796046 | 1856 | 1943 | 80 | 96 | 45 | 71 | 77 |
| 210 | Marco Polo | Marco Polo | 114970 | 184 | 867465 | 1254 | 1324 | 80 | 60 | 55 | 86 | 62 |
| 234 | Tolkien | J. R. R. Tolkien | 148124 | 163 | 621438 | 1892 | 1973 | 80 | 88 | 35 | 68 | 59 |
| 42 | Socrates | Socrates | 92216 | 205 | 454505 | -470 | -399 | 79 | 96 | 38 | 95 | 55 |
| 48 | Michelangelo | Michelangelo | 86294 | 215 | 204680 | 1475 | 1564 | 79 | 94 | 35 | 83 | 47 |
| 73 | Chiang Kai Shek | Chiang Kai-shek | 192053 | 126 | 248991 | 1887 | 1975 | 79 | 65 | 60 | 68 | 49 |
| 91 | Elizabeth I | Elizabeth I | 132433 | 159 | 497855 | 1533 | 1603 | 79 | 58 | 72 | 82 | 56 |
| 94 | Charlemagne | Charlemagne | 119873 | 168 | 646364 | 748 | 814 | 79 | 60 | 86 | 90 | 59 |
| 109 | Zuckerberg | Mark Zuckerberg | 158617 | 144 | 491939 | 1984 | living | 79 | 84 | 75 | 35 | 56 |
| 198 | Emperor Hirohito | Hirohito | 162036 | 140 | 590122 | 1901 | 1989 | 79 | 58 | 85 | 65 | 58 |
| 203 | Louis XIV | Louis XIV | 157125 | 146 | 353526 | 1638 | 1715 | 79 | 58 | 84 | 80 | 53 |
| 206 | Nicholas II | Nicholas II | 230547 | 114 | 320867 | 1868 | 1918 | 79 | 58 | 82 | 73 | 52 |
| 20 | Qin Shi Huang | Qin Shi Huang | 89752 | 185 | 121286 | -259 | -210 | 78 | 60 | 88 | 94 | 42 |
| 28 | Adam Smith | Adam Smith | 111775 | 170 | 410211 | 1723 | 1790 | 78 | 94 | 40 | 78 | 54 |
| 72 | Kepler | Johannes Kepler | 128789 | 153 | 222135 | 1571 | 1630 | 78 | 95 | 40 | 82 | 48 |
| 130 | Mugabe | Robert Mugabe | 184615 | 121 | 516013 | 1924 | 2019 | 78 | 55 | 45 | 54 | 57 |
| 215 | Robespierre | Maximilien Robespierre | 239637 | 101 | 267505 | 1758 | 1794 | 78 | 80 | 55 | 78 | 50 |
| 227 | Victoria | Queen Victoria | 128469 | 152 | 487163 | 1819 | 1901 | 78 | 58 | 96 | 74 | 56 |
| 40 | Bell | Alexander Graham Bell | 147552 | 135 | 496783 | 1847 | 1922 | 77 | 85 | 45 | 73 | 56 |
| 46 | Simon Bolivar | Simón Bolívar | 118791 | 154 | 152867 | 1783 | 1830 | 77 | 68 | 75 | 77 | 44 |
| 74 | Euler | Leonhard Euler | 105043 | 165 | 135965 | 1707 | 1783 | 77 | 99 | 36 | 79 | 43 |
| 88 | Henry Ford | Henry Ford | 113868 | 155 | 527600 | 1863 | 1947 | 77 | 82 | 65 | 71 | 57 |
| 110 | Jeff Bezos | Jeff Bezos | 224585 | 100 | 257642 | 1964 | living | 77 | 84 | 72 | 42 | 50 |
| 211 | Pythagoras | Pythagoras | 104613 | 160 | 203126 | -582 | -500 | 77 | 90 | 36 | 95 | 47 |
| 85 | Peter The Great | Peter the Great | 103347 | 158 | 65224 | 1672 | 1725 | 76 | 58 | 84 | 80 | 36 |
| 95 | Homer | Homer | 68783 | 199 | 224369 | -800 | -701 | 76 | 88 | 35 | 96 | 48 |
| 144 | Felipe VI | Felipe VI | 180465 | 109 | 73511 | 1968 | living | 76 | 58 | 42 | 41 | 37 |
| 154 | Abraham | Abraham | 88101 | 176 | 1039580 | -1813 | -1638 | 76 | 75 | 75 | 98 | 64 |
| 174 | Kim Il Sung | Kim Il Sung | 124633 | 141 | 165079 | 1912 | 1994 | 76 | 55 | 50 | 64 | 45 |
| 197 | Ho Chi Min | Ho Chi Minh | 131964 | 129 | 237894 | 1890 | 1969 | 76 | 68 | 55 | 68 | 49 |
| 232 | Stephen King | Stephen King | 161021 | 115 | 317422 | 1947 | living | 76 | 80 | 35 | 46 | 52 |
| 38 | Plato | Plato | 53652 | 220 | 371573 | -427 | -347 | 75 | 98 | 38 | 95 | 53 |
| 58 | Pinochet | Augusto Pinochet | 182134 | 103 | 1124644 | 1915 | 2006 | 75 | 55 | 50 | 61 | 65 |
| 84 | Cyrus The Great | Cyrus the Great | 119136 | 136 | 427199 | -600 | -530 | 75 | 60 | 90 | 95 | 55 |
| 105 | Pol Pot | Pol Pot | 155198 | 115 | 223433 | 1925 | 1998 | 75 | 55 | 40 | 63 | 48 |
| 125 | Cicero | Cicero | 115061 | 135 | 168189 | -106 | -43 | 75 | 90 | 60 | 94 | 45 |
| 166 | Tutankhamun | Tutankhamun | 153412 | 113 | 552403 | -1343 | -1324 | 75 | 55 | 50 | 97 | 57 |
| 173 | Kim Jung Il | Kim Jong Il | 140756 | 120 | 583673 | 1941 | 2011 | 75 | 55 | 45 | 59 | 58 |
| 231 | Warren Buffet | Warren Buffett | 176480 | 104 | 248298 | 1930 | living | 75 | 90 | 60 | 46 | 49 |
| 39 | Malcolm X | Malcolm X | 182754 | 100 | 985361 | 1925 | 1965 | 74 | 72 | 45 | 69 | 63 |
| 44 | Heisenberg | Werner Heisenberg | 134722 | 114 | 65390 | 1901 | 1976 | 74 | 96 | 40 | 67 | 36 |
| 50 | Omar ibn al-Khattab | Umar | 109084 | 139 | 549568 | 586 | 644 | 74 | 75 | 88 | 91 | 57 |
| 61 | Cortes | Hernán Cortés | 89041 | 155 | 153653 | 1485 | 1547 | 74 | 60 | 70 | 83 | 44 |
| 233 | Edgar Allan Poe | Edgar Allan Poe | 92277 | 155 | 447793 | 1809 | 1849 | 74 | 86 | 35 | 76 | 55 |
| 12 | Maxwell | James Clerk Maxwell | 96053 | 139 | 317384 | 1831 | 1879 | 73 | 98 | 40 | 75 | 52 |
| 83 | Vasco da Gama | Vasco da Gama | 62103 | 173 | 87074 | 1469 | 1524 | 73 | 60 | 66 | 84 | 39 |
| 156 | Suleiman the Magnificent | Suleiman the Magnificent | 96445 | 137 | 88357 | 1494 | 1566 | 73 | 60 | 88 | 83 | 39 |
| 182 | Caligula | Caligula | 131881 | 116 | 131868 | 12 | 41 | 73 | 60 | 75 | 93 | 43 |
| 229 | William II | Wilhelm II | 146153 | 109 | 282247 | 1859 | 1941 | 73 | 58 | 80 | 71 | 51 |
| 11 | Faraday | Michael Faraday | 73679 | 154 | 80805 | 1791 | 1867 | 72 | 94 | 40 | 76 | 38 |
| 45 | David | David | 119296 | 112 | 1096998 | -1039 | -969 | 72 | 58 | 55 | 96 | 64 |
| 56 | Idi Amin | Idi Amin | 135451 | 102 | 127145 | 1925 | 2003 | 72 | 55 | 42 | 62 | 43 |
| 57 | Max Planck | Max Planck | 75339 | 149 | 65276 | 1858 | 1947 | 72 | 96 | 40 | 71 | 36 |
| 177 | Konrad Adenauer | Konrad Adenauer | 110184 | 119 | 100591 | 1876 | 1967 | 72 | 65 | 65 | 69 | 40 |
| 196 | Hindenburg | Paul von Hindenburg | 163721 | 91 | 45899 | 1847 | 1934 | 72 | 65 | 65 | 72 | 32 |
| 54 | Rutherford | Ernest Rutherford | 74885 | 143 | 201731 | 1871 | 1937 | 71 | 94 | 40 | 72 | 47 |
| 87 | Francis Bacon | Francis Bacon | 97339 | 119 | 771874 | 1561 | 1626 | 71 | 92 | 38 | 82 | 61 |
| 114 | Marie Antoinette | Marie Antoinette | 127919 | 104 | 468747 | 1755 | 1793 | 71 | 58 | 50 | 78 | 56 |
| 200 | Ali Jinnah | Muhammad Ali Jinnah | 132382 | 99 | 556839 | 1876 | 1948 | 71 | 65 | 60 | 71 | 58 |
| 7 | Gutenberg | Johannes Gutenberg | 52599 | 168 | 269001 | 1400 | 1468 | 70 | 88 | 45 | 84 | 50 |
| 10 | James Watt | James Watt | 60530 | 147 | 58637 | 1736 | 1819 | 70 | 90 | 45 | 77 | 35 |
| 55 | John Calvin | John Calvin | 96504 | 112 | 460428 | 1509 | 1564 | 70 | 78 | 60 | 83 | 56 |
| 65 | William the Conqueror | William the Conqueror | 101521 | 108 | 398360 | 1028 | 1087 | 70 | 58 | 75 | 88 | 54 |
| 90 | Zoroastre | Zoroaster | 88578 | 123 | 289278 | -628 | -551 | 70 | 75 | 60 | 95 | 51 |
| 120 | Mark Antony | Mark Antony | 142629 | 92 | 241927 | -83 | -30 | 70 | 65 | 70 | 94 | 49 |
| 131 | Kadyrov | Ramzan Kadyrov | 193703 | 73 | 66926 | 1976 | living | 70 | 62 | 35 | 38 | 36 |
| 132 | Mauricio Macri | Mauricio Macri | 177316 | 75 | 88887 | 1959 | living | 70 | 62 | 40 | 44 | 39 |
| 149 | Nero | Nero | 93567 | 113 | 293181 | 37 | 68 | 70 | 60 | 78 | 93 | 51 |
| 150 | Hannibal | Hannibal | 98695 | 116 | 363323 | -247 | -183 | 70 | 88 | 75 | 94 | 53 |
| 178 | Alfred The Great | Alfred the Great | 129088 | 93 | 136797 | 849 | 899 | 70 | 58 | 55 | 89 | 43 |
| 183 | Chamberlain | Neville Chamberlain | 126874 | 96 | 123940 | 1869 | 1940 | 70 | 62 | 70 | 71 | 42 |
| 184 | Charles I | Charles I of England | 120959 | 98 | 202902 | 1600 | 1649 | 70 | 58 | 60 | 82 | 47 |
| 17 | Euclid | Euclid | 48312 | 169 | 179168 | -323 | -285 | 69 | 96 | 36 | 94 | 46 |
| 36 | Marconi | Guglielmo Marconi | 82268 | 119 | 124400 | 1874 | 1937 | 69 | 80 | 45 | 72 | 42 |
| 63 | Isebella I of Castile | Isabella I of Castile | 111229 | 97 | 82794 | 1451 | 1504 | 69 | 58 | 70 | 84 | 38 |
| 96 | Justinian | Justinian I | 104309 | 104 | 165673 | 482 | 565 | 69 | 60 | 80 | 91 | 45 |
| 207 | Alfred Nobel | Alfred Nobel | 49205 | 163 | 37992 | 1833 | 1896 | 69 | 85 | 45 | 74 | 30 |
| 8 | Lavoisier | Antoine Lavoisier | 80657 | 111 | 52455 | 1743 | 1794 | 67 | 95 | 40 | 78 | 34 |
| 41 | Fleming | Alexander Fleming | 72040 | 118 | 66075 | 1881 | 1955 | 67 | 84 | 40 | 70 | 36 |
| 116 | Larry Page | Larry Page | 105495 | 93 | 94381 | 1973 | living | 67 | 90 | 72 | 39 | 40 |
| 143 | Mohammed VI | Mohammed VI of Morocco | 100357 | 93 | 16364 | 1963 | living | 67 | 58 | 45 | 42 | 22 |
| 164 | Ramesses II | Ramesses II | 95448 | 99 | 155368 | -1303 | -1213 | 67 | 55 | 75 | 97 | 45 |
| 212 | Ramesses the Great | Ramesses II | 95448 | 99 | 155368 | -1303 | -1213 | 67 | 55 | 75 | 97 | 45 |
| 70 | Lao Tseu | Laozi | 41940 | 153 | 200862 | -604 | -471 | 66 | 88 | 50 | 95 | 47 |
| 148 | Attila | Attila | 73453 | 107 | 298369 | 395 | 453 | 66 | 62 | 88 | 92 | 51 |
| 181 | Pablo Escobar | Pablo Escobar | 81730 | 101 | 101955 | 1949 | 1993 | 66 | 60 | 38 | 65 | 40 |
| 186 | Claudius | Claudius | 85054 | 97 | 78708 | -10 | 54 | 66 | 60 | 80 | 93 | 38 |
| 221 | Tiberius | Tiberius | 80689 | 104 | 120023 | -42 | 37 | 66 | 60 | 80 | 93 | 42 |
| 185 | Charles II | Charles II of England | 94898 | 87 | 141304 | 1630 | 1685 | 65 | 58 | 60 | 81 | 44 |
| 208 | Philippe Petain | Philippe Pétain | 92983 | 85 | 95067 | 1856 | 1951 | 65 | 65 | 50 | 70 | 40 |
| 97 | Mahavira | Mahavira | 94350 | 81 | 255715 | -599 | -527 | 64 | 80 | 50 | 95 | 50 |
| 121 | Pompey | Pompey | 79277 | 88 | 68618 | -106 | -48 | 64 | 65 | 75 | 94 | 36 |
| 129 | John Rockefeller | John D. Rockefeller | 94100 | 83 | 136437 | 1839 | 1937 | 64 | 80 | 70 | 72 | 43 |
| 151 | Vlad the Impaler | Vlad the Impaler | 90360 | 84 | 351913 | 1431 | 1476 | 64 | 58 | 40 | 84 | 53 |
| 180 | Al Capone | Al Capone | 90232 | 84 | 164568 | 1899 | 1947 | 64 | 60 | 35 | 71 | 45 |
| 214 | Jack the Ripper | Jack the Ripper | 91683 | 82 | 1536697 | 1855 | 1910 | 64 | 60 | 30 | 73 | 68 |
| 67 | Edward Jenner | Edward Jenner | 60871 | 102 | 54610 | 1749 | 1823 | 63 | 86 | 40 | 77 | 34 |
| 30 | John Dalton | John Dalton | 52095 | 105 | 19433 | 1766 | 1844 | 62 | 88 | 40 | 77 | 24 |
| 165 | Nefertiti | Nefertiti | 55574 | 101 | 38303 | -1370 | -1330 | 62 | 55 | 48 | 97 | 30 |
| 175 | Shaka Zulu | Shaka | 57507 | 96 | 89917 | 1787 | 1828 | 62 | 58 | 60 | 77 | 39 |
| 195 | Henry IV | Henry IV of France | 65451 | 88 | 45666 | 1553 | 1610 | 62 | 58 | 65 | 82 | 32 |
| 201 | Khufu | Khufu | 79903 | 79 | 70748 | -2620 | -2566 | 62 | 55 | 58 | 99 | 37 |
| 68 | Rontgen | Wilhelm Röntgen | 28202 | 142 | 16622 | 1845 | 1923 | 61 | 88 | 40 | 73 | 22 |
| 77 | Malthus | Thomas Robert Malthus | 59698 | 89 | 75585 | 1766 | 1834 | 61 | 85 | 40 | 77 | 37 |
| 124 | Sulla | Sulla | 94855 | 68 | 133804 | -138 | -78 | 61 | 65 | 72 | 94 | 43 |
| 137 | Michel Temer | Michel Temer | 74240 | 77 | 45491 | 1940 | living | 61 | 62 | 40 | 46 | 32 |
| 139 | Tsipras | Alexis Tsipras | 66217 | 85 | 11015 | 1974 | living | 61 | 62 | 38 | 39 | 18 |
| 222 | Titus | Titus | 60761 | 90 | 26961 | 39 | 81 | 61 | 60 | 78 | 93 | 27 |
| 230 | Jack Ma | Jack Ma | 70286 | 80 | 33472 | 1964 | living | 61 | 80 | 65 | 42 | 29 |
| 15 | Cai Lun | Cai Lun | 69179 | 73 | 59810 | 48 | 121 | 59 | 85 | 50 | 93 | 35 |
| 60 | Pizarro | Francisco Pizarro | 49728 | 87 | 16870 | 1478 | 1541 | 59 | 60 | 68 | 83 | 22 |
| 79 | Hideki Tojo | Hideki Tojo | 67388 | 76 | 57664 | 1884 | 1948 | 59 | 65 | 70 | 71 | 35 |
| 167 | Clovis I | Clovis I | 53246 | 87 | 93267 | 466 | 511 | 59 | 58 | 60 | 91 | 39 |
| 179 | Black Beard | Blackbeard | 82068 | 64 | 227492 | 1680 | 1718 | 59 | 60 | 35 | 80 | 48 |
| 218 | Enver Pasha | Enver Pasha | 81601 | 65 | 69460 | 1881 | 1922 | 59 | 65 | 55 | 73 | 36 |
| 226 | Vespasian | Vespasian | 47585 | 91 | 27361 | 9 | 79 | 59 | 60 | 80 | 93 | 27 |
| 34 | Mansa Musa | Mansa Musa | 55462 | 79 | 118838 | 1280 | 1337 | 58 | 58 | 75 | 86 | 42 |
| 53 | Harvey | William Harvey | 50088 | 83 | 29398 | 1578 | 1657 | 58 | 86 | 40 | 81 | 28 |
| 117 | Sergey Brin | Sergey Brin | 45718 | 88 | 112843 | 1973 | living | 58 | 90 | 72 | 39 | 41 |
| 123 | Spartacus | Spartacus | 49861 | 86 | 125454 | -103 | -71 | 58 | 68 | 40 | 94 | 42 |
| 152 | Scipio Africanus | Scipio Africanus | 65685 | 68 | 44583 | -235 | -183 | 57 | 65 | 70 | 94 | 32 |
| 228 | William Wallace | William Wallace | 44699 | 82 | 178989 | 1270 | 1305 | 57 | 65 | 38 | 86 | 46 |
| 147 | Satoshi Nakamoto | Satoshi Nakamoto | 68737 | 60 | 267017 | 1975 | living | 56 | 95 | 60 | 38 | 50 |
| 220 | Yahya Khan | Yahya Khan | 72653 | 58 | 26449 | 1917 | 1980 | 56 | 65 | 45 | 67 | 27 |
| 26 | Goazu of Han | Emperor Gaozu of Han | 56799 | 61 | 12668 | -256 | -195 | 54 | 60 | 80 | 94 | 19 |
| 122 | Crassus | Marcus Licinius Crassus | 45074 | 69 | 33003 | -115 | -53 | 54 | 65 | 65 | 94 | 29 |
| 153 | Hamilcar | Hamilcar Barca | 58679 | 59 | 7676 | -275 | -228 | 54 | 65 | 60 | 94 | 14 |
| 169 | Atahualpa | Atahualpa | 46538 | 70 | 23887 | 1500 | 1533 | 54 | 60 | 65 | 84 | 26 |
| 49 | Urban II | Pope Urban II | 29109 | 89 | 14366 | 1035 | 1099 | 53 | 78 | 70 | 88 | 20 |
| 134 | Philippe of Belgium | Philippe of Belgium | 28304 | 87 | 35524 | 1960 | living | 53 | 58 | 35 | 43 | 30 |
| 235 | Ram Nath Kovind | Ram Nath Kovind | 33201 | 82 | 15274 | 1945 | living | 53 | 62 | 45 | 46 | 21 |
| 80 | Mani | Mani (prophet) | 34708 | 70 | 51254 | 216 | 274 | 51 | 75 | 55 | 92 | 33 |
| 89 | Mencius | Mencius | 26505 | 76 | 21886 | -372 | -289 | 50 | 88 | 45 | 94 | 25 |
| 22 | Leonidas | Leonidas I | 23667 | 75 | 53538 | -540 | -480 | 49 | 65 | 45 | 95 | 34 |
| 93 | Menes | Menes | 29692 | 63 | 22208 | -3150 | -3125 | 48 | 55 | 55 | 100 | 25 |
| 199 | Imhotep | Imhotep | 22421 | 74 | 44208 | -2650 | -2600 | 48 | 85 | 40 | 99 | 32 |
| 219 | Snofru | Sneferu | 24024 | 60 | 3827 | -2649 | -2609 | 45 | 55 | 56 | 99 | 7 |
| 204 | Jean Moulin | Jean Moulin | 41554 | 41 | 16325 | 1899 | 1943 | 44 | 72 | 30 | 71 | 22 |
| 82 | Sui Wendi | Emperor Wen of Sui | 37430 | 41 | 3107 | 541 | 604 | 43 | 60 | 78 | 91 | 5 |
| 238 | Ponzi | Charles Ponzi | 44338 | 35 | 26255 | 1882 | 1949 | 42 | 60 | 30 | 70 | 27 |
| 155 | Vitalik Buterin | Vitalik Buterin | 39326 | 36 | 48217 | 1994 | living | 41 | 92 | 55 | 32 | 33 |
| 59 | Nikolaus Otto | Nicolaus Otto | 13945 | 64 | 16291 | 1832 | 1891 | 40 | 78 | 45 | 74 | 22 |
| 35 | Morton | William T. G. Morton | 26894 | 40 | 8247 | 1819 | 1868 | 39 | 70 | 30 | 76 | 15 |
