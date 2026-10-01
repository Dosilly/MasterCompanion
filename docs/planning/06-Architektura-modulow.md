# Granica silnika i modułów

## Gameplay contract — 1 October 2026

The first gameplay slice uses `ICampaignGameRules` in `MasterCompanion.Contracts`. The engine owns elapsed minutes, party IDs, shared rest ends, revisions and transactionally stored snapshots and operation receipts. A module owns the schema, validation and transformation of its JSON state and its tool projection. Pure rules receive neutral snapshots; they never import engine persistence or EF Core. The API registers concrete implementations.

Campaign-scoped operations must atomically update time, module state, revision and history. Sequential undo restores the last active snapshot while advancing revision; material saves remain independent. Request IDs preserve the original receipt for safe retries and reject reuse with different input. See [the gameplay implementation plan](09-Gameplay-implementation.md) for delivery order and acceptance evidence.

30 września 2026 · rozpoczęta implementacja fundamentu

Użytkownik wymaga mocnej granicy między silnikiem wyświetlającym materiały a modułami kampanii. Wprowadzamy osobne projekty .NET i osobno kompilowane biblioteki Angulara. Vertical slices pozostają sposobem organizacji przypadków użycia wewnątrz projektu odpowiedzialnego za daną funkcję.

Na MVP rekomendujemy jedno lokalne uruchomienie i wspólne wydanie. Pytanie o instalowanie modułów zawierających nowy kod bez aktualizacji aplikacji pozostaje otwarte. Wcześniejsze ustalenie zakładało dostarczanie nowych mechanik z aktualizacją aplikacji. Nie wdrożono dynamicznego loadera pluginów ani Module Federation.

## Pojęcia

**Silnik** zapewnia ogólne funkcje pracy z kampanią: czytnik, edycję, zapis, karty, hierarchiczną nawigację i wyświetlanie map. **Moduł** to implementacja kontraktu dostarczająca manifest, foldery, materiały, mapy, zasoby oraz własne reguły i narzędzia. **Kampania** to instancja utworzona z modułu, z własnymi materiałami i stanem rozgrywki.

**Ythryn** jest pierwszą konkretną implementacją modułu. Jego nazwa, materiały i Arcane Blight opisują zakres pilota. Inne moduły mogą dostarczyć inną hierarchię folderów, mapy i mechaniki bez zmian w czytniku. Nazwa konkretnego projektu `MasterCompanion.Modules.Ythryn` oznacza implementację, a nie nazwę abstrakcji.

## Zależności

```mermaid
flowchart LR
    Host[API / Angular host] --> Engine[Silnik]
    Host --> Module[Implementacja modułu]
    Engine --> Contracts[Kontrakty]
    Module --> Contracts
```

Host jest jedynym miejscem, które składa konkretny silnik i konkretny moduł. Silnik nie odwołuje się do projektów ani nazw Ythryn. Moduł nie importuje implementacji silnika, jego komponentów, DbContext ani prywatnych plików. Moduły nie zależą od siebie.

| Obszar | Właściciel |
|---|---|
| Nawigacja materiałów, karty, czytnik, edytor i zapis | Silnik |
| Wyświetlanie mapy i otwieranie materiałów ze znaczników | Silnik |
| Foldery i ich hierarchia, treść, ilustracje map, pozycje i cele znaczników, materiał początkowy | Implementacja modułu |
| Reguły specyficzne dla przygody i interfejs jej narzędzi | Implementacja modułu; Arcane Blight backend and frontend are implemented |
| Neutralne typy folderów, materiałów i map, manifest, rejestracja narzędzi | Kontrakty |
| Rejestracja modułów, DI, procesy, połączenie z bazą | Host / Aspire |

## Backend

- `MasterCompanion.Contracts`: `ICampaignModule`, manifest i neutralne typy folderów, materiałów, map oraz zasobów. Nie zależy od EF Core, ASP.NET Core ani konkretnego modułu.
- `MasterCompanion.Engine`: neutralne slices odczytu, zapisu i inicjalizacji kampanii, własny model EF Core i schemat PostgreSQL `engine`. Zależy wyłącznie od kontraktów w obrębie rozwiązania.
- `MasterCompanion.Modules.<Nazwa>`: projekty konkretnych implementacji kontraktu modułu. Obecnie istnieje `MasterCompanion.Modules.Ythryn`, dostarczający manifest, hierarchię folderów, osadzone materiały i mapę. Zależy wyłącznie od kontraktów. Przyszłe slices i reguły pilota powstają w tym projekcie.
- `MasterCompanion.Api`: composition root. Rejestruje Ythryn jako implementację kontraktu i montuje neutralne endpointy silnika.

Silnik kopiuje materiały do kampanii przy pierwszym uruchomieniu. Moduł nie aktualizuje samodzielnie dokumentów użytkownika. Zasób mapy jest udostępniany przez kontrakt strumienia; silnik nie zna ścieżek plików modułu.

Źródła treści modułu są oddzielone od jego paczki wykonawczej. Konkretna implementacja przechowuje mały manifest, hierarchię folderów, definicje map i zasoby oraz osobne dokumenty Markdown z metadanymi YAML. Etap budowania waliduje źródła i kompiluje Markdown do istniejącego schematu dokumentu Tiptap. Wynikowy JSON jest artefaktem budowania, pomijanym przez Git; kompilacja projektu modułu osadza go w assembly. Silnik i kontrakty nadal otrzymują gotowe dokumenty, niezależnie od formatu źródeł. POC jest wyłącznie historycznym wejściem do jawnego importu, który nie może nadpisywać istniejących źródeł.

Kotwice nagłówków używają `{#id}`. Zwykły Markdown nie reprezentuje wszystkich struktur dokumentu; dla bezstratnego przeniesienia dopuszczamy kontrolowane bloki HTML, zwłaszcza zwijane fragmenty i niektóre tabele. Walidator odrzuca wykonywalny HTML i zewnętrzne odwołania. Zmiany w aplikacji zapisują kopię kampanii, bez zapisu do repozytorium modułu. Wizualne tworzenie modułów i aktualizowanie istniejących kampanii są odrębnym przyszłym zakresem. Bieżący build i testy nie wymagają usuniętego katalogu POC; opcjonalny import historycznej zawartości przyjmuje zewnętrzny plik HTML.

Folder ma stabilny identyfikator i opcjonalny identyfikator rodzica. Materiał wskazuje folder; nazwa grupy służy jedynie opisowi w czytniku. Hierarchia jest kopiowana do tabeli `engine.Folders`, a silnik sprawdza brak cykli i poprawność odwołań. Przy aktualizacji pierwszego fundamentu, który miał wyłącznie płaskie grupy, jednorazowo uzupełniamy foldery i przypisania istniejących materiałów. Ta aktualizacja metadanych nie zmienia dokumentów ani rewizji zapisu. Kolejne starty nie odtwarzają hierarchii z paczki.

The gameplay contract is now `ICampaignGameRules`, with elapsed minutes, party and shared rest owned by the engine and versioned module JSON interpreted only by the module. `GameplayService` stores current snapshots and confirmed operation receipts under the `engine` schema. Transactions and campaign row locks protect time, module state, revisions and sequential undo together. Material documents remain outside this journal. Repeatable-read gameplay GETs keep current state and undo availability coherent; replayed receipts are validated before returning. The API is the composition root registering `YthrynGameRules`. No module-specific branch or disease column was added to the engine. Verification is recorded in [the gameplay plan](09-Gameplay-implementation.md).

## Frontend

- `@mastercompanion/contracts`: DTO i manifest modułu, token rejestracji, typ rejestracji komponentu narzędzia.
- `@mastercompanion/engine`: czytnik, Tiptap, mapa, rekurencyjna nawigacja, karty, preferencja motywu i własne style. Zna kontrakty, nie importuje konkretnego modułu.
- `@mastercompanion/ythryn`: manifest and lazily loaded Arcane Blight component, module projection validation, outcome commands and its own localization resources.
- `src/main.ts`: host importujący publiczne API bibliotek i rejestrujący moduły.

Biblioteki są rzeczywiście budowane przez `ng-packagr`; aplikacja importuje wynik kompilacji przez publiczne entry points. Nie korzysta z aliasów do prywatnych katalogów źródłowych. Podczas rozwoju biblioteki przebudowujemy przed uruchomieniem hosta; zmiany w bibliotece wymagają ponownego uruchomienia `pnpm start`.

The frontend contracts now expose `GameStateDto`, `GameAction` and `GameToolContext` through the public entry point. The engine provides `CAMPAIGN_GAME` to a dynamically loaded module tool. Its signals supply confirmed state, pending status and operation availability; `execute` returns confirmed success. The module imports only contracts, validates its opaque projection and submits module commands without importing the engine's HTTP service or persistence implementation. The host still composes the libraries.

`GameSession` owns revision coordination and recovery. It copies and validates each action, preserves the exact request ID and body in tab session storage before POST, and allows only one dependent operation at a time. An uncertain outcome blocks other writes and permits explicit replay of that same request, including after page reload. Original receipts are followed by a current-state GET; an older receipt never becomes visible current state. Conflicts require explicit refresh. Storage or response failures do not claim success, and destruction cancels I/O while leaving the recovery request intact. Module tools keep local input associated with the current check identity.

Markdown insertion and material-link selection belong to the engine editor. They insert through the supported schema at the captured selection, require explicit edit mode and use the existing material autosave/revision path. Markdown is bounded to 65,536 characters, escapes raw HTML and rejects images, external links and unknown campaign targets. Existing rich blocks remain intact; cancelled or rejected Markdown stays recoverable in the mounted material view. This campaign editing path does not edit authored module sources.

## Kontrola granic i przyszłe rozszerzenia

`pnpm check:boundaries` sprawdza referencje projektów .NET, zależności bibliotek, importy między bibliotekami i odwołania do Ythryn w silniku. Kontrola jest również uruchamiana przed kompilacją i startem frontendu. Zwykłe endpointy nadal wymagają odpowiednich testów; kontrola importów nie dowodzi kompletnej izolacji zachowania.

Mikrofrontendy uzasadnia potrzeba niezależnego budowania, dostarczania i aktualizowania kodu widoków. [Module Federation](https://webpack.js.org/concepts/module-federation/) łączy oddzielne buildy w działającej aplikacji; wymaga też zarządzania zależnościami współdzielonymi i ich wersjami. [Biblioteki Angulara](https://angular.dev/tools/libraries/creating-libraries) zapewniają osobne paczki i publiczne API bez ładowania kodu z oddzielnych wdrożeń. Wybór bibliotek na MVP jest rekomendacją wynikającą z lokalnego uruchomienia i budżetu, a nie rezygnacją z wymaganej granicy.

Jeśli potrzebne będzie instalowanie kodu bez przebudowy hosta, projekt obejmie wersjonowanie kontraktów, zgodność paczek, ładowanie i błędy inicjalizacji, migracje stanu oraz reguły zaufania do pluginów. Silne granice obecnego kodu pomagają w tym kierunku, ale nie oznaczają, że taka migracja będzie bezkosztowa.
