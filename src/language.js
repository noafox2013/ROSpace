const translations = [
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
  ['Violetter Kristall', 'Purple crystal'], ['Stein', 'Rock'], ['Selten', 'Rare'],
  ['Noch nicht gesammelt', 'Not collected yet'],
  ['Der Sandwurm hat dich mit seinem Maul erwischt.', 'The sandworm caught you in its mouth.'],
  ['Du wurdest vom Sandwurm tödlich verletzt.', 'The sandworm fatally injured you.'],
  ['DER FLUCH DES SANDWURMS HAT SICH ÜBER DICH GELEGT, DU WIRST NIE GUT ERWACHEN', 'THE CURSE OF THE SANDWORM HAS FALLEN UPON YOU, YOU WILL NEVER WAKE WELL'],
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
