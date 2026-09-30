# User stories — aplikacja wspierająca MG

Wersja robocza 0.1 · 29 września 2026

Powiązane: [koncepcja](00-Koncepcja-produktu.md) · [BRD](01-BRD.md)

Wszystkie historie dotyczą jednego aktora: **mistrza gry**. Opisują proponowany zakres pierwszej wersji. Kryteria są podstawą przyszłego przeglądu i odbioru; nie oznaczają, że aplikacja została zaimplementowana lub przetestowana.

## Kampania i materiały

### US-01. Rozpoczęcie kampanii z modułu

Jako MG chcę rozpocząć kampanię z przygotowanego modułu, aby otrzymać gotową bazę do własnej gry.

**BRD:** BR-01, BR-02.

**Kryteria akceptacji:**
- Po wybraniu modułu i nazwaniu kampanii mam dostęp do jego folderów, treści, map, powiązań i narzędzi.
- Narzędzia mają opisane wartości początkowe; nie dziedziczą wyników innej rozgrywki.
- Zmiana treści lub wartości w tej kampanii nie zmienia modułu ani drugiej kampanii utworzonej z niego.
- Mogę wrócić do każdej kampanii z jej niezależnym stanem.

### US-02. Rozpoczęcie własnej kampanii

Jako MG chcę zacząć bez gotowej przygody, aby budować własny świat tymi samymi narzędziami.

**BRD:** BR-01, BR-18.

**Kryteria akceptacji:**
- Mogę wybrać „Własną kampanię” bez wskazania gotowego modułu.
- Mogę tworzyć foldery, notatki, obiekty, mapy, narzędzia i sesje.
- Kampania nie otrzymuje obowiązkowych rozdziałów, bohaterów, zasad ani nazw Ythryn.

### US-03. Organizacja w folderach

Jako MG chcę organizować materiały w zagnieżdżonych folderach, aby układ odpowiadał mojej kampanii.

**BRD:** BR-03.

**Kryteria akceptacji:**
- Mogę utworzyć np. „Region → Miasto → Dzielnica → Lokacje” oraz osobną gałąź wątków.
- Mogę zmienić nazwy i przenieść folder z zawartością.
- Przeniesienie lub zmiana nazwy notatki zachowuje linki, znaczniki i powiązania wydarzeń.
- Przed usunięciem powiązanego materiału widzę wpływ na odnośniki i mogę anulować czynność.

### US-04. Swobodny tekst i obiekty

Jako MG chcę pisać swobodnie i oznaczać ważne elementy jako NPC, lokacje lub frakcje, aby zachować własny sposób notowania oraz uporządkowane powiązania.

**BRD:** BR-04.

**Kryteria akceptacji:**
- Mogę utworzyć zwykłą notatkę albo obiekt z nazwą i krótkim opisem.
- Mogę używać nagłówków, list, tabel, obrazów i linków.
- Dodatkowe pola i szablon są opcjonalne; mogę zmienić układ treści szablonu.
- Edycja materiału kampanii jest dostępna zarówno podczas przygotowań, jak i prowadzenia sesji.

### US-05. Linkowanie i szybki podgląd

Jako MG chcę linkować materiały w tekście i szybko je podejrzeć, aby sprawdzać informacje bez gubienia bieżącej sceny.

**BRD:** BR-05.

**Kryteria akceptacji:**
- W opisie karczmy mogę wskazać istniejącego gospodarza i jego frakcję.
- Podgląd pokazuje aktualną treść wskazanego obiektu, a nie osobną kopię.
- Po podglądzie wracam do poprzedniego miejsca bez utraty zapisku.
- Przy obiekcie mogę odnaleźć materiały, które do niego odsyłają.

### US-06. Wyszukiwanie w kampanii

Jako MG chcę wyszukać nazwę lub fragment treści, aby odnaleźć materiał niezależnie od folderu i sesji.

**BRD:** BR-06.

**Kryteria akceptacji:**
- Wyniki obejmują materiały kampanii, zapiski sesji i wydarzenia kroniki.
- Wynik wskazuje typ i pochodzenie materiału, np. notatkę przygotowawczą lub wydarzenie kroniki.
- Otwarcie wyniku nie zmienia stanu gry ani nie gubi bieżących zapisków.

## Mapy

### US-07. Przygotowanie mapy

Jako MG chcę dodać mapę i umieścić na niej znaczniki, aby przygotować przestrzenny dostęp do notatek.

**BRD:** BR-07.

**Kryteria akceptacji:**
- Mogę dodać własny obraz mapy i korzystać z niego offline.
- Mogę utworzyć, nazwać, przesunąć i usunąć znacznik oraz zmienić jego powiązanie.
- Znacznik może wskazywać istniejącą lokację lub inny materiał.
- Ta sama lokacja może mieć znaczniki na dwóch mapach; usunięcie jednego nie usuwa lokacji ani drugiego znacznika.

### US-08. Prowadzenie z mapy

Jako MG chcę otwierać materiały z mapy i przechodzić do map wnętrz, aby prowadzić eksplorację bez ciągłego szukania dokumentów.

**BRD:** BR-07, BR-09.

**Kryteria akceptacji:**
- Mogę przybliżać i przesuwać mapę.
- Kliknięcie znacznika otwiera jego materiał, a powrót zachowuje położenie i powiększenie mapy.
- Lokacja może prowadzić do własnej mapy z kolejnymi znacznikami.
- Przejście do mapy wnętrza i powrót nie zmieniają czasu, narzędzi ani bieżącej sesji.

## Przygotowanie i zapis sesji

### US-09. Przygotowanie kolejnego spotkania

Jako MG chcę przygotować osobny zapis przyszłej sesji i przypiąć materiały, aby mieć pod ręką potrzebne informacje.

**BRD:** BR-08.

**Kryteria akceptacji:**
- Mogę nadać sesji nazwę, dopisać przygotowania i przypiąć istniejące materiały.
- Przypięcie nie tworzy kopii notatki.
- Mam dostęp do poprzednich sesji, kroniki i nierozstrzygniętych przypomnień.
- Podczas gry mogę sięgnąć poza przypięty zestaw i zmienić plan.

### US-10. Szybkie notatki podczas gry

Jako MG chcę zapisywać ustalenia w bieżącej sesji, aby nie przerywać prowadzenia i nie mieszać zapisków z różnych spotkań.

**BRD:** BR-09, BR-10.

**Kryteria akceptacji:**
- Widzę, do której sesji trafia zapisek, i mogę linkować w nim obiekty.
- Szybkie zapiski są odróżnione od przygotowań tej sesji.
- Mogę dopisać nowego NPC lub zmienić lokację podczas gry.
- Otwieranie map i materiałów nie usuwa wpisanej treści.

### US-11. Zamknięcie i kontynuacja

Jako MG chcę zakończyć sesję i później rozpocząć nową, aby zachować odrębne zapiski przy ciągłym stanie kampanii.

**BRD:** BR-10, BR-17.

**Kryteria akceptacji:**
- Mogę dopisać podsumowanie zakończonej sesji i sprawy na kolejne spotkanie.
- Nowa sesja ma własne zapiski; nie nadpisuje poprzedniej.
- Czas, stany narzędzi i nierozstrzygnięte przypomnienia przechodzą do dalszej gry bez zerowania.
- Zamknięcie i ponowne uruchomienie aplikacji zachowuje te informacje.

## Czas i narzędzia

### US-12. Świadome przesuwanie czasu

Jako MG chcę przesuwać czas świata w dniach, godzinach i minutach, aby odwzorowywać działania drużyny niezależnie od czasu rzeczywistego.

**BRD:** BR-11.

**Kryteria akceptacji:**
- Mogę dodać określony czas i zobaczyć jego nową wartość.
- Upływ rzeczywistej godziny ani rozpoczęcie nowej sesji nie przesuwają zegara gry.
- Mogę śledzić czas od osobnego momentu, np. wejścia do Ythryn.
- Jeśli narzędzie rozróżnia eksplorację i odpoczynek, widzę rodzaj wykonywanej czynności i jego wpływ na czas.

### US-13. Terminy do rozstrzygnięcia

Jako MG chcę widzieć należne przypomnienia wraz z zasadami, aby nie przeoczyć zdarzeń zależnych od czasu.

**BRD:** BR-12.

**Kryteria akceptacji:**
- Po osiągnięciu terminu widzę nazwę sprawy, jej czas, cel śledzenia i opis działania.
- Skok o kilka okresów zachowuje wszystkie należne wystąpienia, z czytelną liczbą zaległości.
- Wpisuję wynik albo świadomie rozstrzygam sprawę; aplikacja nie zakłada wyniku rzutu lub rozegrania sceny.
- Zapisany wynik nie jest naliczany drugi raz przy ponownym otwarciu panelu.
- Zmiana otwartego folderu, mapy lub sesji nie wyłącza aktywnego narzędzia.

### US-14. Stan osobny dla każdego bohatera

Jako MG chcę przypisać to samo narzędzie kilku bohaterom, aby śledzić ich niezależne wyniki.

**BRD:** BR-04, BR-13.

**Kryteria akceptacji:**
- Mogę dodać bohaterów o własnych nazwach i przypisać im narzędzie.
- Wynik jednego bohatera nie zmienia wyniku pozostałych.
- Widzę bieżące wartości, stan i należne sprawy każdej postaci.
- W pilocie Arcane Blight pozwala osobno śledzić stan zakażenia, wyniki i aktualne ST zgodnie z przygotowanymi zasadami modułu.

### US-15. Utworzenie prostego narzędzia

Jako MG chcę stworzyć własny licznik, checklistę, termin lub przypomnienie cykliczne, aby śledzić sprawy nieprzewidziane w module.

**BRD:** BR-14.

**Kryteria akceptacji:**
- Wybieram rodzaj narzędzia i określam jego nazwę, opis, zakres oraz wartości lub terminy właściwe dla tego rodzaju.
- Mogę dodać próg albo powiązać narzędzie z notatką zasad.
- Przed użyciem rozumiem, co uruchamia zmianę lub przypomnienie i jaki będzie skutek.
- Narzędzie działa również w pustej kampanii i nie wymaga pisania kodu.

### US-16. Ponowne użycie wzoru narzędzia

Jako MG chcę zachować ustawienia narzędzia jako wzór, aby wykorzystać je ponownie bez kopiowania wyników wcześniejszej gry.

**BRD:** BR-14.

**Kryteria akceptacji:**
- Z zachowanego wzoru mogę utworzyć nowe narzędzie z niezależnym stanem.
- Nowe użycie nie dziedziczy rozstrzygniętych przypomnień ani historii starego.
- Edycja wzoru nie zmienia niejawnie działającego narzędzia.
- Wzór przygotowany przeze mnie jest dostępny do użycia w innej mojej kampanii.

### US-17. Korekta pomyłki

Jako MG chcę poprawić błędny wpis lub cofnąć ostatnią operację, aby nie musieć ręcznie odtwarzać stanu gry.

**BRD:** BR-13, BR-16.

**Kryteria akceptacji:**
- Mogę poprawić omyłkowo wpisaną wartość i zobaczyć zapis tej korekty.
- Cofnięcie ostatniego dodania czasu usuwa wynikające wyłącznie z niego nowe przypomnienia i przywraca powiązane wartości.
- Jeśli po zmianie czasu były dalsze rozstrzygnięcia, aplikacja pokazuje zależności i nie wykonuje częściowego cofnięcia pozostawiającego sprzeczny stan.
- Historia tych operacji pozostaje oddzielona od kroniki opowieści.

## Kronika i trwałość

### US-18. Wydarzenie z zapisku lub od zera

Jako MG chcę ręcznie tworzyć wydarzenia kroniki, aby zachowywać istotne fakty zamiast wszystkich roboczych notatek.

**BRD:** BR-15, BR-16.

**Kryteria akceptacji:**
- Mogę utworzyć wydarzenie od zera lub z wybranego fragmentu zapisku.
- Mogę zmienić tytuł i treść, dodać powiązane obiekty oraz opcjonalny czas świata.
- Wydarzenie utworzone z zapisku wskazuje źródłową sesję; oryginalny zapisek pozostaje zachowany.
- Żaden plan sceny ani wynik licznika nie trafia do kroniki bez mojego wyboru.

### US-19. Układanie historii świata

Jako MG chcę poprawiać kolejność i treść wydarzeń, aby kronika odzwierciedlała ustaloną historię także wtedy, gdy nie znam wszystkich dat.

**BRD:** BR-15, BR-16.

**Kryteria akceptacji:**
- Mogę dodać wydarzenie sprzed pierwszej sesji albo bez dokładnego czasu.
- Mogę zmienić kolejność wydarzeń; dokładne czasy nie są po cichu pozostawiane w sprzeczności z nową kolejnością.
- Przy wydarzeniu widzę powiązane postacie, miejsca i ewentualną sesję źródłową.
- Poprawienie opisu lub kolejności kroniki nie przesuwa zegara gry i nie zmienia stanu narzędzi.

### US-20. Pełna praca offline i odtworzenie kampanii

Jako MG chcę pracować bez internetu i mieć kompletną kopię kampanii, aby móc kontynuować grę po przerwie lub odtworzeniu danych.

**BRD:** BR-17, BR-18.

**Kryteria akceptacji:**
- Bez połączenia z internetem mogę tworzyć i edytować materiały, korzystać z map, prowadzić narzędzia, zapisywać sesje i kronikę.
- Po ponownym otwarciu aplikacji odzyskuję zapisane materiały i stan; ewentualny problem z zapisem jest widoczny.
- Mogę wykonać i odtworzyć kompletną kopię obejmującą treści, obrazy, powiązania, sesje, kronikę i narzędzia.
- Odtworzenie nie nadpisuje innej kampanii bez świadomego wyboru.

## Proponowana kolejność weryfikacji produktu

1. **Materiały i mapa:** US-01–08 — czy przygotowanie i dostęp do informacji są wygodniejsze niż w obecnym zestawie notatek?
2. **Ciągłość sesji i czasu:** US-09–14, US-17 — czy MG może przeprowadzić dwie sesje bez utraty stanu i należnych spraw?
3. **Własne klocki i kronika:** US-15–16, US-18–19 — czy własna kampania oraz ręczne budowanie historii są użyteczne poza Ythryn?
4. **Pełny przebieg offline i odtworzenie:** US-20 — sprawdzane również podczas wcześniejszych prób, a na końcu jako kompletny scenariusz.

To kolejność sprawdzania założeń produktowych, nie harmonogram implementacji ani wycena.
