# Plan wykonawczy MVP — MasterCompanion

Wersja robocza 0.5 · 1 października 2026

**Zakres:** pełne Ythryn z POC, mapa, czytelne materiały, edycja istniejących opisów, autosave, czas, Arcane Blight, wspólny odpoczynek i cofanie ostatnich operacji. Edycja i Arcane Blight są obowiązkowe w pierwszym tygodniu. Budżet: około 21 godzin pracy użytkownika z agentem. Implementacja fundamentu została rozpoczęta; bieżący stan i weryfikację opisuje [implementation status](07-Stan-implementacji.md). Mocna granica silnika i modułów jest nowym wymaganiem użytkownika i została uwzględniona w [architekturze](06-Architektura-modulow.md).

[Plan minimum](04-Plan-minimum-tydzien.md) rozdziela funkcje pierwszej wersji od backlogu. [Warsztat](03-Plan-implementacji.md) zachowuje uzgodnienia i ich kontekst. Poniższe wybory szczegółów technicznych są rekomendacjami autora planu w ramach przyjętego stosu; nie przedstawiamy ich jako osobnych odpowiedzi użytkownika.

Execution update, 1 October: the user requested parallel work where possible and starting implementation. The [gameplay implementation plan](09-Gameplay-implementation.md) defines the current delivery order, neutral operation contract, and acceptance for the first backend slice. Rules and persistence can proceed in parallel after the shared contract is defined; frontend gameplay follows verification of the API contract. The existing source reorganization remains intact: 106 materials, 10 folders and 29 map markers. Historical 16-document, 142-section and 18-folder counts remain evidence of earlier conversion and migration stages, not the current navigation totals.

Plan dotyczy ogólnego silnika MasterCompanion i kontraktu modułu. Ythryn jest konkretną implementacją wybraną do pilota i źródłem materiałów do odbioru. Funkcje czytnika, edycji, hierarchii folderów, map i kart działają na neutralnych kontraktach. Reguły Arcane Blight należą do implementacji modułu. Definicje silnika, modułu i kampanii zawiera [architektura](06-Architektura-modulow.md).

## 1. Rekomendowane wersje i organizacja kodu

| Element | Rekomendacja | Podstawa |
|---|---|---|
| Backend | .NET 10 LTS, ASP.NET Core Minimal APIs. | [.NET 10 jest wspierane do listopada 2028](https://dotnet.microsoft.com/en-us/platform/support/policy); [Minimal APIs](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/apis?view=aspnetcore-10.0) pasują do niewielkich endpointów przypisanych do przypadków użycia. |
| Baza i ORM | PostgreSQL 18, EF Core 10, Npgsql EF provider 10. | [PostgreSQL 18 jest wspierane](https://www.postgresql.org/support/versioning/); [provider Npgsql 10](https://www.npgsql.org/efcore/release-notes/10.0.html) obsługuje EF 10 i funkcje PostgreSQL 18. |
| Frontend | Angular 22, aplikacja SPA, standalone components, HttpClient i lokalny stan widoku oparty o signals. | [Angular 22 jest aktywnie wspierany](https://angular.dev/reference/releases); [tabela zgodności](https://angular.dev/reference/versions) określa dopuszczalne Node i TypeScript. |
| Uruchomienie | C# AppHost Aspire 13.6.0; PostgreSQL w Dockerze, API i Angular jako procesy deweloperskie. | Przypięto paczki AppHost, PostgreSQL i JavaScript; sprawdzono wspólny start na Windows. |
| Edytor | Przyjęty Tiptap 3; jeden zestaw rozszerzeń dla konwersji, czytnika i edytora. | Wcześniejsze D-27 i D-28; integrację oraz zachowanie realnych dokumentów weryfikuje próba dnia 1. |

Przypięte wersje: SDK 10.0.303, EF Core 10.0.12, Npgsql 10.0.3, Aspire 13.6.0, PostgreSQL 18.6, Angular 22.2.0, TypeScript 6.0.3 i Tiptap 3.31.4. Zależności npm są zapisane w lockfile. Przy pierwszym przygotowaniu pobieramy zależności; później korzystamy z lokalnych paczek i obrazu. Style i systemowe fonty nie wymagają internetu. Pełny odbiór pracy przy odłączonym internecie nadal należy do ostatniego etapu.

Stan środowiska 30 września: SDK 10.0.303 i Node 24.19.0 działają. Po uruchomieniu Docker Desktop silnik 29.4.3 udostępnił kontener PostgreSQL 18.6. Migracja bazy, przygotowanie kampanii, API i Angular zostały uruchomione przez Aspire. Odczyt i zapis sprawdzono na tej bazie, także po restarcie środowiska.

Struktura fundamentu; slices gry i mechaniki są jeszcze do dodania:

```text
src/
  MasterCompanion.AppHost/
  MasterCompanion.ServiceDefaults/
  MasterCompanion.Api/
    Program.cs                      # składanie projektów i DI
  MasterCompanion.Contracts/
    ICampaignModule.cs
  MasterCompanion.Engine/
    Features/
      Workspace/GetWorkspace.cs
      Materials/GetMaterial.cs
      Materials/SaveMaterial.cs
      Assets/GetAsset.cs
    Persistence/
  MasterCompanion.Modules.Ythryn/
    YthrynModule.cs
    Data/
  mastercompanion-web/
    projects/
      contracts/
      engine/src/lib/features/
        workspace/
        materials/
        maps/
      ythryn/
    src/main.ts                     # składanie bibliotek i DI
    tools/
      prepare-module.mjs
      import-ythryn-poc.mjs
      check-boundaries.mjs
      content.test.mjs
      autosave.test.mjs
      verify-api.mjs
```

Slice zawiera endpoint, wejście/wyjście, walidację i zapis. Reguły Arcane Blight i ich slices powstają w projekcie Ythryn; neutralny zegar i rejestr operacji w silniku. Komunikują się przez kontrakty, bez dostępu modułu do DbContext silnika. Nadal rekomendujemy bezpośrednie wywołania, bez MediatR i ogólnego repozytorium. Osobne projekty wydzielają moduły, nie każdą warstwę techniczną.

## 2. Dane potrzebne do pierwszej wersji

| Dane | Najważniejsze elementy |
|---|---|
| `Campaign` | Identyfikator, nazwa, identyfikator i wersja modułu, znacznik ukończonego przygotowania. |
| `Material` | Identyfikator, kampania, tytuł, typ, dokument JSON, wersja schematu, rewizja zapisu; identyfikator sekcji źródłowej, grupa dokumentu i kolejność. |
| `CampaignFolder` | Kampania, stabilny identyfikator, tytuł, opcjonalny rodzic i kolejność. Materiał wskazuje folder; spis obsługuje dowolną głębokość. |
| `Map`, `Marker` | Zasób obrazu, wymiary źródłowe; kod i pozycja procentowa znacznika oraz identyfikator docelowego materiału. |
| `Asset` | Identyfikator, typ treści i lokalny plik. Odwołania w treści i mapach używają identyfikatora, a API udostępnia plik. |
| `CampaignGameState` | Rewizja, neutralny czas i drużyna oraz wersjonowany stan modułu w JSON. Schemat zarazy i jego interpretacja należą do Ythryn. Kontrakt operacji wymaga ustalenia przed implementacją. |
| `GameOperation` | Kampania, kolejność, identyfikator żądania, typ operacji, stan przed i po, informacja o cofnięciu. |

Pierwsza wersja korzysta z jednej przygotowanej kampanii. Materiały pozostają oddzielone od stanu gry, więc cofnięcie zegara nie zmienia notatek. Czas świata jest liczbą minut od wejścia; nie wiążemy go ze strefą czasu Windows ani datą rzeczywistą.

Pierwotna konwersja rozliczyła 142 jednostki z 16 dokumentów POC. Po uporządkowaniu utrzymywana paczka zawiera 106 materiałów w 10 folderach. Usunięto strony pełniące wyłącznie funkcję indeksu; sekcje pięciu dokumentów Fenes scalono w pełne dokumenty z zachowaniem treści, tabel i kotwic. Lokacje Y1–Y29 i komnaty Y19 są bezpośrednio w jednym folderze, a „Wątki graczy w Ythryn → Fenes” zawiera pięć dokumentów. Materiały redakcyjne zachowują zagnieżdżenie. Y4 i poszczególne komnaty Y19 pozostają konkretnymi materiałami. Karty otwieramy tylko na żądanie. Odnośniki źródłowe otrzymują mapowanie do identyfikatorów materiałów i kotwic sekcji; przegląd rozlicza również odwołania bibliograficzne i brakujące cele. Liczby 16/142/29 opisują historyczną migrację źródła, a nie bieżącą liczbę materiałów ani limit przyszłej aplikacji.

Kampanię przygotowujemy jeden raz. Ponowny start ani regeneracja pliku modułu nie nadpisuje edytowanych materiałów. Aktualizowanie istniejącej kampanii nową paczką modułu jest przyszłym zakresem. Baza i pliki mają trwałe lokalne miejsce przechowywania.

## 3. Przebieg pracy w głównym widoku

1. Aplikacja otwiera przygotowane materiały Ythryn. Użytkownik czyta w szerokim obszarze z przyciskiem przejścia do mapy, kartami i filtrem nazw.
2. Kliknięcie znacznika otwiera lub aktywuje opis tej lokacji. Przejście do innej karty zachowuje pozycję czytania; powrót do mapy zachowuje jej powiększenie i przesunięcie.
3. „Edytuj” włącza edytor istniejącego materiału. Mały pasek formatuje tekst i wstawia link do istniejącego materiału. Tabele, obrazy i wyróżnienia zachowują treść podczas wczytania, edycji i zapisu.
4. Autosave wysyła zmiany kolejno dla danego dokumentu, z oczekiwaną rewizją. Stan „Zapisano” wymaga potwierdzenia backendu. Błąd lub konflikt pozostawia lokalny tekst w karcie i pokazuje możliwość ponowienia. Wyjście z edycji dopilnowuje zapisu.
5. Przy pierwszym otwarciu narzędzia MG wpisuje drużynę. Bohaterowie mają własne identyfikatory, są zdrowi, ST wynosi 15, pierwsza ekspozycja następuje po 12 godzinach. Konfiguracja liczby i nazw następuje przed pierwszą operacją gry; rozbudowane zarządzanie składem jest poza minimum.
6. Pasek czasu daje skróty i własny przyrost. „Długi odpoczynek +8 h” dodaje 8 godzin i zapisuje koniec wspólnego odpoczynku jako jedną operację. Samo „+8 h” nie zapisuje odpoczynku.
7. Narzędzie pokazuje stany bohaterów i najbliższe zaległe sprawdzenie dla każdego. MG podaje sukces/porażkę, a przy sukcesie rzutu zakażonego także wynik k6. Po wyniku pojawia się następna należna sprawa, jeśli istnieje. Widok nie zajmuje stale części przestrzeni notatek.
8. „Cofnij” pokazuje, jaka ostatnia operacja gry zostanie cofnięta, i przywraca jej poprzedni stan. Można cofać dalej po kolei. Historia operacji jest trwała, więc zachowanie cofania sprawdzamy także po restarcie. Edytor ma niezależne Cofnij/Ponów w bieżącej edycji.

Podstawowa mapa korzysta ze źródłowego obrazu i pozycji procentowych. Powiększenie obejmuje obraz i znaczniki razem. Przyciski przybliżania, oddalania i dopasowania oraz przesuwanie myszą pozostają dostępne; przeciągnięcie nie powinno przypadkowo otwierać opisu. Edytor znaczników i wgrywanie nowych map należą do backlogu.

## 4. Arcane Blight i zapis operacji

Zachowujemy zaakceptowane reguły POC: zdrowi sprawdzają ekspozycję co 12 godzin; pierwsza porażka zakaża, nie dodając porażki leczenia. Zakażeni wykonują sprawdzenie po długim odpoczynku; sukces obniża ST o podany wynik k6, ST 0 daje odporność, trzecia porażka powoduje przemianę. Magiczne leczenie jest dostępne dla zakażonego przed przemianą i przywraca zdrowie bez odporności; kolejna ekspozycja przypada po 12 godzinach od leczenia, zgodnie z referencją.

Reguła wylicza najstarsze zaległe sprawdzenie osobno dla bohatera: zdrowy ma termin kolejnej ekspozycji, a zakażony pierwszy jeszcze nierozstrzygnięty odpoczynek od chwili zakażenia. Nie utrzymujemy dodatkowej kolejki dublującej te dane ani zadania działającego według rzeczywistego zegara.

Przykład odbioru: drużyna jest zdrowa w godzinie 10, MG kończy odpoczynek +8 h i zegar pokazuje 18. Dla bohatera pozostaje ekspozycja z godziny 12. Porażka zakaża go od godziny 12; wtedy ujawnia się rzut za odpoczynek zakończony w godzinie 18. Zegar nadal pokazuje 18. Drugiemu bohaterowi ten wynik nie zmienia stanu.

Każda operacja gry otrzymuje identyfikator żądania i oczekiwaną rewizję stanu. W jednej transakcji utrwalamy zmianę stanu i zapis operacji; powtórzony identyfikator zwraca wynik już wykonanej operacji. Cofnięcie przywraca poprzedni stan gry, oznacza operację jako cofniętą i zwiększa bieżącą rewizję. Dwie karty przeglądarki nie mogą po cichu nadpisywać stanu gry. Rozstrzyganie starszej operacji poza kolejnością i Ponów dla gry są późniejszym zakresem.

Po dodaniu wymagania mocnej granicy modułów ten fragment jest kierunkiem projektu, nie gotowym kontraktem gry. Rekomendujemy neutralny koordynator operacji silnika oraz reguły modułu przekazywane przez interfejs kontraktów. Silnik może utrwalać wersjonowany payload modułu bez interpretowania jego pól; Ythryn waliduje i przekształca własny stan. Sprawdzamy atomowość zapisu i cofania przy implementacji tego slice, zanim rozdzielimy pracę nad zegarem i mechaniką.

## 5. Zadania w siedmiu dniach

Każdy dzień ma budżet około 3 godzin. Agent przygotowuje kod, konwersję i sprawdzenia, a użytkownik w tym samym budżecie uruchamia, przegląda i ocenia widok. Tabela zachowuje pierwotny podział budżetu, nie jest pomiarem wykonanego wdrożenia ani bieżącym harmonogramem. Liczby 16/142 w zadaniach konwersji odnoszą się do historycznego rozliczenia źródła; aktualna nawigacja ma 106 materiałów w 10 folderach. Bieżącą kolejność prac opisuje [plan implementacji gry](09-Gameplay-implementation.md).

| Dzień | Zadania | Warunek ukończenia |
|---|---|---|
| 1 | Zweryfikować silnik Docker; ustalić i przypiąć wersje; utworzyć AppHost, API, Angular i schemat bazy. Sprawdzić konwersję i zapis Y4 oraz fragmentu z tabelą w Tiptap. | Wszystkie procesy startują; edytowany przykład przechodzi zapis i wczytanie bez straty tekstu, tabel i wymaganych wyróżnień. Zidentyfikowane nieobsługiwane elementy mają rozwiązanie przed masową migracją. |
| 2 | Skrypt ekstrakcji i konwersji całego aktu 7, mapa i mapowanie identyfikatorów; przygotowanie kampanii, czytnik i nawigacja. Rozliczyć linki, w tym Obsidian, SRD i dwa odnośniki do aktu 6. | Raport obejmuje 16 dokumentów, 142 sekcje i 29 znaczników. Źródłowy tekst nie jest pominięty. Nie występują aktywne linki do nieobecnych materiałów; potrzebne braki reguł są wskazane i uzupełniane przed odbiorem. |
| 3 | Karty materiałów, filtr nazw i linki wewnętrzne; mapa, przyciski, powiększenie i przesuwanie, otwieranie opisów. | Wszystkie znaczniki mają poprawny cel. Y4, Y19 i komnaty są osiągalne, a powrót zachowuje kontekst. Długi opis jest czytelny na Full HD. |
| 4 | Jawny tryb edycji, mały pasek, wklejanie, „Wstaw Markdown”, zapis z rewizją i obsługa błędu. | Zmiana materiału przetrzymuje restart; kolejne uruchomienie nie nadpisuje jej danymi modułu. Tryb czytania nie uruchamia edycji, tabele i bloki przetrzymują zapis. |
| 5 | Czyste reguły Arcane Blight w C#, konfiguracja drużyny, stan gry, zmiana czasu i odpoczynek; testy granic i zależnych rozstrzygnięć. | Przechodzą testy ekspozycji, zakażenia, k6, odporności, przemiany, leczenia, skoku czasu oraz indywidualnych wyników przy wspólnym odpoczynku. |
| 6 | Widok narzędzia, rozstrzyganie wyników, trwałe operacje i cofanie; transakcje, kontrola rewizji i ponowienia. | Scenariusz 10 h → odpoczynek → ekspozycja → zakażenie → rzut odpoczynku działa przez UI. Ponowienie i cofanie działają także po restarcie, bez zmian notatek. |
| 7 | Odbiór całej migracji, czytelności i pracy offline; poprawki oraz instrukcja Windows z uruchomieniem i lokalizacją trwałych danych. | Po odłączeniu internetu działa cały przebieg: mapa, długi opis, edycja/zapis, czas, odpoczynek, rozstrzygnięcia i cofanie. Oryginalny POC pozostaje zachowany. |

Po dniu 1 aktualizujemy estymację na podstawie próby. Gdy wystąpi opóźnienie, w pierwszej kolejności ograniczamy dodatkowe menu, animacje i dekoracje; wymagany rezultat nadal obejmuje całą treść, edycję i Arcane Blight. Jeśli nie da się go domknąć w budżecie, uzgadniamy termin na podstawie konkretnych pozostałych zadań. Nie nazywamy czytnika bez edycji albo mechaniki gotowym MVP.

## 6. Sprawdzenia chroniące rezultat

- Konwersja: wszystkie identyfikatory źródłowe są rozliczone, tekst nie jest ucięty, znaczniki i odnośniki mają poprawne cele. Rozbieżności formatowania i brakujące odwołania trafiają do raportu, a nie znikają przy konwersji.
- Reguły: próg dokładnie 12 h, wiele zaległych terminów, zakażenie od terminu ekspozycji, ujawnienie należnego odpoczynku, niezależność bohaterów, k6 od 1 do 6, ST 0, trzecia porażka, leczenie bez odporności oraz brak dalszych rzutów u odpornych i przemienionych.
- Trwałość: zapis i odczyt notatki, restart bez nadpisania, ponowienie operacji bez podwójnego naliczenia, konflikt rewizji, cofnięcie stanu gry bez cofania dokumentu. Reguły testujemy jednostkowo; transakcje i zapis wymagają sprawdzenia na prawdziwym PostgreSQL.
- Widok: rzeczywista mapa, długie opisy, tabela i bloki w edytorze, zachowanie miejsca czytania, błąd autosave i praca offline. Weryfikujemy rzeczywiste zachowanie; nie tworzymy zestawu testów powielających strukturę komponentów.

Pierwsze MVP nie obejmuje nowych osobnych notatek, konfiguratora folderów, edytora map, kolejnych trackerów, historii zapisanych wersji treści, eksportu/importu, kont ani AWS. Te elementy zachowujemy w backlogu, a termin pierwszego tygodnia odnosimy do funkcji opisanych powyżej.

## 7. Źródła modułu i przyszły edytor

Uzgodnienie z 30 września: źródła dokumentów utrzymujemy w Markdown, a lepszy edytor pozostaje przyszłym zadaniem. Każdy materiał ma osobny plik z metadanymi YAML i stabilnymi identyfikatorami. Manifest, nawigacja, mapa i zasoby są rozdzielone. Kompilacja tworzy paczkę JSON wymaganą przez bieżący kontrakt modułu; wynik nie jest źródłem ręcznej edycji ani plikiem wersjonowanym w Git. Oryginalny POC pozostaje referencją, a jego importer nie nadpisuje istniejących źródeł. Test migracji porównuje wszystkie dokumenty, foldery i mapę z referencją.

Edytor kampanii nadal zapisuje dokumenty Tiptap w bazie. Zmiana Markdown lub przebudowa modułu nie nadpisuje jego kopii w istniejącej kampanii. Pełne aktualizacje treści modułu wymagają osobnej polityki wersji i rozstrzygania zmian użytkownika.

Po MVP planujemy:

- Wizualny edytor źródeł modułu: edycja pojedynczego materiału, podgląd zgodny z czytnikiem, zapis Markdown oraz metadanych, bez pracy na zbiorczym JSON-ie.
- Lepszą obsługę tabel, zwijanych bloków, kotwic, obrazów oraz wybierania odnośników do materiałów. Obecne elementy HTML i identyfikatory muszą przetrwać zapis bez strat; nie zakładamy automatycznie bezstratnej konwersji dowolnego HTML do czystego Markdown.
- Wyraźne rozróżnienie edycji źródła modułu i własnej kopii kampanii, z ochroną przed przypadkowym nadpisaniem.
- Walidację i podgląd paczki przed wydaniem oraz osobne, świadome zastosowanie nowej wersji do kampanii z ochroną jej zmian.

Odbiór przyszłego edytora: otwarcie, zmiana i ponowne zapisanie reprezentatywnych materiałów zachowują treść, strukturę, kotwice i cele mapy; błędy nie usuwają lokalnych zmian. Ten etap nie jest częścią obecnego minimum i nie zastępuje obowiązkowego Arcane Blight.

Po uporządkowaniu repozytorium POC jest źródłem historycznym, nie zależnością bieżącego projektu. Budowanie i testy korzystają z utrzymywanych plików Markdown oraz danych odniesienia przypisań materiałów. Opcjonalny importer wymaga jawnie wskazanej zewnętrznej kopii HTML i nowego katalogu wynikowego. Nie odtwarzamy usuniętego katalogu referencji. Dokumentacja i bieżący stan pozostają w `docs/planning`, a README zawiera trwałe informacje o projekcie w języku angielskim.
