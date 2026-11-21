# ADR-0002: Przechowywanie i serwowanie zbudowanych paczek

Status: przyjęta
Data: 2026-11-21

## Kontekst
Paczki są ładowane przez host w runtime (ADR-0001). Potrzebny jest magazyn, który trzyma
wszystkie wersje (rollback, source mapy: NFR-3, NFR-7), oraz warstwa cache przed nim (NFR-11).
Całość ma działać lokalnie i za 0 zł (NFR-12). Mentor wskazał S3 emulowane przez LocalStack.
Schemat wersji, manifest i rollback rozstrzyga ADR-0003.

## Opcje
- **Magazyn:** serwer statyczny z dysku (jak w spike'u) / **LocalStack S3 z tokenem** /
  LocalStack 4.4.0 bez tokenu (zamrożony) / inny emulator S3 (moto, S3Mock).
- **CDN:** brak (przeglądarka → S3) / **nginx jako lokalny CDN** / CloudFront w LocalStacku (płatny).

## Decyzja
1. Paczki trafiają do bucketu S3 `gw-packages` w LocalStacku (aktualny obraz, darmowy token).
   Bucket tworzy skrypt init przy starcie.
2. Przeglądarka pobiera paczki wyłącznie przez nginx na `:4000` (proxy z cache przed S3).
3. Pliki w buckecie są niezmienne: każda wersja pod własnym kluczem, bez nadpisywania.
4. Upload skryptem Node (`@aws-sdk/client-s3`), który ustawia `Content-Type` i `Cache-Control`
   jako metadane obiektu. nginx respektuje te nagłówki.
5. CORS ustawia nginx. Bucket nie jest wystawiony dla przeglądarek.
6. Całość uruchamia Docker Compose. Token leży w `.env` (poza gitem), w repo jest `.env.example`.

## Konsekwencje
- ➕ Wszystkie wersje dostępne jednocześnie: podstawa rollbacku i podglądu (ADR-0003).
- ➕ Model „CI wgrywa niezmienny artefakt, CDN serwuje” odpowiada produkcji (S3 + CloudFront).
- ➕ Cache jest widoczny i testowalny lokalnie.
- ➖ Przed pierwszym uruchomieniem trzeba założyć konto LocalStack: świadome odstępstwo od „jednego polecenia”.
- ➖ Wymagany Docker.
- ➖ Stan LocalStacka nie przetrwa restartu kontenera (zweryfikowane 2026-11-21): bucket
  odtwarza skrypt init, ale wersje paczek trzeba wgrać ponownie. Na produkcji historia jest trwała.
- ➖ nginx to jeden węzeł, więc nie pokazuje propagacji ani unieważniania cache w prawdziwym CDN.
