# ADR-0001: Dostarczanie funkcji Engagement jako mikrofrontendów ładowanych w runtime

Status: przyjęta
Data: 2026-11-11

## Kontekst

Portal (Next.js, zespół Portalu) jest wydawany raz w tygodniu. Każda zmiana zespołu Engagement
(funkcje interaktywne i monetyzacja) wymaga PR do repozytorium Portalu i czekania na ten deploy.
Zarząd chce szybciej eksperymentować z paywallem, bo od niego zależą przychody z subskrypcji,
i zdecydował, że funkcje Engagement mają być niezależnymi paczkami ładowanymi w przeglądarce
w czasie działania strony.

Ten ADR **weryfikuje** tę decyzję: porównuje ją z prostszymi alternatywami i określa, na jakich
warunkach ma sens. Sposób integracji (import maps, web components, iframe, …), współdzielenie
zależności i podział na paczki to tematy kolejnych ADR-ów.

### Założenia

- **[Z-1] Przyczyna tygodniowego rytmu.** Portal wydaje raz w tygodniu z powodu ręcznej regresji
  QA i okna wydań dopasowanego do pracy redakcji. Zespół Engagement nie ma wpływu na ten proces
  i nie zmieni się on w horyzoncie projektu.
- **[Z-2] Charakter eksperymentów.** Większość eksperymentów z paywallem dotyczy parametrów
  (teksty, ceny, liczba darmowych artykułów), ale co kilka tygodni pojawia się zmiana kodu:
  nowy wariant flow logowania lub subskrypcji, nowy komponent.
- **[Z-3] Odpowiedzialność.** Zespół Engagement jest właścicielem swoich paczek w produkcji,
  łącznie z ich monitoringiem i rollbackiem. Zespół Portalu odpowiada za stronę i za to, że
  awaria paczki degraduje się do braku funkcji, a nie do zepsutego artykułu.
- **[Z-4] Skala.** Dwa zespoły, kilka osób w każdym. Nie przewiduje się kolejnych zespołów
  dostarczających frontend w ciągu roku.

### Dowody ze spike'a (2026-11-11)

- Host Next.js 16 (Turbopack) ładuje natywny moduł ESM z innego originu przez `import()`
  wyłączony z bundlowania. Działa także w buildzie produkcyjnym.
- Nowa wersja paczki jest widoczna po przeładowaniu strony, bez builda i deployu hosta.
- Paczka z wbudowanym Reactem waży 218 kB (min). React jest zduplikowany względem hosta.
- Treść paczki nie występuje w HTML z SSR.
- Niedostępność serwera paczek i brak nagłówka CORS dają w JS identyczny błąd, więc
  diagnostyka wymaga dodatkowych środków.

## Opcje

Kryteria: (1) czas od zmiany do produkcji, (2) niezależność wydań i rollbacku (NFR-1, NFR-3),
(3) koszt złożoności, (4) wpływ na użytkownika: wydajność, SEO, CLS (NFR-9, NFR-10),
(5) jasność odpowiedzialności za incydenty, (6) koszt infrastruktury (NFR-12).

### A. Status quo
Kod Engagement w repozytorium Portalu, deploy co tydzień.
- ➕ Zero nowej złożoności. Pełne SSR, jeden React.
- ➖ To jest problem, który rozwiązujemy: do 7 dni od merge'a do produkcji.
- ➖ Rollback paywalla oznacza rollback całego Portalu.

### B. Poprawa procesu Portalu
CODEOWNERS dla katalogu Engagement w repo Portalu, automatyczne testy, deploy po każdym merge'u.
- ➕ Uderza w przyczynę, a nie w objaw. Architektura pozostaje prosta.
- ➖ Wymaga zmiany procesu zespołu Portalu, na którą Engagement nie ma wpływu **[Z-1]**.
- ➖ Wydania i rollbacki Engagement dalej idą przez pipeline Portalu. **Nie spełnia NFR-1.**

### C. Paczki npm (integracja w buildzie)
Engagement publikuje wersjonowane paczki, Portal je instaluje (np. z automatycznym podbijaniem wersji).
- ➕ Wersjonowanie, typy TypeScript, jeden React, pełne SSR.
- ➖ Każda wersja wymaga builda i deployu hosta. **Nie spełnia NFR-1 ani NFR-3.**
- ➖ Formalnie rozdziela kod, ale nie cykl wydań, więc główny problem zostaje.

### D. Zdalna konfiguracja / feature flagi
Paywall w kodzie Portalu, parametry eksperymentów pobierane w runtime.
- ➕ Najtańsza droga dla eksperymentów parametrycznych, które według **[Z-2]** stanowią większość.
- ➖ Zmienia dane, nie kod. Nowy flow lub komponent nadal czeka na deploy Portalu.
- ➖ Nie rozwiązuje problemu dla widgetów i auth.

### E. Mikrofrontendy ładowane w runtime
Paczki Engagement budowane, wersjonowane i wydawane niezależnie. Host ładuje je w przeglądarce.
- ➕ Wydanie i rollback paczki bez udziału zespołu Portalu (NFR-1, NFR-3).
- ➕ Jasna granica własności kodu między zespołami, zgodna z **[Z-3]**.
- ➖ Nowe problemy do rozwiązania: współdzielenie zależności, izolacja stylów i błędów,
  komunikacja między paczkami, typy dla hosta, source mapy, obserwowalność (NFR-2, NFR-4–NFR-8).
- ➖ Treść paczek nie jest w SSR: ryzyko CLS i konieczność ochrony treści premium po stronie serwera (NFR-9).
- ➖ Dodatkowy koszt pobrania kodu (spike: 218 kB na paczkę bez współdzielenia Reacta).
- ➖ Kod Engagement trafia na produkcję Portalu z pominięciem ich QA, więc ryzyko przesuwa się na Engagement **[Z-1]**.

### F. Hybryda D + E
Mikrofrontendy (E) dla zmian kodu, zdalna konfiguracja (D) dla parametrów eksperymentów.
- ➕ Każdy typ zmiany idzie najtańszą drogą.
- ➖ Dwa mechanizmy zmian. Trzeba zdefiniować, co jest konfiguracją, a co kodem.
- ➖ Więcej zakresu niż wymaga MVP.

## Decyzja

Przyjmujemy **opcję E**: funkcje Engagement są dostarczane jako niezależnie wydawane
mikrofrontendy ładowane przez host w runtime.

Uzasadnienie (wynika z założeń):
- Tylko E i F spełniają NFR-1 i NFR-3 bez zmiany procesu zespołu Portalu **[Z-1]**.
- D pokrywa większość eksperymentów, ale nie te, które zmieniają kod **[Z-2]**, i nic nie daje widgetom ani auth.
- Granica mikrofrontendu pokrywa się z granicą zespołów **[Z-3]**, więc złożoność kupuje
  realną autonomię, a nie tylko podział techniczny.

Opcję D uznajemy za wartościowe **uzupełnienie** i świadomie wycinamy ją z zakresu MVP.
Wrócimy do niej, gdy pojawią się realne eksperymenty parametryczne.

## Konsekwencje

Pozytywne:
- Engagement wydaje i wycofuje paczki samodzielnie, nie jest bottleneckiem.
- Host nie zależy od implementacji paczek, tylko od kontraktu.

Negatywne i wymagające kolejnych decyzji:
- Trzeba zaprojektować: sposób integracji, współdzielenie Reacta i `ui`, komunikację między
  paczkami, izolację stylów, wersjonowanie i rollback, cache, obserwowalność (kolejne ADR-y).
- **Ochrona treści premium nie może zależeć od paczki paywall w przeglądarce.** Gdy paczka
  się nie załaduje, artykuł ma degradować się do samego leadu („fail closed”), a nie odsłaniać
  treść. Pełna treść premium jest wysyłana tylko po weryfikacji sesji na serwerze (NFR-9).
- Funkcje Engagement nie są w HTML z SSR, więc trzeba zarezerwować miejsce w layoucie (CLS)
  i pogodzić się z tym, że nie są widoczne dla botów.
- Zespół Engagement przejmuje odpowiedzialność za jakość wydań na produkcji Portalu: testy
  w CI, możliwość podglądu nowej wersji na prawdziwym hoście przed udostępnieniem, szybki rollback.
- Koszt wydajnościowy trzeba ograniczyć i mierzyć (budżet w NFR-10).

Warunki, przy których decyzję należy zrewidować:
- Zespół Portalu przechodzi na ciągły deploy (opcja B staje się dostępna).
- Zespół Engagement znika albo zostaje połączony z zespołem Portalu, więc granica zespołów przestaje istnieć.
- Wymogi SEO wymuszą renderowanie funkcji Engagement po stronie serwera.
