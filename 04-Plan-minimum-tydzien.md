# Plan minimum — pierwszy tydzień

Wersja robocza 0.5 · 30 września 2026

**Cel:** użyteczny lokalny widok do prowadzenia całego Ythryn dostępnego w POC, z interaktywną mapą, czytelnymi notatkami, wymaganą edycją oraz czasem i Arcane Blight. Budżet użytkownika: siedem dni po około 3 godziny pracy z agentem, razem około 21 godzin. Testujemy i opisujemy uruchomienie na Windows. Wybrany stos pozostaje przenośny; nie planujemy w tym tygodniu osobnego odbioru na innych systemach.

**Status:** zakres minimum ustalony w rozmowie; implementacja fundamentu rozpoczęta. Użytkownik potwierdził obowiązek edycji i Arcane Blight, edycję istniejących materiałów oraz wspólny odpoczynek. Mapa, materiały i zapis są już w kodzie; mechanika i zegar pozostają wymaganym dalszym etapem. Aktualny stan i próby opisuje [README](README.md). Historia jest w [warsztacie](03-Plan-implementacji.md), zadania w [planie wykonawczym](05-Plan-wykonawczy-MVP.md), a mocna granica modułów w [architekturze](06-Architektura-modulow.md). Ten dokument nadal opisuje cały wymagany rezultat, nie potwierdza ukończenia MVP.

## 1. Granica pierwszej wersji

Budujemy ogólny silnik MasterCompanion i kontrakt modułu. Moduł dostarcza treść, hierarchię folderów, mapy, konfigurację i własne mechaniki. Ythryn jest pierwszą implementacją tego kontraktu; jego nazwa w zakresie i scenariuszach oznacza materiał pilota, nie ograniczenie ogólnych funkcji silnika. Kampania przechowuje własną kopię materiałów i stan gry.

Pierwsza wersja otwiera jedną lokalną kampanię Ythryn, przygotowaną z dostarczonej referencji. Obowiązkowo przenosimy wszystkie 16 dokumentów i 142 sekcje aktu 7 oraz mapę Ythryn z 29 znacznikami. Obejmuje to komnaty iglicy, spotkania, frakcje i dodatkowe materiały MG. Próbna lokacja Y4 służy tylko weryfikacji konwersji i edytora; nie jest zakresem końcowego rezultatu. Akt 6 pozostaje poza pilotem.

Osoba prowadząca czyta, przechodzi między materiałami, włącza edycję istniejących opisów i obsługuje czas oraz Arcane Blight. Dane i własne zmiany zachowują się po restarcie. Kampania zaczyna się przy wejściu do miasta, z czasem 0 i zdrową drużyną. Nie tworzymy teraz nowych osobnych notatek; własne uwagi można dopisywać do materiałów. Długi odpoczynek obejmuje całą drużynę, a rzuty rozstrzygamy osobno dla każdego bohatera.

Jedna kampania jest ograniczeniem interfejsu tej wersji. Dane nadal mają identyfikator kampanii, materiałów i zasobów. Nazwy Ythryn i reguły Arcane Blight należą do przygotowanego modułu, nie do ogólnego czytnika.

Konta, użytkownicy, logowanie, role i uprawnienia to przyszły etap. Obecna aplikacja działa lokalnie pod localhost dla MG. Model dostępu dla hostingu zaprojektujemy przed wdrożeniem do chmury.

Eksport/import i przenoszenie stanu są jawnie odłożone. Nie budujemy ich ekranów ani formatu archiwum. Automatyczne przygotowanie kampanii z danych POC jest częścią dostarczenia modułu, a nie funkcją importu użytkowego. Ponowne uruchomienie aplikacji nie może nadpisywać własnych zmian danymi startowymi.

## 2. Główny widok

- Lewa nawigacja prezentuje zagnieżdżoną strukturę materiałów modułu i proste wyszukiwanie. Aktywacja karty rozwija jej foldery, ustawia focus na wyraźnie zaznaczonym materiale i centruje go w spisie, w granicach przewijania panelu. Organizacja pochodzi z przeniesionej treści; edytor drzewa folderów może powstać później.
- Główna przestrzeń mieści szeroki dokument i karty otwartych materiałów. Zwykłe kliknięcie tekstu służy czytaniu. Link wewnętrzny otwiera lub aktywuje kartę wskazanego materiału.
- Karty zamykamy przyciskiem × lub środkowym przyciskiem myszy. Oczekujące zmiany muszą zostać zapisane; błąd pozostawia kartę i jej tekst otwarte. Zamkniętą mapę można otworzyć ponownie przyciskiem w nagłówku.
- Jasny i ciemny motyw obejmują cały czytnik i jego narzędzia. Wybór jest pamiętany w danej przeglądarce; bez własnego wyboru stosujemy preferencję systemową.
- Mapa otwiera się na żądanie w tym samym obszarze. Zachowuje powiększenie i przesunięcie, a kliknięcie przygotowanego znacznika prowadzi do opisu. Powrót do karty zachowuje miejsce czytania.
- Mały pasek czasu pokazuje czas od wejścia do Ythryn, skróty jego przesuwania i sygnał należnych spraw. Przycisk narzędzi otwiera pomocniczy widok Arcane Blight. Narzędzia nie zajmują stale otwartego panelu kosztem tekstu.
- „Edytuj” uruchamia Tiptap dla całego materiału. Rekomendowany mały pasek obejmuje nagłówki, pogrubienie, kursywę, listy i link wewnętrzny. Zachowujemy istniejące tabele i wyróżnienia; edycja tekstu w komórkach nie wymaga rozbudowanego kreatora tabel. Autosave pokazuje stan zapisu; „Zakończ edycję” wraca do czytania po dopilnowaniu zapisu.

Projektujemy dla Full HD na jednym monitorze. Dopasowanie wyglądu i ergonomii głównego widoku ma pierwszeństwo przed dodawaniem kolejnych ekranów administracyjnych.

## 3. Minimum i dodatki

| Obszar | Minimum na ten tydzień | Kolejny etap lub dodatek |
|---|---|---|
| Uruchomienie | Aspire: Angular, jedno API .NET i PostgreSQL; dane przetrzymują restart. Instrukcja dla Windows. | Gotowy instalator i samodzielna paczka dla nietechnicznych MG, odbiór macOS/Linux. |
| Kampania | Jedna automatycznie przygotowana kampania Ythryn. | Lista wielu kampanii, kreator pustej kampanii, wybieranie różnych modułów. |
| Materiały | Całe Ythryn z POC: 16 dokumentów, 142 sekcje, mapa i powiązania; przygotowana nawigacja, prosty filtr nazw, szeroki czytnik, karty, linki wewnętrzne. | Pełne wyszukiwanie po treści i rozbudowane filtry, panel odwołań, zarządzanie typami i szablonami. |
| Edycja | Tiptap, edycja istniejącego dokumentu, autosave i mały pasek formatowania. Zachowanie tabel, obrazów, wyróżnień i zwijanych sekcji bez utraty treści po zapisie. | Tworzenie nowych osobnych notatek, rozbudowane menu, tworzenie i konfigurowanie własnych bloków, zaawansowany pasek tabel, regularna edycja źródła, pełna historia wersji dokumentów. |
| Wprowadzanie treści | Podstawowe wklejanie obsługiwanego HTML. Jawna akcja „Wstaw Markdown” pozostaje w propozycji ograniczonego edytora; nie rozwijamy osobnego procesu importowania plików. | Import całych stron, sejfów, zbiorów Markdown, pobieranie i przetwarzanie dowolnych zewnętrznych załączników. |
| Obrazy | Przeniesione lokalne zasoby pilota, renderowane także w edytorze; pełna mapa w oryginalnej rozdzielczości. | Menedżer zasobów i bogata obsługa wgrywania nowych obrazów. |
| Mapa | Przygotowana mapa Ythryn i 29 znaczników, powiększanie, przesuwanie, otwieranie opisów. | Tworzenie i przesuwanie znaczników, wgrywanie nowych map i edytor map wnętrz. |
| Czas | Skróty, dowolny przyrost, wspólny długi odpoczynek oraz zachowane należne sprawdzenia. Pełny skok wykonywany od razu. | Odpoczynek wybranych bohaterów, uniwersalny kalendarz, edytor rodzajów aktywności, osobne zegary każdej lokacji. |
| Arcane Blight | Wymagane w tym tygodniu: zatwierdzone reguły, osobny stan każdego bohatera, jawne sukcesy/porażki i wynik k6, leczenie oraz cofanie kolejno od ostatniej operacji. | Klątwa głodu, inne mechaniki, ogólny kreator liczników i przypomnień, UI edycji parametrów mechaniki. |
| Drużyna | Minimalne ustawienie nazw i liczby bohaterów przed pierwszą operacją gry; dane nie są stałymi kodu. | Pełne zarządzanie składem podczas gry i powiązaniami z rozbudowanymi materiałami NPC. |
| Przenoszenie stanu | Brak eksportu/importu; zwykły lokalny zapis pozostaje obowiązkowy. | Cały eksport/import kampanii, archiwa, aktualizacja przez import z kopią poprzedniego stanu, niezależne kopie i scalanie gałęzi. |
| Podgląd | Linki przełączają karty z zachowaniem kontekstu. | Dodatkowa akcja „Podejrzyj” z osobnym szerokim oknem. |
| Sesje i kronika | Zwykły edytowalny materiał może służyć bieżącym zapiskom. | Osobne rekordy sesji, przypinanie materiałów, kronika i tworzenie wydarzeń z tekstu. |
| Dostęp i chmura | Lokalny proces dla MG, bez kont i logowania. | Konta, ochrona dostępu, hosting AWS i ewentualna synchronizacja. |

Użytkownik jawnie odłożył cały eksport/import i tworzenie nowych notatek oraz potwierdził wspólny odpoczynek. Edycja i Arcane Blight są wymagane w tym tygodniu. Ograniczenia dodatkowych menu edytora, zarządzania znacznikami i osobnego podglądu są rekomendowanym sposobem zmieszczenia funkcji w budżecie; zachowujemy je w backlogu produktu.

## 4. Fundament techniczny o małym zakresie

Zachowujemy Angular, ASP.NET Core, Aspire, PostgreSQL / EF Core, Tiptap oraz vertical slices. Backend jest jedną aplikacją. Nie ma potrzeby osobnego procesu dla każdej mechaniki modułu.

Proponowane podstawowe dane głównego widoku: `Campaign`, `Material`, `Map`, `Marker`, `Asset`. Treść zapisujemy jako JSON Tiptap/ProseMirror w PostgreSQL z wersją schematu. Osobny `CampaignGameState` zawiera czas, bohaterów, odpoczynki i Arcane Blight, a `GameOperation` umożliwia ponowienie i cofanie. W minimum bohaterowie mogą być obiektami w dokumencie stanu, bez osobnej tabeli postaci. Model nie zawiera w tym etapie tabel użytkowników ani atrap uprawnień.

Slice obejmuje endpoint, kontrakt, walidację i obsługę EF Core. Proponowane przypadki użycia:

```text
Materials/GetMaterial
Materials/SaveMaterial
Maps/GetMap
Assets/GetAsset
```

Nawigacja dostaje listę nazw i identyfikatorów materiałów. Zachowujemy jednostki źródłowe: 142 sekcje są osiągalnymi materiałami, uporządkowanymi w 16 grupach dokumentów. Kliknięcie znacznika otwiera jego konkretny opis; nie przewija wielkiego zbiorczego dokumentu lokacji. Karty powstają tylko po otwarciu materiału, nie otwieramy wszystkich 142 naraz. Model i rekomendowane endpointy opisuje plan wykonawczy.

Czas i mechanika wymagają również:

```text
Party/ConfigureParty
Game/GetState
Time/AdvanceTime
Time/EndRest
Modules/Ythryn/ArcaneBlight/ResolveCheck
Modules/Ythryn/ArcaneBlight/HealCharacter
Operations/UndoLastOperation
```

Reguły mechaniki pozostają w C#. Źródła JS i istniejące testy pomagają przenieść oraz sprawdzić zachowanie; nie kopiujemy ograniczeń dotyczących pięciu konkretnych nazw bohaterów. Nie planujemy dublowania autorytatywnych reguł w backendzie i frontendzie.

Autosave dokumentu wykorzystuje oczekiwaną rewizję. Operacja czasu lub wyniku rzutu ma identyfikator pozwalający bezpiecznie ponowić żądanie i jest zapisywana wraz z powiązanymi skutkami w transakcji. Cofanie obejmuje stan gry i należne sprawy, bez przywracania poprzedniej treści dokumentów.

Należny rzut wyliczamy ze stanu bohatera, czasu i odpoczynków, jak w referencji. Po zakażeniu podczas zaległej ekspozycji może pojawić się wcześniej odbyty odpoczynek do rozstrzygnięcia. Nie potrzebujemy osobnego procesu uruchamiającego te zdarzenia według czasu rzeczywistego. Stan i historia operacji są utrwalane; wyliczane terminy zachowują się po restarcie.

Zapis inicjalnego modułu odbywa się tylko dla nieprzygotowanej kampanii. Nie stosujemy bezwarunkowej aktualizacji wszystkich materiałów przy każdym starcie. Baza korzysta z trwałego wolumenu; „Zapisano” w UI oznacza potwierdzenie utrwalenia przez backend. Błąd nie może usuwać niezapisanego tekstu z otwartej karty.

Zasoby przechowujemy lokalnie pod identyfikatorami niezależnymi od fizycznych ścieżek. API udostępnia ich treść. Konkretny adapter S3 pozostaje na przyszłość. Kod aplikacji, fonty i inne wymagane zasoby są dostarczane lokalnie.

## 5. Wykorzystanie referencji

- Ekstrakcja całej treści i mapy jest zadaniem skryptu przygotowującego pilota. Nie przepisujemy ręcznie 142 sekcji. Raport konwersji rozlicza wszystkie 16 dokumentów, 142 sekcje i 29 znaczników; nie pomijamy dodatków po przeniesieniu opisów lokacji.
- Zachowujemy czytelny podział i tabele oraz mapujemy stare identyfikatory do nowych materiałów i sekcji. Testujemy przejścia od znaczników do opisów, zwłaszcza iglicę i jej komnaty.
- Dodatki istniejącej kampanii zostają w odpowiednich grupach materiałów. Początkowe wartości narzędzia odpowiadają wejściu do Ythryn, bez wyników obecnej rozgrywki.
- Przycisków źródłowych Obsidiana nie przenosimy. Dostępne treści łączymy wewnętrznie; odwołania bibliograficzne mogą zostać tekstem. Braki potrzebnych reguł trzeba jawnie rozliczyć i uzupełnić przed uznaniem pilota za gotowy do gry.
- Źródła i testy liczników są materiałem referencyjnym dla zaakceptowanych reguł Arcane Blight. Pozostałe trackery nie wchodzą automatycznie do minimum.

## 6. Siedem dni — proponowany podział budżetu

Poniższe sloty są przydziałem 21 godzin pracy użytkownika z agentem, nie zweryfikowaną estymacją. Dni 1–4 przeznaczamy na cały główny widok z ograniczoną edycją, dni 5–6 na wymagane narzędzia, a dzień 7 pozostawiamy na odbiór, poprawki i instrukcję. Edycja i Arcane Blight są częścią odbioru pierwszego tygodnia. Testy reguł i ryzykowna próba konwersji zaczynają się przed końcowym odbiorem; nie odkładamy ich wszystkich na dzień 7.

| Dzień | Cel slotu do trzech godzin | Punkt sprawdzenia |
|---|---|---|
| 1 | Uruchomienie Aspire, Angular, API i bazy; mała próba konwersji i Tiptap na Y4 oraz fragmencie z tabelą. | Czy stos działa i czy treść zachowuje format oraz zapis JSON? Jeśli próba nie przejdzie, korygujemy plan przed masową konwersją. |
| 2 | Skrypt przenoszący całą treść Ythryn, zasoby i identyfikatory; szeroki czytnik oraz przygotowana nawigacja. | Czy raport obejmuje wszystkie 16 dokumentów i 142 sekcje, a długie opisy są czytelne? |
| 3 | Mapa z 29 znacznikami, powiększanie i przesuwanie; karty, linki wewnętrzne i zachowanie pozycji. | Czy wybór lokacji, wejście do komnat iglicy i powrót zachowują orientację? |
| 4 | Ograniczony edytor, autosave i podstawowe wklejanie; kontrola zapisu po restarcie. | Czy da się poprawić notatkę bez utraty tabel i wyróżnień, a ponowny start nie nadpisuje zmian? |
| 5 | Czas, wspólny odpoczynek i Arcane Blight w C#, wraz z testami reguł. | Czy należne sprawdzenia działają niezależnie dla bohaterów i zachowują kolejność skutków? |
| 6 | Domknięcie widoku mechaniki, prostego cofania i jej trwałości. | Czy duży skok nie gubi zaległości, ponowienie nie nalicza skutków dwa razy, a cofnięcie przywraca spójny stan? |
| 7 | Odbiór kompletności danych, Full HD i pracy offline; poprawki i instrukcja Windows. | Czy można prowadzić z mapy i notatek bez internetu i utraty zmian? To slot odbioru, nie czas na nowy moduł. |

Dzień 7 zostawia 3 godziny na sprawdzenie i poprawki, ale nie stanowi gwarancji wystarczającej rezerwy. Główne niewiadome to konwersja bogatej treści bez strat, integracja edytora i zależne rozstrzygnięcia mechaniki. Po dniu 1 oceniamy realność slotów. Opóźnienie rozwiązujemy ograniczeniem dodatków lub uzgodnieniem terminu; nie usuwamy części Ythryn, nie tracimy treści i nie odkładamy samowolnie wcześniej wymaganego Arcane Blight.

## 7. Odbiór minimum

1. Uruchamiam aplikację lokalnie na Windows. Raport migracji rozlicza 16 dokumentów, 142 sekcje i 29 znaczników; wszystkie dostępne teksty Ythryn są osiągalne w nawigacji. Żaden znacznik nie kieruje do nieistniejącego materiału. Przegląd obejmuje także komnaty Y19, tabele i materiały dodatkowe.
2. Otwieram Y4 z mapy, czytam długi opis, przechodzę do innego materiału i wracam w poprzednie miejsce. Mapa zachowuje powiększenie i przesunięcie. Każdy odnośnik źródłowy jest rozliczony; nie ma pozornie działających linków do nieobecnych treści.
3. Włączam edycję, zmieniam treść i potwierdzam zachowanie jej po restarcie. Czytelność i istniejące elementy dokumentu są zachowane. Klikanie w trybie czytania nie otwiera edytora. Błąd zapisu jest widoczny i nie kasuje tekstu z karty.
4. Po przygotowaniu środowiska odłączam internet, ponownie uruchamiam aplikację i wykonuję ten sam przebieg. Dane startowe nie nadpisują zmian. Potrzebne materiały nie wymagają otwarcia Obsidiana ani strony internetowej.

Obowiązkowy odbiór czasu i Arcane Blight:

5. Przesuwam czas przez granicę 12 h, rozstrzygam ekspozycje niezależnie dla bohaterów, zakażenie i odpoczynek. Duży skok nie gubi spraw; powtórzone żądanie nie nalicza zmiany drugi raz. Sprawdzamy też sukces z wynikiem k6, wyzdrowienie z odpornością, trzecią porażkę po odpoczynku i magiczne leczenie.
6. Cofam ostatnie rozstrzygnięcia, a następnie zmianę czasu, uzyskując spójny stan. Zapis stanu narzędzia przetrzymuje restart i działa offline.

Eksport/import nie jest elementem odbioru tej wersji. Testy konwersji i powiązań chronią kompletność danych; testy mechaniki sprawdzają reguły i zależności. Czytelność, nawigację, zapis i obsługę błędu weryfikujemy na rzeczywistym widoku. Nie dodajemy testów odtwarzających tylko układ komponentów.

## 8. Ostatnie odpowiedzi i dalszy krok

1. Użytkownik wskazał, że Arcane Blight oraz edycja muszą wejść do pierwszego tygodnia.
2. Wystarczy edycja istniejących materiałów; tworzenie nowych osobnych notatek jest późniejszym zakresem.
3. Wystarczy wspólny długi odpoczynek całej drużyny; wyniki mechaniki pozostają indywidualne.

Zakres minimum nie wymaga ponownego potwierdzania tych decyzji. Następny dokument rozpisuje [konkretne zadania i propozycję techniczną](05-Plan-wykonawczy-MVP.md). Nadal pracujemy nad planem; odpowiedzi o zakresie nie stanowią same w sobie polecenia rozpoczęcia implementacji.
