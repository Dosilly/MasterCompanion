# Migawka stanu implementacji

Current execution evidence for gameplay is in [the gameplay implementation plan](09-Gameplay-implementation.md). The entries below preserve earlier verification history.

Arcane Blight now displays remaining time and links to its campaign rules
heading. The user-confirmed infected recovery schedule is every 12 hours or
after long rest, which resets the timer. Module schema 2 preserves supported
schema 1 saves, receipts and undo. Scoped rule, PostgreSQL, HTTP and browser
evidence is recorded in [the gameplay implementation plan](09-Gameplay-implementation.md).

The latest design revision adds a generic editable party tab, stable character
resources shared with module tools, building search (30 minutes), short rest
(1 hour), a single long-rest shortcut and undo beside refresh. A one-tool module
renders its tool directly. Draft/conflict recovery and atomic roster undo are
verified. The updated Docker application is running at localhost:4200 with the
existing campaign preserved; exact checks and remaining offline acceptance are
recorded in [the gameplay implementation plan](09-Gameplay-implementation.md).

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

## Module content organization — 1 October 2026

The maintained Ythryn sources now contain 106 materials in 10 folders. All 46 numbered location materials (Y1–Y29 and the Y19 rooms) share one location folder in adventure order. The Y19 overview includes its shared features. Nine navigation-only materials were removed, and links now target substantive documents. Fenes contains five complete documents directly under the character folder; the GM guide and four player handouts keep their original sections, tables, and stable anchors. The original 29 map targets and asset remain unchanged.

The user explicitly authorized replacing all materials in the existing local campaign. A local SQL backup was saved under `.local/campaign-before-reorganization.sql`, then a campaign-scoped transaction replaced the material contents and folder hierarchy. Retained materials advanced their revisions; obsolete materials were removed. The final duplicate player-thread index was removed with a separate revision-protected transaction. This was a one-time, user-requested replacement, not an automatic module upgrade or a change to startup initialization. Future rebuilds still preserve campaign-owned edits. The backup is local and ignored by Git; restoring it requires a separately authorized operation that accounts for any subsequent edits.

All 16 content and source-tool tests passed, including exact preservation of consolidated section content, schema round trips, navigation order, internal links, map targets, and portable export of colon-containing IDs on Windows. The code/localization check and the affected .NET module build passed; the build reported no warnings or errors. API evidence from the running PostgreSQL-backed campaign confirmed exact source content at replacement, the final 106 materials and 10 folders, unchanged maps, and increasing revisions. A stale save returned a revision conflict without changing the document. During the final read, the tomb-tapper encounter had a subsequent campaign save at revision 3; that later save was preserved, while the remaining 105 documents still matched the source package.

Browser checks at 1920×1080 covered map navigation to Y19, search, the single-page recovery report and observatory correspondence, and both themes without horizontal page overflow. No console errors were observed. Angular's existing oversized-map-image performance warning remains. No frontend implementation changed; no frontend rebuild, application restart, or database-volume removal was needed. General module upgrades and visual module authoring remain deferred.

## Gameplay backend — 1 October 2026

The first gameplay backend slice now implements party setup, elapsed time, shared rest, module-owned Arcane Blight outcomes and healing, idempotent operation receipts, revision conflicts and sequential undo. State and operation history are separate from material documents and committed atomically. A neutral `ICampaignGameRules` contract keeps module rules independent of engine persistence. The new additive EF migration and API registration are prepared; the local user's campaign has not been migrated or initialized with game state during this work.

Verification passed 16 pure-rule cases, real PostgreSQL integration tests (concurrency, receipts, undo, material isolation, rollback at commit, corrupt data rejection and cancellation), and real HTTP boundary tests. Test database restart preserved state, journal and authored material hashes. The full backend solution and final affected backend/test project compiled without warnings or errors. Code/localization, dependency boundaries and EF model/migration consistency checks passed. All database probes used an isolated disposable test container; no user database volume was removed or changed.

The frontend delivery below follows this backend slice. See [the delivery plan](09-Gameplay-implementation.md) for the API contract, bounds and repeatable checks.

## Gameplay frontend and editor completion — 1 October 2026

Implemented the on-demand game tab, party setup, elapsed clock, time advances, shared rest, Ythryn's Arcane Blight tool with independent outcomes and k6, magical healing, and confirmed sequential undo. Exact pending requests survive page reload in tab session storage; retries use their original identity and read the current state after confirmation. Revision conflicts block writes until refresh. Module tools depend only on frontend contracts. The material editor now inserts bounded Markdown and selected campaign links while preserving existing rich content and cancelled drafts. Keyboard tab navigation and panel relationships are included.

All 30 gameplay frontend, 6 insertion and 14 affected autosave/editor tests passed. Full frontend compilation and code/localization/dependency checks passed, followed by final scoped engine compilation. Browser checks at 1920×1080 in both themes used an isolated real PostgreSQL database and loopback API: setup, 10 h → 8 h rest → exposure → infection → recovery k6, undo, persisted Markdown/table/link, independent note saves, real two-window conflict and recovery after connection loss/page reload/API restart. The existing oversized-map-image warning remains. The user's campaign and database volume were not changed.

Full internet-disconnected acceptance remains pending. Current implementation and exact evidence are detailed in [the gameplay delivery plan](09-Gameplay-implementation.md); these scoped checks do not constitute complete MVP acceptance.

## Local Docker runtime — 1 October 2026

The root multi-stage Dockerfile and Compose configuration now run the production
frontend and API together at `http://localhost:4200`, with separate private
PostgreSQL. The user's existing volume and credentials are reused. A backup was
saved before the additive gameplay migration; before/after hashes confirmed all
106 materials, their revisions and the remaining campaign data were preserved.
The image build and four read-only container integration tests passed. Details and
limits are in [the Docker runtime record](10-Docker-local-runtime.md).
