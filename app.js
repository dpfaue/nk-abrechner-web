/* NK-Abrechner – Oberfläche */
(function () {
  'use strict';
  const C = window.NK_CONFIG;
  const $ = id => document.getElementById(id);
  const KEY = 'nk_state_v1';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = p => p + Math.random().toString(36).slice(2, 8);
  function newId() { return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); }

  /* ---------- Tracking (anonym, gleiche Logik wie die anderen Seiten) ---------- */
  function sGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  const visitId = sGet('nk_visit') || newId(); sSet('nk_visit', visitId);
  const quelle = sGet('nk_quelle') || (function () { try { const q = new URLSearchParams(location.search); return q.get('gclid') ? 'google-ads' : (q.get('utm_source') || (document.referrer && !document.referrer.includes(location.host) ? new URL(document.referrer).hostname : 'direkt')); } catch (e) { return 'direkt'; } })();
  sSet('nk_quelle', quelle);
  function post(p) { return fetch(C.api, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(p) }); }
  const sent = {};
  function funnel(step) {
    if (sent[step] || navigator.webdriver || sGet('nk_f_' + step)) return; sent[step] = true; sSet('nk_f_' + step, '1');
    try { post({ kind: 'funnel', service: 'nk', visit: visitId, step, quelle, plan: 'objekt', device: matchMedia('(max-width: 700px)').matches ? 'mobil' : 'desktop' }).catch(() => {}); } catch (e) {}
  }
  function jsonp(params, timeout) {
    return new Promise((resolve, reject) => {
      const cb = 'nkcb_' + Math.random().toString(36).slice(2);
      const s = document.createElement('script');
      const done = () => { delete window[cb]; s.remove(); };
      window[cb] = data => { done(); resolve(data); };
      s.src = C.api + '?' + new URLSearchParams(Object.assign({}, params, { callback: cb }));
      s.onerror = () => { done(); fetch(s.src).then(r => r.text()).then(t => { const m = t.match(/^[\w$]+\(([\s\S]*)\);?\s*$/); resolve(JSON.parse(m ? m[1] : t)); }).catch(() => reject(new Error('Keine Verbindung'))); };
      document.body.appendChild(s);
      setTimeout(() => { if (window[cb]) { done(); reject(new Error('Zeitüberschreitung')); } }, timeout || 20000);
    });
  }

  /* ---------- Zustand ---------- */
  let S;
  function load() { try { const t = localStorage.getItem(KEY); if (t) { const x = JSON.parse(t); if (x && x.v === 1) return x; } } catch (e) {} return null; }
  let saveT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(S)); $('saveState').textContent = '✓ lokal gespeichert'; }
      catch (e) { $('saveState').textContent = 'Speichern im Browser nicht möglich – bitte „Daten sichern“ nutzen'; }
    }, 250);
  }
  function setPath(obj, path, val) {
    const p = path.split('.'); let o = obj;
    for (let i = 0; i < p.length - 1; i++) { const k = /^\d+$/.test(p[i]) ? +p[i] : p[i]; if (o[k] == null) o[k] = {}; o = o[k]; }
    o[p[p.length - 1]] = val;
  }
  function getPath(obj, path) { return path.split('.').reduce((o, k) => o == null ? undefined : o[/^\d+$/.test(k) ? +k : k], obj); }

  /* ---------- Bausteine ---------- */
  function inp(path, label, opts) {
    opts = opts || {};
    const v = getPath(S, path);
    const t = opts.type || 'text';
    const attrs = 'data-p="' + esc(path) + '"' + (opts.rr ? ' data-rr="' + opts.rr + '"' : '') + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') +
      (opts.list ? ' list="' + opts.list + '"' : '') + (opts.num ? ' class="num" inputmode="decimal"' : '') + (opts.ro ? ' readonly' : '');
    return '<div' + (opts.wide ? ' style="grid-column:1/-1"' : '') + '><label>' + esc(label) + '</label><input type="' + t + '" ' + attrs + ' value="' + esc(v == null ? '' : v) + '">' + (opts.hint ? '<p class="hint">' + opts.hint + '</p>' : '') + '</div>';
  }
  function sel(path, label, options, opts) {
    opts = opts || {};
    const v = getPath(S, path);
    return '<div' + (opts.wide ? ' style="grid-column:1/-1"' : '') + '><label>' + esc(label) + '</label><select data-p="' + esc(path) + '"' + (opts.rr ? ' data-rr="' + opts.rr + '"' : '') + '>' +
      options.map(o => '<option value="' + esc(o[0]) + '"' + (String(v == null ? '' : v) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>' + (opts.hint ? '<p class="hint">' + opts.hint + '</p>' : '') + '</div>';
  }

  /* ---------- Abschnitt 1 ---------- */
  function r1() {
    $('b1').innerHTML =
      '<h3>Vermieter (Absender)</h3><div class="f">' +
      inp('vermieter.name', 'Name', { ph: 'z. B. Petra Muster' }) + inp('vermieter.strasse', 'Straße, Nr.') + inp('vermieter.ort', 'PLZ Ort') +
      inp('vermieter.telefon', 'Telefon (optional)') + inp('vermieter.email', 'E-Mail (optional)') +
      inp('vermieter.iban', 'IBAN für Nachzahlungen', { ph: 'DE..' }) + inp('vermieter.bank', 'Bank (optional)') + '</div>' +
      '<h3 style="margin-top:18px">Objekt</h3><div class="f">' +
      inp('objekt.bezeichnung', 'Bezeichnung (optional)', { ph: 'z. B. Zweifamilienhaus' }) + inp('objekt.strasse', 'Straße, Nr. des Hauses', { rr: 'lz' }) + inp('objekt.ort', 'PLZ Ort', { rr: 'lz' }) + '</div>' +
      '<h3 style="margin-top:18px">Abrechnungszeitraum</h3><div class="f">' +
      inp('zeitraum.von', 'von', { type: 'date', rr: 'all' }) + inp('zeitraum.bis', 'bis', { type: 'date', rr: 'all' }) +
      inp('optionen.zahlungsziel', 'Zahlungsziel (Tage)', { num: true }) +
      inp('optionen.anpassungAb', 'Neue Vorauszahlung ab (optional)', { type: 'date', rr: 'all', hint: 'Wenn gesetzt, steht in jeder Abrechnung die angepasste monatliche Vorauszahlung (Vorschlag automatisch, bei den Mietern änderbar).' }) + '</div>' +
      '<p class="hint">Die Abrechnung muss dem Mieter spätestens 12 Monate nach Ende des Zeitraums zugehen (§ 556 Abs. 3 BGB) – für 2025 also bis 31.12.2026.</p>';
    info();
  }

  /* ---------- Abschnitt 2: Wohnungen + Zähler ---------- */
  function r2() {
    const meaAn = S.kosten.some(k => k.schluessel === 'mea');
    let h = '';
    S.einheiten.forEach((e, i) => {
      h += '<div class="row"><button class="x" type="button" title="Wohnung entfernen" data-del="einheiten" data-i="' + i + '">×</button><h4>Wohnung ' + (i + 1) + '</h4><div class="f">' +
        inp('einheiten.' + i + '.name', 'Bezeichnung', { ph: 'z. B. EG links', rr: 'm' }) + inp('einheiten.' + i + '.flaeche', 'Wohnfläche m²', { num: true }) +
        (meaAn ? inp('einheiten.' + i + '.mea', 'Miteigentumsanteile', { num: true }) : '') + '</div></div>';
    });
    h += '<button class="btn small sec" type="button" data-add="einheit">+ Wohnung</button>' +
      '<p class="hint">Auch selbst bewohnte oder leerstehende Wohnungen eintragen – ihr Anteil bleibt dann beim Vermieter.</p>';
    h += '<h3 style="margin-top:22px">Zähler (für Verbrauchskosten)</h3><p class="hint" style="margin:0 0 10px">Z. B. Kaltwasser (m³) oder Heizung (kWh/Einheiten). Die abgelesenen Werte tragen Sie bei den Mietern ein.</p>';
    S.zaehler.forEach((z, i) => {
      h += '<div class="row"><button class="x" type="button" title="Zähler entfernen" data-del="zaehler" data-i="' + i + '">×</button><div class="f">' +
        inp('zaehler.' + i + '.name', 'Zähler', { rr: 'mk' }) + inp('zaehler.' + i + '.einheit', 'Einheit', { ph: 'm³', rr: 'mk' }) + '</div></div>';
    });
    h += '<button class="btn small sec" type="button" data-add="zaehler">+ Zähler</button>';
    $('b2').innerHTML = h;
    info();
  }

  /* ---------- Abschnitt 3: Mieter ---------- */
  function r3() {
    let h = '<p class="hint" style="margin:0 0 10px">Mieterwechsel im Jahr? Legen Sie für dieselbe Wohnung einfach einen zweiten Mieter mit Aus- bzw. Einzugsdatum an. Leere Tage werden automatisch als Leerstand (Vermieter) berechnet.</p>';
    const z = zr();
    const direkt = S.kosten.filter(k => k.schluessel === 'direkt');
    S.mieter.forEach((m, i) => {
      const auto = z ? NK.r2(NK.numRaw(m.vorausMonat) * NK.monate(m, z)) : 0;
      h += '<div class="row"><button class="x" type="button" title="Mieter entfernen" data-del="mieter" data-i="' + i + '">×</button><h4>Mieter ' + (i + 1) + (m.name ? ': ' + esc(m.name) : '') + '</h4><div class="f">' +
        sel('mieter.' + i + '.einheitId', 'Wohnung', S.einheiten.map(e => [e.id, e.name || '(ohne Namen)'])) +
        inp('mieter.' + i + '.name', 'Name (wie in der Anschrift)', { ph: 'z. B. Herr Max Mustermann' }) +
        inp('mieter.' + i + '.einzug', 'Einzug (nur wenn im Zeitraum)', { type: 'date' }) + inp('mieter.' + i + '.auszug', 'Auszug (nur wenn im Zeitraum)', { type: 'date' }) +
        inp('mieter.' + i + '.personen', 'Personen', { num: true }) + inp('mieter.' + i + '.vorausMonat', 'Vorauszahlung je Monat €', { num: true }) +
        inp('mieter.' + i + '.vorausGezahlt', 'Tatsächlich gezahlt gesamt € (optional)', { num: true, ph: auto ? 'automatisch: ' + NK.eur(auto) : '' });
      if (S.optionen && S.optionen.anpassungAb) h += inp('mieter.' + i + '.vorausNeu', 'Neue Vorauszahlung €/Monat', { num: true, ph: 'Vorschlag siehe Ergebnis' });
      h += '</div>';
      if (S.zaehler.length || direkt.length) {
        h += '<div class="sub"><div class="f">';
        S.zaehler.forEach(zz => { h += inp('mieter.' + i + '.verbrauch.' + zz.id, 'Verbrauch ' + (zz.name || 'Zähler') + (zz.einheit ? ' (' + zz.einheit + ')' : ''), { num: true }); });
        direkt.forEach(k => { h += inp('mieter.' + i + '.direkt.' + k.id, (k.art || 'Kosten') + ' € (direkt)', { num: true }); });
        h += '</div></div>';
      }
      h += '<details class="sub"><summary class="note" style="cursor:pointer">Andere Anschrift (z. B. nach Auszug)</summary><div class="f" style="margin-top:8px">' +
        inp('mieter.' + i + '.strasse', 'Straße, Nr.') + inp('mieter.' + i + '.ort', 'PLZ Ort') + '</div></details></div>';
    });
    h += '<button class="btn small sec" type="button" data-add="mieter">+ Mieter</button>';
    $('b3').innerHTML = h;
    info();
  }

  /* ---------- Abschnitt 4: Kosten ---------- */
  function r4() {
    const schl = [['flaeche', 'nach Wohnfläche'], ['personen', 'nach Personen'], ['einheiten', 'nach Wohneinheiten'], ['verbrauch', 'nach Verbrauch (Zähler)'], ['heizung', 'Heizkosten (Grund-/Verbrauchsanteil)'], ['direkt', 'direkt je Mieter (z. B. Messdienst)'], ['mea', 'nach Miteigentumsanteilen']];
    let h = '<datalist id="arten">' + NK.KOSTENARTEN.map(a => '<option value="' + esc(a) + '">').join('') + '</datalist>' +
      '<p class="hint" style="margin:0 0 10px">Tragen Sie die Gesamtkosten des Hauses für den Zeitraum ein (laut Rechnungen/Bescheiden). Nur umlagefähige Betriebskosten, die im Mietvertrag vereinbart sind – keine Verwaltungs- oder Reparaturkosten.</p>';
    S.kosten.forEach((k, i) => {
      const sumDirekt = k.schluessel === 'direkt' ? NK.r2(S.mieter.reduce((a, m) => a + NK.numRaw((m.direkt || {})[k.id]), 0)) : 0;
      h += '<div class="row"><button class="x" type="button" title="Kostenart entfernen" data-del="kosten" data-i="' + i + '">×</button><div class="f">' +
        inp('kosten.' + i + '.art', 'Kostenart', { list: 'arten', rr: 'm' }) +
        (k.schluessel === 'direkt' ? '<div><label>Gesamtbetrag €</label><input type="text" class="num" readonly value="' + esc(NK.eur(sumDirekt)) + '"><p class="hint">= Summe der Beträge bei den Mietern</p></div>' : inp('kosten.' + i + '.betrag', 'Gesamtbetrag €', { num: true })) +
        sel('kosten.' + i + '.schluessel', 'Verteilerschlüssel', schl, { rr: 'kosten' });
      if (k.schluessel === 'verbrauch' || k.schluessel === 'heizung') {
        h += sel('kosten.' + i + '.zaehlerId', 'Zähler', S.zaehler.length ? S.zaehler.map(z => [z.id, (z.name || 'Zähler') + (z.einheit ? ' (' + z.einheit + ')' : '')]) : [['', 'bitte unter 2. einen Zähler anlegen']]);
      }
      if (k.schluessel === 'heizung') h += sel('kosten.' + i + '.verbrauchAnteil', 'Verbrauchsanteil', [['70', '70 % Verbrauch / 30 % Fläche'], ['60', '60 % / 40 %'], ['50', '50 % / 50 %']], { hint: 'Laut Heizkostenverordnung 50–70 % nach Verbrauch.' });
      h += '</div>';
      if (k.schluessel === 'heizung') {
        const co2 = (function () { try { return NK.co2Aufteilung(k, S.einheiten, { tage: (zr() ? Math.round((zr().bis - zr().von) / 864e5) + 1 : 365) }); } catch (e) { return null; } })();
        h += '<details class="sub"' + (k.co2Kosten ? ' open' : '') + '><summary class="note" style="cursor:pointer">CO2-Kosten aufteilen (Gas/Öl, Pflicht seit 2023)</summary><p class="hint">Bei Heizung mit Gas oder Öl stehen CO2-Kosten und CO2-Menge auf der Brennstoffrechnung. Der Vermieteranteil wird nach dem Stufenmodell (CO2KostAufG) berechnet und von den Heizkosten abgezogen. Bei Fernwärme/Wärmepumpe leer lassen.</p><div class="f">' +
          inp('kosten.' + i + '.co2Kosten', 'CO2-Kosten laut Rechnung €', { num: true, rr: 'k4' }) + inp('kosten.' + i + '.co2Kg', 'CO2-Ausstoß kg', { num: true, rr: 'k4' }) +
          inp('kosten.' + i + '.co2Flaeche', 'Wohnfläche Gebäude m² (optional)', { num: true, rr: 'k4', ph: 'Summe der Wohnungen' }) + '</div>' +
          (co2 ? '<p class="okbox" style="margin:8px 0 0">' + NK.zahl(co2.kgm2, 1) + ' kg CO2/m² · Stufe ' + co2.stufe + ' → Vermieter trägt ' + co2.vProz + ' % = ' + NK.eur(co2.vermieter) + '</p>' : '') + '</details>';
      }
      h += '<details class="sub"' + (k.typ35a ? ' open' : '') + '><summary class="note" style="cursor:pointer">§ 35a: Arbeitskosten für die Steuererklärung der Mieter (optional)</summary><div class="f" style="margin-top:8px">' +
        sel('kosten.' + i + '.typ35a', 'Art', [['', '– keine –'], ['dienst', 'haushaltsnahe Dienstleistung'], ['handwerk', 'Handwerkerleistung']]) +
        inp('kosten.' + i + '.arbeitskosten', 'davon Arbeits-/Fahrtkosten €', { num: true }) + '</div></details></div>';
    });
    h += '<button class="btn small sec" type="button" data-add="kosten">+ Kostenart</button>';
    h += '<label class="toggle"><input type="checkbox" data-pc="optionen.leerstandPersonen"' + (S.optionen.leerstandPersonen === false ? '' : ' checked') + '> Bei Verteilung nach Personen: Leerstand mit 1 Person zulasten des Vermieters ansetzen (empfohlen)</label>';
    $('b4').innerHTML = h;
    info();
  }

  function zr() { const a = NK.d(S.zeitraum.von), b = NK.d(S.zeitraum.bis); return (a != null && b != null && b >= a) ? { von: a, bis: b } : null; }

  function info() {
    $('i1').textContent = S.objekt.strasse ? S.objekt.strasse + ' · ' + NK.fmtDatum(S.zeitraum.von) + '–' + NK.fmtDatum(S.zeitraum.bis) : '';
    $('i2').textContent = S.einheiten.length + ' Wohnung(en), ' + NK.zahl(S.einheiten.reduce((a, e) => a + NK.numRaw(e.flaeche), 0)) + ' m²';
    $('i3').textContent = S.mieter.length + ' Mieter';
    $('i4').textContent = S.kosten.length + ' Kostenarten, ' + NK.eur(S.kosten.reduce((a, k) => a + (k.schluessel === 'direkt' ? S.mieter.reduce((x, m) => x + NK.numRaw((m.direkt || {})[k.id]), 0) : NK.numRaw(k.betrag)), 0));
  }

  /* ---------- Ergebnis ---------- */
  let erg = null;
  function rechne() {
    try { erg = NK.berechne(S); } catch (e) { erg = null; $('ergebnis').innerHTML = '<div class="errbox">' + esc(e.message) + '</div>'; $('dl').innerHTML = ''; $('i5').textContent = ''; return; }
    const hatDaten = erg.mieter.some(r => r.summe > 0);
    if (!hatDaten) {
      $('ergebnis').innerHTML = '<div class="warnbox">Noch kein Ergebnis – bitte Wohnungen, Mieter und mindestens eine Kostenart mit Betrag eintragen. Oder zum Ausprobieren oben auf „Beispiel laden“ tippen.</div>';
      $('dl').innerHTML = ''; $('i5').textContent = ''; rLizenz(); return;
    }
    funnel('2 Paket gewählt');
    let h = '<div class="scroll"><table class="tbl"><tr><th>Mieter</th><th class="hm">Wohnung</th><th class="r">Kosten</th><th class="r">Vorausz.</th><th class="r">Ergebnis</th></tr>';
    erg.mieter.forEach(r => {
      const cls = r.saldo > 0 ? 'plus' : 'minus';
      h += '<tr><td>' + esc(r.m.name || '–') + '<div class="hint">' + esc(r.e.name || '') + ' · ' + r.tage + ' Tage' + (r.vorschlag && S.optionen.anpassungAb ? ' · neu: ' + NK.eur(NK.numRaw(r.m.vorausNeu) || r.vorschlag) + '/Monat' : '') + '</div></td><td class="hm">' + esc(r.e.name || '') + '</td><td class="r">' + NK.eur(r.summe) + '</td><td class="r">' + NK.eur(r.voraus) +
        '</td><td class="r ' + cls + '">' + (r.saldo > 0 ? 'Nachzahlung<br>' : r.saldo < 0 ? 'Guthaben<br>' : '') + NK.eur(Math.abs(r.saldo)) + '</td></tr>';
    });
    if (erg.vermieter.summe) h += '<tr><td>Vermieter (Leerstand)</td><td class="hm"></td><td class="r">' + NK.eur(erg.vermieter.summe) + '</td><td></td><td></td></tr>';
    h += '</table></div>';
    const sM = erg.mieter.reduce((a, r) => a + r.summe, 0);
    const stimmt = erg.kontrolle.every(k => k.ok) && Math.abs(sM + erg.vermieter.summe - erg.gesamtKosten) < 0.01;
    h += '<div class="' + (stimmt ? 'okbox' : 'errbox') + '" style="margin-top:12px">' + (stimmt ? '✓ Kontrolle: Gesamtkosten ' + NK.eur(erg.gesamtKosten) + ' sind vollständig verteilt (Mieter ' + NK.eur(sM) + ' + Vermieter ' + NK.eur(erg.vermieter.summe) + ').' : 'Achtung: Die Verteilung geht nicht auf – bitte Hinweise unten prüfen.') + '</div>';
    if (erg.warnungen.length) h += '<div class="warnbox" style="margin-top:10px"><b>Hinweise</b><ul style="margin:6px 0 0;padding-left:18px">' + erg.warnungen.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul></div>';
    $('ergebnis').innerHTML = h;
    $('i5').textContent = erg.mieter.length + ' Abrechnung(en)';
    rDownloads();
    rLizenz();
  }

  /* ---------- Freischaltung ---------- */
  function freigeschaltet() { return !S.demo && S.lizenz && S.lizenz.code && S.lizenz.fp === NK.fp(S); }
  function rDownloads() {
    const frei = freigeschaltet();
    let h = '';
    if (frei) {
      h += '<button class="btn" type="button" data-pdf="alle">PDF: alle Abrechnungen + Übersicht</button>';
      erg.mieter.forEach((r, i) => { h += '<button class="btn small sec" type="button" data-pdf="' + i + '">PDF ' + esc(r.m.name || 'Mieter ' + (i + 1)) + '</button>'; });
    } else {
      h += '<button class="btn sec" type="button" data-pdf="alle">Muster-PDF ansehen (mit Wasserzeichen)</button>';
    }
    $('dl').innerHTML = h;
  }

  let zahlungLaeuft = false, payStage = false;
  function rLizenz() {
    const box = $('lizenzBox');
    if (zahlungLaeuft || (payStage && !freigeschaltet())) return;
    if (freigeschaltet()) {
      box.innerHTML = '<div class="okbox" style="margin-top:14px">✓ Freigeschaltet für <b>' + esc(S.objekt.strasse + ', ' + S.objekt.ort) + '</b>, Abrechnungsjahr ' + esc(String(S.zeitraum.bis).slice(0, 4)) + ' (Code ' + esc(S.lizenz.code) + '). Sie können beliebig oft ändern und neu erstellen.</div>';
      return;
    }
    const alt = S.lizenz && S.lizenz.code && !S.demo;
    const preis = C.preis.replace('.', ',');
    box.innerHTML = '<div class="pay"><span class="badge">Für Ihre eigenen Daten</span><h3 style="margin-top:10px">Abrechnungen ohne Wasserzeichen</h3>' +
      '<div class="preis">' + preis + ' € <small class="note">einmalig je Objekt und Abrechnungsjahr</small></div>' +
      '<ul class="checks"><li>Fertige PDF-Abrechnung für jeden Mieter (inkl. Erläuterung der Schlüssel)</li><li>Gesamtübersicht mit Kontrolle für Ihre Unterlagen</li><li>Beliebig oft ändern und neu erstellen</li><li>Kein Abo, keine Anmeldung, Daten bleiben auf Ihrem Gerät</li></ul>' +
      (alt ? '<div class="warnbox" style="margin-bottom:10px">Ihre Freischaltung (' + esc(S.lizenz.code) + ') gilt für eine andere Adresse oder ein anderes Jahr. Haben Sie nur einen Tippfehler korrigiert? Dann unten den Code erneut prüfen.</div>' : '') +
      (S.demo ? '<p class="note">Sie sehen gerade das Beispiel. Tippen Sie oben auf „Neu beginnen“ und tragen Sie Ihr Haus ein – rechnen und das Muster-PDF ansehen ist kostenlos.</p>' :
      '<div id="payForm"><label class="lbl">Ihr Name</label><input type="text" id="pName" autocomplete="name" value="' + esc(S.vermieter.name || '') + '">' +
      '<label class="lbl" style="margin-top:10px">E-Mail (für Rechnung und Freischaltcode)</label><input type="email" id="pMail" autocomplete="email" value="' + esc(S.vermieter.email || '') + '">' +
      '<label class="consent"><input type="checkbox" id="pVerzicht"><span>Ich stimme ausdrücklich zu, dass die Freischaltung sofort und vor Ablauf der Widerrufsfrist erfolgt. Mir ist bekannt, dass ich dadurch mein Widerrufsrecht verliere. Es gelten die <a href="agb.html" target="_blank">AGB</a> (<a href="widerruf.html" target="_blank">Widerrufsbelehrung</a>).</span></label>' +
      '<div id="pErr" class="errbox hidden"></div>' +
      '<button class="btn" type="button" id="pWeiter">Weiter zur Zahlung</button><div id="ppButtons" style="margin-top:12px;max-width:420px"></div>' +
      '<p class="note">Zahlung über PayPal (auch Lastschrift oder Kreditkarte ohne PayPal-Konto). Freigeschaltet wird für: <b>' + esc((S.objekt.strasse || '–') + ', ' + (S.objekt.ort || '–')) + ' · ' + esc(String(S.zeitraum.bis).slice(0, 4)) + '</b>.</p></div>') +
      '<details style="margin-top:10px"><summary class="note" style="cursor:pointer">Ich habe schon einen Freischaltcode</summary><div class="f" style="margin-top:8px"><div><input type="text" id="cCode" placeholder="NK-XXXX-XXXX" value="' + esc(alt ? S.lizenz.code : '') + '"></div><div><button class="btn small sec" type="button" id="cPruef">Code prüfen</button></div></div><div id="cMsg" class="hint"></div></details></div>';
  }

  function pErr(m) { const e = $('pErr'); if (!e) return; e.textContent = m; e.classList.toggle('hidden', !m); }

  function ladePaypal() {
    return new Promise((res, rej) => {
      if (window.paypal) return res();
      const s = document.createElement('script');
      s.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(C.paypalClientId) + '&currency=EUR&locale=de_DE';
      s.onload = () => res(); s.onerror = () => rej(new Error('PayPal konnte nicht geladen werden'));
      document.head.appendChild(s);
    });
  }

  async function weiterZurZahlung() {
    pErr('');
    const name = $('pName').value.trim(), email = $('pMail').value.trim(), verzicht = $('pVerzicht').checked;
    if (!S.objekt.strasse || !S.objekt.ort) return pErr('Bitte zuerst unter 1. die Adresse des Hauses eintragen – dafür wird freigeschaltet.');
    if (!name) return pErr('Bitte Ihren Namen angeben.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return pErr('Bitte eine gültige E-Mail-Adresse angeben – dorthin kommen Rechnung und Code.');
    if (!verzicht) return pErr('Bitte die Zustimmung zur sofortigen Freischaltung bestätigen.');
    funnel('5 Weiter zur Zahlung');
    try { await ladePaypal(); } catch (e) { return pErr('Die Zahlungsfunktion konnte nicht geladen werden. Bitte Seite neu laden oder Werbeblocker kurz deaktivieren.'); }
    ['pName', 'pMail', 'pVerzicht'].forEach(i => $(i).disabled = true); $('pWeiter').style.display = 'none';
    payStage = true;
    const requestId = newId();
    const fp = NK.fp(S), jahr = String(S.zeitraum.bis).slice(0, 4);
    const objektText = (S.objekt.strasse + ', ' + S.objekt.ort + ' · ' + jahr).slice(0, 120);
    window.paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'buynow' },
      createOrder: (data, actions) => (funnel('6 PayPal geöffnet'), actions.order.create({ purchase_units: [{ amount: { value: C.preis, currency_code: 'EUR' }, description: C.marke + ' Freischaltung ' + jahr, custom_id: requestId }] })),
      onApprove: async (data, actions) => {
        zahlungLaeuft = true;
        const order = await actions.order.capture(); funnel('7 Bezahlt');
        $('ppButtons').innerHTML = '<div class="okbox">Zahlung erhalten – Freischaltung wird eingerichtet …</div>';
        const p = { kind: 'shop_paid', produkt: 'nk', requestId, quelle, paypalOrderId: order.id, paypalPayerEmail: (order.payer && order.payer.email_address) || '', name, email, firma: '', verzicht: true, objektFp: fp, objektText };
        for (let i = 0; i < 3; i++) { try { await post(p); break; } catch (e) { await new Promise(r => setTimeout(r, 1500)); } }
        let code = null;
        for (let i = 0; i < 15 && !code; i++) {
          await new Promise(r => setTimeout(r, i === 0 ? 2500 : 3000));
          try { const r = await jsonp({ nk: 'claim', order: order.id, req: requestId }); if (r && r.ok && r.code) code = r.code; } catch (e) {}
        }
        zahlungLaeuft = false;
        if (code) { S.lizenz = { code, fp }; payStage = false; save(); rechne(); $('lizenzBox').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        else { $('ppButtons').innerHTML = '<div class="warnbox">Zahlung ist eingegangen (Transaktion ' + esc(order.id) + '). Der Freischaltcode kommt in wenigen Minuten per E-Mail an ' + esc(email) + ' – dann unten bei „Ich habe schon einen Freischaltcode“ eingeben. Bei Problemen einfach auf die Mail antworten.</div>'; }
      },
      onError: () => { pErr('Bei der Zahlung ist ein Fehler aufgetreten. Es wurde nichts abgebucht – bitte erneut versuchen.'); }
    }).render('#ppButtons');
  }

  async function codePruefen() {
    const code = $('cCode').value.trim().toUpperCase();
    const msg = $('cMsg');
    if (!/^NK-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) { msg.textContent = 'Der Code hat das Format NK-XXXX-XXXX.'; return; }
    if (!S.objekt.strasse || !S.objekt.ort) { msg.textContent = 'Bitte zuerst unter 1. die Adresse des Hauses eintragen.'; return; }
    msg.textContent = 'Prüfe …';
    try {
      const fp = NK.fp(S);
      const r = await jsonp({ nk: 'check', code, fp, ft: (S.objekt.strasse + ', ' + S.objekt.ort + ' · ' + String(S.zeitraum.bis).slice(0, 4)).slice(0, 120) });
      if (r && r.ok) { S.lizenz = { code, fp }; save(); rechne(); }
      else msg.textContent = (r && r.error) || 'Code nicht gültig.';
    } catch (e) { msg.textContent = 'Keine Verbindung – bitte später erneut versuchen.'; }
  }

  /* ---------- PDF ---------- */
  function pdf(nur) {
    if (!window.NKPDF || !window.jspdf) { alert('PDF-Funktion lädt noch – bitte einen Moment warten.'); return; }
    const frei = freigeschaltet();
    if (!frei) funnel('4 Foto hinzugefügt');
    try {
      const out = NKPDF.erstelle(S, frei, nur === 'alle' ? null : +nur);
      const name = frei ? out.name : out.name.replace('.pdf', '_MUSTER.pdf');
      out.doc.save(name);
    } catch (e) { alert('PDF konnte nicht erstellt werden: ' + e.message); }
  }

  /* ---------- Ereignisse ---------- */
  let calcT;
  function bald() { clearTimeout(calcT); calcT = setTimeout(rechne, 350); }
  const renderer = { k4: () => { r4(); }, all: () => { r3(); r4(); }, m: () => { r3(); }, mk: () => { r3(); r4(); }, kosten: () => { r2(); r3(); r4(); }, lz: () => {} };
  document.addEventListener('input', e => {
    const t = e.target; const p = t.getAttribute && t.getAttribute('data-p');
    if (!p) return;
    setPath(S, p, t.value);
    if (p === 'objekt.strasse' && S.demo) { delete S.demo; $('demoHinweis').classList.add('hidden'); }
    funnel('3 Formular begonnen');
    save(); info(); bald();
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.getAttribute && t.getAttribute('data-pc')) { setPath(S, t.getAttribute('data-pc'), t.checked); save(); bald(); return; }
    const rr = t.getAttribute && t.getAttribute('data-rr');
    if (t.tagName === 'SELECT' && t.getAttribute('data-p')) { setPath(S, t.getAttribute('data-p'), t.value); save(); }
    if (rr && renderer[rr]) { renderer[rr](); bald(); }
    else if (t.tagName === 'SELECT') bald();
  });
  document.addEventListener('click', e => {
    const t = e.target.closest('button, [data-add], [data-del], [data-pdf]');
    if (!t) return;
    if (t.dataset.add) {
      if (t.dataset.add === 'einheit') { S.einheiten.push({ id: uid('e'), name: 'Wohnung ' + (S.einheiten.length + 1), flaeche: '', mea: '' }); r2(); r3(); }
      if (t.dataset.add === 'zaehler') { S.zaehler.push({ id: uid('z'), name: '', einheit: '' }); r2(); r3(); r4(); }
      if (t.dataset.add === 'mieter') { const last = S.mieter[S.mieter.length - 1]; S.mieter.push({ id: uid('m'), einheitId: (S.einheiten[Math.min(S.mieter.length, S.einheiten.length - 1)] || {}).id || '', name: '', strasse: '', ort: '', einzug: '', auszug: '', personen: '', vorausMonat: '', vorausGezahlt: '', verbrauch: {}, direkt: {} }); r3(); }
      if (t.dataset.add === 'kosten') { S.kosten.push({ id: uid('k'), art: '', betrag: '', schluessel: 'flaeche' }); r4(); }
      save(); bald(); return;
    }
    if (t.dataset.del) {
      const liste = S[t.dataset.del], i = +t.dataset.i;
      if (t.dataset.del === 'einheiten') {
        if (S.einheiten.length <= 1) return alert('Mindestens eine Wohnung wird benötigt.');
        const id = S.einheiten[i].id; const n = S.mieter.filter(m => m.einheitId === id).length;
        if (!confirm('Wohnung „' + (S.einheiten[i].name || '') + '“' + (n ? ' und ' + n + ' zugehörige(n) Mieter' : '') + ' entfernen?')) return;
        S.mieter = S.mieter.filter(m => m.einheitId !== id);
      } else if (!confirm('Eintrag entfernen?')) return;
      liste.splice(i, 1); r2(); r3(); r4(); save(); bald(); return;
    }
    if (t.dataset.pdf) { pdf(t.dataset.pdf); return; }
    if (t.id === 'pWeiter') { weiterZurZahlung(); return; }
    if (t.id === 'cPruef') { codePruefen(); return; }
  });

  $('bDemo').addEventListener('click', () => {
    if (!S.demo && hatEigeneDaten() && !confirm('Das Beispiel ersetzt Ihre aktuellen Eingaben. Vorher „Daten sichern“? Abbrechen = nicht ersetzen.')) return;
    const liz = S.lizenz; S = NK.demo(); if (liz) S.lizenz = liz; start();
  });
  $('bNeu').addEventListener('click', () => {
    if (hatEigeneDaten() && !S.demo && !confirm('Alle Eingaben löschen und neu beginnen?')) return;
    const liz = S.lizenz; S = NK.leer(); if (liz) S.lizenz = liz; start(); $('s1').open = true; $('s1').scrollIntoView({ behavior: 'smooth' });
  });
  $('bExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'NK-Abrechner_' + (S.objekt.strasse || 'Daten').replace(/[^\wäöüÄÖÜß-]+/g, '_') + '_' + String(S.zeitraum.bis).slice(0, 4) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });
  $('fImport').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { try { const x = JSON.parse(rd.result); if (!x || x.v !== 1 || !Array.isArray(x.einheiten)) throw new Error(); S = x; start(); } catch (err) { alert('Die Datei ist keine gültige Sicherung des NK-Abrechners.'); } };
    rd.readAsText(f); e.target.value = '';
  });
  function hatEigeneDaten() { return S.kosten.some(k => NK.numRaw(k.betrag)) || S.mieter.some(m => m.name); }

  function start() {
    S.optionen = S.optionen || { leerstandPersonen: true, zahlungsziel: 30, anpassungAb: '' };
    S.zaehler = S.zaehler || [];
    $('demoHinweis').classList.toggle('hidden', !S.demo);
    r1(); r2(); r3(); r4(); save(); rechne();
  }

  S = load();
  const qs = new URLSearchParams(location.search);
  if (qs.get('neu') === '1' && (!S || S.demo)) { const liz = S && S.lizenz; S = NK.leer(); if (liz) S.lizenz = liz; }
  if (!S || qs.get('beispiel') === '1') { const liz = S && S.lizenz; S = qs.get('beispiel') === '1' || !S ? NK.demo() : S; if (liz) S.lizenz = liz; }
  if (S.demo) { $('s5').open = true; }
  funnel('1 Seite geöffnet');
  start();
  if (S.demo && qs.get('beispiel') === '1') setTimeout(() => $('s5').scrollIntoView({ behavior: 'smooth' }), 300);
})();
