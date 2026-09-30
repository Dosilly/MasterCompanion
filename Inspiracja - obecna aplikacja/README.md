# Inspiracja — obecna aplikacja MG

Migawka istniejącej aplikacji z 29 września 2026. Ten folder można przenieść razem z dokumentacją do osobnego projektu. Oryginał w folderze kampanii pozostaje bez zmian.

## Jak obejrzeć

Otwórz [Rozdzialy 6 i 7.html](<Rozdzialy 6 i 7.html>) w zwykłej przeglądarce. Plik działa offline i zawiera treść notatek, stylowanie, mapy oraz narzędzia. Nie wymaga serwera ani przebudowy.

Wybierz rozdział **07**, następnie mapę albo **Narzędzia — Ythryn**. Rozdział 6 pozostaje w kopii dla kompletności istniejącej aplikacji, ale materiałem pilotażowym nowego produktu jest akt 7.

Kopia HTML nie zawiera bieżącego zapisu liczników z przeglądarki MG. Stan sesji jest przechowywany osobno; do jego świadomego przeniesienia służą przyciski pobrania i wczytania zapisu w narzędziach. Odnośniki do zewnętrznych notatek Obsidiana mogą wymagać oryginalnego sejfu. Treści osadzone w HTML i mapy działają samodzielnie.

## Co ma inspirować nowy produkt

- **Mapa jako wejście do materiałów:** kliknięcie znacznika pokazuje opis lokacji pod mapą. Powiększenie, przesuwanie i powrót do mapy ułatwiają orientację.
- **Dostęp do komnat:** znacznik Y19 prowadzi do iglicy i jej poszczególnych pomieszczeń.
- **Nawigacja:** spis po lewej, wyszukiwanie, zagnieżdżenie dokumentów Fenes i oddzielenie materiałów redakcyjnych.
- **Czytelność lokacji:** opis dla graczy, obraz miejsca dla MG, zasady przy konkretnych obiektach i zwijane tło. Y4 jest dobrym przykładem tego układu.
- **Świadome przesuwanie czasu:** osobny pobyt w Ythryn i czas eksploracji, przypomnienia oraz rozstrzygnięcia należnych spraw.
- **Narzędzia przy stole:** niezależne karty bohaterów, Arcane Blight, postęp rytuału, terminy frakcji, dodatkowe przypomnienia i notatka sesji.
- **Ciągłość stanu:** zapis lokalny, cofanie operacji oraz możliwość pobrania i wczytania zapisu.

## Jak korzystać z tej inspiracji w nowym projekcie

Ta aplikacja pokazuje doświadczenia, które doprowadziły do pomysłu nowego produktu. Nie jest docelowym projektem ani specyfikacją architektury. W razie różnic pierwszeństwo mają [koncepcja](../00-Koncepcja-produktu.md), [BRD](../01-BRD.md) i [user stories](../02-User-stories.md).

Nowy produkt ma umożliwiać edycję treści, tworzenie map i znaczników, własne foldery, linkowane obiekty, puste kampanie i kreator prostych narzędzi. Ma też oddzielać zapiski poszczególnych sesji od kroniki. Obecny HTML ma treść osadzoną przy budowaniu, narzędzia przygotowane konkretnie dla Ythryn i prostszy zapis sesji; tych ograniczeń nie należy przenosić do nowego produktu jako wymagań.

Nazwy postaci, pięcioosobowa drużyna, podział na rozdziały 6 i 7 oraz reguły konkretnej przygody są zawartością tej kampanii. Nie określają ograniczeń ogólnej aplikacji. Materiały zawierają sekrety MG i prywatne dodatki kampanii; ta kopia służy jako kontekst projektu, nie jako publiczny moduł do dystrybucji.

## Czytelne źródła do przejrzenia

Folder `zrodla` zawiera kopie wybranych plików, żeby można było obejrzeć zachowanie aplikacji bez analizowania całego dużego HTML:

| Plik | Kontekst |
|---|---|
| `app.js` | Nawigacja, wyszukiwanie, prezentacja notatek i obsługa map. |
| `style.css` | Wygląd czytnika, spisu treści i map. |
| `shell.html` | Układ interfejsu przed osadzeniem treści. |
| `tracker-core.js` | Zasady zmiany czasu i stanu narzędzi. |
| `tracker-ui.js` | Obsługa narzędzi z perspektywy MG. |
| `tracker.css` | Wygląd panelu narzędzi. |
| `tracker.test.cjs` | Przykłady sprawdzanych przypadków i rozróżnień mechaniki. |

Są to materiały referencyjne, nie osobny zestaw do budowania aplikacji. Gotowym, samodzielnym wynikiem jest HTML powyżej. Źródła nie zawierają procesu eksportowania notatek z oryginalnego sejfu. Migawka nie aktualizuje się automatycznie po zmianach oryginału.
