# Aplikacja wspierająca MG — koncepcja produktu

Wersja robocza 0.1 · 29 września 2026

Punkt wejścia do dokumentacji przyszłego, osobnego projektu. Dokumenty opisują produkt; nie wybierają technologii ani sposobu implementacji.

- [BRD — potrzeby, wymagania i zakres](01-BRD.md)
- [User stories i kryteria akceptacji](02-User-stories.md)

## Pomysł

Osobisty warsztat mistrza gry do przygotowania kampanii i prowadzenia sesji. Łączy edytowalne materiały przygody, interaktywne mapy, narzędzia śledzące stan gry oraz kronikę. MG może rozpocząć kampanię z gotowego modułu albo od pustego zestawu i rozwijać ją przy użyciu tych samych elementów.

Najważniejsze doświadczenie: **klikam miejsce na mapie, widzę związane z nim materiały, prowadzę scenę, przesuwam czas i rozstrzygam przypomnienia, a nowe ustalenia zapisuję przy tej sesji**.

Jedynym użytkownikiem aplikacji jest MG. Produkt nie jest pełnym VTT. Pierwsza wersja działa offline i nie wymaga hostowania. Przyszłe uruchomienie jako usługi, np. na AWS, jest kierunkiem rozwoju, który nie powinien wymagać porzucenia kampanii ani zmiany podstawowych pojęć produktu.

## Ustalenia z rozmowy

| Obszar | Uzgodniony kierunek |
|---|---|
| Użytkownik | Wyłącznie MG; nacisk na przygotowanie materiałów i wsparcie podczas gry. |
| Gotowe moduły | Początkowo przygotowuje je właściciel produktu. Tworzenie i udostępnianie modułów przez innych użytkowników jest planem na przyszłość. |
| Własna kampania | Dostępny jest pusty zestaw startowy, roboczo nazwany „Własna kampania”. |
| Edycja | MG może zmieniać materiał we własnej kampanii, bez zmiany modułu i innych kampanii. |
| Organizacja | Dowolne foldery z wielokrotnym zagnieżdżeniem. Rozdziały są jedną z możliwych organizacji. |
| Materiały | Swobodny tekst i linkowane obiekty, w szczególności NPC, lokacje i frakcje. |
| Narzędzia | Gotowe narzędzia modułów oraz kreator prostych narzędzi dla MG. |
| Przebieg pracy | Oddzielone przygotowanie i prowadzenie sesji, korzystające ze wspólnych materiałów. |
| Czas | Dni, godziny i minuty; bez potrzeby pełnego kalendarza świata w pierwszej wersji. |
| Zapis sesji | Szybkie notatki oddzielne dla każdej sesji. |
| Kronika | Ręcznie tworzone wydarzenia, także z fragmentu notatki; możliwość poprawiania kolejności. |
| Moduł pilotażowy | Materiały aktu 7 obecnej kampanii Icewind Dale. |

Szczegółowe zachowania i proponowany zakres pierwszej wersji w kolejnych dokumentach są rozwinięciem tych ustaleń, przeznaczonym do przeglądu. Nie wszystkie były osobno zatwierdzane podczas rozmowy.

## Pojęcia produktu

**Moduł** jest zestawem do wielokrotnego użycia: zawiera materiały, organizację folderów, mapy, powiązania oraz przygotowane narzędzia i ich ustawienia początkowe. Może opisywać całą przygodę albo jej fragment. Rozdział nie jest obowiązkowym elementem struktury.

**Kampania** jest samodzielnym obszarem pracy MG. Zawiera materiały startowe, własne zmiany i dodatki, drużynę, czas świata, sesje oraz kronikę. Dwie kampanie oparte na tym samym module mają niezależną treść i stan.

**Obiekt** to rozpoznawalny element kampanii, np. NPC, lokacja lub frakcja. Ma nazwę, typ i swobodną treść; dodatkowe pola oraz szablony pomagają w opisie, ale nie są obowiązkowym formularzem. Obiekt można wskazać w tekście, na mapie, w narzędziu i wydarzeniu kroniki.

**Notatka** nie musi opisywać obiektu. Może być pomysłem, sceną, dokumentem, opisem zasad lub materiałem do przygotowania. Swobodny dokument pozostaje pełnoprawnym elementem kampanii.

**Mapa** przedstawia przestrzeń i zawiera edytowalne znaczniki prowadzące do materiałów. Ta sama lokacja może być zaznaczona na kilku mapach. Lokacja może mieć własną mapę wnętrza.

**Narzędzie** ma opis działania i własny stan. Przykładami są licznik zasobów, lista odkryć, termin przybycia ekspedycji oraz przebieg klątwy dla każdego bohatera. Wzór narzędzia można wykorzystać ponownie; bieżące wartości należą do konkretnego użycia.

**Sesja** jest zapisem jednego spotkania przy stole: przygotowań, szybkich notatek i podsumowania. Zamknięcie sesji nie zeruje kampanii, zegara ani narzędzi.

**Wydarzenie kroniki** opisuje fakt w historii świata. Może mieć czas, powiązane obiekty i odnośnik do sesji lub zapisku, z którego powstało. Może również dotyczyć okresu sprzed rozpoczęcia gry. Plan MG nie staje się faktem przez sam upływ czasu.

## Przed sesją

MG czyta i edytuje materiały, rozwija świat i wątki, dodaje mapy i znaczniki oraz przygotowuje narzędzia. Może przejrzeć kronikę i poprzednią sesję, a następnie przypiąć materiały przydatne na najbliższym spotkaniu.

Przygotowanie ma pomagać w orientacji, a nie wymuszać scenariusz. Przypięte lokacje i postacie nie ograniczają dostępu do reszty kampanii. Propozycją pierwszej wersji jest prosty zestaw materiałów i spraw do przygotowania przy danej sesji.

## W trakcie sesji

MG korzysta z mapy, podglądu materiałów, wyszukiwania i aktywnych narzędzi. Przesuwa czas świata świadomą czynnością. Aplikacja pokazuje należne przypomnienia, a MG rozstrzyga rzuty i konsekwencje.

Szybkie zapiski trafiają do aktualnej sesji. Edycja materiałów kampanii nadal jest dostępna: improwizowany NPC może od razu otrzymać własną notatkę. Przełączenie widoku nie tworzy kopii materiałów.

## Po sesji

MG porządkuje zapiski, zapisuje podsumowanie i wybiera fakty do kroniki. Może utworzyć wydarzenie z zaznaczonego fragmentu notatki, dopracować jego opis, powiązać postacie i lokacje oraz ustawić miejsce na osi czasu.

Nie każda notatka musi stać się wydarzeniem. Historia zmian liczników pozostaje oddzielna od kroniki. Kolejna sesja ma nowy zapis i przejmuje ciągły stan kampanii.

## Proponowany zakres pierwszej wersji

Pierwsza wersja powinna zamknąć cały cykl: utworzenie kampanii → przygotowanie materiałów → rozegranie sesji z mapą i narzędziami → uporządkowanie zapisków → kontynuacja na następnym spotkaniu.

Obejmuje kampanie z modułu i puste, foldery, swobodny tekst, podstawowe obiekty, linki i podgląd, mapy ze znacznikami, czas, narzędzia, osobne zapisy sesji oraz ręczną kronikę. Proste narzędzia tworzone przez MG to licznik, lista postępu, termin i cykliczne przypomnienie. Bardziej złożone narzędzia mogą być dostarczane w module; pierwsza wersja kreatora nie musi umożliwiać odtworzenia dowolnej mechaniki RPG.

Poza pierwszą wersją pozostają: funkcje graczy, współpraca wielu osób, mechaniki VTT, publiczna biblioteka modułów, publikowanie modułów przez użytkowników, hosting, pełne kalendarze i uniwersalne automatyzowanie zasad systemów RPG.

## Pilot: akt 7 w Ythryn

Materiały istniejącej kampanii posłużą do sprawdzenia map, zagnieżdżonych notatek, obiektów i narzędzi zależnych od czasu. W pilocie wykorzystamy lokacje Ythryn i iglicy, dokumenty Fenes, Arcane Blight, postęp rytuału i terminy przybycia frakcji.

To materiał testowy dla ogólnych możliwości produktu. Nazwy, liczba bohaterów, konkretne ST i zasady Ythryn nie są stałymi założeniami dla innych kampanii. Przygotowane sceny pozostają planami, a bieżący stan rozegranej kampanii wymaga świadomego ustalenia przez MG.

Obecny HTML jest punktem odniesienia dla doświadczenia użytkownika. Akt 6 pozostaje zakończonym materiałem obecnej kampanii i nie wchodzi do zakresu pilota. Dokumentacja nie zleca przebudowy dotychczasowej aplikacji.

## Przekazanie do osobnego projektu

Do nowego projektu należy przenieść cały ten folder. Koncepcja wyjaśnia cel i pojęcia, BRD określa wymagania oraz granice, a user stories opisują zachowania do sprawdzenia.

Następnym krokiem produktowym jest przegląd zakresu pierwszej wersji i przebiegu najważniejszych ekranów. Technologie, przechowywanie danych, mechanizmy modułów i przyszłe wdrożenie wymagają osobnego projektu technicznego.
