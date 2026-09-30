# MasterCompanion

Lokalna aplikacja MG w przeglądarce. Angular 22, .NET 10, PostgreSQL 18 i .NET Aspire. Pierwszy moduł: całe Ythryn z dostarczonego POC.

## Bieżący stan

Rozpoczęto implementację fundamentu. Działają nawigacja po 142 materiałach z 16 dokumentów źródłowych, karty, czytnik, wizualna edycja istniejących opisów, autosave w PostgreSQL oraz mapa z 29 znacznikami. Edycja wymaga kliknięcia „Edytuj notatkę”. Mapa zajmuje główny obszar na żądanie. Oryginalny POC jest zachowany.

Spis zachowuje zagnieżdżenie folderów źródła, w tym wątki graczy i folder Fenes. Aktywacja karty rozwija jej ścieżkę, ustawia focus i przewija spis do wyraźnie zaznaczonego materiału. Karty zamykamy przyciskiem × albo środkowym przyciskiem myszy, po dopilnowaniu zapisu. Nagłówek pozwala przełączać jasny/ciemny motyw; wybór jest pamiętany w przeglądarce.

**To jeszcze nie jest pełne MVP.** Pozostają zegar, konfiguracja drużyny, wspólny odpoczynek, Arcane Blight i cofanie operacji gry. Do uzupełnienia są też wstawianie Markdown, menu linków do materiałów i pełny odbiór pracy bez internetu. Po konflikcie zapisu tekst pozostaje w karcie; obecna obsługa pozwala go skopiować przed odświeżeniem.

## Uruchomienie na Windows

Wymagane: SDK .NET 10.0.303 lub nowsza poprawka w tej samej gałęzi, Node 24.19+, pnpm 11.19 i uruchomiony Docker Desktop z kontenerami Linux. Pierwsze przygotowanie wymaga internetu do pobrania paczek i obrazu PostgreSQL.

W PowerShell, z katalogu repozytorium:

```powershell
pnpm --dir src/mastercompanion-web install --frozen-lockfile
dotnet restore MasterCompanion.slnx
dotnet build MasterCompanion.slnx --no-restore
dotnet run --project src/MasterCompanion.AppHost --no-build
```

Otwórz [http://localhost:4200](http://localhost:4200). Aspire uruchamia bazę, API i frontend. Dashboard jest pod adresem wypisanym przez AppHost; token dashboardu dotyczy narzędzia deweloperskiego, aplikacja nie ma logowania. Zatrzymanie procesu przez Ctrl+C zatrzymuje środowisko, zachowując wolumen bazy.

Po pierwszej instalacji frontend startuje z `pnpm install --offline --frozen-lockfile`; paczki i obraz kontenera muszą już być dostępne lokalnie. Nie używamy CDN, zewnętrznych fontów ani chmury. Pełnego odbioru przy odłączonym internecie jeszcze nie wykonano.

Zmiana biblioteki Angulara wymaga ponownego uruchomienia frontendu, ponieważ biblioteki są kompilowane przed `ng serve`. W samym hoście działa odświeżanie deweloperskie.

## Dane i moduły

PostgreSQL przechowuje dane w trwałym wolumenie Docker `mastercompanion-postgres`. Nie usuwaj tego wolumenu, jeśli chcesz zachować własne zmiany. Materiały modułu są kopiowane do kampanii tylko przy pierwszym przygotowaniu bazy; ponowny start nie nadpisuje edycji. API wykonuje migracje EF Core przed uruchomieniem.

Silnik obsługuje ogólny kontrakt modułu. Moduł dostarcza foldery, materiały, mapy, zasoby i własne mechaniki; kampania jest jego instancją z własnymi zmianami. Ythryn jest pierwszą konkretną implementacją. Silnik, kontrakty i implementacje modułów to osobne projekty .NET oraz osobno kompilowane biblioteki Angulara. Host składa te elementy. Granice opisuje [architektura modułów](06-Architektura-modulow.md). Endpointy są organizowane jako vertical slices; reguły przygody rozwijamy w jej module.

Przy przejściu z pierwszej wersji płaskiego spisu migracja dodaje foldery, a inicjalizacja jednorazowo uzupełnia ich hierarchię i przypisania materiałów. Nie zmienia treści notatek ani ich rewizji. Edycja organizacji folderów i ogólny mechanizm aktualizacji paczek modułów pozostają przyszłym zakresem.

Źródłem utrzymywanej treści modułu są teraz osobne pliki Markdown z metadanymi YAML w `src/MasterCompanion.Modules.Ythryn/Data/Source/documents`. Manifest, hierarchia folderów, mapa i zasoby mają osobne pliki. Markdown zachowuje kotwice sekcji; zwijane bloki i tabele, których nie da się przenieść bezstratnie, pozostają fragmentami HTML. [Instrukcja utrzymywania modułu](src/MasterCompanion.Modules.Ythryn/Data/Source/README.md) opisuje format i walidację.

Duży JSON jest wyłącznie generowaną paczką w `Data/Generated`, pomijaną przez Git. Kompilacja projektu .NET automatycznie buduje go z Markdown; Node i zainstalowane zależności frontendu są wymagane również podczas tego kroku. Paczkę można przygotować osobno:

```powershell
pnpm --dir src/mastercompanion-web prepare:ythryn
```

Normalne budowanie nie czyta oryginalnego HTML. POC w `Inspiracja - obecna aplikacja` pozostaje referencją, a ponowny import jest możliwy tylko do nowego katalogu roboczego przez `import:ythryn-poc`. Nie nadpisuje źródeł Markdown. Edycja w aplikacji nadal dotyczy kopii kampanii w bazie, a przebudowa modułu nie aktualizuje istniejących notatek użytkownika. Wizualny edytor źródeł modułu i rozbudowa obecnego edytora są zapisane jako przyszły zakres.

[Raport konwersji](ythryn-conversion-report.json) zawiera brakujące odwołania do materiałów poza POC i bibliografię. Ich widoczny tekst został zachowany, a nieaktywne odnośniki nie wysyłają poza aplikację. Nie dopisano brakujących plików źródłowych ani nowych zasad.

## Weryfikacja

Repository engineering requirements are in [AGENTS.md](AGENTS.md). They define English source and diagnostics, module ownership, data safety, failure handling, security boundaries, accessibility, and the required evidence before a change is considered complete.

UI copy is stored in typed English/Polish catalogs under `projects/engine/src/lib/i18n`. The current UI uses the Polish catalog. Technical exceptions and API ProblemDetails are English; UI recovery messages map error codes to localized resources. Source-specific Polish samples belong to fixtures or module content.

`check:code` checks source files for Polish characters and checks catalog keys/placeholders for consistency. It runs before frontend builds and startup, alongside the boundary check. It supports review rather than proving all ASCII text is English or all production requirements have been satisfied.

```powershell
dotnet build MasterCompanion.slnx
pnpm --dir src/mastercompanion-web build
pnpm --dir src/mastercompanion-web check:boundaries
pnpm --dir src/mastercompanion-web check:code
pnpm --dir src/mastercompanion-web test:content
pnpm --dir src/mastercompanion-web test:autosave
# With a running AppHost: this probe appends temporary text and restores the original content.
pnpm --dir src/mastercompanion-web test:api
# Checks English error diagnostics without changing a persisted document or revision.
pnpm --dir src/mastercompanion-web test:api-errors
```

Sprawdzono kompilację wszystkich projektów, konwersję i ponowne wczytanie całej treści, granice zależności, kolejność autosave, zachowanie przy błędzie i konflikcie oraz odczyt/zapis przez API na rzeczywistym PostgreSQL. Test w przeglądarce Full HD objął Y4, tabele, zwijany blok, polskie znaki, jawny tryb edycji, mapę, znaczniki i zachowanie powiększenia. Próbny zapis przetrwał kontrolowany restart Aspire, po czym dopisek testowy usunięto.

Po poprawkach czytnika przechodzi 10 testów treści, hierarchii i autosave. Sprawdzają też oczekiwanie na zapis przy zamykaniu oraz odmowę zamknięcia po błędzie lub konflikcie. Migracja na działającej bazie dodała 18 folderów i przypisania wszystkich 142 materiałów; porównanie skrótów dokumentów i rewizji przed i po potwierdziło brak zmian w notatkach. Próby w przeglądarce Full HD potwierdziły ×, środkowy przycisk, zamknięcie ostatniej karty, ponowne otwarcie mapy z zachowanym powiększeniem, focus i centrowanie aktywnego materiału, rozwijanie ścieżki Fenes, odsłanianie materiału ukrytego przez filtr oraz pamiętanie obu motywów po odświeżeniu. Nie zaobserwowano błędów konsoli ani poziomego przepełnienia widoku.

Po przeniesieniu źródeł do Markdown zestaw `test:content` obejmuje 12 testów, w tym bezstratny import całego POC, odnośniki i hierarchię, walidację metadanych i HTML, odmowę nadpisania źródeł oraz zachowanie ostatniej paczki po błędzie budowania. Jednorazowe porównanie paczki po migracji potwierdziło dokładnie te same 142 dokumenty, foldery i mapę oraz identyczne bajty obrazu. Rozwiązanie .NET skompilowano również bez istniejącego wygenerowanego JSON-a, a izolowana próba wczytała osadzony manifest, treść i zasób mapy. Kompilacja .NET używała osobnego katalogu wyjściowego ze względu na pliki zablokowane przez działające API; nie restartowano aplikacji ani nie zmieniano danych kampanii. Kompilacja frontendu i kontrole jakości przeszły.

W logach Aspire 13.6 na tym Windows zaobserwowano powtarzający się komunikat DCP o subskrypcji powiadomień przez lokalny socket. Nie zablokował startu zasobów ani powyższych prób; wymaga osobnej diagnostyki, jeśli wpłynie na dashboard lub pracę środowiska.

Zakres całego pierwszego tygodnia opisują [plan minimum](04-Plan-minimum-tydzien.md) i [plan wykonawczy](05-Plan-wykonawczy-MVP.md).
