Die Regeln für den **Gelegenheits-Handel** (*casual trading opportunities*) sind in Kapitel 11: Trading Rules des *Death on the Reik Companion* dargelegt.

Hier ist der algorithmische Ablauf, den Sie als Spielleiter befolgen können, wenn Ihre Spieler Waren kaufen oder verkaufen möchten:

---

## I. Algorithmus: Waren kaufen (Buying)

Dieser Prozess bestimmt, ob in der Siedlung Fracht verfügbar ist, welcher Art und zu welchem Preis.

### Schritt 0: Siedlungsinformationen festlegen

Bestimmen Sie für die aktuelle Siedlung die folgenden Werte aus dem Gazetteer:

1.  **Größen-Rating (Size)** 
2.  **Wohlstands-Rating (Wealth)**
3.  **Produziert (Produces)** (Liste der Güter oder "Trade").

### Schritt 1: Verfügbarkeit prüfen

1.  **Basis-Chance berechnen:** Addieren Sie das Größen-Rating und das Wohlstands-Rating. Multiplizieren Sie die Summe mit 10, um die prozentuale Chance auf eine verfügbare Ladung zu erhalten.
2.  **Würfeln:** Würfeln Sie 1W100.
    *   Wenn das Ergebnis **kleiner oder gleich** der berechneten Chance ist, ist eine Ladung verfügbar.

### Schritt 2: Art und Menge der Ladung bestimmen

#### A. Art der Ladung (Type of Cargo)
1.  Wenn die Siedlung **spezifische Massengüter** im Feld "Produces" listet, ist dies die Ladung.
2.  Wenn nur **"Trade"** gelistet ist oder mehr als ein Gut, wählen Sie zufällig oder würfeln Sie auf der **Cargo Table** (beachten Sie die Jahreszeit).
3.  *Sonderfall Handelszentren:* Siedlungen, die "Trade" *und* mindestens ein weiteres Gut führen, haben die Chance auf **zwei** verfügbare Ladungen (ein lokales Gut und ein zufälliges).

#### B. Größe der Ladung (Size of Cargo in Encumbrance Points)
1.  **Basiswert:** Addieren Sie das Größen-Rating und das Wohlstands-Rating der Siedlung.
2.  **Multiplikator:** Würfeln Sie 1W100 und runden Sie das Ergebnis auf die nächste 10 auf (z. B. 36 wird zu 40).
3.  **Gesamtgröße:** Multiplizieren Sie den Basiswert mit dem Multiplikator.
4.  *Sonderfall Handelszentren:* Wenn die Siedlung ihren Wohlstand aus "Trade" bezieht, kehren Sie das 1W100-Ergebnis um und wählen den höheren der beiden möglichen Multiplikatoren.

### Schritt 3: Preis verhandeln

1.  **Basispreis festlegen:** Bestimmen Sie den Preis (in Gold-Kronen pro 10 Encumbrance Points) anhand der **Base Price Table** (beachten Sie die Jahreszeit und, falls zutreffend, die gesonderten Regeln für Wein und Brandy).
2.  **Teilkäufe:** Wenn die SCs nicht die gesamte verfügbare Ladung kaufen, **erhöhen** Sie den Basispreis pro 10 EP um **10 %**.
3.  **Feilschen (Haggle Test):** Der interessierte SC kann einen vergleichenden *Haggle Test* gegen den Händler (typischerweise FW 32–52) ablegen.
4.  **Endpreis:** Bei Erfolg wird der Preis um **10 %** gesenkt (oder bis zu 20 % mit dem Talent *Dealmaker*).

---

## II. Algorithmus: Waren verkaufen (Selling)

Der Verkaufsprozess folgt der Suche nach der lokalen Nachfrage und dem Feilschen um den Preis.

### Schritt 1: Verkaufsberechtigung prüfen (nicht relevant für Modul)

1.  **Ort:** Die Charaktere können die Ware **niemals an dem Ort verkaufen, an dem sie sie gekauft haben**.
2.  **Zeit:** Alternativ müssen sie mindestens eine Woche warten, bevor sie am selben Ort einen Käufer suchen.

### Schritt 2: Nachfrage feststellen / Käufer finden

1.  **Chance berechnen:**
    *   Multiplizieren Sie das **Größen-Rating** der Siedlung mit 10.
    *   Addieren Sie **+30**, wenn die Siedlung **"Trade"** im Feld "Produces" listet.
2.  **Würfeln:** Würfeln Sie 1W100.
    *   Wenn das Ergebnis $\le$ der berechneten Chance ist, wird ein Käufer gefunden.
3.  **Scheitern:** Wenn kein Käufer gefunden wird, können die SCs versuchen, nur die **Hälfte** ihrer Ladung anzubieten und erneut würfeln.
    *   *Sonderfall Dörfer (Größe 1):* Außer im Frühling für Getreide gibt es normalerweise keine Nachfrage. Es können maximal 1W10 EP anderer Güter verkauft werden.

### Schritt 3: Angebotspreis bestimmen (Offer Price)

1.  **Basispreis:** Verwenden Sie den Basispreis der Ware (siehe Base Price Table).
2.  **Wohlstandsanpassung:** Passen Sie den Basispreis basierend auf dem Wohlstands-Rating (Wealth) der Siedlung an, um den Angebotspreis zu bestimmen:
    *   Squalid (—): 50 % des Basispreises.
    *   Poor (1): Basispreis minus 20 %.
    *   Average (2): Basispreis.
    *   Bustling (3): Basispreis plus 5 %.
    *   Prosperous (4): Basispreis plus 10 %.

### Schritt 4: Feilschen und Abschluss

1.  **Feilschen (Haggle Test):** Der SC kann einen vergleichenden *Haggle Test* gegen den Käufer ablegen, um den Preis zu erhöhen.
2.  **Endpreis:** Bei Erfolg wird der Preis um **10 %** erhöht (oder bis zu 20 % mit dem Talent *Dealmaker*).
3.  **Abschluss:** Bei Einigung ist der Verkauf abgeschlossen.

### Optionale Wege zum Verkauf

1.  **Verzweifelter Verkauf:** Wenn SCs die Ware schnell loswerden müssen, können sie sie in jeder Siedlung mit dem Eintrag "Trade" für **die Hälfte des Basispreises** verkaufen.
2.  **Handelsgerüchte:** Mit einem *Difficult (-10) Gossip Test* können SCs Gerüchte über Orte erfahren, an denen eine Ware **besonders gefragt** ist (Rumour Table). Dort kann die Ware für **das Doppelte des Basispreises** verkauft werden.