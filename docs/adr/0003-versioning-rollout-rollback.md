# ADR-0003: Wersjonowanie, rollout i rollback paczek

Status: przyjęta
Data: 2026-11-21

## Kontekst
Bucket trzyma niezmienne wersje paczek, a nginx cache'uje je wg `Cache-Control` (ADR-0002).
Trzeba ustalić: jak adresować wersje, skąd przeglądarka wie, którą wersję załadować, jak
sprawdzić wersję przed udostępnieniem i jak ją wycofać w < 5 min bez hosta (NFR-1, NFR-3, NFR-11).

## Opcje
- **Adres wersji:** **semver w ścieżce** / hash treści w nazwie / oba.
- **Kto wskazuje aktywną wersję:** **manifest czytany przez przeglądarkę** / manifest czytany
  przez serwer Next (rollback czeka na wygaśnięcie cache'u HTML) / wersja w konfiguracji hosta (wymaga deployu hosta).
- **Format manifestu:** własny JSON / prawdziwa import map (wymaga wstrzyknięcia do HTML
  przez serwer) / **JSON w kształcie import mapy**.
- **Podgląd przed udostępnieniem:** brak / **parametr w URL z walidacją semver** / ciasteczko.

## Decyzja
1. Klucz pliku: `<paczka>/<semver>/<plik>`, np. `hello/1.2.0/hello.js` (+ `.map`). Wersja
   pochodzi z `package.json` paczki. Deploy odmawia wgrania wersji, która już istnieje.
2. **Deploy i release to osobne kroki:** `deploy` wgrywa wersję do bucketu (nikt jej jeszcze
   nie używa), `release <paczka> <wersja>` przełącza manifest. Release sprawdza, czy wersja istnieje.
3. **Rollback = `release` poprzedniej wersji.** Pliki starych wersji zawsze są w buckecie.
4. Manifest `manifest.json` w roocie bucketu, z pełnymi URL-ami (host nie zna układu bucketu):
   ```json
   {
     "imports": { "@gw/hello": "http://localhost:4000/hello/1.2.0/hello.js" },
     "previewUrlTemplate": "http://localhost:4000/{name}/{version}/{name}.js"
   }
   ```
5. Host zna tylko adres manifestu. W przeglądarce pobiera manifest, potem importuje paczkę.
6. Cache: pliki wersji `public, max-age=31536000, immutable`, manifest `no-cache`
   (zawsze rewalidowany, więc release i rollback działają od następnego odświeżenia strony).
7. Podgląd: `?gw-hello=1.3.0` ładuje tę wersję tylko w tej karcie, z URL-a zbudowanego z
   `previewUrlTemplate`. Wartość spoza wzorca semver jest ignorowana (ochrona przed XSS).

## Konsekwencje
- ➕ Release i rollback to podmiana jednego małego pliku: sekundy, bez udziału zespołu Portalu.
- ➕ Każda wersja jest testowalna na prawdziwym hoście przed udostępnieniem.
- ➕ Kształt `imports` pozwoli później wstrzyknąć manifest jako import map (ADR o zależnościach).
- ➖ Dodatkowy request (manifest) przed załadowaniem paczki, bez cache w CDN.
- ➖ Przez CDN manifest zawsze wraca jako pełne 200, nie 304 (zweryfikowane 2026-11-21): nginx
  z `proxy_cache` usuwa nagłówki warunkowe z requestu do S3. Przy ~200 B akceptujemy to.
- ➖ Manifest to pojedynczy punkt awarii: gdy padnie, żadna paczka się nie ładuje (fallback z NFR-5).
- ➖ Dwa równoczesne release'y: wygrywa ostatni zapis (brak blokady). Akceptowalne przy jednym zespole.
- ➖ Wersję w `package.json` podbija się ręcznie (automatyzacja: ADR o narzędziach monorepo).
- ➖ Source mapy są publiczne razem z kodem. Do rozstrzygnięcia przy NFR-7.
