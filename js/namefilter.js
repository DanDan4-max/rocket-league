'use strict';
// Rocket League (fan remake) - keeps swearing and slurs out of player names.
// Names are checked as typed and also after "leet" spellings are undone (sh1t, $hit, f_u_c_k, fuuuck). Roots that
// are never innocent are caught anywhere in a name; short words that hide inside ordinary words (ass in "Class",
// cum in "Cucumber") only count as a whole word ("BigAss", "big_ass", "ass").
(function () {
  const BL = window.BL = window.BL || {};
  const ANYWHERE = ['fuck', 'fuk', 'fck', 'shit', 'bitch', 'cunt', 'nigg', 'niga', 'fagg', 'faggot', 'slut', 'whore', 'pussy', 'asshole',
    'bastard', 'retard', 'twat', 'porn', 'penis', 'vagina', 'boob', 'dildo', 'jizz', 'cocksuck', 'motherf', 'bollock', 'douche',
    'tranny', 'wetback', 'beaner', 'hitler', 'killyourself', 'molest', 'horny', 'milf', 'blowjob', 'handjob', 'cumshot', 'piss', 'kkk'];
  const WHOLE = ['ass', 'arse', 'asses', 'dick', 'dicks', 'cock', 'cocks', 'cum', 'tit', 'tits', 'titty', 'sex', 'sexy', 'rape', 'raped',
    'rapist', 'hoe', 'hoes', 'damn', 'crap', 'prick', 'bugger', 'wank', 'wanker', 'chink', 'spic', 'kike', 'dyke', 'coon', 'gook', 'paki',
    'negro', 'nude', 'nudes', 'anal', 'nazi', 'nazis', 'pedo', 'pedos', 'kys', 'thot', 'stfu', 'wtf', 'gtfo', 'lmfao', 'fml'];
  const LEET = { 0: 'o', 1: 'i', 2: 'z', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b', 9: 'g', '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't', '€': 'e', '£': 'l' };
  const unleet = (s) => s.toLowerCase().replace(/[0-9@$!|+€£]/g, (c) => LEET[c] || c);
  const squash = (s) => s.replace(/(.)\1+/g, '$1');
  // the words of a name: split on anything that isn't a letter or digit, and at camelCase humps ("BigAss")
  // (each word both with its leet undone and with its digits simply dropped: "wtf123" is "wtf")
  const words = (name) => name.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9@$!|+€£]+/).filter(Boolean)
    .flatMap((w) => [unleet(w).replace(/[^a-z]/g, ''), w.toLowerCase().replace(/[^a-z]/g, '')]);
  const NF = BL.NameFilter = {};
  NF.bad = function (name) {
    const s = String(name || '');
    const flat = unleet(s).replace(/[^a-z]/g, '');
    for (const t of [flat, squash(flat)]) if (ANYWHERE.some((w) => t.indexOf(w) >= 0)) return true;
    for (const w of words(s)) if (WHOLE.indexOf(w) >= 0 || WHOLE.indexOf(squash(w)) >= 0) return true;
    return false;
  };
  // someone else's name that isn't allowed shows as Player + a number (the same number every time for that name)
  NF.clean = function (name, fallback) {
    const s = String(name || '');
    if (!NF.bad(s)) return s;
    if (fallback) return fallback;
    let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return 'Player' + (100 + (h % 900));
  };
})();
