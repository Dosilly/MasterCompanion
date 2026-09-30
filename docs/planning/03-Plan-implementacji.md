# Plan implementacji — warsztat projektowy

Wersja robocza 0.19 · 30 września 2026

**Status:** zakres funkcjonalny minimum ustalony po siedemnastu rundach pytań; użytkownik przekazał repozytorium i rozpoczęto implementację fundamentu. Budżet to około 21 godzin pracy użytkownika z agentem. Obowiązkowe są całe Ythryn z POC, mapa, czytelne notatki, edycja, czas, Arcane Blight i proste cofanie. Odpoczynek obejmuje drużynę, wyniki są indywidualne. Eksport/import, nowe osobne notatki, konta, logowanie i historia wersji są odłożone. Stos .NET, Angular, Aspire, PostgreSQL / EF Core, vertical slices, Tiptap JSON i czytnik B pozostają przyjęte. Użytkownik dodał wymaganie mocnej granicy silnika i modułów; opisuje ją [architektura](06-Architektura-modulow.md). Aktualny stan kodu i weryfikacji jest w [migawka stanu implementacji](07-Stan-implementacji.md), zakres w [planie minimum](04-Plan-minimum-tydzien.md), zadania w [planie wykonawczym](05-Plan-wykonawczy-MVP.md). Starsze sekcje zachowują przebieg warsztatu. Plan nie gwarantuje terminu.

Źródła: [koncepcja produktu](00-Koncepcja-produktu.md), [BRD](01-BRD.md), [user stories](02-User-stories.md).

## 1. Punkt wyjścia

Z dokumentów wynika następujący kierunek produktu:

- Osobisty warsztat MG, obejmujący przygotowanie, prowadzenie i uporządkowanie sesji.
- Pełna praca offline w pierwszej wersji; hosting jest przyszłym kierunkiem rozwoju.
- Wspólne materiały i stan kampanii w widokach przygotowania i prowadzenia.
- Niezależne kampanie tworzone z modułu albo od zera.
- Swobodny tekst, obiekty, foldery i linki; mapy jako sposób dostępu do materiałów.
- Czytelność notatek jest najważniejszym kryterium interfejsu; narzędzia śledzenia pełnią rolę pomocniczą. Domyślnie treść i konfiguracja są prezentowane do czytania.
- Czas przesuwany przez MG, trwałe narzędzia i świadomie rozstrzygane przypomnienia.
- Oddzielne zapiski sesji, historia operacji narzędzi i ręcznie prowadzona kronika.
- Pilot oparty na akcie 7 w Ythryn, bez uzależniania ogólnych funkcji od tego materiału.

BRD i user stories zawierają propozycje szczegółowego zakresu. Ich obecność w dokumentach nie oznacza osobnego zatwierdzenia każdego rozwiązania.

## 2. Najważniejsze konsekwencje dla projektu technicznego

Poniższe punkty są interpretacją wymagań, a nie wyborem technologii:

| Obszar | Co musimy rozwiązać | Źródło |
|---|---|---|
| Tożsamość materiałów | Powiązania muszą przetrwać zmianę nazwy i folderu. | BR-03, BR-05; US-03, US-05 |
| Edytor | Swobodna treść, tabele, obrazy, linki do obiektów i podgląd bez utraty wpisywanego tekstu. | BR-04, BR-05; US-04, US-05 |
| Moduły i kampanie | Rozdzielenie materiału startowego, własnych zmian i stanu gry; niezależność kolejnych kampanii. | BR-01, BR-02; US-01, US-02 |
| Mapa i nawigacja | Zachowanie położenia mapy i kontekstu materiałów podczas przechodzenia między nimi. | BR-07; US-07, US-08 |
| Czas i narzędzia | Zachowanie wszystkich należnych wystąpień i ochrona przed ponownym naliczeniem rozstrzygnięcia. | BR-11–14; US-12–17 |
| Cofanie operacji | Spójne cofnięcie zegara, przypomnień i wartości, także wobec późniejszych rozstrzygnięć. | BR-13; US-17 |
| Trwałość | Zapis treści i plików, widoczne błędy zapisu, kompletna kopia oraz bezpieczne odtworzenie. | BR-17; US-20 |
| Przyszły hosting | Zachowanie przenoszalności treści, powiązań i stanu; zakres współdzielenia kodu pozostaje otwarty. | BR-18 |

## 3. Runda pierwsza — odpowiedzi użytkownika

1. **Platforma:** preferowany interfejs w przeglądarce, dostępny lokalnie i ułatwiający przyszłe przeniesienie do chmury. Po drugiej rundzie lokalny backend jest zaakceptowany. Systemy i przeglądarki objęte testami nadal wymagają ustalenia.
2. **Rozwój i utrzymanie:** odpowiada za nie użytkownik. Znany stos: .NET, Angular, Python w mniejszym zakresie, Docker i AWS. To podstawa do rekomendacji, a nie automatyczne zatwierdzenie wszystkich tych technologii w produkcie.
3. **Hosting:** obecny priorytet to rozwój offline bez kosztów hostingu. Architektura ma uwzględniać przyszłe AWS, ale obecny etap nie obejmuje wdrożenia do chmury.

## 4. Proponowana kolejność dalszych rozmów

To agenda projektowania, nie kolejność implementacji.

1. Platformy, ograniczenia, kryteria wyboru technologii i porównanie pasujących wariantów.
2. Pierwszy użyteczny etap: co musi działać, żeby poprowadzić rzeczywistą sesję; dostępny czas i priorytety.
3. Główne widoki i przebieg pracy: mapa, materiał, podgląd, szybkie zapiski i narzędzia.
4. Model treści: dokumenty i obiekty, format edytora, pola, foldery, linki, wyszukiwanie i usuwanie.
5. Dane lokalne: zapis, obrazy, kopie, odtwarzanie, aktualizacje aplikacji i migracje danych.
6. Moduły: przygotowanie przez właściciela produktu, format dostarczania i inicjalizacja kampanii.
7. Czas i narzędzia: aktywności, terminy, zaległości, narzędzia dla bohaterów, korekty i cofanie.
8. Sesje i kronika: stany sesji, źródła wydarzeń, nieznane daty i ręczna kolejność.
9. Podział implementacji na sprawdzalne etapy, zależności i kryteria odbioru powiązane z user stories.

## 5. Materiał do dopracowania pilota

Użytkownik dostarczył folder `Inspiracja - obecna aplikacja` (katalog usunięty z repozytorium; zachowany w historii Git) z samodzielnym HTML oraz czytelnymi źródłami JS, CSS i testami. Przejrzano źródła nawigacji, map, narzędzi i treści osadzone w HTML. Wszystkie 17 istniejących testów zakończyło się powodzeniem. Potwierdzono zgodność plików `app.js`, `tracker-core.js` i `tracker-ui.js` z kodem osadzonym w HTML.

Migawka obejmuje 224 sekcje treści, 25 dokumentów i dwie osadzone mapy; mapa Ythryn zawiera 29 znaczników. Materiałem pilota pozostaje akt 7. Kod iglicy udostępnia odnośniki do komnat; nie należy z tego wywodzić, że obecna aplikacja ma ogólny model zagnieżdżonych map wnętrz.

Przegląd wykonano przez odczyt plików i testy. Interaktywny podgląd nie został zweryfikowany: przeglądarka narzędziowa zablokowała protokół `file://`.

Migawka służy jako inspiracja i źródło scenariuszy. BRD i user stories określają kierunek nowego produktu. HTML nie zawiera bieżącego zapisu liczników MG. Po piątej rundzie ustalono, że pilot zaczyna się od wejścia do Ythryn i nie wymaga przenoszenia stanu obecnej rozgrywki. Reguły Arcane Blight opisane w sekcji 15 zostały zaakceptowane; pozostałe zasady i autorskie modyfikacje modułu nadal wymagają przeglądu.

## 6. Rejestr decyzji

| ID | Przyjęty kierunek | Uzasadnienie i granice |
|---|---|---|
| D-01 | Interfejs przeglądarkowy. | Preferencja użytkownika; po drugiej rundzie zaakceptowany także lokalny backend. |
| D-02 | Pierwszy etap działa lokalnie i offline, bez hostingu. | Użytkownik chce skupić się na rozwoju produktu bez kosztów chmury. |
| D-03 | AWS jako przyszły kierunek wdrożenia. | Projekt ma umożliwiać rozwój w tym kierunku; konkretne usługi i termin wdrożenia pozostają otwarte. |
| D-04 | Lokalny backend .NET i lokalna baza. | Użytkownik zaakceptował model uruchamiania z obsługą przez localhost; silnik ustalono w D-08. |
| D-05 | Wykorzystanie Aspire. | Propozycja użytkownika, aby uprościć uruchamianie całości; szczegółowy model AppHost i paczka użytkowa wymagają zaprojektowania. |
| D-06 | Ręczny eksport/import między komputerami — odłożony. | Pierwotnie przyjęta ścieżka pracy na różnych komputerach. W rundzie piętnastej użytkownik wyłączył przenoszenie stanu z obecnego minimum; kierunek pozostaje na przyszłość. |
| D-07 | Pierwsi użytkownicy: właściciel i kilku zaprzyjaźnionych MG. | Właściciel może pomóc im w instalacji. Konfiguracja techniczna przy pierwszym uruchomieniu jest akceptowalna. |
| D-08 | PostgreSQL + EF Core. | Użytkownik zaakceptował tę propozycję w trzeciej rundzie. |
| D-09 | Wizualny edytor treści. | Użytkownik wybrał pisanie w edytorze formatowanego tekstu. Biblioteka, format zapisu i szczegóły linkowania wymagają wyboru. |
| D-10 | Pierwszy użyteczny etap: mapa i narzędzia odliczania czasu. | Priorytet użytkownika; Arcane Blight doprecyzowano w D-12. Pozostałe wymagania BRD pozostają w planie. |
| D-11 | Vertical slices w backendzie. | Wyraźne życzenie użytkownika. Szczegółowa organizacja przypadków użycia i kodu wspólnego poniżej jest propozycją. |
| D-12 | Arcane Blight jest minimalną wymaganą mechaniką modułową pierwszego etapu. | W rundzie szesnastej ponownie potwierdzono obowiązek w pierwszym tygodniu. Należy do gotowego modułu Ythryn. Nie jest obowiązkowym narzędziem pustej kampanii ani funkcją ogólnego kreatora. Klątwa głodu nie została wskazana jako wymagane minimum. |
| D-13 | Skok czasu jest wykonywany od razu w pełnej zadanej długości. | Aplikacja zachowuje należne sprawy i przypomina o nich po skoku. Nie zatrzymuje automatycznie zegara na pierwszym terminie. |
| D-14 | Wspólny obszar pracy podczas gry, z zachowaniem kontekstu. | Początkowy pomysł dominującej mapy z wąskim opisem bocznym został odrzucony w szóstej rundzie. Aktualny priorytet i układ określa D-20; jednego ekranu nie interpretujemy jako obowiązku stałego pokazywania wszystkich paneli. |
| D-15 | Zachowanie reguł Arcane Blight z HTML w pilocie. | Potwierdzono także powtarzanie ekspozycji zdrowych co 12 godzin, oznaczone w źródle jako autorska propozycja MG. |
| D-16 | Pilot od wejścia do Ythryn, ze stanem początkowym modułu. | Bez obowiązku migracji bieżącego zapisu istniejącej kampanii. Nie przenosimy wyników starej rozgrywki. |
| D-17 | Ekran docelowy minimum Full HD, zwykle monitor 26 cali. | Układ projektujemy dla jednego monitora. Efektywny obszar aplikacji nadal zależy od skalowania systemu i przeglądarki. |
| D-18 | Złożone mechaniki modułów rozwijane w kodzie i wydawane z aplikacją. | Zaakceptowano C# dla reguł i Angular dla widoków. Nowy typ mechaniki może wymagać aktualizacji aplikacji; treści i parametry istniejących typów mogą być dostarczane w paczkach modułów. |
| D-19 | Wybrane parametry mechaniki edytowalne w kampanii, po jawnym włączeniu edycji. | Użytkownik zaakceptował ograniczony zestaw parametrów, np. interwał i początkowe ST. Zwykłe kliknięcie wartości nie otwiera formularza. Szczegóły zastosowania zmian parametrów do istniejącego stanu wymagają projektu. |
| D-20 | Czytelność notatek jest najważniejsza; narzędzia śledzenia są dodatkiem. | Opis lokacji może być długi. Główna treść potrzebuje szerokiej przestrzeni i wygodnego przewijania. W rundzie siódmej wybrano wariant B: mapę otwieraną na żądanie. |
| D-21 | Wariant B: szeroki dokument i mapa na żądanie. | Mapa otwiera się w głównym obszarze; wybór lokacji prowadzi do jej materiału. Uproszczenie mapy w szkicu służyło ocenie układu i nie usuwa znaczników ani przycisków obsługi mapy z zakresu produktu. |
| D-22 | Karty materiałów wewnątrz aplikacji. | Użytkownik przyjął propozycję utrzymywania kilku materiałów z zachowaniem pozycji czytania w każdej karcie. Reguły otwierania linków i podglądu ustalono w D-23. |
| D-23 | Kliknięcie linku otwiera lub aktywuje kartę; podgląd jest osobną akcją. | Ponowne otwarcie materiału wykorzystuje istniejącą kartę. Jawna akcja „Podejrzyj” otwiera szeroki podgląd, bez automatycznego otwierania po najechaniu kursorem. |
| D-24 | Automatyczny zapis treści podczas jawnie włączonej edycji. | Widoczny stan zapisu; zakończenie edycji wraca do czytania po dopilnowaniu zapisu. Przełączenie kart zachowuje rozpoczętą edycję. Szczegóły odzyskiwania zmian i cofania wymagają projektu. |
| D-25 | Pierwsza wersja zawiera bloki „Do odczytania graczom”, „Informacja dla MG” i zwijane sekcje. | Opcjonalne elementy swobodnego dokumentu, bez obowiązkowego szablonu. |
| D-26 | Główne źródła wprowadzanej treści: Markdown i strony internetowe. | Priorytet dla konwersji Markdown oraz wklejania HTML. Nie oznacza przyjęcia edycji źródła Markdown, synchronizacji plików ani importera całych stron. |
| D-27 | Tiptap 3 z własną integracją Angular. | Przyjęto kierunek, z próbą techniczną konwersji, zapisu i własnych bloków przed implementacją całego edytora. Konkretne wersje paczek i wynik próby pozostają do ustalenia. |
| D-28 | Dokument JSON Tiptap/ProseMirror w PostgreSQL. | Przyjęty format przechowywania treści; przewidujemy wersję schematu i migracje. Szczegółowy model tabel nadal jest propozycją. |
| D-29 | Markdown jako wejście, następnie edycja wizualna. | Użytkownik wybrał pierwszy wariant. Edycja całej notatki jako źródła Markdown nie jest wymagana w pierwszym etapie. |
| D-30 | Prosty wspólny model materiałów: nazwa, typ i swobodna treść. | Użytkownik pozostawił wybór autorowi planu. Przyjęto rekomendację: notatka, NPC, lokacja i frakcja korzystają z jednego edytora; opcjonalne szablony pomagają w pisaniu. Pierwszy etap nie wymaga konfiguratora dodatkowych pól ani filtrowania po tych polach. |
| D-31 | Pilot wykorzystuje istniejące teksty, mapy i zasoby Ythryn. | Użytkownik wskazał przeniesienie obecnych materiałów. Odtwarzamy powiązania i przeglądamy wynik; zakres aktu 7 pozostaje przyjęty. Treści poza osadzonym HTML wymagają osobnego ustalenia. |
| D-32 | Materiały potrzebne do prowadzenia znajdują się w aplikacji; pilot nie wymaga odnośników poza nią. | Użytkownik odrzucił zachowanie zewnętrznych odnośników jako sposobu dostępu do treści. Konwersja łączy dostępne materiały wewnętrznie; brakującej treści nie można odtworzyć z samego URL. Obsługę odwołań bibliograficznych i braków opisuje sekcja 35. |
| D-33 | Przyszły import tej samej kampanii umożliwi świadomą aktualizację. | Wcześniej przyjęty przebieg wraz z kopią sprzed importu zachowujemy do późniejszego etapu. Cały eksport/import został wyłączony z obecnego minimum w rundzie piętnastej. |
| D-34 | Historia wersji notatek odłożona na przyszłość. | Użytkownik wykluczył ją z pierwszej wersji ze względu na zakres implementacji. Bieżące Cofnij / Ponów w edytorze i autosave pozostają w planie; pełne archiwa kampanii odłożono w rundzie piętnastej. Rewizja zapisu do ochrony przed konfliktem nie oznacza przechowywania poprzednich treści. |
| D-35 | Cofanie operacji czasu i narzędzi kolejno od ostatniej. | Użytkownik wybrał prostszy wariant. Cofamy pełną operację i jej skutki; edycja dokumentów jest niezależna. Wybór starszej operacji i automatyczne cofanie zestawu zależności pozostawiono poza pierwszym etapem. |
| D-36 | Pierwszy odbiór i instrukcje dla Windows, z przenośnym stosem. | Użytkownik chce skupić się na Windows. Nie wprowadzamy zależności systemowych bez potrzeby; działanie innych platform nie jest w tym etapie osobno sprawdzane. |
| D-37 | Cel: tydzień po około 3 godziny dziennie z agentem. | Odpowiedź rundy piętnastej zastępuje wcześniejsze 1–2 godziny. Około 21 godzin jest budżetem pracy i przeglądu, nie zweryfikowaną estymacją; po próbie technicznej sprawdzamy realność podziału. |
| D-38 | Konta, użytkownicy i logowanie dopiero w przyszłości. | Wyraźne życzenie użytkownika. Lokalne minimum nie zawiera implementacji tych ekranów, tabel ani przepływów; model dostępu projektujemy przed hostingiem. |
| D-39 | Eksport/import i przenoszenie stanu poza obecną wersją. | Jawna redukcja zakresu przez użytkownika. Nie planujemy teraz archiwów, aktualizacji przez import, ekranów przenoszenia ani testów tego przepływu. Lokalny zapis i zachowanie danych po restarcie nadal są wymagane. |
| D-40 | Pełne Ythryn z POC; mapa i notatki przed rozbudową edycji. | Obejmuje wszystkie 16 dokumentów i 142 sekcje aktu 7 oraz mapę z 29 znacznikami, w tym iglicę i materiały dodatkowe. Nie zawężamy rezultatu do próbnej lokacji ani samych 29 opisów. D-41 potwierdza edycję i mechanikę jako obowiązkowe, a D-42 ogranicza edycję do istniejących materiałów. |
| D-41 | Arcane Blight oraz edycja muszą wejść do pierwszego tygodnia. | Wyraźna odpowiedź użytkownika: „musi wejść arcane blight oraz edycja”. Nie są opcjonalnymi dodatkami do czytnika. Zachowujemy proponowany prosty edytor całych opisów zgodny z wcześniejszym kierunkiem. |
| D-42 | Wystarczy edycja istniejących materiałów. | Użytkownik wybrał pierwszy wariant. Własne uwagi można dopisywać do opisów; tworzenie nowych osobnych notatek jest poza minimum. |
| D-43 | Wspólny długi odpoczynek całej drużyny wystarczy. | Użytkownik wybrał pierwszy wariant. Nie budujemy wyboru uczestników; każdy bohater nadal ma osobny stan i wynik Arcane Blight. |
| D-44 | Mocna granica modułów i silnika. | Wymaganie użytkownika. Osobne projekty .NET i biblioteki Angulara, wspólne kontrakty, host jako miejsce składania. Niezależne instalowanie kodu modułów i mikrofrontendy pozostają otwartym pytaniem; na MVP rekomendujemy wspólne wydanie zgodne z D-18. |
| D-45 | Moduł jest ogólną abstrakcją; Ythryn jej pierwszą implementacją. | Silnik obsługuje neutralne kontrakty folderów, materiałów, map i narzędzi. Nazwy przygód i mechaniki pozostają w implementacjach modułów. |
| D-46 | Poprawki bieżącego czytnika. | Zamknięcie karty przez × i środkowy przycisk po zapisie; focus, wyraźne zaznaczenie i centrowanie aktywnego materiału; trwała preferencja jasnego/ciemnego motywu; zagnieżdżona nawigacja zgodna ze źródłem POC. |

## 7. Kierunek techniczny i otwarte propozycje

**Status:** lokalny backend .NET, Angular, Aspire, PostgreSQL, EF Core, vertical slices oraz Tiptap 3 z dokumentem JSON przyjęte. Szczegóły przechowywania plików, bibliotek pomocniczych i dystrybucji pozostają rekomendacjami.

### 7.1. Dwa znaczenia pracy offline w przeglądarce

| Wariant | Działanie bez internetu | Konsekwencje |
|---|---|---|
| Angular i lokalny backend .NET | Przeglądarka łączy się z usługą na tym samym komputerze. Usługa zapisuje dane w lokalnej bazie i magazynie plików. | Wymaga uruchomienia backendu. Umożliwia wykorzystanie tego samego rdzenia backendu przy przyszłym hostingu. |
| Samodzielna aplikacja przeglądarkowa, np. PWA | Po przygotowaniu aplikacji jej kod, dane i pliki są dostępne po stronie przeglądarki. | Wymaga lokalnego modelu zapisu i logiki potrzebnej offline. Późniejsza współpraca z backendem chmurowym wymaga osobnego projektu przenoszenia danych lub synchronizacji. |

Po drugiej rundzie wybrano pierwszy wariant. Odpowiada doświadczeniu użytkownika i daje miejsce dla spójnej logiki czasu, narzędzi oraz cofania operacji w .NET. Drugi wariant pozostaje tutaj jako zapis rozważanej alternatywy.

Angular Service Worker zapewnia podstawowe mechanizmy cache, ale sam nie dostarcza pełnego zapisu kampanii ani synchronizacji zmian. Dane przechowywane przez przeglądarkę podlegają zasadom limitów i trwałości danego środowiska. To dodatkowe zagadnienia projektowe w drugim wariancie. Źródła: [Angular — Service Workers](https://angular.dev/ecosystem/service-workers), [MDN — storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

### 7.2. Proponowany zestaw komponentów

| Element | Propozycja | Powód |
|---|---|---|
| Interfejs | Angular i TypeScript. | Zgodność z doświadczeniem osoby utrzymującej produkt i wymaganiem pracy w przeglądarce. |
| Backend | ASP.NET Core; vertical slices grupowane według obszarów funkcjonalnych. Propozycja uruchamiania jako jednej aplikacji. | Przypadki użycia obejmują pełną obsługę czynności MG; współdzielone reguły czasu i narzędzi zapewniają spójność. |
| Dostęp do danych | EF Core; dla PostgreSQL provider Npgsql. | Rozwiązanie zgodne ze stosem .NET. Szczegółowy model danych i granice transakcji wymagają dalszego projektu. |
| Baza | PostgreSQL — zaakceptowane. | Pozwala zachować ten sam silnik przy późniejszym wdrożeniu do AWS; kosztem osobnego procesu bazy również lokalnie. |
| Edytor | Tiptap 3 z własną integracją Angular i dokumentem JSON — zaakceptowane. | Tabele, obrazy, własne bloki i wewnętrzne linki wymagają sprawdzenia w krótkim prototypie technicznym. Markdown służy do wprowadzania treści. |
| Mapy i obrazy | Lokalny magazyn plików, z identyfikatorami zasobów niezależnymi od fizycznych ścieżek. | Ułatwia późniejsze dodanie magazynu S3 oraz eksport kompletnej kampanii. |
| Uruchamianie podczas rozwoju | Aspire AppHost z zasobami Angular, API i PostgreSQL; Docker uruchamia kontener bazy. | Aspire wybrane przez użytkownika do uproszczenia uruchamiania. Frontend i API mogą działać jako procesy lokalne. |
| Paczka dla MG | Gotowe obrazy i konfiguracja Docker Compose, potencjalnie generowana z modelu Aspire; zbudowany Angular może być udostępniany przez ASP.NET Core. | Propozycja dystrybucji bez wymagania kompilacji kodu przez MG. Szczegółowa konfiguracja do sprawdzenia w prototypie technicznym. |

PostgreSQL z EF Core ma oficjalnie dokumentowany provider [Npgsql](https://www.npgsql.org/efcore/). Uruchamianie ASP.NET Core w kontenerach opisuje [Microsoft Learn](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/docker/building-net-docker-images?view=aspnetcore-10.0). Konkretne wersje komponentów dobierzemy przed implementacją, po sprawdzeniu wsparcia i zgodności.

Rozważano SQLite jako wariant upraszczający instalację. Po trzeciej rundzie wybrano PostgreSQL; utrzymywanie dwóch silników bazy nie jest częścią obecnej propozycji.

Proponowany warunek odbioru offline: po zainstalowaniu środowiska i przygotowaniu obrazów aplikacja uruchamia się ponownie bez internetu oraz obsługuje pełny cykl kampanii. Kod, fonty, ikony, mapy i inne zasoby wymagane podczas gry muszą być lokalne. Dane bazy i pliki muszą znajdować się w trwałych lokalizacjach poza zapisywalną warstwą kontenera.

### 7.3. Kierunek AWS i jego granice

Możliwe późniejsze odpowiedniki infrastruktury to kontener aplikacji w [Amazon ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html), PostgreSQL w [Amazon RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html) i pliki w [Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html). Jest to przykład zgodnej ścieżki rozwoju, nie wybrana architektura wdrożenia ani oszacowanie kosztów.

Przeniesienie hostowania nadal będzie wymagało projektu dostępu użytkowników, ochrony kampanii, konfiguracji infrastruktury, przeniesienia danych i obsługi operacyjnej. Samo przeniesienie backendu do AWS nie zapewni działania przeglądarki po utracie połączenia z tym backendem. Obecna propozycja zapewnia offline dzięki lokalnej usłudze. Zakres pracy offline i ewentualnej synchronizacji w przyszłej wersji hostowanej pozostaje osobną decyzją.

## 8. Runda druga — odpowiedzi użytkownika

1. Lokalny backend i baza są akceptowalne. Użytkownik proponuje Aspire, aby łatwiej uruchamiać całość.
2. Przygotowanie i prowadzenie odbywają się na różnych komputerach. Wystarczy ręczny eksport/import kampanii.
3. Pierwszą wersję uruchamia właściciel i kilku zaprzyjaźnionych MG. Właściciel może pomóc im w instalacji.

## 9. Konsekwencje drugiej rundy — propozycje szczegółów

### 9.1. Rola Aspire

AppHost ma opisywać zależności potrzebne do pracy nad produktem: frontend, backend oraz bazę. Docker pozostaje środowiskiem uruchamiającym kontenery. Proponowany backend jest jedną aplikacją podzieloną na obszary funkcjonalne; wybór Aspire nie przesądza liczby usług.

Do rozważenia jest generowanie paczki Docker Compose z modelu Aspire i dostarczanie MG gotowych obrazów. Aspire obsługuje publikowanie artefaktów dla Docker Compose. To pozwala oddzielić narzędzia potrzebne do rozwijania produktu od wymagań potrzebnych do używania gotowej wersji. Źródła: [Aspire — prerequisites](https://aspire.dev/get-started/prerequisites/), [Aspire — Docker Compose deployment](https://aspire.dev/deployment/docker-compose/).

Trwałość danych PostgreSQL wymaga wolumenu danych; pozostawianie uruchomionego kontenera pomiędzy startami AppHost jest osobną opcją i nie zastępuje trwałego zapisu. Dla środowiska zawierającego prawdziwe kampanie potrzebujemy jawnych wersji obrazów i procesu aktualizacji bazy. Źródło: [Aspire — resource lifetimes](https://aspire.dev/app-host/resource-lifetimes/).

### 9.2. Przenoszenie kampanii jako zwykła czynność użytkowa

**Aktualizacja po rundzie piętnastej:** cały poniższy przebieg dotyczy przyszłego etapu. Użytkownik odłożył eksport/import i przenoszenie stanu poza obecną wersję.

W docelowej funkcji eksport/import ma być dostępny z interfejsu aplikacji. Propozycja to pojedyncze archiwum kampanii zawierające wersjonowany manifest, treści, pliki, powiązania, sesje, kronikę, czas, narzędzia i ich historię. Kampania powinna być przenośna bez kopiowania wolumenów Dockera albo całej instalacji.

Proponowany scenariusz: przygotowanie na komputerze A → eksport → import na komputerze B → prowadzenie sesji → eksport → import na komputerze A.

Do projektu importu przyjmujemy jako propozycje do dalszego przeglądu:

- Zachowanie identyfikacji tej samej kampanii przy przenoszeniu i rozróżnienie jej od świadomego utworzenia niezależnej kopii.
- Rozpoznawanie rewizji i pochodzenia eksportu; sama data pliku nie wystarcza do określenia, która kopia zawiera właściwy stan.
- Po rozpoznaniu tej samej kampanii jawny wybór aktualizacji z kopią stanu sprzed importu albo utworzenia niezależnej kopii. Aktualizacja jest przyjętą typową ścieżką powrotu między komputerami (runda dwunasta, sekcja 33).
- Walidacja kompletności i zgodności archiwum przed zastąpieniem danych.
- Widoczny komunikat przy rozbieżnych zmianach na obu komputerach; automatyczne scalanie pozostaje poza proponowanym zakresem pierwszej wersji.

Techniczny model rewizji, atomowość importu i format archiwum zostaną dopracowane po wyborze modelu danych. Kopia kampanii i kopia całej instalacji są odrębnymi zagadnieniami.

## 10. Runda trzecia — odpowiedzi użytkownika

1. PostgreSQL + EF Core: tak.
2. Edytor wizualny.
3. Pierwszy etap używany podczas sesji: mapa i narzędzia odliczania czasu.
4. Dodatkowe wymaganie: vertical slices w backendzie.

## 11. Wnioski z obecnej aplikacji

Poniższe obserwacje opisują źródła referencji. Parametry Ythryn są zawartością modułu, a nie stałymi ogólnego produktu.

| Obszar | Zachowanie w referencji | Wniosek do projektu |
|---|---|---|
| Mapa | Znacznik otwiera opis pod mapą. Kod zapamiętuje powiększenie i przesunięcie map w obrębie działania strony. | Zachowanie orientacji jest ważne. Docelowe położenie opisu i narzędzi na ekranie wymaga decyzji. |
| Opis lokacji | Y4 rozdziela tekst do odczytania, informacje MG, tabelę testów i zwijane tło. | Edytor powinien umożliwiać taki układ bez obowiązkowego formularza lokacji. |
| Czas | Osobno cały pobyt w mieście i minuty eksploracji. Dostępne są skróty +5, +30 i +60 minut oraz dowolny przyrost. | Główny zegar kampanii, czas od punktu odniesienia i czas określonej aktywności mają różne znaczenie. |
| Czynności | Przeszukanie budynku dodaje 30 minut i osobne sprawdzenia; koniec odpoczynku jest zdarzeniem, również bez dodawania czasu. | Sama liczba minut nie opisuje wszystkich bodźców narzędzi. Potrzebne są także jawne czynności MG. |
| Zaległości | Skok o kilka okresów pozostawia kolejne należne wystąpienia do rozliczenia. | Przyjęto pełny skok od razu. Trzeba zachować należne czasy i zależności między rozstrzygnięciami. |
| Frakcje | Przekroczenie terminu wyświetla przypomnienie; faktyczne przybycie ustawia MG. | Termin i fakt fabularny pozostają rozdzielone. |
| Narzędzia postaci | Arcane Blight reaguje na ekspozycję oraz koniec odpoczynku i utrzymuje niezależny stan każdego bohatera. | Przyjęto jako obowiązkową mechanikę modułu pilotażowego w pierwszym etapie. |
| Nieznany stan | Godzina posiłku i wyczerpanie mogą pozostać nieustalone. | Nieznanej wartości nie należy zastępować zerem ani wymyślonym zdarzeniem. |
| Cofanie | Referencja zachowuje do 20 poprzednich pełnych stanów narzędzi; cofnięcie odtwarza poprzedni stan. | Potrzebna jest spójna jednostka operacji. Limit i mechanizm snapshotów nie są wymaganiami nowej aplikacji. |
| Zapis | LocalStorage i eksport JSON obejmują stan narzędzi; teksty i mapy są osadzone osobno w HTML. | Nowy eksport musi objąć całą kampanię, również edytowalne materiały i pliki. |

Testy referencji sprawdzają m.in. granicę 12 godzin, zaległe rzuty, ekspozycję podczas odpoczynku, niezależność postaci, cykliczne przypomnienia i cofanie. Ich powodzenie potwierdza te przypadki w źródłach referencyjnych, nie stanowi odbioru nowej aplikacji ani kompletnej walidacji wszystkich zachowań referencji.

## 12. Proponowana organizacja vertical slices

Status: vertical slices przyjęte; konkretna struktura i mechanizmy poniżej do dalszego dopracowania.

Przypadek użycia zawiera blisko siebie kontrakt wejścia/wyjścia, endpoint, walidację, obsługę i zapytania EF Core. Przykładowe grupowanie:

```text
Features/
  Campaigns/CreateCampaign/
  Campaigns/ExportCampaign/
  Campaigns/ImportCampaign/
  Materials/SaveMaterial/
  Maps/GetMap/
  Maps/PlaceMarker/
  Time/AdvanceTime/
  Time/EndRest/
  Tools/CreateReminder/
  Tools/ResolveReminder/
  Operations/UndoLastOperation/
```

To szkic katalogów, nie utworzona struktura kodu. Dobór mechanizmu endpointów i ewentualnej biblioteki do obsługi żądań pozostaje osobną decyzją.

Propozycje zasad implementacji:

- Wspólne reguły czasu i narzędzi mają jedno miejsce w kodzie domenowym. Slice koordynuje wykonanie czynności; nie powiela zasad używanych przez inne czynności.
- EF Core może być używane bezpośrednio w obsłudze przypadku użycia. Osobne kontrakty warto przewidzieć dla magazynu plików i innych zewnętrznych zależności.
- `AdvanceTime` powinno zapisywać zegar, wynikające z niego zmiany stanu, nowe należne sprawy oraz historię operacji jako spójną transakcję w bazie. Rozstrzygnięcia MG pozostają osobnymi operacjami.
- `EndRest` jest osobną czynnością. Proponowany skrót „odpoczynek +8 h” łączy przesunięcie czasu i zakończenie odpoczynku w jedną operację; długość wynika z konfiguracji, a nie reguły zaszytej dla każdej kampanii.
- Ponowienie tego samego żądania nie może ponownie dodać czasu lub skutków rozstrzygnięcia. Projekt obejmie identyfikację operacji i kontrolę wersji zmienianego stanu, również przy dwóch kartach przeglądarki.
- Cofanie operacji czasu obejmuje jej powiązane skutki; nie może usuwać niezależnych późniejszych zmian materiałów. Szczegóły zakresu i zależności ustalimy na przykładach użytkowych.
- Zegary świata reagują na czynności MG. Upływ czasu rzeczywistego nie jest potrzebny do uruchamiania przypomnień w grze.

## 13. Pierwszy użyteczny etap — szkic zakresu

Zaakceptowany pierwotny cel: **mapa i narzędzia odliczania czasu**. Po korekcie interfejsu nadrzędnym kryterium jest czytelność materiałów; aktualną propozycję kolejności realizacji opisuje sekcja 38.

Proponowane minimum wspierające ten cel:

1. Kampania z trwałym zapisem, mapą, opisami miejsc i znacznikami.
2. Otwieranie materiału z mapy oraz podstawowa edycja wizualna.
3. Zegar świata i czas od wybranego momentu; rozróżnienie eksploracji i odpoczynku.
4. Terminy jednorazowe, przypomnienia cykliczne oraz panel spraw do rozstrzygnięcia.
5. Arcane Blight z modułu Ythryn: osobny stan bohaterów, ekspozycje, rozstrzygnięcia po odpoczynku i jawnie wpisywane wyniki.
6. Spójna korekta ostatniej operacji czasu, zapis po ponownym uruchomieniu i eksport/import między komputerami.

Arcane Blight jest zatwierdzonym minimum modułowym. Klątwa głodu, pozostałe mechaniki modułowe i szczegółowy zestaw skrótów aktywności nadal wymagają wyboru zakresu. Pozostałe funkcje BRD, w tym pełny kreator, rozbudowana organizacja materiałów, sesje i kronika, pozostają w planie; ich kolejność zostanie ustalona po domknięciu pierwszego etapu.

## 14. Runda czwarta — odpowiedzi po przeglądzie inspiracji

1. Arcane Blight jest wymaganym minimum. Użytkownik podkreślił, że jest częścią gotowego modułu, a nie narzędziem generycznym.
2. Można przesunąć czas od razu o cały zadany okres i później przypomnieć o zaległych sprawach.
3. W tej rundzie zaakceptowano wspólny ekran z mapą, bocznym opisem, zegarem i rozwijanymi narzędziami. **Ustalenie o bocznym opisie zostało zastąpione w rundzie szóstej:** pierwszeństwo ma szeroki obszar czytania; aktualne warianty opisuje sekcja 18.

## 15. Runda piąta — reguły pilota i ekran

1. Użytkownik potwierdził następujące reguły Arcane Blight w module pilotażowym:
   - zdrowe postacie mają sprawdzenie ekspozycji co 12 godzin;
   - porażka ekspozycji zakaża i nie zwiększa licznika porażek po odpoczynku;
   - zakażeni mają sprawdzenie po długim odpoczynku;
   - sukces po odpoczynku obniża ST o wynik k6 wpisany przez MG;
   - trzecia porażka po odpoczynku powoduje przemianę.
2. Pilot zaczyna się przy wejściu do Ythryn, ze stanem początkowym modułu.
3. Typowy ekran to monitor 26 cali, minimum Full HD.

W referencji początkowe ST wynosi 15, osiągnięcie ST 0 oznacza wyleczenie i odporność, a leczenie magiczne przywraca stan zdrowy bez odporności. Te zachowania pochodzą z przyjętej referencji i powinny być jawnie opisane w specyfikacji mechaniki. Wersja pilota nie przenosi automatycznie klątw i wartości ze starej rozgrywki. Imiona i liczba bohaterów pozostają danymi drużyny.

## 16. Propozycja granicy między aplikacją a mechaniką modułu

**Przyjęte:** Arcane Blight należy do modułu; pierwsze złożone mechaniki rozwijamy w kodzie i dostarczamy z aplikacją. MG może zmieniać wybrane parametry w jawnie włączonym trybie edycji. Szczegółowa lista parametrów i skutki ich zmian wymagają projektu.

| Element | Odpowiedzialność |
|---|---|
| Ogólne możliwości aplikacji | Kampanie, drużyna, czas świata, aktywności, przechowywanie stanu, historia operacji, wspólna lista należnych spraw i ogólne typy narzędzi. |
| Implementacja modułu | Foldery, materiały, mapy, domyślna konfiguracja oraz własne reguły i narzędzia. W pilocie implementacją jest Ythryn z Arcane Blight. Każdy moduł definiuje swoje wartości i rozstrzygnięcia przez wspólne kontrakty. |
| Konkretna kampania | Własna kopia konfiguracji, przypisanie mechaniki do bohaterów, ich wyniki, terminy i historia. Zmiana kampanii nie modyfikuje modułu. |

Dla pierwszych modułów przyjęto implementowanie złożonych mechanik w kodzie projektu: reguły i obsługa w C#, dedykowany widok w Angularze. Kod mechaniki ma wyraźnego właściciela, np. `Modules/Ythryn/ArcaneBlight`, i jest dostarczany wraz z wydaniem aplikacji. Ogólne slices czasu wywołują zarejestrowane mechaniki aktywne w kampanii. Pusta kampania nie uruchamia Arcane Blight.

Przykładowe slices modułu: `StartTracking`, `ResolveExposure`, `ResolveRestCheck`, `CorrectCharacterState`. Dokładny podział dostosujemy do kontraktów API; reguły mechaniki pozostają współdzielone przez jej przypadki użycia. Wspólne kontrakty narzędzi nie wymagają, aby każde narzędzie miało identyczny formularz.

Ten wybór oznacza, że zupełnie nowy typ złożonej mechaniki będzie początkowo dostarczany z aktualizacją aplikacji. Treści i parametry już obsługiwanych mechanik mogą należeć do paczki modułu. Swobodę dostarczania niezależnego kodu przez zewnętrzne moduły pozostawiamy do osobnej decyzji, zgodnie z późniejszym etapem publikowania modułów przez użytkowników.

W eksporcie kampanii trzeba zachować identyfikację wymaganej mechaniki i wersję jej stanu. Import sprawdza zgodność obsługi; nie może po cichu odrzucić nieznanego narzędzia. Zmiana kodu lub wzoru nie powinna samoczynnie zmienić zasad trwającej kampanii.

## 17. Duży skok czasu i zależne rozstrzygnięcia

Przyjęto natychmiastowe przesunięcie głównego zegara o cały zadany okres. Należne sprawy zachowują własny czas wystąpienia, odrębny od chwili ich obsługi przez MG.

Przykład: zegar przesunięto do 24. godziny. Bohater ma nieustaloną ekspozycję z 12. godziny. Sukces może pozostawić kolejną ekspozycję w 24. godzinie. Porażka oznacza zakażenie w 12. godzinie i przejście do sprawdzeń po odpoczynku. Aplikacja nie może z góry potraktować wszystkich późniejszych ekspozycji jako niezależnych, pewnych rzutów.

Proponowane zachowanie:

- Rozstrzygnięcia zależne w obrębie jednej postaci i mechaniki są przetwarzane w kolejności należnych zdarzeń. Bohaterowie mogą być obsługiwani niezależnie.
- Po wyniku wcześniejszego sprawdzenia mechanika wyznacza następne właściwe sprawy, również należne przed aktualnym czasem świata.
- Zakażenie jest datowane na należny czas ekspozycji. Jeżeli w międzyczasie zakończono odpoczynek, jego zdarzenie pozostaje dostępne do ustalenia kolejnego sprawdzenia.
- Panel odróżnia znane zaległe wystąpienia prostego przypomnienia od kolejnego sprawdzenia mechaniki, której dalszy przebieg zależy od wyniku. Licznik nie powinien przedstawiać hipotetycznych spraw jako pewnych.
- Historia potrzebnych czynności, np. zakończeń odpoczynku, jest trwała. Nie przesądza to użycia pełnego Event Sourcing.
- Korekta wcześniejszego wyniku musi uwzględnić zależne późniejsze rozstrzygnięcia. Mechanizm korekt i cofania dopracujemy osobno.

## 18. Układ prowadzenia — korekta po przeglądzie szkicu

Pierwszy szkic z dominującą mapą i wąskim bocznym opisem został odrzucony. Nie jest podstawą dalszego projektowania czytnika. Użytkownik wskazał czytelność długich notatek jako najważniejszą funkcję aplikacji; narzędzia śledzenia są pomocnicze.

Aktualne zasady projektowe:

- Szeroka główna przestrzeń na dokument: nagłówki, akapity, tekst do odczytania, tabele zasad, obrazy i zwijane sekcje.
- Szerokość tekstu ograniczona do wygodnego czytania; szerokie tabele i obrazy mogą wykorzystywać więcej miejsca. Duży monitor nie oznacza rozciągania każdego akapitu na całą szerokość.
- Zwięzła nawigacja materiałów, wyszukiwanie i spis sekcji dokumentu. Możliwość zwinięcia nawigacji jest propozycją do dopracowania.
- Mapa zapewnia wybór lokacji. W trakcie czytania nie wymusza zwężenia dokumentu.
- Zegar i sygnał należnych spraw mogą być stale dostępne w niewielkim pasku. Pełne narzędzia otwiera MG świadomą czynnością, z zachowaniem pozycji czytanego materiału.
- Zmiana mapy, otwarcie narzędzi i podgląd linkowanego obiektu zachowują miejsce w dokumencie. Mapa zachowuje własne powiększenie i przesunięcie.
- Jednego ekranu nie traktujemy jako obowiązku zmieszczenia całego długiego dokumentu i wszystkich narzędzi bez przewijania.

Porównane warianty (w rundzie siódmej wybrano B):

| Wariant | Zachowanie | Główna konsekwencja |
|---|---|---|
| A. Mapa nad notatką | Układ podobny do POC: mapa nad szerokim opisem; wybór znacznika przenosi do opisu; dostępny powrót do mapy i jej zwinięcie. | Mapa i tekst należą do jednej strony. Trzeba dopracować przewijanie i powrót do dokumentu. |
| B. Notatka z mapą na żądanie | Dokument zajmuje główną przestrzeń. Przycisk otwiera mapę w tym samym obszarze, a wybór miejsca przywraca szeroki dokument. | Cała przestrzeń pracy może służyć czytaniu; przełączanie wymaga zachowania kontekstu obu widoków. |

**Przyjęto wariant B.** Mapa zachowuje interaktywne znaczniki otwierające materiały, przybliżanie, oddalanie i przesuwanie. Przesuwanie znaczników pozostaje czynnością trybu edycji. Szkic zawierał uproszczoną mapę do porównania układów i nie ogranicza docelowych funkcji. Wariant A pozostaje wyłącznie zapisem rozważanej alternatywy. Szkice nie są implementacją produktu.

## 19. Runda szósta — odpowiedzi o modułach i priorytetach interfejsu

1. Zaakceptowano złożone mechaniki rozwijane w kodzie i wydawane z aplikacją.
2. Zaakceptowano wybrane edytowalne parametry, z zastrzeżeniem wyraźnego trybu edycji. Domyślne kliknięcia nie mają stale otwierać pól.
3. Odrzucono wąski panel notatek. Czytelność długich materiałów jest najważniejsza; narzędzia są dodatkiem. Wymagany jest układ zbliżony do POC albo inny zapewniający odpowiednią przestrzeń dla tekstu.

## 20. Czytanie, obsługa narzędzia i edycja

**Przyjęte:** domyślny widok służy czytaniu; edycja wymaga jawnego wejścia. **Propozycja:** wejście w edycję dotyczy wybranego materiału albo konfiguracji konkretnego narzędzia, zamiast odblokowywania wszystkich elementów kampanii naraz.

| Czynność | Proponowane zachowanie |
|---|---|
| Kliknięcie treści notatki | Czytanie lub zaznaczanie tekstu; link otwiera wskazany materiał; brak automatycznego wejścia w edycję. |
| Kliknięcie „Edytuj notatkę” | Włącza edytor wizualny, pokazuje pasek formatowania i wyraźne oznaczenie trybu. Przyjęto automatyczny zapis z widocznym statusem; „Zakończ edycję” wraca do czytania po dopilnowaniu zapisu. |
| Kliknięcie znacznika mapy | Otwiera materiał. Przesuwanie znaczników i zmiana powiązań wymagają jawnego trybu edycji mapy. |
| Użycie przycisku „+30 min” albo „Sukces” | Zwykła obsługa podczas sesji; pozostaje dostępna bez włączania edycji konfiguracji. Formularz wyniku k6 otwiera się w ramach świadomie wybranego rozstrzygnięcia. |
| Kliknięcie wartości ST lub interwału | Odczyt wartości; brak automatycznego formularza. |
| Kliknięcie „Edytuj konfigurację” | Pokazuje dopuszczone parametry konkretnego narzędzia, domyślne wartości modułu i skutki proponowanej zmiany. |
| Ręczna korekta stanu postaci | Osobna jawna czynność z historią korekty. Zmiana parametru reguły i korekta bieżącego wyniku mają różne znaczenie. |

Widoki przygotowania i prowadzenia mogą korzystać z tych samych materiałów i tego samego jawnego sposobu wejścia w edycję. Tryb prowadzenia nie blokuje potrzebnej edycji, ale też jej nie uruchamia przy zwykłym czytaniu.

## 21. Runda siódma — czytanie i nawigacja

1. Przyjęto wariant B — szeroką notatkę z mapą na żądanie. Brak pełnych przycisków mapy w szkicu został wyjaśniony jako uproszczenie prezentacji, nie zmiana zakresu.
2. Przyjęto karty materiałów wewnątrz aplikacji z zachowaniem miejsca czytania.

## 22. Działanie kart i zapisu

W rundzie ósmej przyjęto otwieranie linków w kartach z osobnym podglądem oraz automatyczny zapis treści. Poniżej opis zachowania; szczegóły wskazane jako wymagające dopracowania pozostają otwarte.

- Kliknięcie linku do materiału otwiera i aktywuje jego kartę. Jeżeli materiał jest już otwarty, aplikacja przechodzi do istniejącej karty zamiast tworzyć duplikat. Otwieranie materiału ze znacznika mapy stosuje tę samą zasadę.
- Zwykły powrót do karty zachowuje pozycję czytania. Link wskazujący konkretną sekcję świadomie przenosi do niej; identyfikatory sekcji i zachowanie powrotu wymagają dopracowania.
- Przełączenie karty zachowuje stan trwającej edycji. Samo otwarcie innego materiału nigdy nie uruchamia w nim edytora.
- Mapa i dokumenty współdzielą główny obszar. Mapa zachowuje powiększenie i przesunięcie; po wyborze miejsca MG przechodzi do jego karty. Szczegółowa postać przełącznika mapy pozostaje do dopracowania.
- Dodatkowa jawna akcja „Podejrzyj” otwiera szeroki podgląd materiału nad bieżącą notatką, z możliwością otwarcia pełnej karty. Zwykłe przesuwanie kursora nie otwiera podglądu. Realizuje to potrzebę szybkiego podglądu z BR-05 / US-05 bez stałego zwężania dokumentu.
- Przyjęty zapis treści: automatyczny zapis po krótkiej przerwie podczas jawnie włączonej edycji, z widocznym stanem „Zapisywanie”, „Zapisano” albo „Błąd zapisu”. „Zapisano” oznacza potwierdzenie trwałego zapisu przez backend. „Zakończ edycję” wraca do czytania po dopilnowaniu zapisu.
- Błąd zapisu nie może zamknąć edytora ani odrzucić tekstu. Bufor odzyskiwania zmian i zachowanie przy zamykaniu aplikacji wymagają osobnej specyfikacji; nie zakładamy gwarancji zapisu ostatnich znaków przy nagłym przerwaniu pracy.
- Nie wybrano ręcznego „Zapisz / Anuluj” jako podstawowego sposobu zapisu dokumentu. Wybór dotyczy treści; osobne zatwierdzanie konfiguracji mechanik ze względu na wpływ na trwającą kampanię pozostaje rekomendacją.

## 23. Runda ósma — linki i zapis treści

1. Przyjęto rekomendację: kliknięcie linku otwiera lub aktywuje kartę; szeroki podgląd stanowi osobną jawną akcję.
2. Wybrano automatyczny zapis treści w trybie edycji.

## 24. Edytor — zakres do wyboru biblioteki

BR-04 i US-04 wymagają nagłówków, akapitów, list, tabel, obrazów i linków oraz swobodnego układu bez obowiązkowego szablonu. Linki do materiałów identyfikują obiekt niezależnie od jego nazwy i folderu. Tryb czytania nie pokazuje narzędzi formatowania.

Robocza propozycja doświadczenia edycji:

- Jeden dokument z klasycznym paskiem formatowania i możliwością wstawiania elementów specjalnych.
- **Przyjęte w rundzie dziewiątej:** gotowe wyróżnienia „Do odczytania graczom” oraz „Informacja dla MG” i zwijane sekcje z własnym tytułem. Są opcjonalne, można przeplatać je swobodnym tekstem. Oznaczenie „dla MG” jest stylem treści w aplikacji dla MG, nie mechanizmem uprawnień ani zapowiedzią widoku gracza.
- Spójne style nagłówków i wyróżnień, tak aby długie materiały pozostały czytelne. Zakres swobodnego doboru kolorów, krojów i wielkości liter pozostaje do dopracowania.
- Link do innego materiału wstawiany przez wyszukanie go w kampanii; skrót typu @ może być uzupełnieniem, nie jedyną metodą.
- Zmiana nazwy obiektu nie zrywa linku; sposób wyświetlania własnej etykiety odnośnika wymaga doprecyzowania.

W rundzie dziesiątej wybrano Tiptap 3 i dokument JSON. Przy doborze konkretnych paczek nadal należy sprawdzić licencje potrzebnych rozszerzeń, integrację z Angularem, działanie bez internetu, własne typy treści oraz wklejanie tabel i obrazów. Ocena dokumentacji i plan próby technicznej znajdują się w sekcji 26.

Konsekwencje automatycznego zapisu do uwzględnienia w projekcie technicznym: kolejność zapisów jednego dokumentu, ochrona przed nadpisaniem nowszej treści starszym żądaniem, zachowanie bufora przy przełączeniu karty i błędzie backendu, oraz osobne zasady cofania edycji i ewentualnej historii wersji. Autosave nie oznacza automatycznej akceptacji pełnego systemu wersjonowania.

## 25. Runda dziewiąta — tworzenie materiałów

1. Przyjęto wszystkie trzy elementy w pierwszej wersji: „Do odczytania graczom”, „Informacja dla MG” oraz zwijane sekcje.
2. Materiały będą najczęściej pochodziły z Markdown i stron internetowych. Wklejanie fragmentu i import całego dokumentu to osobne zakresy; dostarczenie treści pilota z istniejącej referencji nie zależy od ogólnego importera dla użytkowników.

## 26. Wybór biblioteki edytora — przyjęty kierunek

Przegląd dokumentacji wykonano 29 września 2026. To ocena dokumentacji, bez wykonania prototypu integracji ani testów zgodności z przyszłą wersją Angulara.

| Kandydat | Dopasowanie | Koszt lub ograniczenie |
|---|---|---|
| Tiptap 3 / ProseMirror | Elastyczne własne typy treści, JSON dokumentu, rozszerzenie zwijanych sekcji. Rekomendowany dla bloków i linków specyficznych dla MasterCompanion. | Własny pasek narzędzi i komponent integracyjny Angular. Rozszerzenie Markdown jest oznaczone jako beta. |
| CKEditor 5 | Gotowy edytor i oficjalny komponent Angular. | Producent wskazuje GPL 2+ lub licencję komercyjną. Darmowy plan komercyjny korzysta z CDN; komercyjna dystrybucja lokalna wymaga indywidualnego planu. Nie przyjmujemy go jako domyślnego rozwiązania lokalnego bez opłat. |

Źródła porównania: [Tiptap — integracja przez API JavaScript](https://tiptap.dev/docs/editor/getting-started/install/vanilla-javascript), [własne rozszerzenia](https://tiptap.dev/docs/editor/extensions/custom-extensions), [Details](https://tiptap.dev/docs/editor/extensions/nodes/details), [CKEditor — Angular](https://ckeditor.com/docs/ckeditor5/latest/getting-started/installation/self-hosted/angular.html), [licencjonowanie CKEditor](https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/license-and-legal.html), [aktywacja i dystrybucja CKEditor](https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/license-key-and-activation.html).

**Przyjęty kierunek:** Tiptap 3 z bezpośrednią integracją `@tiptap/core` w naszym komponencie Angular; własne menu, kontrola cyklu życia i powiązanie z autosave. Kod oraz zasoby edytora dostarczamy w lokalnej aplikacji. Nie zakładamy usług Tiptap Cloud ani płatnych rozszerzeń. Repozytorium otwartego edytora jest objęte [licencją MIT](https://github.com/ueberdosis/tiptap/blob/main/LICENSE.md); przed przypięciem wersji należy potwierdzić licencje konkretnych wybranych paczek. MIT repozytorium nie oznacza, że cała oferta producenta jest bezpłatna.

Przyjęty format zapisu: dokument JSON Tiptap/ProseMirror w PostgreSQL; propozycja techniczna to `jsonb` z jawną wersją schematu MasterCompanion. Odpowiada to rekomendacji [dokumentacji zapisu Tiptap](https://tiptap.dev/docs/editor/core-concepts/persistence). Własne elementy przechowują typ wyróżnienia, identyfikator linkowanego materiału lub zasobu. Zmiany schematu wymagają migracji; wybór JSON nie usuwa zależności od modelu edytora. Pełny eksport kampanii zachowuje dokumenty i zasoby bez utraty tych danych.

Przyjęto Markdown jako format wejściowy, z późniejszą edycją wizualną. Nie obiecujemy bezstratnej zamiany specjalnych bloków i linków aplikacji na zwykły Markdown i z powrotem. Edycja źródła całej notatki nie jest wymagana w pierwszym etapie. Eksport Markdown pozostaje do osobnej decyzji.

[Rozszerzenie `@tiptap/markdown`](https://tiptap.dev/docs/editor/markdown/getting-started/installation) obsługuje parsowanie i serializację, ale ma status beta. Przed zatwierdzeniem konkretnego zestawu paczek planujemy próbę techniczną na rzeczywistych materiałach: długim opisie Y4, tabelach, zagnieżdżonych listach, polskich znakach, linkach i naszych blokach. Jeśli konwersja okaże się zawodna, wydzielony adapter wejściowy pozwoli zastąpić parser bez zmiany formatu przechowywania. Nie wybrano jeszcze parsera zastępczego.

## 27. Proponowane wprowadzanie treści i zasobów

- „Wstaw Markdown” konwertuje wprowadzony tekst do edytowalnych elementów dokumentu. Opcja zwykłego tekstu pozwala zachować znaki dosłownie. Automatyczne rozpoznawanie Markdown w schowku pozostaje do sprawdzenia; nie zakładamy nieomylnej heurystyki.
- Wklejenie fragmentu strony zachowuje obsługiwane nagłówki, listy, tabele, pogrubienia i linki, a wygląd dopasowuje do aplikacji. Usuwamy skrypty, zdarzenia HTML, nieobsługiwane osadzenia i przypadkowe style strony; reguły oczyszczania i walidacji są częścią implementacji wejścia i renderowania.
- GFM stanowi proponowany podstawowy zakres Markdown. Rozszerzenia takie jak wiki-linki, callouty Obsidiana, front matter czy składnia konkretnego generatora nie są automatycznie objęte zakresem. Potrzebne odmiany ustalimy na przykładach materiałów użytkownika.
- Obraz wskazany przez zewnętrzny URL nie jest jeszcze dostępnym offline zasobem. Proponujemy jawny stan pobierania do magazynu kampanii i możliwość dodania pliku ręcznie, gdy pobranie jest niemożliwe. Nie uznajemy materiału za kompletny offline, dopóki wymagane obrazy nie zostaną utrwalone lokalnie. Szczegóły automatyzacji pobierania pozostają otwarte.
- Próba techniczna obejmie też zapis i odtworzenie własnych bloków, cofnięcie wklejenia, nieudaną operację zapisu, zmianę karty podczas zapisu i działanie odtworzonego materiału przy odłączonym internecie.

## 28. Runda dziesiąta — technologia i rola Markdown

1. Przyjęto Tiptap z własną integracją Angular oraz dokument JSON w PostgreSQL, z próbą techniczną przed implementacją całego edytora.
2. Wybrano Markdown jako wejście, z późniejszą edycją wizualną. Używane odmiany Markdown nie zostały wskazane; proponowany zakres GFM pozostaje do weryfikacji na przykładach.

## 29. Model materiałów — przyjęta podstawa i propozycja reprezentacji

Przyjęto wspólny model materiału dla notatki, NPC, lokacji i frakcji: nazwa, typ i swobodna treść, z opcjonalnymi szablonami. Pierwszy etap nie wymaga dodatkowych pól do filtrowania. Techniczna propozycja poniżej dodaje stabilny identyfikator, przynależność do kampanii, opcjonalny folder i wersjonowany dokument JSON. Typ pomaga w nawigacji i wyborze linku; sama treść pozostaje swobodna.

| Element | Proponowana reprezentacja | Konsekwencja użytkowa |
|---|---|---|
| Materiał | `Material`: identyfikator, kampania, typ, nazwa, folder, treść, wersja schematu i rewizja zapisu. | NPC, lokacja i frakcja korzystają z tego samego edytora i czytnika. |
| Folder | Własny identyfikator i opcjonalny folder nadrzędny, w obrębie kampanii. | Przenoszenie gałęzi nie zmienia tożsamości materiałów. |
| Link w treści | Identyfikator docelowego materiału w elemencie dokumentu; opcjonalna własna etykieta. | Zmiana nazwy lub folderu nie zrywa linku. Sposób aktualizacji wyświetlanej etykiety pozostaje do dopracowania. |
| Mapa | Oddzielny obiekt wskazujący zasób obrazu. | Jedna mapa może prowadzić do wielu materiałów. |
| Znacznik | Mapa, pozycja względem obrazu, etykieta i wskazanie materiału. | Kilka znaczników może wskazywać ten sam opis; usunięcie znacznika nie usuwa opisu. |
| Obraz | Zasób z własnym identyfikatorem i metadanymi w bazie, z plikiem w magazynie. | Dokument odwołuje się do zasobu niezależnie od fizycznej ścieżki. |
| Bohater drużyny | Oddzielny rekord wykorzystywany przez narzędzia; może mieć powiązany materiał opisowy. | Stan Arcane Blight przypisujemy do bohatera, nie do dowolnego dokumentu NPC. |

Rekomendacja przechowywania obrazów nadal jest otwarta: pliki w trwałym lokalnym katalogu udostępnianym aplikacji przez interfejs magazynu zasobów. Pozwoli to później dodać inną implementację magazynu bez zmiany identyfikatorów w dokumentach. Utrwalenie pliku i transakcja bazy wymagają zaprojektowania obsługi niepowodzeń; nie zakładamy jednej transakcji obejmującej oba magazyny.

Proponowane slices materiałów: `CreateMaterial`, `GetMaterial`, `SaveMaterial`, `MoveMaterial`, `GetMaterialReferences`. `SaveMaterial` sprawdza dokument i oczekiwaną rewizję, zapisuje nowszą treść oraz aktualizuje wyliczone powiązania w jednej transakcji bazy. Starsze żądanie autosave nie może nadpisać nowszej treści. Lista odwołań jest pochodną dokumentów, a nie ręcznie utrzymywaną drugą kopią linków.

Tworzenie kampanii z modułu nadaje niezależne identyfikatory materiałom i mapom oraz przepisuje wewnętrzne linki i znaczniki na tę kopię. Moduł zachowuje wersję treści startowej; proponujemy brak automatycznego nadpisywania treści kampanii po aktualizacji paczki modułu. Szczegóły aktualizacji pozostają osobnym zagadnieniem.

## 30. Przygotowanie treści pilota — przyjęte źródło i proponowany proces

Przyjęto wykorzystanie referencji HTML jako źródła początkowej paczki Ythryn: przeniesienie tekstów aktu 7, mapy, znaczników, osadzonych zasobów i powiązań. Zachowujemy także materiały pomocnicze i dodatki kampanii w odpowiednich folderach. Akt 6 pozostaje poza pilotem. Referencja nie określa automatycznie zakresu wszystkich mechanik; minimalny zatwierdzony tracker to Arcane Blight.

Proponowany proces: ekstrakcja zawartości referencji → jawne mapowanie stron, sekcji, odnośników i obrazów do modelu aplikacji → konwersja do dokumentów JSON → przegląd materiału i reguł przez właściciela → wersjonowana paczka startowa modułu. Nie zakładamy, że każdy nagłówek starej strony musi stać się oddzielnym materiałem albo że wszystkie linki mają odpowiednik bez decyzji redakcyjnej.

Konwerter referencji byłby pomocniczym narzędziem przygotowania tego modułu. Nie przesądza zakresu uniwersalnego importera HTML dla MG. W kolejnych etapach można rozwinąć przygotowywanie modułów z materiałów utworzonych w aplikacji; dokładny proces wymaga decyzji.

## 31. Runda jedenasta — model obiektów i źródło pilota

1. Użytkownik pozostawił wybór autorowi planu. Przyjęto prosty model: nazwa, typ i swobodny dokument. Powiązania zapisujemy jako linki w treści; szablony pozostają opcjonalne.
2. Użytkownik wskazał przeniesienie istniejących tekstów, map i innych materiałów.

## 32. Inwentaryzacja referencji Ythryn

Odczyt danych osadzonych w HTML z 30 września 2026 potwierdził poniższy zakres aktu 7:

| Element | Stan referencji |
|---|---|
| Dokumenty źródłowe | 16, łącznie z materiałami pomocniczymi, redakcyjnymi i wątkami kampanii. |
| Sekcje treści | 142; są jednostkami nawigacji starej aplikacji, nie automatycznie 142 osobnymi materiałami nowego modelu. |
| Mapa Ythryn | Obraz 2012 × 1248, osadzony w HTML. |
| Znaczniki | 29. |
| Lokalne odnośniki w treści | 192 wystąpienia, w tym dwa do aktu 6. Proste sprawdzenie identyfikatorów nie wykazało innych nieznanych celów; nie zastępuje to przeglądu semantyki linków po konwersji. |
| Odnośniki Obsidian | 21 wystąpień kierujących do sejfu poza osadzonym materiałem. Nie oznacza to 21 unikalnych notatek. |

Przegląd źródłowy znalazł jeden unikalny osadzony obraz użyty przez tę część, będący mapą; w sekcjach aktu 7 nie znaleziono innych elementów `img` odwołujących się do nieosadzonych plików. Nie wywodzimy z tego kompletności oryginalnego sejfu ani zewnętrznych załączników. Oryginał referencji pozostaje zachowany.

Konwersja ma jawnie rozliczyć każdy dokument, sekcję, obraz i link: wskazać docelowy materiał lub sekcję, odwołanie zachowane jako zwykły tekst albo brak wymagający uzupełnienia. Dwa odnośniki do aktu 6 nie rozszerzają automatycznie zakresu pilota. W rundzie dwunastej odrzucono zachowanie linków Obsidian jako sposobu dostępu do potrzebnych treści; dalsze rozliczenie opisuje sekcja 35.

## 33. Przenoszenie tej samej kampanii — przyjęty przebieg i otwarte szczegóły

**Aktualizacja po rundzie piętnastej:** opis zachowujemy na przyszłość. Eksport/import nie wchodzi do obecnej wersji ani do jej kryteriów odbioru.

Po wdrożeniu tej funkcji eksport/import będzie normalną czynnością użytkową przy pracy na komputerach A i B. Proponujemy jedno archiwum ZIP zawierające manifest wersji, materiały JSON, zasoby, mapy, znaczniki, drużynę i stan narzędzi oraz wdrożone dane sesji i kroniki. Eksport nie dodaje automatycznie funkcji sesji i kroniki do wcześniejszych etapów; format przewiduje ich późniejsze włączenie.

Przy pierwszym imporcie na komputerze B tworzymy lokalną instancję przenoszonej kampanii z zachowaniem jej tożsamości i wewnętrznych identyfikatorów. Przy powrocie na komputer A aplikacja rozpoznaje istniejącą kampanię i pokazuje świadomy wybór:

- „Aktualizuj tę kampanię” — zastąpienie lokalnego stanu stanem z archiwum po walidacji i utworzeniu kompletnej kopii sprzed importu.
- „Utwórz niezależną kopię” — nowa kampania z przepisanymi identyfikatorami i odnośnikami.

Nie ma niejawnego nadpisania. Archiwum przenosi pełny stan, a pierwsza wersja nie scala automatycznie dwóch niezależnie zmienionych kopii. Pochodzenie eksportu i rewizje umożliwiają pokazanie ostrzeżenia o rozbieżności; definicję rewizji kampanii i granice snapshotu eksportu dopracujemy w projekcie technicznym. Sam znacznik czasu nie wystarcza do rozpoznania nowszej gałęzi pracy.

W rundzie dwunastej przyjęto ten przebieg: po rozpoznaniu tej samej kampanii prezentujemy aktualizację jako typową czynność powrotu między komputerami, z niezależną kopią jako drugą opcją. Zastępuje to wcześniejsze rozważanie domyślnego odtworzenia jako nowej kopii. Historia wcześniejszych wersji notatek została odłożona w rundzie trzynastej; kosz na usunięte materiały pozostaje osobnym, nieustalonym zakresem.

## 34. Runda dwunasta — zewnętrzne notatki i powrót między komputerami

1. Użytkownik wskazał, że potrzebne materiały mają być zawarte w aplikacji i edytowalne; odnośniki poza aplikację nie są potrzebne. Nie przyjęto pozostawienia Obsidiana jako zewnętrznej zależności pilota.
2. Przyjęto aktualizowanie tej samej kampanii przy imporcie wraz z kopią sprzed importu.

## 35. Samowystarczalność materiałów pilota

Audyt z 30 września 2026: 21 wystąpień linków Obsidian w treści aktu 7 wskazuje 18 różnych celów z uwzględnieniem nagłówków. Obejmują m.in. podręcznik, notatki o postaciach, kronikę i wątki wcześniejszych aktów. Nie znaleziono bezpośredniego dopasowania nazw tych plików do 16 dokumentów osadzonych w akcie 7; część tematów, np. lokacje Y19 i Y23, jest jednak opisana w dostępnej treści i może otrzymać link wewnętrzny po przeglądzie. To nie potwierdza obecności pełnej treści docelowych notatek.

Każda z 142 sekcji ma także pole `sourceLink` prowadzące do Obsidiana. Stara aplikacja wyświetla je w osobnym przycisku źródła. W nowym czytniku nie odtwarzamy tego przycisku; informacja o pochodzeniu może zostać w metadanych migracji. W treści znaleziono ponadto cztery odsyłacze do SRD, w tym do opisów czarów Symbol, Flesh to Stone i Phantasmal Killer.

Proponowane wykonanie przyjętej zasady:

- Materiał obecny w przenoszonej treści otrzymuje stabilny link do właściwego dokumentu lub sekcji. Przegląd musi potwierdzić zgodność treści, a nie tylko podobieństwo nazw.
- Reguły potrzebne podczas prowadzenia mają być lokalnymi, edytowalnymi materiałami zasad. Sama obecność zewnętrznego linku do czaru lub podręcznika nie potwierdza, że jego potrzebny opis został dostarczony.
- Odwołania bibliograficzne lub kontekstowe pozostają czytelnym tekstem, bez aktywnego linku do sejfu lub internetu. Zachowujemy oryginalną referencję jako źródło migracji.
- Odwołania do nieobecnej historii wcześniejszych aktów lub biografii bohaterów nie powodują wymyślenia brakującego opisu. Jeśli treść jest potrzebna w pilocie, trafi na listę uzupełnień; można ją przenieść z udostępnionego źródła albo dopisać w aplikacji. Jeśli odwołanie jest wyłącznie tłem, zachowujemy jego tekst bez martwego linku.
- Kryterium odbioru paczki: wszystkie wymagane materiały, zasady, obrazy i nawigacja działają przy odłączonym internecie i bez zainstalowanego Obsidiana; nie ma aktywnych martwych linków ani niejawnych braków w potrzebnej treści.

To plan migracji i jej odbioru. Uzupełnienie nieobecnych treści nie zostało wykonane; w workspace nadal znajduje się dokumentacja i referencja, a nie gotowy moduł nowej aplikacji.

## 36. Cofanie treści i operacji gry — przyjęty zakres

Autosave utrwala także przypadkowe zmiany, dlatego odzyskiwanie treści wymaga projektu osobnego od cofania czasu i narzędzi.

| Obszar | Proponowane działanie |
|---|---|
| Trwająca edycja dokumentu | Cofnij / Ponów w edytorze, także po automatycznym zapisie. Długość życia stosu edytora należy sprawdzić przy przełączaniu kart; nie zakładamy jego trwałości po restarcie. |
| Zapisany dokument | Historia zapisanych wersji, ich podgląd i przywracanie są odłożone na przyszłość. Pierwsza wersja zachowuje aktualną treść i licznik rewizji do ochrony zapisu, bez obowiązku przechowywania poprzednich dokumentów. |
| Czas i narzędzia | Przyjęto cofanie kolejnych operacji od ostatniej, w obrębie kampanii. Jedna operacja przywraca zegar i jej powiązane skutki. Historia zapisuje informację o cofnięciu. |
| Starsza operacja z późniejszymi rozstrzygnięciami | MG cofa późniejsze operacje gry w odwrotnej kolejności, dopiero potem wskazaną zmianę czasu. Nie dopuszczamy częściowego cofnięcia pozostawiającego sprzeczny stan. |

Przykład: omyłkowo dodano 8 h, potem MG rozstrzygnął należne rzuty. Cofnięcie samego zegara przy pozostawieniu tych wyników byłoby niepoprawne. Przyjęta pierwsza wersja umożliwia cofnięcie rozstrzygnięć po kolei, a następnie operacji czasu. Wybór starszej operacji i automatyczne cofnięcie wskazanego zestawu zależności po pokazaniu podglądu skutków pozostaje możliwością przyszłego rozwoju.

Stos operacji gry nie obejmuje edycji notatek. Cofnięcie czasu lub wyniku Arcane Blight nie przywraca wcześniejszego tekstu materiałów. Początkowy limit przechowywania, dostępność cofania po restarcie i granice korekt ręcznych pozostają do ustalenia. Kopia kampanii sprzed importu służy przywróceniu całego stanu i nie zastępuje historii pojedynczej notatki.

## 37. Runda trzynasta — odzyskiwanie zmian

1. Użytkownik odłożył historię wcześniejszych wersji notatek na przyszłość i wykluczył ją z pierwszej wersji ze względu na zakres implementacji.
2. Wybrano prostsze cofanie operacji czasu i narzędzi kolejno od ostatniej.

## 38. Proponowane etapy realizacji pierwszego użytecznego pilota

**Uwaga po rundzie piętnastej:** poniższa propozycja jest szerszą ścieżką rozwoju. Nie stanowi zakresu bieżącego tygodnia. Aktualna propozycja ograniczenia znajduje się w [planie minimum](04-Plan-minimum-tydzien.md); obecny budżet to około 21 godzin, a przenoszenie kampanii jest jawnie odłożone.

Kolejność służy szybkiemu sprawdzeniu najważniejszego doświadczenia MG: czytania, edycji i odnajdywania materiałów. Nie stanowi harmonogramu ani zatwierdzenia wszystkich funkcji BRD w pierwszym pilocie. Podczas implementacji każda funkcja obejmuje interfejs, API i trwały zapis, zamiast osobnego budowania całego backendu przed frontendem.

| Etap | Wynik użytkowy | Główne prace i warunek ukończenia |
|---|---|---|
| 1. Środowisko i próba edytora | Lokalnie otwieramy, edytujemy i odtwarzamy długą notatkę Y4. | Aspire, API .NET, Angular, PostgreSQL oraz integracja Tiptap. Sprawdzenie tabel, polskich znaków, wyróżnień, zwijanych sekcji, konwersji Markdown i zapisu JSON. Jeżeli próba ujawni problem, korygujemy integrację przed rozszerzaniem zakresu. |
| 2. Materiały kampanii | MG tworzy kampanię, układa materiały w folderach i korzysta z kart, linków oraz podglądu. | Podstawowe slices kampanii i materiałów, zasoby obrazów, czytnik B, jawna edycja, autosave, wyszukiwanie nazw i treści oraz widoczny błąd zapisu. Restart zachowuje dane. |
| 3. Mapa i paczka Ythryn | Kliknięcie znacznika otwiera czytelny opis lokacji. Nowa kampania otrzymuje własną kopię pilota. | Obraz mapy, pozycje znaczników, powiększanie i przesuwanie, jawna edycja znaczników; migracja tekstów i linków, rozliczenie braków zasad. Dwie kampanie z tej samej paczki mają niezależną treść. Prace nad konwersją mogą toczyć się od ustalenia schematu etapu 1. |
| 4. Czas i Arcane Blight | MG przesuwa czas, kończy odpoczynek i rozstrzyga należne sprawdzenia bohaterów. | Drużyna, zegar i aktywności, terminy modułu, reguły Arcane Blight, zapis operacji i cofanie od ostatniej. Testy obejmują granicę 12 h, duży skok, zależne wyniki, długi odpoczynek, niezależność bohaterów i ponowienie żądania. |
| 5. Przenoszenie kampanii | MG przygotowuje na A, prowadzi na B i aktualizuje stan na A przez archiwum. | Pełny eksport/import wdrożonych danych i zasobów, zgodność wersji, walidacja archiwum, kopia sprzed aktualizacji i świadoma niezależna kopia. Odbiór porównuje treści, linki, mapy, czas, stan narzędzi i historię operacji. Prosty eksport treści warto uruchomić wcześniej, a tu domknąć pełny zakres. |
| 6. Paczka do prowadzenia offline | Właściciel i znajomi MG uruchamiają gotową aplikację i prowadzą sesję bez internetu. | Gotowe obrazy aplikacji i bazy, trwałe dane, instrukcja instalacji i aktualizacji, lokalne zasoby. Próba instalacji na czystym środowisku i restartu bez internetu. Odbiór UI na Full HD z uwzględnieniem skalowania. |

Najwcześniejszy pilot ma umożliwić sesję Ythryn z szerokimi opisami, mapą, czasem i Arcane Blight oraz przeniesienie jej stanu między komputerami. Zwykłe materiały mogą służyć roboczym notatkom podczas tej próby. Oddzielne sesje z własnymi zapiskami, ręczna kronika, pełny kreator prostych narzędzi i dalsze mechaniki pozostają w planie kolejnych etapów całego produktu. Historia wersji notatek jest dodatkowo jawnie odłożona przez użytkownika.

Przed domknięciem planu technicznego pozostaje dobrać wspierane wersje komponentów, strukturę projektów i obsługę endpointów, dopracować format paczek modułu i kampanii, transakcje czasu oraz dokładne zasady aktualizacji aplikacji. Te zadania projektowe można rozwiązać po ustaleniu platformy i oczekiwanego tempa prac; nie wymagają ponownego zatwierdzania przyjętych reguł produktu.

## 39. Przyszły zakres odzyskiwania treści

Zachowujemy w backlogu historię zapisanych wersji materiału z podglądem i przywracaniem. Może wymagać zasad tworzenia wersji, retencji, dołączania historii do eksportu oraz obsługi obrazów używanych w starszych wersjach. Nie włączamy tych zależności do pierwszego etapu ani nie implementujemy w nim ukrytej pełnej historii dokumentów.

Osobną możliwością jest wybór starszej operacji gry i automatyczne cofnięcie zależności. W obecnym planie wystarcza cofanie po kolei. Kosz materiałów i jego retencja nadal nie zostały wybrane.

## 40. Runda czternasta — platforma i tempo realizacji

1. Użytkownik wybrał Windows jako platformę pierwszego odbioru, przy zachowaniu przenośności stosu .NET i Docker.
2. Użytkownik wskazał cel tygodnia przy 1–2 godzinach pracy dziennie. Trzeba określić minimum do działania i dodatki. Priorytetem jest główny widok; konta, użytkownicy i logowanie są jawnie odłożone.

## 41. Runda piętnasta — zawężenie do tygodnia

Przygotowano [osobny, krótki plan minimum](04-Plan-minimum-tydzien.md) z propozycją zakresu, etapami w siedmiu slotach i odbiorem. Nie rozpoczęto implementacji. Lista kont i logowania została odłożona zgodnie z wyraźną instrukcją; pozostałe cięcia są propozycją wymagającą uzgodnienia.

1. Czy na pierwszy tydzień przyjmujemy jedną przygotowaną kampanię Ythryn z edycją materiałów, mapą, czasem, Arcane Blight, prostym cofaniem i eksportem/importem, odkładając zarządzanie kampaniami/folderami/mapami, osobny podgląd i pozostałe dodatki?
2. Czy 1–2 godziny dziennie to czas użytkownika na pracę i przegląd z pomocą agenta, czy całkowity budżet ręcznej implementacji? Dostępny czas określa realność zaproponowanego minimum.

Odpowiedzi użytkownika:

1. Na teraz rezygnujemy z eksportu/importu, czyli przenoszenia stanu. Rezultat ma obejmować cały rozdział Ythryn dostępny w POC. Najważniejsze są interaktywna mapa i notatki, nawet przy ograniczonej edycji.
2. Dostępny budżet to około 3 godziny dziennie razem z agentem, czyli około 21 godzin w tygodniu.

## 42. Konsekwencje rundy piętnastej — pełna treść, mniejszy zakres funkcji

Zaktualizowano [plan minimum](04-Plan-minimum-tydzien.md) do wersji 0.2. Przygotowanie danych Ythryn z referencyjnego HTML jest zadaniem budowania modułu; nie oznacza udostępnienia użytkownikowi importera kampanii. Całe 16 dokumentów, 142 sekcje i 29 znaczników musi zostać rozliczone przez konwersję i odbiór. Karty i czytelnik B pozostają podstawą widoku.

Proponujemy ograniczyć edycję do małego paska formatowania dla całego dokumentu, z zachowaniem tabel, obrazów i istniejących wyróżnień. Nie rozbudowujemy teraz menedżerów kampanii, materiałów, zasobów i map. Ten szczegół edycji oraz przesunięcia wcześniej przyjętych funkcji, np. osobnego podglądu i UI tworzenia bloków, są propozycjami, nie nowymi zatwierdzonymi decyzjami.

Arcane Blight pozostaje w roboczym planie jako wcześniej wymagane minimum. Nie uznajemy akcentu na mapę i notatki za zgodę na jego usunięcie; pytamy o obowiązek dostarczenia tej mechaniki w pierwszym tygodniu. Podział czasu rezerwuje 12 godzin na główny widok i edycję, 6 godzin na czas i mechanikę oraz 3 godziny na odbiór i poprawki. To przydział budżetu, który weryfikujemy po pierwszym dniu.

## 43. Runda szesnasta — dwie granice minimum do ustalenia

1. Czy ograniczona edycja ma nadal pozwalać zmieniać cały opis, z prostym paskiem formatowania, czy tylko dopisywać własne uwagi do niezmienianego materiału modułu? Rekomendujemy pierwszy wariant, zgodny z przyjętym edytorem Tiptap i zapisem JSON.
2. Czy Arcane Blight wraz z czasem i prostym cofaniem nadal jest wymagane w tym tygodniu, czy przechodzi do następnego etapu po ukończeniu pełnej mapy i notatek? Do odpowiedzi zachowujemy wcześniejsze wymaganie i rezerwację czasu; nie zakładamy przesunięcia.

Odpowiedź użytkownika: „musi wejść arcane blight oraz edycja”. Potwierdza wymaganą edycję i obecność mechaniki w pierwszym tygodniu. Przyjmujemy rekomendację prostego edytora całych opisów zgodnie z wcześniej zaakceptowanym kierunkiem; nie wprowadzamy ograniczenia do osobnych dopisków.

## 44. Runda siedemnasta — nowe notatki i uczestnicy odpoczynku

1. Użytkownik potwierdził, że wystarczy edycja wszystkich przeniesionych materiałów. Przycisk tworzenia nowych osobnych notatek nie jest wymagany w tym tygodniu.
2. Użytkownik potwierdził, że wystarczy wspólny długi odpoczynek całej drużyny. Wyniki Arcane Blight pozostają indywidualne.

Nie ma oczekujących odpowiedzi potrzebnych do określenia zakresu funkcjonalnego minimum. Szczegóły implementacyjne rozstrzygamy w ramach przyjętego stosu i budżetu; nie wymagają ponownego pytania o te same funkcje.

## 45. Plan wykonawczy i rekomendacje techniczne

Zaktualizowano [plan minimum](04-Plan-minimum-tydzien.md) do wersji 0.3 i przygotowano [plan wykonawczy MVP](05-Plan-wykonawczy-MVP.md). Obejmuje podział zadań na siedem dni, warunki ukończenia i konkretne scenariusze sprawdzeń. W tym etapie nie utworzono projektów aplikacji.

Rekomendujemy .NET 10 LTS z Minimal APIs i bezpośrednim EF Core w slices, PostgreSQL 18 z EF Core/Npgsql 10, Angular 22 oraz stabilny Aspire 13.x. Są to propozycje autora planu wynikające z przyjętego stosu; źródła i zasady przypięcia dokładnych wersji znajdują się w planie wykonawczym. Integracja Tiptap 3 zachowuje wspólny schemat konwersji i edycji.

Stan gry proponujemy przechowywać jako osobny wersjonowany dokument: czas, bohaterowie, odpoczynki i zaraza. Najstarsze należne sprawdzenie wyliczamy ze stanu, jak w referencji JS. Operacje gry utrwalamy wraz ze stanem przed i po, co umożliwia cofanie kolejno także po restarcie. Rewizja zwiększa się również przy cofnięciu; dokumenty materiałów mają niezależny zapis i rewizje. To rozwiązanie nie wprowadza pełnego systemu event sourcing ani historii zapisanych wersji notatek.

Przy przenoszeniu zachowujemy 142 jednostki treści uporządkowane w 16 grupach dokumentów. Mapa kieruje do konkretnej lokacji; karty są otwierane na żądanie. Nie tworzymy jednego ogromnego dokumentu dla wszystkich lokacji ani nie otwieramy automatycznie wszystkich materiałów.

Odczyt środowiska potwierdził obecność SDK .NET 10 i Node 24.19.0. Docker CLI jest dostępne, ale połączenie z silnikiem nie zostało potwierdzone; pierwsze zadanie wykonawcze obejmuje tę weryfikację. Podczas planowania nie instalowano zależności i nie uruchamiano kontenerów.
