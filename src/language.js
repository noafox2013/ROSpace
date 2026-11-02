const translations = [
  ['W · Steigen · S · Landen', 'W · Ascend · S · Land'],
  ['W · Abheben · F · Aussteigen', 'W · Take off · F · Exit'],
  ['W · Abheben und schweben · F · Aussteigen', 'W · Take off and hover · F · Exit'],
  ['W · Abheben und schweben · P · Ansicht wechseln · F · Aussteigen', 'W · Take off and hover · P · Switch view · F · Exit'],
  ['W · Abheben und schweben · Linksklick · Schießen · P · Ansicht wechseln · F · Aussteigen', 'W · Take off and hover · Left click · Fire · P · Switch view · F · Exit'],
  ['Hebt ab … · S · Landen', 'Taking off … · S · Land'],
  ['Landet …', 'Landing …'],
  ['W · Vorwärts fliegen · S · Landen', 'W · Fly forward · S · Land'],
  ['Maus · Lenken · W · Vorwärts fliegen · S · Landen', 'Mouse · Steer · W · Fly forward · S · Land'],
  ['Maus · Lenken · W · Schub · Leertaste · Bremsen · S · Landen', 'Mouse · Steer · W · Thrust · Space · Brake · S · Land'],
  ['Maus · Lenken · W · Schub · Leertaste · Bremsen · S · Landen · P · Ansicht wechseln', 'Mouse · Steer · W · Thrust · Space · Brake · S · Land · P · Switch view'],
  ['Maus · Lenken · Linksklick · Schießen · W · Schub · Leertaste · Bremsen · S · Landen · P · Ansicht wechseln', 'Mouse · Steer · Left click · Fire · W · Thrust · Space · Brake · S · Land · P · Switch view'],
  ['Cockpithaube schließt sich …', 'Cockpit canopy closing …'],
  ['Cockpithaube öffnet sich …', 'Cockpit canopy opening …'],
  ['F · In Raumschiff einsteigen', 'F · Board spacecraft'],
  ['F · Raumschiff verlassen', 'F · Exit spacecraft'],
  ['Raumschiff · Kestrel 09', 'Spacecraft · Kestrel 09'],
  ["F · Beschädigten Terminal lesen", "F · Read damaged terminal"],
  ["KEPLER / 07 · NOTFALLARCHIV", "KEPLER / 07 · EMERGENCY ARCHIVE"],
  ["Letzter Eintrag", "Last entry"],
  ["Tag 184. Der Sandsturm hat die Solarmodule zerstört. Staub ist in die Kühlung eingedrungen; der Hauptreaktor wurde abgeschaltet.", "Day 184. The sandstorm destroyed the solar arrays. Dust entered the cooling system; the main reactor was shut down."],
  ["Unter der Station registrierten die Sensoren gewaltige Bewegungen. Kurz darauf brach die Kommunikation ab. Die Besatzung evakuierte zur planetarischen Basis.", "Sensors recorded massive movement beneath the station. Communications failed shortly afterwards. The crew evacuated to the planetary base."],
  ["Die Luftschleuse wurde versiegelt. Wartungszugang nur mit Pass-Key. Dieser Terminal läuft auf der letzten Notstromreserve.", "The airlock was sealed. Maintenance access requires a pass key. This terminal is running on the last emergency power reserve."],
  ["ARCHIV BESCHÄDIGT · WEITERE DATEN NICHT LESBAR", "ARCHIVE DAMAGED · REMAINING DATA UNREADABLE"],

  ['F · Tür mit Pass-Key aufschließen', 'F · Unlock door with pass key'],
  ['Verlassenes Gebäude', 'Abandoned building'],
  ['Verschlossen · Pass-Key am Handelsterminal kaufen', 'Locked · Buy a pass key at the trading terminal'],
  ['Pass-Key erkannt · Zugang freigegeben', 'Pass key recognized · Access granted'],
  ['Pass-Key · Verlassenes Gebäude', 'Pass key · Abandoned building'],
  ['Umgebung wird gescannt …', 'Scanning surroundings …'],
  ['Scan abgeschlossen', 'Scan complete'],
  ['Kristall', 'Crystal'], ['Stein', 'Rock'], ['Sandwurm', 'Sandworm'],
  ['Screenshotmodus · Linksklick: Bild speichern · O: Zurück', 'Screenshot mode · Left click: Save image · O: Back'],
  ['Screenshot gespeichert.', 'Screenshot saved.'],
  ['Screenshot konnte nicht gespeichert werden.', 'Screenshot could not be saved.'],
  ['DER SANDSTURM HAT SICH VERZOGEN', 'THE SANDSTORM HAS PASSED'],
  ['HEFTIGER SANDSTURM NÄHERT SICH, BITTE SOFORT SCHUTZ FINDEN!!!', 'SEVERE SANDSTORM APPROACHING, FIND SHELTER IMMEDIATELY!!!'],
  ['Spielsounds', 'Game sounds'],
  ['Das Wurmhorn funktioniert nur, wenn der Sandwurm da ist.', 'The worm horn only works while the sandworm is present.'],
  ['Auswählen und F drücken · Verjagt den Sandwurm', 'Select and press F · Banishes the sandworm'],
  ['DU HAST DEN FLUCH ÜDERWUNDEN UND HAST DEN SANDWURM VERJAGT, DU BIST FREI', 'YOU HAVE OVERCOME THE CURSE AND BANISHED THE SANDWORM, YOU ARE FREE'],
  ['4 Gegenstände', '4 items'], ['Wurmhorn', 'Worm horn'], ['Am Handelsterminal gekauft.', 'Purchased at the trading terminal.'],
  ['Du schläfst.', 'You are sleeping.'],
  ['3 Gegenstände', '3 items'], ['Dabei', 'Carried'], ['Schlafsack', 'Sleeping bag'],
  ['Schlafe durch die Nacht bis zum nächsten Morgen.', 'Sleep through the night until the next morning.'],
  ['Auswählen und F drücken · Nur nachts', 'Select and press F · Night only'],
  ['Lande zuerst, um den Schlafsack zu benutzen.', 'Land before using the sleeping bag.'],
  ['Du kannst den Schlafsack nur nachts benutzen.', 'You can only use the sleeping bag at night.'],
  ['F · Aufstehen', 'F · Stand up'],
  ['F · Handelsterminal öffnen', 'F · Open trading terminal'],
  ['MESA · Handelsterminal', 'MESA · Trading terminal'],
  ['Tausche Rohstoffe gegen Vorräte und dauerhafte Upgrades.', 'Exchange resources for supplies and permanent upgrades.'],
  ['Schließen', 'Close'], ['Kauf erfolgreich.', 'Purchase successful.'], ['Kauf nicht möglich.', 'Purchase unavailable.'],
  ['Kompass', 'Compass'],
  ['Spielnachrichten', 'Game messages'],
  ['Noch keine Spielnachrichten.', 'No game messages yet.'],
  ['Aktueller Speicherplatz', 'Current save slot'],
  ['Spielstand löschen?', 'Delete saved game?'],
  ['Spielstand auswählen · C zum Löschen', 'Select a saved game · C to delete'],
  ['Löschen fehlgeschlagen. Bitte versuche es erneut.', 'Deletion failed. Please try again.'],
  ['Spielstand auswählen', 'Choose saved game'],
  ['Speicherplatz (1–10) · Belegte Plätze werden überschrieben', 'Save slot (1–10) · Occupied slots will be overwritten'],
  ['Sprache', 'Language'], ['Spiel pausiert', 'Game paused'],
  ['Weiterspielen', 'Resume'], ['Name des Spielstands', 'Save name'],
  ['Speichern & beenden', 'Save & Quit'],
  ['Spielstände werden in diesem Browser gespeichert.', 'Saved games are stored in this browser.'],
  ['Spiel gespeichert.', 'Game saved.'],
  ['Speichern fehlgeschlagen. Bitte erlaube dem Browser das Speichern lokaler Daten.', 'Saving failed. Please allow the browser to store local data.'],
  ['Spielstand laden', 'Load game'], ['Mein Spielstand', 'My saved game'],
  ['Dieser Spielstand konnte nicht geladen werden.', 'This saved game could not be loaded.'],
  ['Spiel gespeichert und beendet. Du kannst deinen Spielstand später laden.', 'Game saved and closed. You can load your saved game later.'],
  ['Neues Spiel', 'New game'], ['Leben', 'Health'], ['Lebenspunkte', 'Health points'],
  ['Stein zerstören', 'Destroy rock'], ['Kristall abbauen', 'Mine crystal'],
  ['Fortschritt der Steinzerstörung', 'Rock destruction progress'],
  ['Dein Inventar', 'Your inventory'], ['Inventar schließen', 'Close inventory'],
  ['Alles, was du bei deiner Erkundung dabei hast.', 'Everything you carry on your expedition.'],
  ['Ausrüstung', 'Equipment'], ['2 ausgerüstet', '2 equipped'], ['Ausgerüstet', 'Equipped'],
  ['Baue Steine und Kristalle ab.', 'Mine rocks and crystals.'],
  ['Linke Maustaste · G wechselt den Modus', 'Left mouse button · G changes mode'],
  ['Erreiche neue Höhen.', 'Reach new heights.'], ['Leertaste halten zum Fliegen', 'Hold Space to fly'],
  ['Rohstoffe', 'Resources'], ['oder', 'or'], ['zum Schließen', 'to close'],
  ['Violetter Kristall', 'Purple crystal'], ['Blauer Kristall', 'Blue crystal'], ['Stein', 'Rock'], ['Selten', 'Rare'],
  ['Noch nicht gesammelt', 'Not collected yet'],
  ['Der Sandwurm hat dich mit seinem Maul erwischt.', 'The sandworm caught you in its mouth.'],
  ['Der Sandtornado hat dich zu Boden geschleudert.', 'The sand tornado slammed you into the ground.'],
  ['Du wurdest vom Sandwurm tödlich verletzt.', 'The sandworm fatally injured you.'],
  ['DER FLUCH DES SANDWURMS HAT SICH ÜBER DICH GELEGT, DU WIRST NIE GUT ERWACHEN', 'THE CURSE OF THE SANDWORM HAS FALLEN UPON YOU, YOU WILL NEVER WAKE WELL'],
  ["Dein Raumschiff ist abgestürzt. Lies das Notfallarchiv im verlassenen Gebäude, berge den Treibstofftank und sammle 30 Kristalle plus 20 blaue Kristalle für die Reparatur.", "Your spacecraft has crashed. Read the emergency archive in the abandoned building, recover the fuel tank and collect 30 crystals plus 20 blue crystals for repairs."],
  ["Das versiegelte Wartungsfach enthält noch einen unbeschädigten Treibstofftank. Nach dem Lesen dieses Eintrags kann er für die Reparatur eines Raumschiffs geborgen werden.", "The sealed maintenance locker still contains an intact fuel tank. After reading this entry, you can recover it to repair a spacecraft."],
  ["Eintrag gelesen · Treibstofftank bergen", "Entry read · Recover fuel tank"],
  ["Treibstofftank", "Fuel tank"],
  ["Geborgen", "Recovered"],
  ["Aus dem verlassenen Gebäude.", "From the abandoned building."],
  ["Reparatur: Treibstofftank + 30 Kristalle + 20 blaue Kristalle · F am Raumschiff", "Repair: fuel tank + 30 crystals + 20 blue crystals · F at the spacecraft"],
  ["Raumschiff repariert · Bereit zum Abheben", "Spacecraft repaired · Ready for takeoff"],
  ["Lies das Notfallarchiv im verlassenen Gebäude und berge den Treibstofftank.", "Read the emergency archive in the abandoned building and recover the fuel tank."],
  ["Für die Reparatur brauchst du 30 Kristalle plus 20 blaue Kristalle.", "You need 30 crystals plus 20 blue crystals to repair the spacecraft."],
  ["Treibstofftank geborgen · Repariere dein Raumschiff mit 30 Kristallen plus 20 blauen Kristallen.", "Fuel tank recovered · Repair your spacecraft with 30 crystals plus 20 blue crystals."],
  ["5 Gegenstände", "5 items"],
  ["F · Raumschiff reparieren · Treibstofftank + 30 Kristalle + 20 blaue Kristalle", "F · Repair spacecraft · Fuel tank + 30 crystals + 20 blue crystals"],
  ['Bezahle Vorräte und Upgrades mit Cors. Verdiene Cors, indem du Rohstoffe verkaufst.', 'Pay for supplies and upgrades with Cors. Earn Cors by selling resources.'],
  ['Rohstoffe verkaufen', 'Sell resources'], ['1 Stein = 1 Cor · 1 Kristall = 5 Cors', '1 rock = 1 Cor · 1 crystal = 5 Cors'],
  ['Rohstoffe verkauft.', 'Resources sold.'], ['Verkauf nicht möglich.', 'Sale unavailable.'],
  ['Verkaufsfenster öffnen', 'Open sales window'], ['MESA · Rohstoffe verkaufen', 'MESA · Sell resources'],
  ['Verkaufe deine Rohstoffe und erhalte Cors.', 'Sell your resources to earn Cors.'], ['Zurück zum Handel', 'Back to trading'],
  ['F · Archivterminal aktivieren · 50 Cors', 'F · Activate archive terminal · 50 Cors'],
  ['F · Notfallarchiv lesen', 'F · Read emergency archive'],
  ['Zur Aktivierung des Archivterminals brauchst du 50 Cors.', 'You need 50 Cors to activate the archive terminal.'],
  ['Du wurdest beim Sturz tödlich verletzt.', 'You were fatally injured in the fall.'],
  ['Weltraum-Wachturm', 'Space watchtower'], ['F · Wachturm-Terminal aktivieren', 'F · Activate watchtower terminal'],
  ['AEGIS / 04 · DÜNENWACHT', 'AEGIS / 04 · DUNE WATCH'], ['Wachturm-Terminal', 'Watchtower terminal'],
  ['Terminal bereit', 'Terminal ready'], ['Wähle ein Modul.', 'Choose a module.'],
  ['Scan-Modul auswählen', 'Select scan module'], ['Trasure Scan ausgewählt.', 'Trasure Scan selected.'],
  ['Space-Schatztruhe', 'Space treasure chest'], ['Landestütze', 'Landing strut'],
  ['Fundstelle anzeigen', 'Show dig site'],
  ['F · Space-Aufzug nach oben', 'F · Space lift up'], ['F · Space-Aufzug nach unten', 'F · Space lift down'],
  ['F · Space-Aufzug rufen', 'F · Call space lift'], ['Aufzug fährt …', 'Lift travelling …'], ['Aufzug kommt …', 'Lift approaching …'],
  ['Aus der vergrabenen Space-Schatztruhe.', 'From the buried space treasure chest.'],
  ['Wird für die Reparatur des Raumschiffs benötigt.', 'Required to repair the spacecraft.'],
  ['Reparatur: Treibstofftank + Landestütze + 30 Kristalle + 20 blaue Kristalle · F am Raumschiff', 'Repair: fuel tank + landing strut + 30 crystals + 20 blue crystals · F at the spacecraft'],
  ['Dein Raumschiff ist abgestürzt. Berge den Treibstofftank aus dem verlassenen Gebäude und finde mit dem Wachturm die Landestütze in einer vergrabenen Space-Schatztruhe. Für die Reparatur brauchst du außerdem 30 Kristalle plus 20 blaue Kristalle.', 'Your spacecraft has crashed. Recover the fuel tank from the abandoned building and use the watchtower to find the landing strut in a buried space treasure chest. Repairs also require 30 crystals plus 20 blue crystals.'],
  ['Nutze Trasure Scan im Wachturm und berge die Landestütze aus der Space-Schatztruhe.', 'Use Trasure Scan in the watchtower and recover the landing strut from the space treasure chest.'],
  ['Scan abgeschlossen · Space-Schatztruhe markiert.', 'Scan complete · Space treasure chest marked.'],
  ['Space-Schatztruhe wird ausgegraben …', 'Excavating space treasure chest …'],
  ['Landestütze geborgen · Für die Reparatur des Raumschiffs.', 'Landing strut recovered · Required to repair the spacecraft.'],
  ['Treibstofftank geborgen · Zusätzlich brauchst du die Landestütze aus der Schatztruhe und 30 Kristalle plus 20 blaue Kristalle.', 'Fuel tank recovered · You also need the landing strut from the treasure chest and 30 crystals plus 20 blue crystals.'],
  ['6 Gegenstände', '6 items'],
];
const patterns = [
  [/^Spielstand laden: (.*)$/s, /^Load game: (.*)$/s, 'Spielstand laden: ', 'Load game: '],
  [/^(\d+) gesammelt$/, /^(\d+) collected$/, '', '', ' gesammelt', ' collected'],
  [/^(\d+) Stück$/, /^(\d+) items$/, '', '', ' Stück', ' items'],
];

export function setupLanguage() {
  const select = document.querySelector('#language-select');
  let language = 'de';
  try { if (localStorage.getItem('rust-mesa-language') === 'en') language = 'en'; } catch { /* Session preference still works. */ }

  function translate(value) {
    const trimmed = value.trim();
    const pair = translations.find(([de, en]) => trimmed === de || trimmed === en);
    let translated = pair?.[language === 'en' ? 1 : 0];
    if (!pair) {
      for (const [de, en, dePrefix, enPrefix, deSuffix = '', enSuffix = ''] of patterns) {
        const match = trimmed.match(de) || trimmed.match(en);
        if (match) {
          translated = language === 'en' ? enPrefix + match[1] + enSuffix : dePrefix + match[1] + deSuffix;
          break;
        }
      }
    }
    return translated === undefined ? value : value.replace(trimmed, translated);
  }

  function update(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentElement?.closest('script, style, option')) return;
      const value = translate(node.nodeValue);
      if (value !== node.nodeValue) node.nodeValue = value;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      for (const attribute of ['aria-label', 'alt']) {
        if (node.hasAttribute(attribute)) {
          const value = translate(node.getAttribute(attribute));
          if (value !== node.getAttribute(attribute)) node.setAttribute(attribute, value);
        }
      }
      for (const child of node.childNodes) update(child);
    }
  }

  function apply() {
    document.documentElement.lang = language;
    select.value = language;
    update(document.body);
    for (const option of document.querySelectorAll('#save-slot option')) {
      option.textContent = option.textContent.replace(/ · (Leer|Empty)$/, language === 'en' ? ' · Empty' : ' · Leer');
    }
    const name = document.querySelector('#save-name');
    name.value = translate(name.value);
  }
  select.addEventListener('change', () => {
    language = select.value;
    try { localStorage.setItem('rust-mesa-language', language); } catch { /* Keep the selection for this session. */ }
    apply();
  });
  apply();
  // Game messages and resource counts can change while playing.
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData' || record.type === 'attributes') update(record.target);
      else for (const node of record.addedNodes) update(node);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'alt'] });
}
