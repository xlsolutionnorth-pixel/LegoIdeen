# Baustein-Ideen 🧱

Eine Android-App für Kinder (6–9 Jahre):

1. **Foto machen** von einem Haufen Bausteine auf dem Boden
2. Die App **erkennt die Steine** und zeigt, welche sie gefunden hat. Das landet in deiner Sammlung, und mehrere Fotos werden zusammengezählt.
3. Auf **„Neues Design“** tippen: Die App zeigt mit kleinen Vorschaubildern, welche Figuren du mit deinen Steinen bauen kannst.
4. Eine Figur antippen und eine **3D-Bauanleitung** erscheint: Stein für Stein, mit dem Finger drehbar.

Dazu gibt es eine **Merkliste** (Herz und „schon gebaut“) und eine Seite **„Meine Steine“**, auf der du die Sammlung von Hand ändern kannst.

---

## So bekommst du die App auf dein Handy

Du brauchst nur einen kostenlosen GitHub-Account. GitHub baut die App automatisch für dich.

### Schritt 1: GitHub-Konto und neues Repository

1. Gehe auf <https://github.com> und melde dich an (oder registriere dich kostenlos).
2. Klicke oben rechts auf **„+“** und dann auf **„New repository“**.
3. Gib als Namen z. B. `baustein-ideen` ein.
4. Wähle **Public** oder **Private**. Beides geht.
5. Setze **keinen** Haken bei „Add a README file“.
6. Klicke auf **„Create repository“**.

### Schritt 2: Dateien hochladen

1. Entpacke die ZIP-Datei `baustein-ideen.zip` auf deinem Computer.
2. Klicke im neuen Repository auf den Link **„uploading an existing file“**.
3. Öffne den entpackten Ordner `baustein-ideen` und **ziehe seinen gesamten Inhalt** (alle Ordner und Dateien) in das Browserfenster.
   - Am Mac sind Ordner mit Punkt am Anfang (`.github`) versteckt. Drücke im Finder **⌘ + Shift + .**, um sie anzuzeigen.
4. Warte, bis alle Dateien geladen sind, und klicke unten auf **„Commit changes“**.

> **Wichtig:** Prüfe danach, ob im Repository der Ordner **`.github`** zu sehen ist.
> Fehlt er, lege die Datei von Hand an:
> **Add file → Create new file**, als Namen `.github/workflows/build-apk.yml` eintippen (die Schrägstriche erzeugen die Ordner),
> den Inhalt der gleichnamigen Datei aus der ZIP hineinkopieren und auf **„Commit changes“** klicken.

### Schritt 3: GitHub baut die App

1. Klicke oben im Repository auf **„Actions“**.
2. Dort läuft der Vorgang **„APK bauen“**. Er dauert etwa 3–6 Minuten.
3. Ein grüner Haken ✅ heißt: fertig!
   - Läuft nichts? Klicke links auf **„APK bauen“** und dann rechts auf **„Run workflow“**.

### Schritt 4: APK aufs Handy laden

**Am einfachsten direkt auf dem Handy:**

1. Öffne auf dem Handy die Seite deines Repositorys (bei einem privaten Repository vorher anmelden).
2. Tippe auf **„Releases“** (rechts oder ganz unten) und dann auf die neueste Version.
3. Tippe auf **`Baustein-Ideen.apk`**, um sie herunterzuladen.

**Oder über den Computer:** Unter *Actions → letzter Lauf → Artifacts* findest du `Baustein-Ideen-APK` als ZIP. Entpacke es und kopiere die APK aufs Handy.

### Schritt 5: Installieren

1. Öffne die heruntergeladene Datei `Baustein-Ideen.apk`.
2. Android fragt, ob du Apps aus dieser Quelle erlauben möchtest. Tippe auf **Einstellungen → Erlauben** und dann auf **Installieren**.
3. Eventuell warnt Google Play Protect, weil die App nicht aus dem Play Store kommt. Tippe auf **„Trotzdem installieren“**.

Fertig! 🎉

---

## Updates

Jedes Mal, wenn du im Repository eine Datei änderst, baut GitHub automatisch eine neue Version. Die neue APK kannst du einfach über die alte installieren, deine Steinesammlung bleibt erhalten.

## Gut zu wissen

- **Die Erkennung braucht Internet.** Sie nutzt den kostenlosen Dienst [Brickognize](https://brickognize.com). Die App schickt dafür kleine Bildausschnitte an den Dienst. Sammlung, Favoriten usw. bleiben nur auf dem Handy.
- **Ein Haufen ist schwierig:** Steine, die sich berühren oder übereinander liegen, sieht die App als einen einzigen. Die besten Ergebnisse gibt es, wenn die Steine etwas auseinanderliegen, auf einem hellen, einfarbigen Untergrund, von oben fotografiert. Falsch erkannte Steine kannst du nach dem Foto in der Liste ändern.
- **Farben:** Für die Bauideen zählt nur die Form der Steine, nicht die Farbe. Die Farben in der Anleitung sind Vorschläge.
- **Welche Steine kennt die App?** Klassische Steine (1×1 bis 2×8), Platten, Dachsteine 45°, Fliesen sowie runde 1×1-Steine und -Platten. Andere erkannte Teile werden als „Sonderteile“ gespeichert.
- Die App funktioniert ab **Android 8**.

## Eigene Figuren hinzufügen

Die Figuren stehen in `app/src/main/assets/www/js/models.js`. Jede Zeile ist ein Bauschritt:

```js
['3001', 0, 0, 3, 'R', 0],   // Teil, x, z (nach vorne), Höhe in Platten, Farbe, Drehung
```

Beim Bauen auf GitHub prüft `tools/validate-models.js` automatisch, ob jeder Stein richtig aufsitzt und sich nichts überschneidet.

## Aufbau des Projekts

| Ordner / Datei | Inhalt |
|---|---|
| `app/src/main/assets/www/` | Die eigentliche App (HTML, CSS, JavaScript, eigener 3D-Renderer) |
| `app/src/main/java/.../MainActivity.java` | Android-Teil: Kamera, Galerie, Erkennung, Speicher |
| `.github/workflows/build-apk.yml` | Bauanleitung für GitHub (erzeugt die APK) |
| `tools/validate-models.js` | Prüft die Figuren-Bibliothek |
| `app/debug.keystore` | Schlüssel, damit Updates die alte App ersetzen können |

**Testen im Browser:** Öffne `app/src/main/assets/www/index.html?demo=1`. Im Demo-Modus wird die Erkennung simuliert.
