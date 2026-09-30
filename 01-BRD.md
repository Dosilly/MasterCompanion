# BRD — aplikacja wspierająca mistrza gry

Wersja robocza 0.1 · 29 września 2026

Powiązane: [koncepcja produktu](00-Koncepcja-produktu.md) · [user stories](02-User-stories.md)

## 1. Cel dokumentu i status

BRD opisuje potrzebę produktu, oczekiwane rezultaty, zakres i wymagania biznesowe. Nie zawiera projektu technicznego. Ustalenia użytkownika zestawiono w koncepcji; poniższe szczegółowe wymagania i granica pierwszej wersji są propozycją ich realizacji do dalszego przeglądu.

## 2. Problem

MG potrzebuje jednocześnie materiałów do przygotowania i szybkiego dostępu do informacji podczas gry. Rozbudowane notatki utrudniają orientację. Mapa jest oddzielona od opisu miejsca, narzędzia od zasad, a zapiski sesji od historii świata. Śledzenie czasu i skutków rozłożonych na wiele sesji wymaga pamiętania o wielu niezależnych sprawach.

Obecny HTML rozdziałów Icewind Dale pokazał wartość map otwierających notatki i narzędzi reagujących na czas. Kolejny produkt ma umożliwiać MG samodzielne dodawanie i zmienianie treści, map, znaczników i prostych narzędzi w różnych kampaniach.

## 3. Cele i ocena powodzenia

| Cel | Sposób sprawdzenia w pilocie |
|---|---|
| Skrócić szukanie informacji przy stole. | Z mapy Ythryn MG otwiera opis lokacji i powiązanego NPC, po czym wraca do miejsca na mapie. |
| Pozwolić dostosować gotową przygodę. | Edycja lokacji i dodanie własnego wątku są widoczne w danej kampanii, a nowa kampania z tego samego modułu zachowuje oryginał. |
| Zapewnić swobodę budowania własnej kampanii. | Bez gotowego modułu MG tworzy foldery, obiekty, mapę i własne narzędzie. |
| Odciążyć pamięć MG. | Po upływie kilku terminów aplikacja pokazuje wszystkie należne sprawy, także nierozstrzygnięte z wcześniejszej sesji. |
| Zachować czytelny zapis kampanii. | Dwie sesje mają osobne zapiski; wybrane fakty trafiają do kroniki z odnośnikami do źródła. |
| Zapewnić ciągłość pracy offline. | Przygotowanie, prowadzenie, zamknięcie i ponowne otwarcie kampanii działają bez internetu, z zachowaniem stanu. |

Są to kryteria jakościowe pierwszego pilota. Liczbowe cele wygody i szybkości obsługi należy ustalić po próbie prowadzenia rzeczywistej sesji, zamiast przyjmować je bez obserwacji.

## 4. Użytkownik i odpowiedzialność

Jedynym aktorem korzystającym z produktu jest **mistrz gry**. Przygotowuje kampanię, prowadzi sesję, zmienia materiały i rozstrzyga przebieg świata.

Właściciel produktu początkowo dostarcza moduły. Jest to sposób przygotowania zawartości, a nie dodatkowa rola wymagająca kont, panelu administracyjnego lub uprawnień w pierwszej wersji.

## 5. Zasady produktu

- MG zachowuje kontrolę nad wydarzeniami, rzutami i konsekwencjami.
- Przygotowanie i prowadzenie korzystają z tych samych materiałów oraz wspólnego stanu kampanii.
- Swobodny tekst działa samodzielnie; struktura i szablony są pomocą.
- Moduł, kampania i bieżący stan narzędzi mają odrębne znaczenie.
- Zmiana folderu lub nazwy nie powinna zrywać powiązań materiału.
- Czas świata jest niezależny od czasu rzeczywistego i liczby sesji.
- Plany, robocze zapiski i ustalona historia nie są automatycznie utożsamiane.
- Materiały i stan kampanii pozostają dostępne offline.

## 6. Wymagania funkcjonalne — proponowana pierwsza wersja

### BR-01. Rozpoczęcie i niezależność kampanii

MG tworzy kampanię z dostępnego modułu albo pustego zestawu. Kampania otrzymuje własną nazwę, materiały i stan początkowy. Zmiany w niej nie modyfikują modułu ani pozostałych kampanii. Można prowadzić więcej niż jedną kampanię i wracać do każdej z jej zachowanym stanem.

### BR-02. Moduł jako zestaw do ponownego użycia

Moduł obejmuje treść, foldery, mapy, znaczniki, powiązania i przygotowane narzędzia. Może organizować materiały rozdziałami, ale produkt nie wymusza takiej struktury. Nowa kampania nie dziedziczy historii sesji ani wyników wcześniejszej rozgrywki w innej kampanii. Szczegóły procesu przygotowania modułu przez właściciela produktu wymagają osobnego opracowania.

### BR-03. Foldery

MG tworzy, nazywa i przenosi foldery oraz materiały w wielopoziomowej hierarchii. Liczba poziomów nie jest z góry ograniczona do rozdziału i podrozdziału. Obiekt może być przywołany w wielu miejscach bez tworzenia osobnych kopii. Usunięcie materiału powinno pokazywać wpływ na istniejące odnośniki i dawać możliwość rezygnacji; dokładny sposób odzyskiwania usuniętych treści pozostaje do ustalenia.

### BR-04. Swobodna treść i podstawowe obiekty

MG tworzy zwykłe notatki oraz obiekty NPC, lokacja i frakcja. Treść obsługuje co najmniej nagłówki, akapity, listy, tabele, obrazy i linki. Szablony oraz dodatkowe pola są opcjonalne. Nowy obiekt może zacząć się od samej nazwy i krótkiego opisu. Dane bohaterów drużyny umożliwiają przypisanie im narzędzi; nie są pełną kartą postaci danego systemu RPG.

### BR-05. Linki i podgląd

MG linkuje obiekty i notatki w swobodnym tekście. Może podejrzeć powiązany materiał i wrócić do miejsca pracy bez utraty niezapisanego zapisku. Zmiana nazwy i położenia materiału zachowuje powiązania. Proponowanym uzupełnieniem jest lista materiałów odwołujących się do danego obiektu.

### BR-06. Wyszukiwanie

MG wyszukuje materiały po nazwie i treści w obrębie kampanii, w tym zapiski poprzednich sesji i wydarzenia kroniki. Wynik wskazuje rodzaj materiału i jego położenie, żeby odróżnić plan sceny od zapisu rozegranego zdarzenia.

### BR-07. Mapy i znaczniki

MG dodaje własny obraz mapy, tworzy, przesuwa, opisuje i usuwa znaczniki oraz łączy je z materiałami. Kliknięcie znacznika pokazuje powiązaną treść z możliwością zachowania dostępu do mapy. Mapa umożliwia przybliżenie i przesuwanie. Powrót z notatki lub mapy wnętrza zachowuje orientację na mapie nadrzędnej. Jedna lokacja może być wskazana na kilku mapach bez powielania opisu. Usunięcie znacznika nie usuwa lokacji.

### BR-08. Przygotowanie sesji

MG tworzy zapis przyszłej sesji, dodaje notatki przygotowawcze i przypina potrzebne materiały. Ma dostęp do kroniki, poprzednich sesji i nierozstrzygniętych spraw. Przypięty zestaw jest skrótem, a nie listą wymuszonych scen. Jego wykorzystanie jest opcjonalne.

### BR-09. Prowadzenie sesji

MG rozpoczyna lub wznawia sesję. Widok prowadzenia daje dostęp do map, materiałów, wyszukiwania, czasu, narzędzi i szybkich zapisków. Edycja oraz tworzenie materiałów nadal są dostępne. Zmiana widoku lub otwartej lokacji nie zeruje stanu gry.

### BR-10. Osobne zapisy sesji

Każda sesja ma własną nazwę i zapiski. Szybkie notatki są oddzielone od przygotowań i późniejszego podsumowania, ale należą do tego samego zapisu sesji. Utworzenie kolejnej sesji nie nadpisuje poprzedniej. Zakończenie sesji zachowuje aktywne narzędzia, czas oraz należne przypomnienia.

### BR-11. Czas świata

Główny zegar kampanii operuje dniami, godzinami i minutami. MG świadomie przesuwa czas; samo otwarcie aplikacji, pisanie notatek lub przerwa między spotkaniami nie powodują jego upływu. Osobne liczniki mogą mierzyć czas od wskazanego momentu, np. pobyt w Ythryn.

Narzędzia mogą reagować na upływ całego czasu albo wskazaną aktywność, np. eksplorację lub zakończenie odpoczynku. Typ aktywności musi być widoczny dla MG. Sposób dodawania takich rodzajów aktywności to element do doprecyzowania przy projektowaniu obsługi narzędzi.

### BR-12. Przypomnienia i rozstrzygnięcia

Przekroczenie terminu lub progu wyświetla sprawę do rozstrzygnięcia z opisem i odnośnikiem do zasad. Duży skok czasu nie gubi wcześniejszych ani powtarzających się terminów. MG widzi, ile spraw pozostaje należnych. Każde rozstrzygnięcie zostaje zapisane tylko raz.

Aplikacja nie zakłada samodzielnie wyniku rzutu ani rozegrania sceny. Proste, jawnie skonfigurowane zmiany wartości mogą być automatyczne; działania wpływające na opowieść wymagają decyzji MG. Ukrycie panelu lub zmiana rozdziału nie wyłącza działającego narzędzia. Zatrzymanie go jest osobną czynnością.

### BR-13. Stan i zakres narzędzi

Narzędzie może dotyczyć kampanii, miejsca, frakcji lub konkretnej postaci. Narzędzie dla każdego bohatera przechowuje niezależne wyniki. Jego opis działania jest dostępny obok wartości. MG może poprawić stan oraz cofnąć ostatnią pomyłkę wraz z jej powiązanymi skutkami. Cofnięcie czasu nie może pozostawić niewidocznej sprzeczności między zegarem, wartościami i rozstrzygniętymi przypomnieniami.

### BR-14. Kreator prostych narzędzi

MG tworzy licznik, listę postępu, termin lub przypomnienie cykliczne. Ustala nazwę, opis, cel śledzenia, wartości początkowe i odpowiednie progi lub czasy. Może powiązać narzędzie z materiałem zawierającym zasady. Kreator wyjaśnia, na jakie zdarzenia narzędzie reaguje i jaki będzie ich skutek.

Konfigurację można wykorzystać ponownie jako wzór. Nowe użycie ma niezależne wartości; zmiana wzoru nie zmienia po cichu już działających narzędzi. Złożone mechaniki modułowe, takie jak Arcane Blight, nie wyznaczają obowiązkowego zakresu swobody początkowego kreatora.

### BR-15. Kronika

MG ręcznie tworzy wydarzenia, również na podstawie fragmentu notatki. Wydarzenie zawiera tytuł, swobodny opis, opcjonalny czas świata, linki do obiektów i opcjonalne wskazanie sesji lub zapisku źródłowego. Pierwotna notatka pozostaje dostępna.

Można opisać wydarzenia wcześniejsze niż pierwsza sesja lub bez znanej daty. MG poprawia kolejność. Jeśli podano dokładne czasy, ich relacja do ręcznej kolejności musi być czytelna; proponujemy, aby przeniesienie na sprzeczne miejsce wymagało świadomej korekty czasu albo rezygnacji z dokładnego datowania. Widok grupowania wydarzeń bez daty wymaga dopracowania.

### BR-16. Plany, historia narzędzi i fakty

Plan sceny nie pojawia się automatycznie jako rozegrane wydarzenie. Historia operacji narzędzi jest dostępna oddzielnie od kroniki. MG świadomie wybiera, które informacje utrwalić jako historię kampanii. Edycja wydarzenia kroniki nie cofa automatycznie czasu ani wcześniejszych rozstrzygnięć narzędzi.

### BR-17. Trwałość, offline i kopia kampanii

Materiały, obrazy, mapy, zapiski i narzędzia są dostępne bez połączenia z internetem. Praca pozostaje zachowana po zamknięciu aplikacji. Użytkownik widzi problem z zapisem, jeśli wystąpi. Pierwsza wersja powinna umożliwiać wykonanie i odtworzenie kompletnej kopii kampanii, bez konieczności jej ponownego ręcznego składania. Odtworzenie nie może niejawnie zastąpić innej kampanii.

### BR-18. Niezależność od Ythryn i przyszłego hostowania

Foldery, typy materiałów, mapy i proste narzędzia są użyteczne także w pustej kampanii bez reguł Icewind Dale. Pilot dostarcza konkretną zawartość. Przyszła wersja hostowana powinna zachować treść, powiązania i stan przenoszonej kampanii oraz podstawowy przebieg pracy MG. Wymaganie nie przesądza bieżącej technologii, chmury ani modelu synchronizacji.

## 7. Zakres pilota i scenariusz odbioru

Źródłem pilota są istniejące materiały aktu 7, obecna mapa i zachowanie narzędzi aplikacji HTML. Dostępne zasady i ustalenia kampanii mają pierwszeństwo przed dopisywaniem nowych. Materiały źródłowe zostają zachowane; przygotowanie pilota nie zmienia aktu 6.

1. Utworzyć dwie kampanie z modułu aktu 7 i sprawdzić niezależność ich materiałów oraz narzędzi.
2. W pierwszej zmienić lokację, dodać NPC i połączyć go z tekstem oraz znacznikiem mapy.
3. Przygotować sesję, następnie otworzyć Y4 z mapy i przejść do powiązanych materiałów.
4. Przesunąć czas, wywołać należne sprawdzenia i rozstrzygnąć klątwę niezależnie dla kilku bohaterów. Duży skok czasu nie gubi sprawdzeń.
5. Zapisać ustalenie w szybkiej notatce, po sesji utworzyć z niego wydarzenie kroniki i poprawić jego pozycję.
6. Zamknąć aplikację, wrócić offline, rozpocząć następną sesję i potwierdzić zachowanie stanu oraz oddzielnych zapisków.
7. Utworzyć pustą kampanię z własną mapą i narzędziem; potwierdzić brak zależności od nazw i reguł Ythryn.
8. Odtworzyć kopię kampanii i sprawdzić materiały, obrazy, powiązania, czas, narzędzia i historię.

To plan przyszłej walidacji produktu, nie raport z wykonanych testów.

## 8. Poza pierwszą wersją i możliwości rozwoju

- Konta graczy, widok gracza, współprowadzenie i edycja wieloosobowa.
- Plansza taktyczna VTT, sterowanie tokenami i automatyzacja walki.
- Publiczna biblioteka, sprzedaż i udostępnianie modułów przez użytkowników.
- Uniwersalny kreator dowolnych reguł i pełne karty postaci wielu systemów.
- Hosting, synchronizacja urządzeń i rozwiązywanie konfliktów wspólnej edycji.
- Pełne kalendarze świata, daty astronomiczne i automatyczne liczenie czasu rzeczywistego.
- Automatyczne pisanie kroniki, rozwijanie świata lub rozstrzyganie scen przez AI.
- Automatyczne łączenie aktualizacji modułu ze zmienionymi materiałami kampanii.
- Uniwersalny import sejfów Obsidiana i synchronizacja zewnętrznych notatek. Pilot korzysta z wybranych materiałów aktu 7; nie oznacza to obietnicy obsługi każdego sejfu.

## 9. Ryzyka produktowe i decyzje do późniejszego dopracowania

| Ryzyko | Kierunek ograniczenia |
|---|---|
| Formularze utrudnią szybki zapis pomysłu. | Nazwa i swobodna treść wystarczają; szablony i dodatkowe pola są opcjonalne. |
| Kreator narzędzi stanie się osobnym językiem programowania. | Cztery proste rodzaje na początek; złożone przypadki przygotowane w module. |
| Duży skok czasu zasypie MG powiadomieniami. | Czytelne grupowanie zaległości z zachowaniem liczby i czasu wystąpień; sposób obsługi do sprawdzenia w pilocie. |
| Materiał pilota stanie się sztywną strukturą całego produktu. | Obowiązkowa walidacja pustej kampanii i narzędzi o innych nazwach oraz wartościach. |
| Kronika pomiesza plany z historią. | Ręczne utrwalanie wydarzeń, źródło zapisku i oddzielna historia narzędzi. |
| Aktualizacja modułu nadpisze autorskie zmiany. | Pierwsza wersja zachowuje niezależność istniejącej kampanii; scalanie aktualizacji jest poza zakresem. |

Do opracowania przy projektowaniu doświadczenia pozostają: szczegółowe pola obiektów, wygląd podglądu materiałów przy mapie, obsługa wydarzeń bez daty, dokładne możliwości kreatora, cofanie kilku kolejnych operacji, odzyskiwanie skasowanych treści i sposób dostarczania modułów przez właściciela produktu.
