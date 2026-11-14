/* Nebenkosten-Rechner – Rechenkern (ohne Oberfläche, auch in Node testbar)
   Alle Beträge in Euro, intern in Cent gerundet. Zeitanteile tagesgenau. */
(function (root) {
  'use strict';

  const DAY = 86400000;
  function d(s) { // 'JJJJ-MM-TT' -> UTC-Datum
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  }
  function tage(a, b) { return Math.round((b - a) / DAY) + 1; } // inklusive
  function fmtDatum(s) { const t = d(s); if (t == null) return ''; const x = new Date(t); return pad(x.getUTCDate()) + '.' + pad(x.getUTCMonth() + 1) + '.' + x.getUTCFullYear(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function num(v) { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
  function numRaw(v) { // akzeptiert "1.234,56", "1234.56", "1234,5"
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    let s = String(v == null ? '' : v).trim().replace(/\s|€/g, '');
    if (!s) return 0;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // 5.500 = fünftausendfünfhundert
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function r2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }
  function eur(x) { const v = r2(x); return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
  function zahl(x, st) { return Number(x).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: st == null ? 2 : st }); }

  const KOSTENARTEN = [
    'Grundsteuer', 'Wasserversorgung', 'Entwässerung / Abwasser', 'Heizkosten', 'Warmwasser', 'Aufzug',
    'Straßenreinigung', 'Müllbeseitigung', 'Gebäudereinigung / Ungezieferbekämpfung', 'Gartenpflege',
    'Allgemeinstrom / Beleuchtung', 'Schornsteinreinigung', 'Sach- und Haftpflichtversicherung', 'Hauswart',
    'Wascheinrichtung', 'Winterdienst', 'Sonstige Betriebskosten'
  ];

  const SCHLUESSEL = {
    flaeche: { name: 'Wohnfläche', einheit: 'm² × Tage', kurz: 'Fläche' },
    personen: { name: 'Personen', einheit: 'Personentage', kurz: 'Personen' },
    einheiten: { name: 'Wohneinheiten', einheit: 'Einheitentage', kurz: 'Einheiten' },
    mea: { name: 'Miteigentumsanteile', einheit: 'MEA × Tage', kurz: 'MEA' },
    verbrauch: { name: 'Verbrauch (Zähler)', einheit: '', kurz: 'Verbrauch' },
    heizung: { name: 'Heizkostenverordnung (Grund-/Verbrauchskosten)', einheit: '', kurz: 'HeizkostenV' },
    direkt: { name: 'Direkte Zuordnung (z. B. lt. Heizkostenabrechnung des Messdienstes)', einheit: '', kurz: 'direkt' }
  };

  function zeitraum(s) {
    const von = d(s.zeitraum && s.zeitraum.von), bis = d(s.zeitraum && s.zeitraum.bis);
    if (von == null || bis == null || bis < von) throw new Error('Bitte einen gültigen Abrechnungszeitraum angeben.');
    return { von, bis, tage: tage(von, bis) };
  }

  // Nutzungstage eines Mieters im Abrechnungszeitraum
  function mieterTage(m, z) {
    const a = Math.max(z.von, d(m.einzug) == null ? z.von : d(m.einzug));
    const b = Math.min(z.bis, d(m.auszug) == null ? z.bis : d(m.auszug));
    return b < a ? 0 : tage(a, b);
  }
  function mieterSpanne(m, z) {
    const a = Math.max(z.von, d(m.einzug) == null ? z.von : d(m.einzug));
    const b = Math.min(z.bis, d(m.auszug) == null ? z.bis : d(m.auszug));
    return { a, b };
  }

  // Monatsanteile (für Vorauszahlungen): je Kalendermonat belegte Tage / Tage des Monats
  function monate(m, z) {
    const sp = mieterSpanne(m, z);
    if (sp.b < sp.a) return 0;
    let summe = 0;
    let x = new Date(sp.a);
    let y = x.getUTCFullYear(), mo = x.getUTCMonth();
    while (true) {
      const ms = Date.UTC(y, mo, 1), me = Date.UTC(y, mo + 1, 0);
      if (ms > sp.b) break;
      const a = Math.max(ms, sp.a), b = Math.min(me, sp.b);
      if (b >= a) summe += tage(a, b) / tage(ms, me);
      mo++; if (mo > 11) { mo = 0; y++; }
    }
    return Math.round(summe * 1000) / 1000;
  }

  function vorausGesamt(m, z) {
    if (m.vorausGezahlt !== '' && m.vorausGezahlt != null && String(m.vorausGezahlt).trim() !== '') return r2(numRaw(m.vorausGezahlt));
    return r2(numRaw(m.vorausMonat) * monate(m, z));
  }

  function fp(s) { // Objekt-Fingerabdruck für die Freischaltung: Adresse + Abrechnungsjahr
    const o = s.objekt || {};
    const norm = (String(o.strasse || '') + '|' + String(o.ort || '')).toLowerCase()
      .replace(/ß/g, 'ss').replace(/str\.?(?=\s|\d|\||$)/g, 'strasse').replace(/[^a-z0-9äöü|]/g, '');
    const jahr = String((s.zeitraum && s.zeitraum.bis) || '').slice(0, 4);
    let h = 2166136261;
    const t = norm + '#' + jahr;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8) + '-' + jahr;
  }

  /* Hauptfunktion: berechnet alle Anteile.
     Rückgabe: { z, mieter:[{m, tage, positionen:[...], summe, voraus, saldo, p35a}], vermieter:{positionen, summe}, kontrolle:[...], warnungen:[] } */
  function berechne(s) {
    const z = zeitraum(s);
    const warn = [];
    const einheiten = (s.einheiten || []).filter(e => e && e.id);
    const eById = {}; einheiten.forEach(e => { eById[e.id] = e; });
    const mieter = (s.mieter || []).filter(m => m && m.id && eById[m.einheitId]);
    const kosten = (s.kosten || []).filter(k => k && k.id && (k.schluessel === 'direkt' || numRaw(k.betrag) !== 0));
    const zaehler = s.zaehler || [];
    const leerPers = s.optionen && s.optionen.leerstandPersonen === false ? 0 : 1;

    // Belegung je Einheit prüfen + Leerstand ermitteln
    const leerstand = {}; // einheitId -> Tage ohne Mieter
    einheiten.forEach(e => {
      const belegt = new Array(z.tage).fill(0);
      mieter.filter(m => m.einheitId === e.id).forEach(m => {
        const sp = mieterSpanne(m, z);
        if (sp.b < sp.a) return;
        for (let t = sp.a; t <= sp.b; t += DAY) belegt[Math.round((t - z.von) / DAY)]++;
      });
      let leer = 0, doppel = 0;
      belegt.forEach(x => { if (x === 0) leer++; if (x > 1) doppel++; });
      leerstand[e.id] = leer;
      if (doppel) warn.push('Wohnung „' + (e.name || '?') + '“: Mietzeiträume überschneiden sich an ' + doppel + ' Tag(en). Bitte Ein-/Auszugsdaten prüfen.');
      if (leer && leer < z.tage) warn.push('Wohnung „' + (e.name || '?') + '“: ' + leer + ' Tag(e) ohne Mieter – dieser Anteil bleibt beim Vermieter (Leerstand).');
      if (leer === z.tage) warn.push('Wohnung „' + (e.name || '?') + '“: im ganzen Zeitraum kein Mieter – Kosten dieser Wohnung trägt der Vermieter.');
      if (!(numRaw(e.flaeche) > 0)) warn.push('Wohnung „' + (e.name || '?') + '“: Wohnfläche fehlt.');
    });
    mieter.forEach(m => { if (mieterTage(m, z) === 0) warn.push('Mieter „' + (m.name || '?') + '“: Mietzeit liegt außerhalb des Abrechnungszeitraums.'); });

    const res = mieter.map(m => ({ m, e: eById[m.einheitId], tage: mieterTage(m, z), monate: monate(m, z), positionen: [], summe: 0, voraus: vorausGesamt(m, z), p35a: { dienst: 0, handwerk: 0 } }));
    const verm = { positionen: [], summe: 0 };
    const kontrolle = [];

    kosten.forEach(k => {
      const sch = k.schluessel || 'flaeche';
      let gesamt = r2(numRaw(k.betrag));
      const teile = []; // {ziel: index|'V', basis, gewicht, betrag}
      let basisText = '', basisSumme = 0, einheitText = '';

      if (sch === 'flaeche' || sch === 'einheiten' || sch === 'mea') {
        const w = e => sch === 'flaeche' ? numRaw(e.flaeche) : sch === 'mea' ? numRaw(e.mea) : 1;
        basisSumme = einheiten.reduce((a, e) => a + w(e) * z.tage, 0);
        res.forEach((r, i) => teile.push({ ziel: i, gewicht: w(r.e) * r.tage }));
        einheiten.forEach(e => { if (leerstand[e.id]) teile.push({ ziel: 'V', gewicht: w(e) * leerstand[e.id], leer: e }); });
        einheitText = SCHLUESSEL[sch].einheit;
        if (sch === 'mea' && einheiten.some(e => !(numRaw(e.mea) > 0))) warn.push('Kostenart „' + (k.art || '') + '“: Schlüssel MEA, aber nicht bei allen Wohnungen sind Miteigentumsanteile eingetragen.');
      } else if (sch === 'personen') {
        res.forEach((r, i) => teile.push({ ziel: i, gewicht: numRaw(r.m.personen) * r.tage }));
        einheiten.forEach(e => { if (leerstand[e.id] && leerPers) teile.push({ ziel: 'V', gewicht: leerPers * leerstand[e.id], leer: e }); });
        basisSumme = teile.reduce((a, t) => a + t.gewicht, 0);
        einheitText = SCHLUESSEL.personen.einheit;
        if (res.some(r => r.tage > 0 && !(numRaw(r.m.personen) > 0))) warn.push('Kostenart „' + (k.art || '') + '“ nach Personen: bei mindestens einem Mieter fehlt die Personenzahl.');
      } else if (sch === 'verbrauch') {
        const zid = k.zaehlerId;
        const zz = zaehler.find(x => x.id === zid) || { name: 'Zähler', einheit: '' };
        res.forEach((r, i) => teile.push({ ziel: i, gewicht: numRaw((r.m.verbrauch || {})[zid]) }));
        const leerV = numRaw(((s.leerVerbrauch || {})[zid]) || 0);
        if (leerV > 0) teile.push({ ziel: 'V', gewicht: leerV, leerText: 'Leerstand/Vermieter' });
        basisSumme = teile.reduce((a, t) => a + t.gewicht, 0);
        einheitText = zz.einheit || '';
        if (!(basisSumme > 0)) warn.push('Kostenart „' + (k.art || '') + '“: Verbrauchswerte für „' + zz.name + '“ fehlen.');
      } else if (sch === 'heizung') {
        const p = Math.min(70, Math.max(50, numRaw(k.verbrauchAnteil) || 70)) / 100;
        const zid = k.zaehlerId;
        const zz = zaehler.find(x => x.id === zid) || { name: 'Wärmezähler', einheit: 'Einheiten' };
        // CO2-Kostenaufteilung (CO2KostAufG, Stufenmodell Wohngebäude): Vermieteranteil vorab abziehen
        const co2 = co2Aufteilung(k, einheiten, z);
        if (co2) {
          verm.positionen.push({ k, art: 'CO2-Kosten Vermieteranteil (' + co2.vProz + ' %)', gesamt: co2.kosten, betrag: co2.vermieter, grund: 'CO2KostAufG' });
          if (co2.warn) warn.push(co2.warn);
        }
        const netto = r2(gesamt - (co2 ? co2.vermieter : 0));
        const grund = r2(netto * (1 - p)), verbr = r2(netto - grund);
        const fSum = einheiten.reduce((a, e) => a + numRaw(e.flaeche) * z.tage, 0);
        const vTeile = res.map(r => numRaw((r.m.verbrauch || {})[zid]));
        const leerV = numRaw(((s.leerVerbrauch || {})[zid]) || 0);
        const vSum = vTeile.reduce((a, b) => a + b, 0) + leerV;
        if (!(vSum > 0)) warn.push('Heizkosten „' + (k.art || '') + '“: Verbrauchswerte für „' + zz.name + '“ fehlen.');
        // zwei Unterpositionen
        const sub = [
          { teil: 'Grundkosten ' + Math.round((1 - p) * 100) + ' % nach Wohnfläche', betrag: grund, basis: fSum, einheit: 'm² × Tage',
            gew: res.map(r => numRaw(r.e.flaeche) * r.tage), vg: einheiten.map(e => ({ e, g: numRaw(e.flaeche) * (leerstand[e.id] || 0) })).filter(x => x.g > 0) },
          { teil: 'Verbrauchskosten ' + Math.round(p * 100) + ' % nach Verbrauch', betrag: verbr, basis: vSum, einheit: zz.einheit || 'Einheiten',
            gew: vTeile, vg: leerV > 0 ? [{ e: null, g: leerV }] : [] }
        ];
        sub.forEach(su => {
          const anteile = verteile(su.betrag, su.basis, su.gew.concat(su.vg.map(x => x.g)));
          res.forEach((r, i) => {
            r.positionen.push({ k, art: (k.art || 'Heizkosten') + ' – ' + su.teil, gesamt: su.betrag, schluessel: sch, basis: su.basis, einheit: su.einheit, anteil: su.gew[i], betrag: anteile[i] });
          });
          const vb = anteile.slice(res.length).reduce((a, b) => a + b, 0);
          const rest = r2(su.betrag - anteile.reduce((a, b) => a + b, 0));
          if (vb || rest) verm.positionen.push({ k, art: (k.art || 'Heizkosten') + ' – ' + su.teil, gesamt: su.betrag, betrag: r2(vb + rest), grund: rest && !vb ? 'nicht verteilt (Verbrauch 0)' : 'Leerstand' });
        });
        if (co2) {
          const mAnteil = co2.kosten - co2.vermieter;
          res.forEach(r => {
            const b = r.positionen.filter(x => x.k === k).reduce((a, x) => a + x.betrag, 0);
            r.co2 = r.co2 || [];
            r.co2.push({ art: k.art || 'Heizkosten', kgm2: co2.kgm2, stufe: co2.stufe, vProz: co2.vProz, kosten: co2.kosten, vermieter: co2.vermieter, ihrAnteil: netto > 0 ? r2(mAnteil * b / netto) : 0 });
          });
        }
        addKontrolle(k, gesamt, res, verm, kontrolle);
        zuordnen35a(k, res);
        return;
      } else if (sch === 'direkt') {
        res.forEach((r, i) => teile.push({ ziel: i, gewicht: r2(numRaw((r.m.direkt || {})[k.id])) }));
        const vd = r2(numRaw(((s.leerDirekt || {})[k.id]) || 0));
        if (vd) teile.push({ ziel: 'V', gewicht: vd, leerText: 'Leerstand/Vermieter' });
        const summeDirekt = r2(teile.reduce((a, t) => a + t.gewicht, 0));
        if (gesamt && Math.abs(summeDirekt - gesamt) > 0.005) warn.push('Kostenart „' + (k.art || '') + '“: Summe der Einzelbeträge (' + eur(summeDirekt) + ') weicht vom Gesamtbetrag (' + eur(gesamt) + ') ab. Der Gesamtbetrag wird auf die Summe gesetzt.');
        gesamt = summeDirekt;
        res.forEach((r, i) => r.positionen.push({ k, art: k.art, gesamt, schluessel: sch, basis: null, einheit: '', anteil: null, betrag: teile[i].gewicht }));
        if (vd) verm.positionen.push({ k, art: k.art, gesamt, betrag: vd, grund: 'Leerstand/Vermieter' });
        addKontrolle(k, gesamt, res, verm, kontrolle);
        zuordnen35a(k, res);
        return;
      }

      const anteile = verteile(gesamt, basisSumme, teile.map(t => t.gewicht));
      teile.forEach((t, j) => {
        if (t.ziel === 'V') return;
        const r = res[t.ziel];
        r.positionen.push({ k, art: k.art, gesamt, schluessel: sch, basis: basisSumme, einheit: einheitText, anteil: t.gewicht, betrag: anteile[j] });
      });
      const vb = r2(teile.reduce((a, t, j) => a + (t.ziel === 'V' ? anteile[j] : 0), 0));
      const rest = r2(gesamt - anteile.reduce((a, b) => a + b, 0)); // nur wenn basisSumme 0 (nichts verteilt)
      if (vb || rest) verm.positionen.push({ k, art: k.art, gesamt, betrag: r2(vb + rest), grund: rest && !vb ? 'nicht verteilbar (Basis fehlt)' : 'Leerstand' });
      addKontrolle(k, gesamt, res, verm, kontrolle);
      zuordnen35a(k, res);
    });

    res.forEach(r => {
      r.summe = r2(r.positionen.reduce((a, p) => a + p.betrag, 0));
      r.saldo = r2(r.summe - r.voraus);
      r.p35a.dienst = r2(r.p35a.dienst); r.p35a.handwerk = r2(r.p35a.handwerk);
      // Vorschlag neue monatliche Vorauszahlung (nur wenn Mieter am Ende noch da ist)
      r.ausgezogen = d(r.m.auszug) != null && d(r.m.auszug) <= z.bis;
      r.vorschlag = (!r.ausgezogen && r.tage > 0) ? Math.ceil((r.summe * 365 / r.tage) / 12) : null;
    });
    verm.summe = r2(verm.positionen.reduce((a, p) => a + p.betrag, 0));
    const gesamtKosten = r2(kosten.reduce((a, k) => a + (k.schluessel === 'direkt' ? 0 : r2(numRaw(k.betrag))), 0) + kontrolle.filter(x => x.k.schluessel === 'direkt').reduce((a, x) => a + x.gesamt, 0));
    return { z, mieter: res, vermieter: verm, kontrolle, warnungen: warn, gesamtKosten, leerstand };
  }

  // CO2KostAufG Anlage (Wohngebäude): Grenzen in kg CO2/m² Wohnfläche und Jahr -> Vermieteranteil
  const CO2_STUFEN = [[12, 0], [17, 10], [22, 20], [27, 30], [32, 40], [37, 50], [42, 60], [47, 70], [52, 80], [Infinity, 95]];
  function co2Aufteilung(k, einheiten, z) {
    const kosten = r2(numRaw(k.co2Kosten)), kg = numRaw(k.co2Kg);
    if (!(kosten > 0) || !(kg > 0)) return null;
    const fl = numRaw(k.co2Flaeche) || einheiten.reduce((a, e) => a + numRaw(e.flaeche), 0);
    if (!(fl > 0)) return null;
    const kgm2 = Math.round(kg / fl * 10) / 10;
    const faktor = z.tage < 365 ? z.tage / 365 : 1; // kürzere Zeiträume: Grenzwerte anteilig
    let stufe = 0, vProz = 95;
    for (let i = 0; i < CO2_STUFEN.length; i++) { if (kgm2 < CO2_STUFEN[i][0] * faktor) { stufe = i + 1; vProz = CO2_STUFEN[i][1]; break; } }
    return { kosten, kg, fl, kgm2, stufe, vProz, vermieter: r2(kosten * vProz / 100),
      warn: kosten > numRaw(k.betrag) ? 'CO2-Kosten sind höher als die Heizkosten – bitte Eingaben prüfen.' : '' };
  }

  // Verteilt einen Betrag nach Gewichten auf Cent genau (größter Rest), Summe = Betrag (falls basis > 0)
  function verteile(betrag, basis, gewichte) {
    const cent = Math.round(betrag * 100);
    if (!(basis > 0)) return gewichte.map(() => 0);
    const roh = gewichte.map(g => cent * g / basis);
    const ab = roh.map(x => Math.floor(x + 1e-9));
    let diff = Math.round(cent * gewichte.reduce((a, b) => a + b, 0) / basis) - ab.reduce((a, b) => a + b, 0);
    const idx = roh.map((x, i) => ({ i, f: x - ab[i] })).sort((a, b) => b.f - a.f);
    for (let j = 0; j < idx.length && diff > 0; j++, diff--) ab[idx[j].i]++;
    return ab.map(c => c / 100);
  }

  function addKontrolle(k, gesamt, res, verm, kontrolle) {
    const m = r2(res.reduce((a, r) => a + r.positionen.filter(p => p.k === k).reduce((x, p) => x + p.betrag, 0), 0));
    const v = r2(verm.positionen.filter(p => p.k === k).reduce((x, p) => x + p.betrag, 0));
    kontrolle.push({ k, art: k.art, gesamt, mieter: m, vermieter: v, ok: Math.abs(m + v - gesamt) < 0.005 });
  }

  function zuordnen35a(k, res) {
    const typ = k.typ35a, ak = numRaw(k.arbeitskosten);
    if (!typ || !(ak > 0)) return;
    const gesamt = k.schluessel === 'direkt' ? null : numRaw(k.betrag);
    res.forEach(r => {
      const b = r.positionen.filter(p => p.k === k).reduce((a, p) => a + p.betrag, 0);
      const g = gesamt == null ? r.positionen.filter(p => p.k === k).reduce((a, p) => Math.max(a, p.gesamt), 0) : gesamt;
      if (g > 0 && b) r.p35a[typ === 'handwerk' ? 'handwerk' : 'dienst'] += ak * b / g;
    });
  }

  function demo() {
    return {
      v: 1, demo: true,
      vermieter: { name: 'Petra Beispiel', strasse: 'Lindenweg 3', ort: '12345 Musterstadt', iban: 'DE00 0000 0000 0000 0000 00', bank: 'Musterbank', telefon: '', email: '' },
      objekt: { bezeichnung: 'Mehrfamilienhaus', strasse: 'Gartenstraße 12', ort: '12345 Musterstadt' },
      zeitraum: { von: '2025-01-01', bis: '2025-12-31' },
      optionen: { leerstandPersonen: true, zahlungsziel: 30, anpassungAb: '' },
      einheiten: [
        { id: 'e1', name: 'EG links', flaeche: '62', mea: '' },
        { id: 'e2', name: 'EG rechts', flaeche: '48', mea: '' },
        { id: 'e3', name: 'OG', flaeche: '85', mea: '' }
      ],
      zaehler: [{ id: 'z1', name: 'Kaltwasser', einheit: 'm³' }, { id: 'z2', name: 'Heizung (Wärmemengenzähler)', einheit: 'kWh' }],
      mieter: [
        { id: 'm1', einheitId: 'e1', name: 'Familie Sommer', strasse: '', ort: '', einzug: '', auszug: '', personen: '3', vorausMonat: '280', vorausGezahlt: '', verbrauch: { z1: '112', z2: '7420' }, direkt: {} },
        { id: 'm2', einheitId: 'e2', name: 'Herr Jonas Winter', strasse: 'Neue Straße 5', ort: '12345 Musterstadt', einzug: '', auszug: '2025-06-30', personen: '1', vorausMonat: '175', vorausGezahlt: '', verbrauch: { z1: '21', z2: '2310' }, direkt: {} },
        { id: 'm3', einheitId: 'e2', name: 'Frau Lea Herbst', strasse: '', ort: '', einzug: '2025-08-01', auszug: '', personen: '2', vorausMonat: '230', vorausGezahlt: '', verbrauch: { z1: '24', z2: '2950' }, direkt: {} },
        { id: 'm4', einheitId: 'e3', name: 'Familie Frühling', strasse: '', ort: '', einzug: '', auszug: '', personen: '4', vorausMonat: '420', vorausGezahlt: '', verbrauch: { z1: '168', z2: '10120' }, direkt: {} }
      ],
      kosten: [
        { id: 'k1', art: 'Grundsteuer', betrag: '640,00', schluessel: 'flaeche' },
        { id: 'k2', art: 'Wasserversorgung', betrag: '1.088,40', schluessel: 'verbrauch', zaehlerId: 'z1' },
        { id: 'k3', art: 'Entwässerung / Abwasser', betrag: '1.256,80', schluessel: 'verbrauch', zaehlerId: 'z1' },
        { id: 'k4', art: 'Heizkosten', betrag: '4.380,00', schluessel: 'heizung', zaehlerId: 'z2', verbrauchAnteil: '70', co2Kosten: '412,50', co2Kg: '5.500' },
        { id: 'k5', art: 'Müllbeseitigung', betrag: '702,00', schluessel: 'personen' },
        { id: 'k6', art: 'Gebäudereinigung / Ungezieferbekämpfung', betrag: '960,00', schluessel: 'flaeche', typ35a: 'dienst', arbeitskosten: '960,00' },
        { id: 'k7', art: 'Gartenpflege', betrag: '540,00', schluessel: 'flaeche', typ35a: 'dienst', arbeitskosten: '480,00' },
        { id: 'k8', art: 'Allgemeinstrom / Beleuchtung', betrag: '186,30', schluessel: 'einheiten' },
        { id: 'k9', art: 'Schornsteinreinigung', betrag: '142,00', schluessel: 'einheiten', typ35a: 'handwerk', arbeitskosten: '118,00' },
        { id: 'k10', art: 'Sach- und Haftpflichtversicherung', betrag: '890,00', schluessel: 'flaeche' }
      ]
    };
  }

  function leer() {
    const j = new Date().getFullYear() - 1;
    return {
      v: 1,
      vermieter: { name: '', strasse: '', ort: '', iban: '', bank: '', telefon: '', email: '' },
      objekt: { bezeichnung: '', strasse: '', ort: '' },
      zeitraum: { von: j + '-01-01', bis: j + '-12-31' },
      optionen: { leerstandPersonen: true, zahlungsziel: 30, anpassungAb: '' },
      einheiten: [{ id: 'e1', name: 'Wohnung 1', flaeche: '', mea: '' }],
      zaehler: [{ id: 'z1', name: 'Kaltwasser', einheit: 'm³' }],
      mieter: [{ id: 'm1', einheitId: 'e1', name: '', strasse: '', ort: '', einzug: '', auszug: '', personen: '', vorausMonat: '', vorausGezahlt: '', verbrauch: {}, direkt: {} }],
      kosten: [
        { id: 'k1', art: 'Grundsteuer', betrag: '', schluessel: 'flaeche' },
        { id: 'k2', art: 'Wasserversorgung', betrag: '', schluessel: 'verbrauch', zaehlerId: 'z1' },
        { id: 'k3', art: 'Entwässerung / Abwasser', betrag: '', schluessel: 'verbrauch', zaehlerId: 'z1' },
        { id: 'k4', art: 'Müllbeseitigung', betrag: '', schluessel: 'personen' },
        { id: 'k5', art: 'Sach- und Haftpflichtversicherung', betrag: '', schluessel: 'flaeche' }
      ]
    };
  }

  const NK = { berechne, co2Aufteilung, CO2_STUFEN, verteile, monate, mieterTage, vorausGesamt, fp, demo, leer, eur, zahl, r2, numRaw, fmtDatum, d, KOSTENARTEN, SCHLUESSEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = NK; else root.NK = NK;
})(typeof self !== 'undefined' ? self : this);
