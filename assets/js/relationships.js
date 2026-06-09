/* Assassination game relationship graph.
 * Each edge: the FIRST figure historically defeated / ended / outlasted the
 * SECOND. Hardcoded obvious connections for the stub; the engine falls back to
 * an influence duel when no direct edge exists. humanIds reference HC_ROSTER. */
(function () {
  "use strict";
  var HC = window.HC;

  // [winnerId, loserId, reason]
  var EDGES = [
    [21, 120, "Octavian crushed Mark Antony at Actium, 31 BCE"],
    [21, 119, "His victory at Actium ended Cleopatra's reign"],
    [115, 121, "Caesar broke Pompey at Pharsalus, 48 BCE"],
    [152, 150, "Scipio beat Hannibal at Zama, 202 BCE"],
    [122, 123, "Crassus crushed Spartacus' slave revolt, 71 BCE"],
    [64, 223, "Stalin had Trotsky exiled, then assassinated in 1940"],
    [81, 206, "Lenin's October Revolution toppled the Tsar"],
    [127, 37, "Churchill held the line and outlasted the Reich"],
    [64, 37, "Stalin's Eastern Front broke the Wehrmacht"],
    [216, 37, "Roosevelt marshalled the Allied war machine"],
    [60, 169, "Pizarro captured and executed Atahualpa, 1533"],
    [215, 114, "Robespierre's Terror sent Marie Antoinette to the guillotine"],
    [31, 84, "Alexander conquered the Persia that Cyrus built"],
    [103, 237, "Obama ordered the raid that killed Bin Laden, 2011"],
    [135, 141, "Bush's 2003 invasion ended Saddam's rule"],
    [86, 73, "Mao won the Chinese Civil War over Chiang, 1949"],
    [138, 78, "Castro repelled the Bay of Pigs invasion, 1961"],
    [37, 183, "Hitler outplayed Chamberlain's appeasement at Munich, 1938"],
    [103, 108, "NATO intervention under Obama ended Gaddafi, 2011"],
    [115, 122, "Caesar eclipsed Crassus after Carrhae left the triumvirate broken"]
  ];

  var map = {}; // "a:b" -> reason
  EDGES.forEach(function (e) { map[e[0] + ":" + e[1]] = e[2]; });

  // Does a beat b directly? Returns the reason string or null.
  function beats(aId, bId) {
    return map[aId + ":" + bId] || null;
  }
  // All figures a given human directly defeats.
  function victimsOf(aId) {
    return EDGES.filter(function (e) { return e[0] === aId; }).map(function (e) { return e[1]; });
  }
  // All figures who directly defeat a given human.
  function killersOf(bId) {
    return EDGES.filter(function (e) { return e[1] === bId; }).map(function (e) { return e[0]; });
  }

  HC.rel = { EDGES: EDGES, beats: beats, victimsOf: victimsOf, killersOf: killersOf };
})();
