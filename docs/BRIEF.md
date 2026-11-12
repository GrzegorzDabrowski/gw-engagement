# Handbook - "Gazeta Wrocławska": platforma mikrofrontendów

> Projekt mentoringowy: **System Design, Architecture & Infrastructure (frontend)**

---

## 1. Kontekst biznesowy

Pracujesz w "Gazecie Wrocławskiej". Portal z artykułami to aplikacja Next.js utrzymywana przez **zespół Portalu**. Ty jesteś w **zespole Engagement**, który odpowiada za funkcje interaktywne i monetyzację.

Dziś każda zmiana Twojego zespołu wymaga PR do repozytorium Portalu i czekania na ich cotygodniowy deploy. Zarząd chce szybciej eksperymentować z paywallem, bo od niego zależą przychody z subskrypcji. Zapadła decyzja: funkcje Engagement mają być dostarczane jako **niezależne paczki frontendowe, które Portal ładuje w przeglądarce w czasie działania strony**, a nie w czasie swojego builda.

**Twoja rola:** Masz zaprojektować i zbudować MVP tej platformy.

---

## 2. Co budujemy

### Host - `gw-portal` (osobne repozytorium)

Minimalna aplikacja Next.js z SSR: lista artykułów i strona artykułu. Artykuły są darmowe albo premium. Treść może pochodzić z pliku JSON. Host ma być możliwie prosty - to nie jest projekt o Next.js.

### Paczki - `gw-engagement` (monorepo)

| Paczka | Odpowiedzialność | Zakres MVP |
|---|---|---|
| `widgets` | Wyspy interaktywności w treści artykułu | Jeden widget, np. sonda "Tak / Nie" z wynikami |
| `auth` | User flows: modal logowania i rejestracji | Logowanie na zamockowanym API; rejestracja opcjonalna |
| `paywall` | Blokada artykułów premium, CTA do logowania / subskrypcji | Przycisk "Zaloguj się" uruchamiający flow z paczki `auth` |
| `ui` | Wspólne komponenty UI używane przez pozostałe paczki | Dwa przyciski: primary i secondary |

### Kluczowy scenariusz (musi działać na demo)

1. Niezalogowany użytkownik otwiera artykuł premium.
2. Widzi lead artykułu i paywall.
3. Klika w paywallu "Zaloguj się" - otwiera się modal logowania pochodzący z paczki `auth`.
4. Loguje się (mock).
5. Paywall reaguje na zmianę stanu i użytkownik dostaje pełną treść. Czy z przeładowaniem strony, czy bez - Twoja decyzja, do uzasadnienia.

Na tej samej stronie, niezależnie od reszty, działa widget z paczki `widgets`.

---

## 3. Wymagania

### Niefunkcjonalne

| ID | Wymaganie |
|---|---|
| NFR-1 | **Niezależny deploy.** Nowa wersja dowolnej paczki trafia na produkcję bez builda i deployu hosta. |
| NFR-2 | **Brak duplikacji wspólnych zależności.** React i komponenty `ui` nie są wbudowywane osobno w każdą paczkę. |
| NFR-3 | **Szybki rollback.** Wycofanie wersji jednej paczki w mniej niż 5 minut, bez wpływu na pozostałe. |
| NFR-4 | **Luźne powiązanie.** Paczki nie importują się nawzajem bezpośrednio (wyjątek: `ui`). Akcja wywołana przez jedną paczkę musi zadziałać, nawet jeśli paczka docelowa nie została jeszcze załadowana. |
| NFR-5 | **Izolacja błędów.** Awaria albo niedostępność paczki nie psuje artykułu. |
| NFR-6 | **Izolacja stylów.** Style paczek nie psują strony, a style strony nie psują paczek. |
| NFR-7 | **Debugowalność.** Błąd z produkcji da się przełożyć na linię w kodzie źródłowym konkretnej wersji paczki. |
| NFR-8 | **DX dla konsumentów.** Zespół Portalu ma typy TypeScript dla API paczek. |
| NFR-9 | **SEO i ochrona treści.** Artykuły są renderowane po stronie serwera. Treści premium nie da się "odblokować" w 30 sekund z DevTools. |
| NFR-10 | **Wydajność.** Sam zdefiniuj budżet (rozmiar, Core Web Vitals) i pokaż, że go spełniasz. |
| NFR-11 | **Cache.** Świadomie zaprojektowane cache'owanie na każdej warstwie, przez którą przechodzi request. |
| NFR-12 | **Koszt: 0 zł.** |

### Ograniczenia techniczne

- Dwa repozytoria na GitHubie: host i monorepo paczek.
- Paczki: React + TypeScript, dostarczane do przeglądarki jako **natywne moduły ES (ESM)**.
- CI/CD: GitHub Actions.
- Całe środowisko (host + infrastruktura do serwowania paczek) da się uruchomić **lokalnie jednym poleceniem**. Deploy do chmury jest opcjonalny.
- Autoryzacja może być zamockowana, ale jej model (gdzie żyje sesja, kto ją weryfikuje) ma być realistyczny.

---

## 4. Plan pracy

### Projekt

**Cel:** zanim napiszesz kod produkcyjny, wiesz, co budujesz i dlaczego.

1. **Minimum 6 ADR-ów.** Obszary, w których musisz podjąć decyzję (lista nie jest wyczerpująca):
   - czy ta architektura w ogóle ma sens w porównaniu z prostszymi alternatywami,
   - sposób integracji paczek z hostem,
   - współdzielenie zależności,
   - komunikacja między paczkami,
   - izolacja stylów,
   - gdzie i jak przechowywane i serwowane są zbudowane paczki,
   - wersjonowanie i strategia rollbacku,
   - narzędzia do monorepo.
2. **Diagram architektury** (np. C4 poziom 1-2) z zaznaczonym przepływem kluczowego scenariusza.
3. **Spike:** wskaż najbardziej ryzykowne założenie całego projektu i potwierdź je (albo obal) minimalną ilością kodu. Wybór tego założenia też będziemy omawiać.

### Fundament

**Cel:** kluczowy scenariusz działa end-to-end lokalnie.

- Monorepo z czterema paczkami, buildem i wygodnym lokalnym dev workflow.
- Infrastruktura do serwowania paczek uruchamiana lokalnie.
- Host ładuje paczki w runtime.
- Paywall -> auth działa zgodnie z NFR-4.
- Widget działa.
- ADR-y zaktualizowane tam, gdzie rzeczywistość zweryfikowała plan.

### Gotowość produkcyjna

**Cel:** to da się utrzymać i bezpiecznie wydawać.

- Pipeline CI/CD: build, testy, publikacja wersji paczki, udostępnienie jej użytkownikom, rollback.
- Strategia cache zaimplementowana i opisana: dla każdego typu zasobu - gdzie, jak długo i jak się unieważnia.
- Source mapy działające dla wersji produkcyjnej.
- Izolacja błędów i stylów.
- Minimalna obserwowalność: dowiadujesz się, że paczka padła u użytkownika.
- `README` w obu repozytoriach: uruchomienie od zera jednym poleceniem.

### Demo i obrona architektury

- ~10 minut demo kluczowego scenariusza.
- Wydanie nowej wersji paywalla i jej rollback na żywo.
- Scenariusze "co jeśli…" - incydenty i nowe wymagania biznesowe.
- Retrospektywa: co zrobiłbyś inaczej.

---

## 5. Pytania naprowadzające

### Integracja i zależności

- Gdy w kodzie paczki jest `import { useState } from 'react'`, skąd przeglądarka ma wiedzieć, jaki plik pobrać?
- Co się stanie, gdy na stronie znajdą się dwie kopie Reacta? Kiedy to jest problem, a kiedy nie?
- Host też jest aplikacją Reactową. Czy komponent z paczki powinien być dzieckiem drzewa Reacta hosta?
- Kto decyduje o wersji Reacta, na której działają wszystkie paczki? Jak wygląda jej podbicie?
- Jaki jest kontrakt między hostem a paczką? Co host musi o paczce wiedzieć, a czego wiedzieć nie powinien?

### Komunikacja

- Co się stanie, jeśli użytkownik kliknie "Zaloguj się", zanim kod modułu logowania się pobierze? A jeśli ten moduł w ogóle nie był jeszcze potrzebny na tej stronie?
- Skąd paywall wie, że użytkownik się zalogował? Co jeśli paywall zamontował się dopiero po zalogowaniu?
- Jeśli mechanizm komunikacji umieścisz we wspólnej paczce, a dwie paczki używają jej różnych wersji - co się stanie?
- Jak zmienisz format komunikatu, nie psując paczek, które jeszcze nie zostały zaktualizowane?

### Serwowanie, wersje, cache

- Jak wygląda URL pliku paczki? Co się w nim zmienia między wersjami?
- Jak host dowiaduje się o nowej wersji paczki, skoro nie jest przebudowywany?
- Czym różni się "wgranie nowej wersji" od "udostępnienia jej użytkownikom"? Czy to musi być jeden krok?
- Przez jakie warstwy przechodzi request po plik paczki? Co każda z nich cache'uje i jak długo?
- Plik pobrany przez przeglądarkę wczoraj - skąd wiadomo, czy dziś jest aktualny?
- Strona artykułu jest cache'owana. Co z personalizacją (zalogowany / niezalogowany)?

### Debugowanie

- Stack trace z produkcji wskazuje na `index.js:1:48213`. Jak dojdziesz do linii w kodzie? A jeśli w międzyczasie wyszła nowa wersja?
- Czy chcesz, żeby każdy mógł obejrzeć Twój kod źródłowy w DevTools?

### Style i izolacja

- Portal ma globalną regułę `button { … }`. Co się stanie z Twoim przyciskiem?
- Co się dzieje z czcionkami i zmiennymi CSS po przejściu przez granicę izolacji, którą wybrałeś?
- Modal renderuje się "nad" stroną. Gdzie w DOM wyląduje i czy jego style nadal działają?

### SSR, SEO, bezpieczeństwo

- Co widzi Googlebot? Co widzi użytkownik z wyłączonym JS? Co widzi ktoś z otwartymi DevTools?
- Czy paczkę ładowaną w przeglądarce da się wyrenderować po stronie serwera? Jakim kosztem?
- Gdzie trzymasz sesję i kto ma do niej dostęp z poziomu JavaScriptu?
- Co się dzieje z layoutem, kiedy paczka doładuje się 2 sekundy po treści?

### Infrastruktura i CI/CD

- Pull request zmienia tylko `ui`. Co powinno się zbudować i wydać?
- Jak przetestujesz nową wersję paywalla na prawdziwym hoście, zanim zobaczą ją użytkownicy?
- Jakie warunki musi spełnić odpowiedź serwera z paczkami, żeby przeglądarka zgodziła się wykonać moduł pobrany z innej domeny?

---

## 6. Zasady gry

**Możesz:**

- wybrać dowolne narzędzia (bundler, narzędzie do monorepo, infrastruktura) - o ile uzasadnisz wybór w ADR,
- mockować backend (API routes w hoście w zupełności wystarczą),
- wycinać zakres - jawnie i z uzasadnieniem,
- używać AI do pisania kodu i do burzy mózgów; na spotkaniu decyzji bronisz jednak Ty.

**Nie rób:**

- nie używaj gotowych frameworków do mikrofrontendów, które robią orkiestrację za Ciebie - chodzi o zrozumienie mechanizmów (gotowe narzędzia do pojedynczych elementów, np. serwowania plików, są OK, jeśli rozumiesz, co robią),
- nie poleruj UI - dwa przyciski i brzydki modal wystarczą,
- nie buduj prawdziwej autoryzacji,
- nie wydawaj pieniędzy - jeśli coś wymaga karty kredytowej, szukaj alternatywy albo zrób to lokalnie.

---

## 7. Szablony

### ADR

```markdown
# ADR-00X: <decyzja>
Status: proponowana | przyjęta | zastąpiona przez ADR-00Y
## Kontekst
## Decyzja
## Rozważane opcje (min. 2) z plusami i minusami
## Konsekwencje (także negatywne)
```

---

## 9. Definition of Done (całość)

- [ ] ADR-y aktualne względem tego, co faktycznie powstało
- [ ] `git clone` + jedno polecenie = działające środowisko lokalne w obu repo
- [ ] Kluczowy scenariusz działa end-to-end
- [ ] Wydanie nowej wersji paczki bez deployu hosta
- [ ] Rollback paczki w < 5 minut, z opisaną procedurą
- [ ] Strategia cache opisana i zaimplementowana
- [ ] Source mapy działają dla wersji produkcyjnej
- [ ] Awaria jednej paczki nie psuje artykułu (pokażesz to na demo)
- [ ] Zdefiniowany i zmierzony budżet wydajności
- [ ] Koszt infrastruktury: 0 zł
