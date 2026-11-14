/* PDF-Erzeugung (jsPDF + AutoTable, läuft komplett im Browser) */
(function () {
  'use strict';
  const C = window.NK_CONFIG;
  const eur = NK.eur, zahl = NK.zahl, fd = NK.fmtDatum;
  const GRAU = [90, 98, 110], AKZENT = [30, 70, 120];

  function heute() { const x = new Date(); return ('0' + x.getDate()).slice(-2) + '.' + ('0' + (x.getMonth() + 1)).slice(-2) + '.' + x.getFullYear(); }
  function isoPlusTage(n) { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }

  function wasserzeichen(doc) {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.saveGraphicsState();
      try { doc.setGState(new doc.GState({ opacity: 0.16 })); } catch (e) {}
      doc.setTextColor(200, 30, 30); doc.setFont('helvetica', 'bold'); doc.setFontSize(54);
      doc.text('MUSTER', 105, 150, { angle: 35, align: 'center' });
      doc.setFontSize(20);
      doc.text('nicht freigeschaltet – ' + C.domain, 112, 172, { angle: 35, align: 'center' });
      doc.restoreGraphicsState();
    }
  }

  function fusszeile(doc, starts) {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRAU);
      let a = 1, b = n;
      starts.forEach((st, j) => { if (i >= st) { a = st; b = (starts[j + 1] || n + 1) - 1; } });
      doc.text('Seite ' + (i - a + 1) + ' von ' + (b - a + 1), 190, 289, { align: 'right' });
      doc.text('Erstellt mit ' + C.marke + ' (' + C.domain + ')', 20, 289);
    }
  }

  function kopf(doc, s, m) {
    const v = s.vermieter || {};
    doc.setTextColor(20, 30, 45);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const rechts = [v.name, v.strasse, v.ort, v.telefon ? 'Tel. ' + v.telefon : '', v.email].filter(Boolean);
    rechts.forEach((t, i) => doc.text(String(t), 190, 20 + i * 4.4, { align: 'right' }));
    // Absenderzeile
    doc.setFontSize(7.5); doc.setTextColor(...GRAU);
    doc.text([v.name, v.strasse, v.ort].filter(Boolean).join(' · '), 20, 50);
    doc.setDrawColor(180); doc.line(20, 51.2, 105, 51.2);
    // Empfänger
    const o = s.objekt || {};
    const adr = [m.name, m.strasse || o.strasse, m.ort || o.ort].filter(Boolean);
    doc.setFontSize(10.5); doc.setTextColor(20, 30, 45);
    adr.forEach((t, i) => doc.text(String(t), 20, 58 + i * 5));
    doc.setFontSize(9.5);
    doc.text((v.ort ? String(v.ort).replace(/^\d{4,5}\s*/, '') + ', ' : '') + heute(), 190, 58, { align: 'right' });
  }

  function anrede(m) {
    const n = String(m.name || '').trim();
    if (/^herr\s/i.test(n)) return 'Sehr geehrter ' + n + ',';
    if (/^frau\s/i.test(n)) return 'Sehr geehrte ' + n + ',';
    if (/^familie\s/i.test(n)) return 'Sehr geehrte ' + n + ',';
    return 'Guten Tag' + (n ? ' ' + n : '') + ',';
  }

  function absatz(doc, text, y, size, opts) {
    doc.setFont('helvetica', (opts && opts.bold) ? 'bold' : 'normal'); doc.setFontSize(size || 9.5); doc.setTextColor(20, 30, 45);
    const zeilen = doc.splitTextToSize(text, 170);
    if (y + zeilen.length * (size || 9.5) * 0.42 > 278) { doc.addPage(); y = 22; }
    doc.text(zeilen, 20, y);
    return y + zeilen.length * (size || 9.5) * 0.42 + 2.5;
  }

  function mieterSeite(doc, s, r, erg) {
    const z = s.zeitraum, m = r.m, e = r.e;
    kopf(doc, s, m);
    let y = 92;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...AKZENT);
    doc.text('Betriebskostenabrechnung ' + String(z.bis).slice(0, 4), 20, y); y += 7;
    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 30, 45);
    const nutz = (m.einzug && m.einzug > z.von ? fd(m.einzug) : fd(z.von)) + ' – ' + (m.auszug && m.auszug < z.bis ? fd(m.auszug) : fd(z.bis));
    doc.autoTable({
      startY: y, theme: 'plain', margin: { left: 20, right: 20 }, styles: { fontSize: 9, cellPadding: 0.8, textColor: [20, 30, 45] },
      columnStyles: { 0: { cellWidth: 48, textColor: GRAU } },
      body: [
        ['Abrechnungszeitraum', fd(z.von) + ' – ' + fd(z.bis) + ' (' + erg.z.tage + ' Tage)'],
        ['Objekt', [s.objekt.bezeichnung, s.objekt.strasse, s.objekt.ort].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(', ')],
        ['Wohnung', (e.name || '') + (NK.numRaw(e.flaeche) ? ' · ' + zahl(NK.numRaw(e.flaeche)) + ' m² Wohnfläche' : '')],
        ['Ihr Nutzungszeitraum', nutz + ' (' + r.tage + ' Tage)'],
      ].concat(NK.numRaw(m.personen) ? [['Personen im Haushalt', zahl(NK.numRaw(m.personen), 0)]] : [])
    });
    y = doc.lastAutoTable.finalY + 5;
    y = absatz(doc, anrede(m), y);
    y = absatz(doc, 'hiermit erhalten Sie die Abrechnung der Betriebskosten für den oben genannten Zeitraum. Die Gesamtkosten des Hauses wurden nach den unten erläuterten Verteilerschlüsseln auf die Wohnungen verteilt; für Ihren Nutzungszeitraum ergibt sich folgender Anteil:', y);

    const rows = r.positionen.map(p => {
      const sch = NK.SCHLUESSEL[p.schluessel] || {};
      if (p.schluessel === 'direkt') return [p.art, eur(p.gesamt), 'direkt zugeordnet', '–', '–', eur(p.betrag)];
      const flaechenTage = p.einheit === 'm² × Tage' || p.einheit === 'MEA × Tage' || p.einheit === 'Einheitentage' || p.einheit === 'Personentage';
      return [p.art, eur(p.gesamt), sch.kurz + (p.einheit ? ' (' + p.einheit + ')' : ''),
        zahl(p.basis, flaechenTage ? 0 : 2), zahl(p.anteil, flaechenTage ? 0 : 2), eur(p.betrag)];
    });
    const saldoText = r.saldo > 0 ? 'Nachzahlung' : r.saldo < 0 ? 'Guthaben' : 'Ergebnis';
    const vorausText = 'abzüglich Ihrer Vorauszahlungen' + (NK.numRaw(m.vorausMonat) && (m.vorausGezahlt === '' || m.vorausGezahlt == null)
      ? ' (' + zahl(r.monate, 2) + ' Monate × ' + eur(NK.numRaw(m.vorausMonat)) + ')' : '');
    doc.autoTable({
      startY: y, margin: { left: 20, right: 20 }, theme: 'striped',
      head: [['Kostenart', 'Gesamtkosten', 'Verteilerschlüssel', 'Basis gesamt', 'Ihre Basis', 'Ihr Anteil']],
      body: rows,
      foot: [
        [{ content: 'Summe Ihrer Betriebskosten', colSpan: 5 }, eur(r.summe)],
        [{ content: vorausText, colSpan: 5 }, '- ' + eur(r.voraus)],
        [{ content: saldoText, colSpan: 5, styles: { fontStyle: 'bold' } }, { content: eur(Math.abs(r.saldo)), styles: { fontStyle: 'bold' } }]
      ],
      styles: { fontSize: 8.2, cellPadding: 1.6, textColor: [20, 30, 45], lineColor: [220, 225, 232] },
      headStyles: { fillColor: AKZENT, textColor: 255, fontSize: 8 },
      footStyles: { fillColor: [238, 242, 247], textColor: [20, 30, 45], halign: 'right' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 50 }, 1: { halign: 'right', cellWidth: 23 }, 2: { cellWidth: 34 }, 3: { halign: 'right', cellWidth: 21 }, 4: { halign: 'right', cellWidth: 19 }, 5: { halign: 'right', cellWidth: 23 } },
      didParseCell: c => { if (c.section === 'foot' && c.column.index === 0) c.cell.styles.halign = 'left'; }
    });
    y = doc.lastAutoTable.finalY + 6;

    const v = s.vermieter || {}, opt = s.optionen || {};
    const ziel = NK.numRaw(opt.zahlungsziel) || 30;
    if (r.saldo > 0) {
      y = absatz(doc, 'Bitte überweisen Sie die Nachzahlung von ' + eur(r.saldo) + ' bis zum ' + fd(isoPlusTage(ziel)) + (v.iban ? ' auf folgendes Konto: ' + v.name + ', IBAN ' + v.iban + (v.bank ? ' (' + v.bank + ')' : '') : '') + '. Verwendungszweck: Betriebskosten ' + String(s.zeitraum.bis).slice(0, 4) + ', ' + (e.name || '') + '.', y, 9.5, { bold: false });
    } else if (r.saldo < 0) {
      y = absatz(doc, 'Das Guthaben von ' + eur(-r.saldo) + ' überweisen wir Ihnen innerhalb von ' + ziel + ' Tagen' + (r.ausgezogen ? ' auf Ihr uns bekanntes Konto. Falls sich Ihre Bankverbindung geändert hat, teilen Sie uns diese bitte mit.' : ' bzw. verrechnen es nach Absprache mit der nächsten Mietzahlung.'), y);
    }

    if (opt.anpassungAb && r.vorschlag) {
      const neu = NK.numRaw((m.vorausNeu !== '' && m.vorausNeu != null) ? m.vorausNeu : r.vorschlag);
      if (neu && Math.abs(neu - NK.numRaw(m.vorausMonat)) >= 1) {
        y = absatz(doc, 'Anpassung der Vorauszahlungen: Auf Grundlage dieser Abrechnung wird die monatliche Betriebskostenvorauszahlung gemäß § 560 Abs. 4 BGB ab dem ' + fd(opt.anpassungAb) + ' auf ' + eur(neu) + ' (bisher ' + eur(NK.numRaw(m.vorausMonat)) + ') angepasst.', y);
      }
    }

    if (r.co2 && r.co2.length) {
      y += 1;
      y = absatz(doc, 'Aufteilung der CO2-Kosten (Kohlendioxidkostenaufteilungsgesetz)', y, 9.5, { bold: true });
      r.co2.forEach(c => {
        y = absatz(doc, 'Der CO2-Ausstoß des Gebäudes beträgt ' + zahl(c.kgm2, 1) + ' kg CO2 je m² Wohnfläche und Jahr (Stufe ' + c.stufe + ' von 10 nach der Anlage zum CO2KostAufG). ' +
          'Von den CO2-Kosten in Höhe von ' + eur(c.kosten) + ' trägt der Vermieter ' + c.vProz + ' % = ' + eur(c.vermieter) + '; dieser Betrag wurde vor der Verteilung von den ' + c.art + ' abgezogen. ' +
          'Auf Sie entfallen ' + eur(c.ihrAnteil) + ' CO2-Kosten (in Ihrem Heizkostenanteil enthalten). Berechnungsgrundlage: Brennstoffrechnung (CO2-Menge und CO2-Kosten) und Gesamtwohnfläche.', y - 1, 8.6);
      });
    }

    // Erläuterung der Schlüssel
    const benutzt = [];
    r.positionen.forEach(p => { if (benutzt.indexOf(p.schluessel) < 0) benutzt.push(p.schluessel); });
    const erkl = {
      flaeche: 'Wohnfläche: Anteil Ihrer Wohnfläche an der Gesamtwohnfläche (' + zahl(s.einheiten.reduce((a, x) => a + NK.numRaw(x.flaeche), 0)) + ' m²), zeitanteilig nach Tagen.',
      personen: 'Personen: Anzahl der Bewohner multipliziert mit den Tagen der Nutzung (Personentage)' + ((s.optionen || {}).leerstandPersonen === false ? '.' : '; leerstehende Zeiträume werden mit 1 Person zulasten des Vermieters angesetzt.'),
      einheiten: 'Wohneinheiten: gleicher Anteil je Wohnung (' + s.einheiten.length + ' Wohnungen), zeitanteilig nach Tagen.',
      mea: 'Miteigentumsanteile: Anteil laut Teilungserklärung, zeitanteilig nach Tagen.',
      verbrauch: 'Verbrauch: Anteil Ihres abgelesenen Verbrauchs am Gesamtverbrauch aller Nutzer.',
      heizung: 'Heizkosten nach Heizkostenverordnung: Grundkosten nach Wohnfläche (zeitanteilig), Verbrauchskosten nach erfasstem Verbrauch.',
      direkt: 'Direkte Zuordnung: Betrag wurde Ihnen direkt zugeordnet (z. B. laut Einzelabrechnung des Messdienstes).'
    };
    y += 1;
    y = absatz(doc, 'Erläuterung der Verteilerschlüssel', y, 9.5, { bold: true });
    benutzt.forEach(k => { y = absatz(doc, '• ' + erkl[k], y - 1, 8.6); });
    const leerTage = Object.keys(erg.leerstand).reduce((a, k) => a + erg.leerstand[k], 0);
    if (leerTage) y = absatz(doc, 'Kostenanteile für leerstehende Zeiträume trägt der Vermieter; sie sind in Ihrem Anteil nicht enthalten.', y - 1, 8.6);

    if (r.p35a.dienst || r.p35a.handwerk) {
      y += 1;
      y = absatz(doc, 'Bescheinigung für Ihre Steuererklärung (§ 35a EStG)', y, 9.5, { bold: true });
      const t = [];
      if (r.p35a.dienst) t.push('haushaltsnahe Dienstleistungen (z. B. Reinigung, Gartenpflege, Hauswart): ' + eur(r.p35a.dienst));
      if (r.p35a.handwerk) t.push('Handwerkerleistungen (z. B. Wartung, Schornsteinfeger): ' + eur(r.p35a.handwerk));
      y = absatz(doc, 'Auf Sie entfallen folgende Arbeits- und Fahrtkosten, die Sie ggf. steuerlich geltend machen können: ' + t.join('; ') + '. Die Aufteilung erfolgte nach demselben Schlüssel wie die jeweilige Kostenart.', y - 1, 8.6);
    }

    y += 1;
    y = absatz(doc, 'Die Rechnungen und Belege zu dieser Abrechnung können Sie nach vorheriger Terminabsprache bei uns einsehen. Einwendungen gegen die Abrechnung teilen Sie uns bitte spätestens bis zum Ablauf des zwölften Monats nach Zugang dieser Abrechnung mit (§ 556 Abs. 3 BGB).', y, 8.6);
    y += 3;
    y = absatz(doc, 'Mit freundlichen Grüßen', y);
    y += 8;
    if (y > 280) { doc.addPage(); y = 30; }
    doc.setDrawColor(150); doc.line(20, y, 80, y);
    doc.setFontSize(8.5); doc.setTextColor(...GRAU); doc.text(v.name || 'Vermieter/in', 20, y + 4);
  }

  function uebersicht(doc, s, erg) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...AKZENT);
    doc.text('Gesamtübersicht für den Vermieter', 20, 22);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20, 30, 45);
    doc.text((s.objekt.bezeichnung || s.objekt.strasse || '') + ' · Zeitraum ' + fd(s.zeitraum.von) + ' – ' + fd(s.zeitraum.bis) + ' · nur für Ihre Unterlagen', 20, 28);
    doc.autoTable({
      startY: 33, margin: { left: 20, right: 20 },
      head: [['Mieter', 'Wohnung', 'Tage', 'Kostenanteil', 'Vorauszahlungen', 'Ergebnis']],
      body: erg.mieter.map(r => [r.m.name || '–', r.e.name || '', String(r.tage), eur(r.summe), eur(r.voraus), (r.saldo > 0 ? 'Nachzahlung ' : r.saldo < 0 ? 'Guthaben ' : '') + eur(Math.abs(r.saldo))])
        .concat([['Vermieter (Leerstand)', '', '', eur(erg.vermieter.summe), '', '']]),
      styles: { fontSize: 8.4, cellPadding: 1.6 }, headStyles: { fillColor: AKZENT },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } }
    });
    const sMieter = erg.mieter.reduce((a, r) => a + r.summe, 0);
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 8, margin: { left: 20, right: 20 },
      head: [['Kontrolle je Kostenart', 'Gesamtkosten', 'auf Mieter verteilt', 'beim Vermieter', 'Prüfung']],
      body: erg.kontrolle.map(k => [k.art, eur(k.gesamt), eur(k.mieter), eur(k.vermieter), k.ok ? 'stimmt' : 'ABWEICHUNG'])
        .concat([['Summe', eur(erg.gesamtKosten), eur(sMieter), eur(erg.vermieter.summe), Math.abs(sMieter + erg.vermieter.summe - erg.gesamtKosten) < 0.01 ? 'stimmt' : 'ABWEICHUNG']]),
      styles: { fontSize: 8.4, cellPadding: 1.6 }, headStyles: { fillColor: [80, 90, 105] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } }
    });
    if (erg.warnungen.length) {
      let y = doc.lastAutoTable.finalY + 8;
      y = absatz(doc, 'Hinweise', y, 9.5, { bold: true });
      erg.warnungen.forEach(w => { y = absatz(doc, '• ' + w, y - 1, 8.6); });
    }
  }

  function dateiname(s, zusatz) {
    const b = String((s.objekt && (s.objekt.strasse || s.objekt.bezeichnung)) || 'Objekt').replace(/[^\wäöüÄÖÜß-]+/g, '_').slice(0, 40);
    return 'Betriebskostenabrechnung_' + String(s.zeitraum.bis).slice(0, 4) + '_' + b + (zusatz ? '_' + String(zusatz).replace(/[^\wäöüÄÖÜß-]+/g, '_').slice(0, 30) : '') + '.pdf';
  }

  /* nur: Index eines Mieters (oder null = alle + Übersicht) */
  function erstelle(s, freigeschaltet, nur) {
    const { jsPDF } = window.jspdf;
    const erg = NK.berechne(s);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    // Standardschrift kennt keine hochgestellten Ziffern -> m² / m³ ersetzen
    const san = x => typeof x === 'string' ? x.replace(/m²/g, 'qm').replace(/m³/g, 'cbm').replace(/²/g, '2').replace(/³/g, '3') : Array.isArray(x) ? x.map(san) : x;
    const orig = doc.text.bind(doc);
    doc.text = function (txt) { const a = Array.prototype.slice.call(arguments); a[0] = san(txt); return orig.apply(null, a); };
    doc.setProperties({ title: 'Betriebskostenabrechnung', creator: C.marke });
    const liste = nur == null ? erg.mieter : [erg.mieter[nur]];
    const starts = [];
    liste.forEach((r, i) => { if (i > 0) doc.addPage(); starts.push(doc.getNumberOfPages()); mieterSeite(doc, s, r, erg); });
    if (nur == null) { doc.addPage(); starts.push(doc.getNumberOfPages()); uebersicht(doc, s, erg); }
    fusszeile(doc, starts);
    if (!freigeschaltet) wasserzeichen(doc);
    return { doc, name: dateiname(s, nur == null ? '' : (liste[0].m.name || 'Mieter')) };
  }

  window.NKPDF = { erstelle };
})();
