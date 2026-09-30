# Migawka stanu implementacji

30 września 2026 · zapis historyczny przeniesiony z README

Poniższy opis zachowuje stan i wyniki prób raportowane przed uporządkowaniem repozytorium. Nie jest potwierdzeniem ponownego wykonania tych prób. Oryginalny katalog POC został usunięty; gotowe dane i mapa modułu pozostają w `src/MasterCompanion.Modules.Ythryn/Data`.

## Stan fundamentu

Rozpoczęto implementację fundamentu. Działają nawigacja po 142 materiałach z 16 dokumentów źródłowych, karty, czytnik, wizualna edycja istniejących opisów, autosave w PostgreSQL oraz mapa z 29 znacznikami. Edycja wymaga kliknięcia „Edytuj notatkę”. Mapa zajmuje główny obszar na żądanie. Oryginalny POC był wówczas zachowany.

Spis zachowuje zagnieżdżenie folderów źródła, w tym wątki graczy i folder Fenes. Aktywacja karty rozwija jej ścieżkę, ustawia focus i przewija spis do wyraźnie zaznaczonego materiału. Karty zamykamy przyciskiem × albo środkowym przyciskiem myszy, po dopilnowaniu zapisu. Nagłówek pozwala przełączać jasny/ciemny motyw; wybór jest pamiętany w przeglądarce.

**To jeszcze nie jest pełne MVP.** Pozostają zegar, konfiguracja drużyny, wspólny odpoczynek, Arcane Blight i cofanie operacji gry. Do uzupełnienia są też wstawianie Markdown, menu linków do materiałów i pełny odbiór pracy bez internetu. Po konflikcie zapisu tekst pozostaje w karcie; obecna obsługa pozwala go skopiować przed odświeżeniem.

## Raportowane próby

Sprawdzono kompilację wszystkich projektów, konwersję i ponowne wczytanie całej treści, granice zależności, kolejność autosave, zachowanie przy błędzie i konflikcie oraz odczyt/zapis przez API na rzeczywistym PostgreSQL. Test w przeglądarce Full HD objął Y4, tabele, zwijany blok, polskie znaki, jawny tryb edycji, mapę, znaczniki i zachowanie powiększenia. Próbny zapis przetrwał kontrolowany restart Aspire, po czym dopisek testowy usunięto.

Po poprawkach czytnika przechodzi 10 testów treści, hierarchii i autosave. Sprawdzają też oczekiwanie na zapis przy zamykaniu oraz odmowę zamknięcia po błędzie lub konflikcie. Migracja na działającej bazie dodała 18 folderów i przypisania wszystkich 142 materiałów; porównanie skrótów dokumentów i rewizji przed i po potwierdziło brak zmian w notatkach. Próby w przeglądarce Full HD potwierdziły ×, środkowy przycisk, zamknięcie ostatniej karty, ponowne otwarcie mapy z zachowanym powiększeniem, focus i centrowanie aktywnego materiału, rozwijanie ścieżki Fenes, odsłanianie materiału ukrytego przez filtr oraz pamiętanie obu motywów po odświeżeniu. Nie zaobserwowano błędów konsoli ani poziomego przepełnienia widoku.

W logach Aspire 13.6 na tym Windows zaobserwowano powtarzający się komunikat DCP o subskrypcji powiadomień przez lokalny socket. Nie zablokował startu zasobów ani powyższych prób; wymaga osobnej diagnostyki, jeśli wpłynie na dashboard lub pracę środowiska.

## Źródła Markdown i integracja zmian

Kolejna zmiana przeniosła 142 materiały do osobnych źródeł Markdown z metadanymi YAML w `src/MasterCompanion.Modules.Ythryn/Data/Source`. Manifest, foldery, definicja mapy i zasoby są rozdzielone. Paczka JSON powstaje podczas kompilacji .NET w pomijanym przez Git `Data/Generated`. Edycja w aplikacji nadal dotyczy kopii kampanii; przebudowa nie aktualizuje jej notatek.

Przed scaleniem zmian porównano wszystkie dokumenty, foldery i mapę z pierwotną paczką oraz potwierdzono identyczne bajty obrazu. Sprawdzono kompilację .NET i Angulara oraz izolowane wczytanie osadzonego manifestu, 142 dokumentów, 18 folderów i mapy. Nie restartowano aplikacji ani nie zmieniano danych kampanii. Rozbudowany wizualny edytor pozostaje przyszłym zakresem opisanym w [planie wykonawczym](05-Plan-wykonawczy-MVP.md).

Przy rozwiązywaniu konfliktów PR #2 zachowano usunięcie katalogu POC i organizację dokumentacji z `trunk`. Testy treści korzystają z utrzymywanych źródeł i stałych danych odniesienia, a test eksportu do Markdown ponownie kompiluje wszystkie materiały. Opcjonalny importer przyjmuje jawnie wskazany zewnętrzny HTML; jego test używa małego niezależnego przykładu. Ta zmiana usuwa zależność testów i kompilacji od skasowanego katalogu referencji.

Po scaleniu przeszło 13 testów treści i narzędzi modułu, także po rzeczywistym usunięciu katalogu POC. Kompilacja .NET zakończyła się bez ostrzeżeń i błędów, kompilacja Angulara oraz kontrole granic i języka kodu przeszły. Izolowana próba .NET potwierdziła manifest, 142 dokumenty zgodne z pierwotną paczką, 18 folderów, definicję mapy i identyczne bajty obrazu. Nie zmieniano bazy ani nie restartowano aplikacji.
