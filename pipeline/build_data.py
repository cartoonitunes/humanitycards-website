#!/usr/bin/env python3
"""build_data.py — HumanityCards data pipeline.

Pulls real, public data for all 239 roster figures and bakes it into the
static JS files the site ships with. No runtime API calls — everything is
fetched here, once, and committed.

Sources
-------
- English Wikipedia API (no auth): article byte length, talk-page + talk-
  archive byte lengths, wikibase item ids.
- Wikidata API (no auth): birth (P569) and death (P570) years.
- pipeline/roster.py: the curated layer — article mapping, category, role,
  fact-checked one-line bio, fallback years for legendary figures, and
  per-figure dominion/intellect overrides.
- humanity-cards-roster.md: on-chain maxSupply + minted snapshot.

Stat methodology (all 1-100, normalised across the 239)
-------------------------------------------------------
influence   = min-max of log(article bytes). Longer article == more
              historically documented == more influential.
legacy      = min-max of log(years since death), scaled 40-100 for the dead.
              Living figures get a moderate 30-46 based on age.
dominion    = category base (geographic/political scope) with per-figure
              overrides for known territorial reach. Curated, not fetched.
intellect   = category base with per-figure overrides. Curated, not fetched.
controversy = min-max of log(talk page bytes incl. /Archive* subpages).
              Contested figures accumulate huge talk archives.

Usage:  python3 pipeline/build_data.py [--offline]
        --offline reuses pipeline/cache/wiki.json without hitting the network.
"""

import json, math, os, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from roster import ROSTER, CATEGORY_BASES
from relationships import EDGES

HERE = Path(__file__).parent
SITE = HERE.parent
CACHE = HERE / "cache" / "wiki.json"
# on-chain supply snapshot; not committed — point HCX_ROSTER_MD at your copy
ROSTER_MD = Path(os.environ.get("HCX_ROSTER_MD", SITE / "humanity-cards-roster.md"))

WIKI_API = "https://en.wikipedia.org/w/api.php"
WD_API = "https://www.wikidata.org/w/api.php"
UA = {"User-Agent": "HumanityCardsDataPipeline/1.0 (https://humanitycards.vercel.app) python-urllib"}
THIS_YEAR = 2026  # frozen at build time; stats are a baked snapshot


def api(url, params):
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(url + "?" + qs, headers=UA)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))


def chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


# ---------------------------------------------------------------- fetching

def resolve_chain(data):
    """Map requested title -> final title through normalized + redirects."""
    m = {}
    q = data.get("query", {})
    for step in q.get("normalized", []) + q.get("redirects", []):
        m[step["from"]] = step["to"]
    def final(t, seen=None):
        seen = seen or set()
        while t in m and t not in seen:
            seen.add(t)
            t = m[t]
        return t
    return final


def fetch_pages(titles):
    """For article titles: length + wikibase item. Returns {requested: {...}}."""
    out = {}
    for batch in chunks(titles, 40):
        data = api(WIKI_API, {
            "action": "query", "format": "json", "redirects": 1,
            "titles": "|".join(batch), "prop": "info|pageprops",
            "ppprop": "wikibase_item",
        })
        final = resolve_chain(data)
        bytitle = {}
        for p in data["query"]["pages"].values():
            if "missing" in p:
                continue
            bytitle[p["title"]] = {
                "title": p["title"],
                "length": p.get("length", 0),
                "qid": p.get("pageprops", {}).get("wikibase_item"),
            }
        for t in batch:
            out[t] = bytitle.get(final(t))
        time.sleep(0.3)
    return out


def fetch_talk_sizes(final_titles):
    """Talk:X size + sum of Talk:X/Archive* sizes, keyed by final title."""
    out = {t: 0 for t in final_titles}
    # main talk pages, batched
    for batch in chunks(final_titles, 40):
        data = api(WIKI_API, {
            "action": "query", "format": "json", "redirects": 1,
            "titles": "|".join("Talk:" + t for t in batch), "prop": "info",
        })
        final = resolve_chain(data)
        bytitle = {p["title"]: p.get("length", 0)
                   for p in data["query"]["pages"].values() if "missing" not in p}
        for t in batch:
            out[t] += bytitle.get(final("Talk:" + t), 0)
        time.sleep(0.3)
    # archive subpages, one generator query per figure
    for i, t in enumerate(final_titles):
        data = api(WIKI_API, {
            "action": "query", "format": "json",
            "generator": "allpages", "gapnamespace": 1,
            "gapprefix": t + "/", "gaplimit": "max", "prop": "info",
        })
        for p in data.get("query", {}).get("pages", {}).values():
            out[t] += p.get("length", 0)
        if i % 25 == 0:
            print(f"  talk archives {i}/{len(final_titles)}")
        time.sleep(0.15)
    return out


def parse_wd_year(claims, prop):
    """Best year from a Wikidata date claim, or None. Needs year precision."""
    best = None
    for c in claims.get(prop, []):
        snak = c.get("mainsnak", {})
        if snak.get("snaktype") != "value":
            continue
        v = snak["datavalue"]["value"]
        if v.get("precision", 0) < 9:   # coarser than a year
            continue
        m = re.match(r"([+-])(\d+)", v["time"])
        if not m:
            continue
        year = int(m.group(2)) * (1 if m.group(1) == "+" else -1)
        rank = c.get("rank", "normal")
        if rank == "preferred":
            return year
        if best is None and rank == "normal":
            best = year
    return best


def fetch_wikidata(qids):
    """{qid: {born, died, has_death_claim, sitelinks}}

    sitelinks = number of Wikipedia language editions with an article — the
    classic cross-cultural significance signal (cf. MIT Pantheon's L metric).
    """
    out = {}
    for batch in chunks([q for q in qids if q], 45):
        data = api(WD_API, {
            "action": "wbgetentities", "format": "json",
            "ids": "|".join(batch), "props": "claims|sitelinks",
        })
        for qid, ent in data.get("entities", {}).items():
            claims = ent.get("claims", {})
            links = [k for k in ent.get("sitelinks", {}) if k.endswith("wiki")]
            out[qid] = {
                "born": parse_wd_year(claims, "P569"),
                "died": parse_wd_year(claims, "P570"),
                "has_death_claim": "P570" in claims,
                "sitelinks": len(links),
            }
        time.sleep(0.3)
    return out


# ---------------------------------------------------------------- compute

def parse_roster_md():
    """{humanId: (maxSupply, minted)} from the on-chain snapshot markdown."""
    out = {}
    pat = re.compile(r"\*\*(.+?)\*\* \(humanId: (\d+)\) \(1 of (\d+)\) - (\d+) mined")
    for line in ROSTER_MD.read_text().splitlines():
        m = pat.search(line)
        if m:
            out[int(m.group(2))] = (int(m.group(3)), int(m.group(4)))
    return out


def minmax_log(values, lo, hi):
    logs = [math.log(max(v, 1)) for v in values]
    mn, mx = min(logs), max(logs)
    span = (mx - mn) or 1.0
    return [round(lo + (hi - lo) * (math.log(max(v, 1)) - mn) / span) for v in values]


def era_label(born):
    y = born + 30  # rough midpoint of an active life
    if y < -800: return "Ancient"
    if y < 500: return "Classical"
    if y < 1400: return "Medieval"
    if y < 1600: return "Renaissance"
    if y < 1800: return "Early Modern"
    if y < 1946: return "Modern"
    return "Contemporary"


def js_str(s):
    return json.dumps(s, ensure_ascii=False)


def main():
    offline = "--offline" in sys.argv
    titles = sorted({r[2] for r in ROSTER})

    if offline and CACHE.exists():
        cache = json.loads(CACHE.read_text())
    else:
        print(f"Fetching article info for {len(titles)} unique titles…")
        pages = fetch_pages(titles)
        missing = [t for t, p in pages.items() if p is None]
        if missing:
            sys.exit(f"MISSING ARTICLES (fix titles in roster.py): {missing}")
        finals = sorted({p["title"] for p in pages.values()})
        print(f"Fetching talk page + archive sizes for {len(finals)} pages…")
        talk = fetch_talk_sizes(finals)
        print("Fetching Wikidata birth/death years…")
        wd = fetch_wikidata(sorted({p["qid"] for p in pages.values() if p["qid"]}))
        cache = {"pages": pages, "talk": talk, "wikidata": wd,
                 "fetched": time.strftime("%Y-%m-%d")}
        CACHE.write_text(json.dumps(cache, indent=1, ensure_ascii=False))
        print(f"Cached to {CACHE}")

    pages, talk, wd = cache["pages"], cache["talk"], cache["wikidata"]
    supply = parse_roster_md()
    warnings = []

    figures = []
    for (hid, name, title, cat, role, bio, fb_born, fb_died, dom_o, int_o) in ROSTER:
        page = pages[title]
        q = wd.get(page["qid"] or "", {})
        born = q.get("born")
        died = q.get("died")
        living = fb_died is None and not q.get("has_death_claim", False)
        if born is None:
            born = fb_born
            warnings.append(f"{name}: no year-precision Wikidata birth, using curated {fb_born}")
        elif fb_born is not None and abs(born - fb_born) > 5:
            warnings.append(f"{name}: Wikidata born {born} vs curated {fb_born} — using Wikidata")
        if not living and died is None:
            died = fb_died
            if died is None:
                living = True
            else:
                warnings.append(f"{name}: no year-precision Wikidata death, using curated {fb_died}")
        if living:
            died = None

        base_dom, base_int = CATEGORY_BASES[cat]
        ms, minted = supply.get(hid, (100, 0))
        figures.append({
            "humanId": hid, "name": name, "title": page["title"], "cat": cat,
            "role": role, "bio": bio, "born": born, "died": died,
            "era": era_label(born), "maxSupply": ms, "minted": minted,
            "artBytes": page["length"], "talkBytes": talk.get(page["title"], 0),
            "langs": q.get("sitelinks", 1),
            "dominion": dom_o if dom_o is not None else base_dom,
            "intellect": int_o if int_o is not None else base_int,
        })

    # normalised stats
    # influence blends article depth with cross-language reach to cancel the
    # recency bias of raw byte counts (living politicians have huge articles).
    nb = minmax_log([f["artBytes"] for f in figures], 0, 100)
    nl = minmax_log([f["langs"] for f in figures], 0, 100)
    inf = [round(30 + 70 * ((b + l) / 200.0)) for b, l in zip(nb, nl)]
    con = minmax_log([f["talkBytes"] + 1 for f in figures], 5, 100)
    dead = [f for f in figures if f["died"] is not None]
    leg_dead = minmax_log([THIS_YEAR - f["died"] for f in dead], 40, 100)
    leg_by_id = {f["humanId"]: v for f, v in zip(dead, leg_dead)}
    for f, i, c in zip(figures, inf, con):
        f["influence"] = i
        f["controversy"] = c
        if f["died"] is not None:
            f["legacy"] = leg_by_id[f["humanId"]]
        else:
            age = THIS_YEAR - f["born"]
            f["legacy"] = 30 + min(16, max(0, (age - 25) // 3))

    # validate relationship edges
    by_name = {f["name"]: f for f in figures}
    for (w, t, l, note) in EDGES:
        assert w in by_name, f"edge winner not in roster: {w}"
        assert l in by_name, f"edge loser not in roster: {l}"
        assert t in {"KILLED", "DEFEATED", "SUCCEEDED", "OPPOSED", "INFLUENCED"}, t
    seen = set()
    for (w, t, l, _) in EDGES:
        key = (by_name[w]["humanId"], by_name[l]["humanId"])
        assert key not in seen, f"duplicate edge {w} -> {l}"
        assert key[0] != key[1], f"self edge {w}"
        seen.add(key)

    emit_bios(figures)
    emit_data(figures)
    emit_relationships(figures, by_name)
    emit_report(figures, warnings)
    print(f"\nDone. {len(figures)} figures, {len(EDGES)} edges, "
          f"{len(warnings)} year warnings (see pipeline/report.md).")


# ---------------------------------------------------------------- emitters

GEN_NOTE = "/* GENERATED by pipeline/build_data.py — do not edit by hand.\n" \
           "   Source data: en.wikipedia.org + wikidata.org, fetched {date}.\n" \
           "   Methodology: pipeline/report.md */\n"


def gen_note():
    fetched = json.loads(CACHE.read_text())["fetched"] if CACHE.exists() else "n/a"
    return GEN_NOTE.format(date=fetched)


def emit_bios(figures):
    lines = [gen_note(),
             "/* bios.js — fact-checked role + one-line biography per figure, keyed by",
             "   humanId. born/died are years (negative = BCE); died:null = living.",
             "   Years come from Wikidata where it has year precision, otherwise from",
             "   the curated table in pipeline/roster.py. */",
             "window.HCX_BIOS = {"]
    for f in figures:
        died = "null" if f["died"] is None else f["died"]
        lines.append(f'  {f["humanId"]}: {{ role: {js_str(f["role"])}, born: {f["born"]}, '
                     f'died: {died}, era: {js_str(f["era"])},')
        lines.append(f'     bio: {js_str(f["bio"])} }},')
    lines.append("};")
    (SITE / "assets/js/bios.js").write_text("\n".join(lines) + "\n")
    print("wrote assets/js/bios.js")


def emit_data(figures):
    rows = []
    for f in figures:
        died = "null" if f["died"] is None else str(f["died"])
        rows.append(f'    [{f["humanId"]},{js_str(f["name"])},{f["maxSupply"]},'
                    f'{f["minted"]},{f["born"]},{died},{f["influence"]},'
                    f'{f["intellect"]},{f["dominion"]},{f["legacy"]},{f["controversy"]}]')
    raw = ",\n".join(rows)
    out = gen_note() + """\
/* data.js — HumanityCards catalogue + game data, from the REAL 2018 contract.
   Source of truth for humanId / name / maxSupply is the on-chain roster
   (humanity-cards-roster.md). Minted counts are a snapshot fallback here and
   are refreshed live from the contract by hcx-chain.js (getHumanInfo).

   Stats are derived from public data (1-100, normalised across all 239):
     influence   — Wikipedia article length + language-edition count (log blend)
     legacy      — years since death (log); living figures get 30-46 by age
     dominion    — curated: geographic/political scope by category + figure
     intellect   — curated: intellectual contribution by category + figure
     controversy — Wikipedia talk page + archive bytes (log, normalised)   */
(function () {
  var CA = "0xbc9B96E7Aa6AFEA664f9D5fdDa168518eE20f2Cc";          // original (mining)
  var WRAPPER = "0xf6f722590AF5F791f68d0ED88D27b72dDe1C70CA";       // ERC-721 wrapper (ownership, checksummed)
  var DEP = "13 MAR 2018";
  var OPENSEA = "https://opensea.io/collection/wrappedhumanitycards";

  // [humanId, name, maxSupply, mintedSnapshot, born, died(null=living),
  //  influence, intellect, dominion, legacy, controversy]
  var RAW = [
""" + raw + """
  ];

  // tiny deterministic RNG (mulberry32-ish) seeded by string
  function seed(str){var h=1779033703^str.length;for(var i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return((h^=h>>>16)>>>0)/4294967296;};}

  var BIOS = window.HCX_BIOS || {};

  var FIGURES = RAW.map(function (row) {
    var humanId = row[0], name = row[1];
    var b = BIOS[humanId] || {};
    return {
      humanId: humanId,
      name: name,
      maxSupply: row[2],
      minted: row[3],                       // refreshed live by hcx-chain.js
      born: row[4],
      died: row[5],
      era: b.era || null,
      role: b.role || null,
      bio: b.bio || null,
      cardId: null,                         // real token ids only on owned cards (hcx-chain.js)
      contract: CA,
      deployed: DEP,
      stats: { influence: row[6], intellect: row[7], dominion: row[8],
               legacy: row[9], controversy: row[10] }
    };
  });

  var byId_ = {}, byName_ = {};
  FIGURES.forEach(function (f) { byId_[f.humanId] = f; byName_[f.name] = f; });
  function byName(n){ return byName_[n] || null; }
  function byId(id){ return byId_[id] || null; }
  function eraLabel(y){ return y < 0 ? Math.abs(y) + " BCE" : y + " CE"; }
  function lifespan(f){
    if (f.died == null) return "b. " + (f.born < 0 ? Math.abs(f.born) + " BCE" : f.born);
    if (f.born < 0 && f.died < 0) return Math.abs(f.born) + "\\u2013" + Math.abs(f.died) + " BCE";
    if (f.born >= 0 && f.died >= 0) return f.born + "\\u2013" + f.died;
    return eraLabel(f.born) + " \\u2013 " + eraLabel(f.died);
  }

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
    CA: CA, WRAPPER: WRAPPER, DEP: DEP, OPENSEA: OPENSEA,
    HUMANS_TOTAL: FIGURES.length,
    FIGURES: FIGURES,
    OWNED: OWNED,
    TIMELINE_TODAY: TIMELINE_TODAY,
    stats: { humans: FIGURES.length, minted: FIGURES.length,
      cardsMinted: FIGURES.reduce(function(a,f){return a+f.minted;},0),
      uniques: FIGURES.filter(function(f){return f.maxSupply<=1;}).length, genesis: 2018 },
    byName: byName, byId: byId, eraLabel: eraLabel, lifespan: lifespan,
    seed: seed, recomputeStats: recomputeStats
  };
})();
"""
    (SITE / "assets/js/data.js").write_text(out)
    print("wrote assets/js/data.js")


def emit_relationships(figures, by_name):
    rows = []
    for (w, t, l, note) in EDGES:
        rows.append(f'    [{by_name[w]["humanId"]},{by_name[l]["humanId"]},'
                    f'{js_str(t)},{js_str(note)}]')
    out = gen_note() + """\
/* relationships.js — historical edges between roster figures, hand-curated
   and validated against the roster (pipeline/relationships.py).

   Edge [winnerId, loserId, type, note] means the winner KILLED / DEFEATED /
   SUCCEEDED / OPPOSED / INFLUENCED the loser. In the Assassination game,
   playing the winner against the loser is an instant strike regardless of
   stats; with no edge, higher influence wins and the defender takes ties. */
(function () {
  // [winnerId, loserId, type, note]
  var EDGES = [
""" + ",\n".join(rows) + """
  ];

  var byWinner = {}, byPair = {};
  EDGES.forEach(function (e) {
    (byWinner[e[0]] = byWinner[e[0]] || []).push(e);
    byPair[e[0] + ":" + e[1]] = e;
  });

  window.HCX_REL = {
    EDGES: EDGES,
    // edge giving attackerId the instant win over defenderId, or null
    edge: function (attackerId, defenderId) {
      var e = byPair[attackerId + ":" + defenderId];
      return e ? { type: e[2], note: e[3] } : null;
    },
    // all edges where this figure is the dominant side
    edgesFor: function (humanId) {
      return (byWinner[humanId] || []).map(function (e) {
        return { overId: e[1], type: e[2], note: e[3] };
      });
    }
  };
})();
"""
    (SITE / "assets/js/relationships.js").write_text(out)
    print(f"wrote assets/js/relationships.js ({len(EDGES)} edges)")


def emit_report(figures, warnings):
    fetched = json.loads(CACHE.read_text())["fetched"]
    L = ["# HumanityCards data pipeline report", "",
         f"Fetched from en.wikipedia.org + wikidata.org on **{fetched}**. "
         f"Rebuild with `python3 pipeline/build_data.py` (add `--offline` to reuse the cache).", "",
         "## Stat methodology",
         "",
         "| Stat | Source | Normalisation |",
         "|---|---|---|",
         "| influence | ½ Wikipedia article bytes + ½ language-edition count (Wikidata sitelinks, cf. MIT Pantheon) | each log min-maxed, blended, scaled 30-100 |",
         "| legacy | years since death (Wikidata P570) | log, min-max to 40-100; living = 30-46 by age |",
         "| dominion | curated category base + per-figure override | (see pipeline/roster.py) |",
         "| intellect | curated category base + per-figure override | (see pipeline/roster.py) |",
         "| controversy | Talk: page + /Archive* byte total | log, min-max to 5-100 |",
         "",
         "## Year-source warnings", ""]
    L += [f"- {w}" for w in warnings] or ["- none"]
    L += ["", "## Full table", "",
          "| id | name | article | bytes | langs | talk | born | died | inf | int | dom | leg | con |",
          "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for f in sorted(figures, key=lambda x: -x["influence"]):
        L.append(f'| {f["humanId"]} | {f["name"]} | {f["title"]} | {f["artBytes"]} '
                 f'| {f["langs"]} | {f["talkBytes"]} | {f["born"]} | {f["died"] if f["died"] is not None else "living"} '
                 f'| {f["influence"]} | {f["intellect"]} | {f["dominion"]} | {f["legacy"]} | {f["controversy"]} |')
    (HERE / "report.md").write_text("\n".join(L) + "\n")
    print("wrote pipeline/report.md")


if __name__ == "__main__":
    main()
