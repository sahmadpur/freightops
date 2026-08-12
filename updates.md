**ALL IN LOGISTICS CRM / TMS**

Final Functional Specification - Phase 1

Requests, Orders, Transport Logic, Outlook Integration, Communications, Workflow, KPI

_Version 1.0 | 07.08.2026_

# 1\. Цель документа

Этот документ является финальной спецификацией согласованной логики Phase 1 для системы All In Logistics. Он предназначен для передачи программисту как единый источник требований. Главная задача Phase 1 - построить корректный фундамент, на который затем без переделки ядра будут добавлены финансовый модуль, подробный Pricing/Quotation, invoicing, payments, accounting, расширенные документы и другие функции.

Важно: в системе не следует использовать «Pricing» и «Quotation» как два отдельных пользовательских этапа. Для команды используется единый коммерческий этап QUOTATION. Внутри будущего Quotation могут быть внутренние cost rates и клиентская selling price, но это не два разных workflow-статуса.

# 2\. Главная бизнес-логика

Любое новое обращение клиента по конкретной перевозке сначала регистрируется как Request. Request может пойти по одному из двух сценариев:

| **Сценарий**               | **Логика**                                                                      |
| -------------------------- | ------------------------------------------------------------------------------- |
| A. Клиент просит цену      | Request -> Quotation -> решение клиента -> Won/Lost -> при Won создается Order. |
| B. Клиент сразу дает заказ | Request -> Direct Order. Quotation до создания Order не обязателен.             |

Даже при Direct Order финансовые данные все равно должны быть внесены позже. Order может быть создан без финальной цены, но не должен закрываться без обязательных финансовых данных.

**REQUEST  
├─ Need price -> QUOTATION -> WON / LOST  
└─ Direct confirmed instruction -> ORDER  
<br/>ORDER -> OPERATIONS -> IN TRANSIT -> DELIVERED -> CLOSED**

# 3\. Разделение Request и Order

| **Сущность** | **Назначение**                                                                     | **Когда заканчивается**  |
| ------------ | ---------------------------------------------------------------------------------- | ------------------------ |
| Request      | Фиксирует входящее обращение, потребность клиента, расчет/предложение и результат. | Won, Lost или Cancelled. |
| Order        | Фиксирует уже подтвержденную перевозку и ее исполнение.                            | Closed.                  |

Request и Order - отдельные сущности. При подтверждении Request не удаляется и не превращается физически в Order: создается отдельный Order, связанный с исходным Request.

# 4\. Основные разделы меню

| **Раздел**          | **Назначение**                          |
| ------------------- | --------------------------------------- |
| Dashboard           | KPI и аналитика.                        |
| Requests            | Все входящие запросы.                   |
| Orders              | Подтвержденные перевозки.               |
| Clients / Companies | Единая база компаний.                   |
| Carriers            | Представление компаний с ролью Carrier. |
| Customs             | Существующий/будущий таможенный модуль. |
| Finance             | Будущий финансовый модуль.              |
| Documents           | Общие документы / при необходимости.    |
| Users & Roles       | Пользователи и права.                   |
| Audit Log           | История изменений и действий.           |

# 5\. Companies и Contacts

Компания хранится один раз в CRM и может иметь несколько ролей одновременно. Контактные лица принадлежат компании.

| **Company fields / roles**                                          | **Contact fields**                   |
| ------------------------------------------------------------------- | ------------------------------------ |
| Company Name                                                        | Full Name                            |
| Roles: Client / Agent / Carrier / Supplier / Customs Broker / Other | Position / Job Title                 |
| Email domain(s)                                                     | Email                                |
| Phone(s)                                                            | Phone                                |
| Country / City / Address                                            | WhatsApp number                      |
| Notes                                                               | Notes / Preferred channel (optional) |

Контактное лицо не вводится заново свободным текстом при каждом Request. После выбора Client поле Contact Person показывает только контакты этой компании. Если контакт один - допустима автоматическая подстановка.

# 6\. Создание Request

## 6.1. Каналы поступления

| **Source**      | **Создание**                                                              |
| --------------- | ------------------------------------------------------------------------- |
| Email           | Create Request из Outlook; metadata и thread подтягиваются автоматически. |
| WhatsApp        | Ручной + New Request; Source=WhatsApp. В будущем возможна интеграция API. |
| Phone           | Ручной + New Request; Source=Phone; желательно Call Summary.              |
| Website         | Автоматический Request из web-form.                                       |
| Agent / Partner | Ручной Request с указанием source и, при необходимости, Agent Company.    |
| Tender          | Ручной Request с Source=Tender.                                           |
| Other           | Ручной Request с пояснением.                                              |

Правило: любое новое коммерческое обращение по перевозке = новый Request.

## 6.2. Request ID, Request Title, Email Subject

| **Элемент**   | **Логика**                                                                              | **Пример**                           |
| ------------- | --------------------------------------------------------------------------------------- | ------------------------------------ |
| Request ID    | Системный уникальный ID. Автогенерация. Не редактируется.                               | REQ-2026-0145                        |
| Request Title | Внутреннее человекочитаемое название. Генерируется автоматически.                       | BOSCH \| Hamburg -> Baku \| Road FTL |
| Email Subject | Оригинальная тема письма клиента из Outlook. Сохраняется отдельно для поиска переписки. | RFQ // 2 trucks Hamburg - Baku       |

Формула Request Title: {CLIENT} | {ORIGIN} -> {DESTINATION} | {TRANSPORT} {SUBTYPE}. После автогенерации допускается ручное уточнение Title, но это не влияет на Request ID.

## 6.3. Поля верхнего блока New Request и очередность

| **Порядок** | **Поле**                      | **Тип / поведение**                                                    |
| ----------- | ----------------------------- | ---------------------------------------------------------------------- |
| 1           | Client \*                     | Company dropdown. + Create New Client без выхода из формы.             |
| 2           | Contact Person                | Dropdown зависит от Client.                                            |
| 3           | Responsible Manager \*        | Автоматически текущий user; изменить может пользователь с правами.     |
| 4           | Lead Source \*                | Email / WhatsApp / Phone / Website / Agent / Partner / Tender / Other. |
| 5           | Request Received Date/Time \* | Фактическое время получения обращения. Для Outlook - из письма.        |
| 6           | Email Subject                 | Показывается/заполняется, если source Email.                           |
| 7           | Call / Source Note            | Показывается для Phone/WhatsApp/Other при необходимости.               |

Дата создания записи в CRM (created_at) и фактическое время получения запроса (received_at) - разные поля. Это нужно для KPI скорости регистрации и обработки.

# 7\. Route / Маршрут

| **Поле**                       | **Требование**                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Origin Country \*              | Структурированное поле.                                                                           |
| Origin City / Location \*      | Город/место. Для некоторых видов транспорта позже может уточняться terminal/port/station/airport. |
| Destination Country \*         | Структурированное поле.                                                                           |
| Destination City / Location \* | Город/место.                                                                                      |

Страна и город должны храниться раздельно, чтобы в будущем строить аналитику по странам, городам и маршрутам.

# 8\. Transport Type - динамические поля

После выбора транспорта интерфейс показывает только относящиеся к нему поля. Поля других типов транспорта должны быть скрыты.

## 8.1. Road / Автомобильный транспорт

После выбора Road открыть Transport Subtype: FTL / LTL.

| **Subtype** | **Открываемые поля**                                                  | **Значения / примечания**                                                                                         |
| ----------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| FTL         | Vehicle Type; Number of Trucks                                        | Vehicle Type: Curtainsider/Tent, Reefer, Mega, Box/Closed, Container Chassis, Isothermal, Lowbed/Platform, Other. |
| LTL         | Number of Packages; Gross Weight; Volume (CBM); Dimensions; Stackable | Размеры желательно поддерживать несколькими строками.                                                             |

Дополнительная динамика:

- Если FTL + Reefer -> предложить Temperature Controlled = Yes и открыть температурные поля.
- Number of Trucks numeric, minimum 1.
- Для LTL Stackable = Yes / No / Unknown.

## 8.2. Sea / Морская перевозка

После выбора Sea открыть Sea Subtype: FCL / LCL / Breakbulk / Ro-Ro.

| **Subtype** | **Открываемые поля**                                                             |
| ----------- | -------------------------------------------------------------------------------- |
| FCL         | Container Type; Container Quantity; POL; POD.                                    |
| LCL         | Number of Packages; Gross Weight; Volume (CBM); Dimensions; Stackable; POL; POD. |
| Breakbulk   | Pieces; Gross Weight; Dimensions; POL; POD; Oversized.                           |
| Ro-Ro       | Vehicle/Equipment Description; Quantity; Weight/Dimensions if needed; POL; POD.  |

Container Type options:

- 20'DC
- 40'DC
- 40'HC
- 45'HC
- 20'RF
- 40'RF
- Open Top
- Flat Rack
- Other

POL = Port of Loading; POD = Port of Discharge.

## 8.3. Rail / Железнодорожная перевозка

После выбора Rail открыть Rail Subtype: Container / Wagon / LCL-Consolidated.

| **Subtype**        | **Открываемые поля**                                                             |
| ------------------ | -------------------------------------------------------------------------------- |
| Container          | Container Type; Container Quantity; Origin Station; Destination Station.         |
| Wagon              | Wagon Type; Number of Wagons; Origin Station; Destination Station.               |
| LCL / Consolidated | Packages; Gross Weight; Volume; Dimensions; Origin Station; Destination Station. |

Rail Container Type:

- 20'DC
- 40'DC
- 40'HC
- 45'HC
- Other

Wagon Type:

- Covered Wagon
- Open Wagon / Gondola
- Platform
- Tank Wagon
- Hopper
- Refrigerated Wagon (if needed)
- Other

Origin/Destination Station на Request могут быть необязательными, так как клиент часто знает только город/страну. Станцию можно уточнить позже.

## 8.4. Air / Авиа

| **Поле**            | **Логика**                                       |
| ------------------- | ------------------------------------------------ |
| Origin Airport      | Airport / IATA code + city.                      |
| Destination Airport | Airport / IATA code + city.                      |
| Number of Pieces    | Количество мест.                                 |
| Gross Weight        | Фактический вес.                                 |
| Dimensions          | Размеры одного или нескольких мест.              |
| Volume              | Опционально/расчетно.                            |
| Chargeable Weight   | Авторасчет с возможностью ручной корректировки.  |
| Routing Preference  | Direct / Transit / No Preference, необязательно. |

Формулу volumetric/chargeable weight лучше сделать настраиваемой, потому что коэффициенты могут отличаться.

## 8.5. Multimodal

Multimodal должен строиться из Transport Legs. Каждый leg имеет собственный Transport Type и получает те же динамические поля, которые описаны для Road/Sea/Rail/Air.

| **Поле Leg**             | **Описание**                       |
| ------------------------ | ---------------------------------- |
| Leg Number               | Автоматическая последовательность. |
| Transport Type           | Road / Sea / Rail / Air.           |
| Origin                   | Начало участка.                    |
| Destination              | Конец участка.                     |
| Subtype / dynamic fields | Автоматически по выбранному типу.  |

- \+ Add Leg
- Remove Leg
- Move Up / Move Down (желательно)
- Duplicate Leg (optional)

| **Leg** | **Transport** | **Example**         |
| ------- | ------------- | ------------------- |
| 1       | Road          | Munich -> Constanta |
| 2       | Sea           | Constanta -> Poti   |
| 3       | Rail          | Poti -> Baku        |

# 9\. Cargo / Груз

| **Поле**               | **Тип**            | **Логика**                                   |
| ---------------------- | ------------------ | -------------------------------------------- |
| Cargo Description \*   | Text               | Краткое наименование.                        |
| HS Code                | Text / multi-value | Необязательно на Request.                    |
| Number of Packages     | Numeric            | По необходимости.                            |
| Gross Weight (kg)      | Decimal            | По необходимости.                            |
| Volume (CBM)           | Decimal            | По необходимости.                            |
| Dimensions             | Structured         | L x W x H; несколько строк желательно.       |
| Cargo Value            | Decimal            | Необязательно.                               |
| Currency               | Dropdown           | Для Cargo Value.                             |
| Stackable              | Yes / No / Unknown | Особенно LTL/LCL/Air.                        |
| Dangerous Goods        | Yes / No           | При Yes открыть DG fields.                   |
| Temperature Controlled | Yes / No           | При Yes открыть temperature range.           |
| Oversized              | Yes / No           | При Yes dimensions становятся обязательными. |

| **Условие**                  | **Дополнительные поля**                       |
| ---------------------------- | --------------------------------------------- |
| Dangerous Goods = Yes        | ADR / IMO / DG Class; UN Number; DG Notes.    |
| Temperature Controlled = Yes | Min Temperature; Max Temperature; °C default. |
| Oversized = Yes              | Oversized Notes; mandatory Dimensions.        |

# 10\. Shipment Terms

| **Поле**                               | **Логика**                                               |
| -------------------------------------- | -------------------------------------------------------- |
| Incoterms                              | EXW, FCA, FOB, CFR, CIF, CPT, CIP, DAP, DPU, DDP, Other. |
| Incoterm Place                         | Открывается после выбора Incoterm. Пример: EXW Hamburg.  |
| Cargo Ready Date                       | Ключевая дата запроса.                                   |
| Requested Delivery Date                | Необязательно.                                           |
| Special Instructions / Client Comments | Свободный текст.                                         |

# 11\. Request Lifecycle / статусы

Request status должен отвечать на вопрос: что происходит с коммерческим запросом? Статусы не должны смешиваться с операционными статусами Order.

| **Status**     | **Meaning**                                       |
| -------------- | ------------------------------------------------- |
| New            | Запрос зарегистрирован.                           |
| In Progress    | Менеджер начал обработку.                         |
| Quotation      | Идет расчет и/или подготовка предложения клиенту. |
| Quotation Sent | Предложение отправлено.                           |
| Waiting Client | Ожидается решение клиента.                        |
| Won            | Клиент подтвердил.                                |
| Lost           | Клиент не подтвердил / выбрал другой вариант.     |
| Cancelled      | Груз или запрос отменен.                          |

Для Direct Order Request может перейти New/In Progress -> Won -> Create Order без Quotation и Quotation Sent.

# 12\. Lost / Cancelled Reason

При закрытии Request как Lost требуется причина:

- Price too high
- Client chose competitor
- Transit time not suitable
- No suitable solution
- Client stopped responding
- Cargo / shipment cancelled
- Request was informational only
- Other

При Other обязательный комментарий.

# 13\. Quotation - единый коммерческий этап

В интерфейсе и терминологии CRM не использовать два отдельных пользовательских этапа Pricing и Quotation. Использовать единый термин QUOTATION.

Внутри Quotation в дальнейшем будут две логические части, но обе находятся в одном модуле/экране:

| **Часть**             | **Что содержит**                                                          |
| --------------------- | ------------------------------------------------------------------------- |
| Internal Cost / Rates | Ставки Carrier/Supplier, дополнительные ожидаемые расходы, expected cost. |
| Client Offer          | Selling price, currency, validity, transit time, terms/notes.             |

Подробная финансовая структура Quotation будет отдельным ТЗ. Сейчас важно заложить сущность и связь с Request.

# 14\. Создание Order из Request

Кнопка: Convert / Create Order.

При нажатии выбрать сценарий:

| **Option**                   | **Поведение**                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| Based on confirmed Quotation | Order создается на основании принятого предложения; будущие финансовые данные подтягиваются из Quotation. |
| Direct Order                 | Клиент сразу дал инструкцию на перевозку; Order создается даже если стоимость еще не определена.          |

Order ID: ORD-{YEAR}-{SEQUENTIAL_NUMBER}, например ORD-2026-0087.

В Order переносить:

- Client, Contact
- Route
- Transport Type/Subtype и все dynamic transport fields
- Cargo data
- Incoterms / dates / special instructions
- Responsible Manager
- Communication links / Outlook threads
- Documents
- Quotation/financial references, если они существуют

Request остается в системе со статусом Won и ссылкой на созданный Order.

# 15\. Order Lifecycle

После создания Order начинается операционная часть. Здесь уже не используются Request-статусы.

| **Order Status**                | **Meaning**                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------- |
| Created                         | Order создан.                                                                 |
| Operations                      | Бронирование/подбор перевозчика/организация/документы.                        |
| Booked / Confirmed with Carrier | Перевозчик/сервис подтвержден (можно оставить как optional отдельный статус). |
| In Transit                      | Груз в пути.                                                                  |
| Delivered                       | Груз доставлен.                                                               |
| Closed                          | Операционно и финансово закрыт.                                               |

Слово Execution в финальной терминологии не использовать как основной этап; вместо него использовать Operations.

# 16\. Финансовое правило для Direct Order

Цена не должна быть обязательным условием создания Order. Это критично для срочных грузов, когда клиент сразу дает поручение забрать груз, а закупочная и/или продажная стоимость определяется позже.

| **Этап**                        | **Финансовые данные обязательны?**                             |
| ------------------------------- | -------------------------------------------------------------- |
| Create Request                  | Нет.                                                           |
| Quotation                       | Да - если клиент просит расчет/предложение.                    |
| Convert to Order from Quotation | Обычно уже есть, подтягиваются.                                |
| Create Direct Order             | Нет. Допускается Financial Data Incomplete.                    |
| Operations / In Transit         | Можно дополнять/корректировать.                                |
| Delivered                       | Желательно завершить фактические расходы.                      |
| Closed                          | Да. Order нельзя закрыть без обязательного финансового набора. |

В Direct Order карточке должен быть видимый indicator, например Financial data incomplete, пока необходимые financial fields не заполнены.

Будущий Finance модуль должен разделять Expected/Quoted и Actual Financials. Пример: клиенту предложили EUR 2,700 при ожидаемой себестоимости EUR 2,350, но фактическая себестоимость составила EUR 2,480. Система должна хранить и expected profit, и actual profit.

# 17\. Outlook / Microsoft 365 Integration

## 17.1. Цель

Создавать Request из входящего Outlook email в 1-2 клика без ручного копирования sender, subject, date, body и attachments.

## 17.2. Пользовательский сценарий

1. Пользователь открывает клиентское письмо в Outlook.
2. Нажимает Create All In Request.
3. Открывается предзаполненная New Request form.
4. CRM пытается определить Client и Contact.
5. Пользователь добавляет маршрут, транспорт и груз.
6. Save Request -> система присваивает REQ ID и связывает email thread.

## 17.3. Данные Outlook

| **Field**                | **Requirement**                                    |
| ------------------------ | -------------------------------------------------- |
| Subject                  | Email Subject.                                     |
| Sender Name              | Display/matching.                                  |
| Sender Email             | Primary Contact matching key.                      |
| To                       | Сохранить.                                         |
| CC                       | Сохранить.                                         |
| Received Date/Time       | Request Received Date default.                     |
| Body                     | Сохранить/отображать в Emails.                     |
| Attachments              | Сохранять как email attachments.                   |
| Microsoft Message ID     | External identifier.                               |
| Conversation ID          | Основная связь thread.                             |
| In-Reply-To / References | Использовать при необходимости для robust linking. |

## 17.4. Client / Contact matching

1. Точное совпадение Sender Email с Contact.Email.
2. Если найдено - подставить Contact и Company.
3. Если Contact не найден - проверить email domain по Company domains.
4. Если Company найдена - предложить Add New Contact to Company.
5. Если Company не найдена - предложить Create New Client/Company с предзаполненными данными.

Не создавать Company автоматически без подтверждения, чтобы избежать дублей.

## 17.5. Email thread внутри Request

Вкладка Emails / Communication должна отображать:

- Date/Time
- From/To/CC
- Subject
- Body
- Attachments
- Incoming/Outgoing
- Linked Request(s)

После привязки Conversation CRM должна фоново синхронизировать новые сообщения именно связанных conversations. Не импортировать весь mailbox.

## 17.6. Reply / Forward

Reply/Forward из CRM отправляется через рабочий Microsoft 365 аккаунт текущего пользователя, появляется в Outlook Sent Items и сохраняется в CRM.

## 17.7. REQ в email subject

Опциональная настройка: добавить \[REQ-2026-0145\] к исходящей теме. Не делать обязательной.

## 17.8. Один email - несколько Requests

Email ↔ Request должна быть many-to-many. Одно письмо может содержать несколько перевозок и породить несколько REQ.

## 17.9. Один Request - несколько email threads

Нужна функция Link Email to Request, потому что клиент может прислать отдельный Packing List новым thread.

## 17.10. Attachments vs Documents

Все вложения письма отображаются как Email Attachments. Только выбранные пользователем файлы сохраняются в бизнес-раздел Documents через действие Save to Documents.

## 17.11. Technical

- Microsoft Graph API / Exchange Online.
- OAuth per CRM user.
- Separate internal IDs and Microsoft external IDs.
- Background sync for linked conversations.
- Integration failure must not block manual Request creation.

# 18\. WhatsApp / Phone / Website / Agent

Архитектура Request не зависит от канала. Канал - это источник коммуникации, а не отдельный бизнес-процесс.

| **Channel**     | **Special logic**                                                                       |
| --------------- | --------------------------------------------------------------------------------------- |
| WhatsApp        | Manual Request now; match by phone/WhatsApp number if possible; future API integration. |
| Phone           | Manual Request; Call Summary / Communication Note.                                      |
| Website         | Auto-create New Request; Source=Website; responsible assignment rule later.             |
| Agent / Partner | Manual Request; optionally link source agent company.                                   |

# 19\. Карточка Request

| **Tab**                | **Content**                                                     |
| ---------------------- | --------------------------------------------------------------- |
| Overview               | Client, route, transport, cargo, dates, source, status.         |
| Quotation              | Единый коммерческий модуль; detailed finance later.             |
| Emails / Communication | Outlook thread + manual WhatsApp/Phone notes.                   |
| Documents              | Business documents.                                             |
| Tasks                  | Task management - можно внедрять в Phase 1 или ближайшем этапе. |
| History / Timeline     | Автоматический audit trail.                                     |

# 20\. Timeline / Audit Log

- Request created
- Status changed
- Responsible changed
- Route/transport/cargo changed
- Email linked / received / sent
- Document added/removed
- Quotation sent
- Marked Won/Lost/Cancelled
- Order created
- Order status changed

Для каждого события хранить user, datetime, old/new value where applicable.

# 21\. Search / Request List / Filters

Глобальный поиск минимум по:

- REQ ID
- ORD ID
- Request Title
- Email Subject
- Client
- Contact
- Contact Email
- Origin
- Destination

Рекомендуемые колонки списка Requests:

| **Column**      | **Example**                 |
| --------------- | --------------------------- |
| REQ             | REQ-2026-0145               |
| Request / Route | Hamburg -> Baku \| Road FTL |
| Client          | BOSCH                       |
| Source          | Email                       |
| Status          | Quotation                   |
| Responsible     | Manager A                   |
| Received        | 07.08.2026 09:42            |
| Last Activity   | 07.08.2026 11:10            |

Рекомендуемые фильтры: Status, Responsible, Source, Transport Type, Date Range, Client, Origin Country, Destination Country.

# 22\. Dashboard / KPI

Даже если dashboard визуально будет разработан позже, все исходные данные и timestamps должны сохраняться с первого дня.

| **KPI**               | **Definition**                                             |
| --------------------- | ---------------------------------------------------------- |
| Total Requests        | REQ за период.                                             |
| Quotation Sent        | Количество Requests с отправленным Quotation.              |
| Won                   | Requests, приведшие к Order.                               |
| Lost                  | Lost Requests.                                             |
| Conversion Rate       | Won/Requests и/или Won/Quoted - формулу можно переключать. |
| Requests by Manager   | Рабочая нагрузка.                                          |
| Won by Manager        | Результативность.                                          |
| Requests by Source    | Email/WhatsApp/Phone/Website/etc.                          |
| Lost Reasons          | Причины потерь.                                            |
| Registration Time     | created_at - received_at.                                  |
| Time to Quote         | quote_sent_at - received_at.                               |
| Client Decision Time  | decision_at - quote_sent_at.                               |
| Request to Order Time | order_created_at - received_at.                            |

# 23\. Обязательные timestamps

| **Timestamp**        | **Trigger**                          |
| -------------------- | ------------------------------------ |
| received_at          | Фактическое получение запроса.       |
| created_at           | Создание REQ в CRM.                  |
| work_started_at      | Переход в In Progress.               |
| quotation_started_at | Начало Quotation, если используется. |
| quotation_sent_at    | Отправка предложения.                |
| decision_at          | Won/Lost/Cancelled.                  |
| order_created_at     | Create Order.                        |
| order_delivered_at   | Delivered.                           |
| order_closed_at      | Closed.                              |
| updated_at           | Последнее изменение.                 |

# 24\. Validation / обязательность данных по этапам

| **Stage**      | **Minimum required**                                                                        |
| -------------- | ------------------------------------------------------------------------------------------- |
| Save Draft/New | Source, received_at, responsible; желательно Client, но можно предусмотреть temporary lead. |
| In Progress    | Client/Contact if known, Origin, Destination, Transport Type, Cargo Description.            |
| Quotation Sent | Operational data + future required commercial data.                                         |
| Direct Order   | Client confirmation, core route/transport/cargo data. Финальная цена не обязательна.        |
| Closed Order   | Все обязательные operational + financial fields.                                            |

- Не показывать нерелевантные dynamic fields.
- При смене Transport Type предупреждать об очистке уже введенных subtype-specific данных.
- Save Draft должен позволять сохранить неполную карточку.
- Не создавать дубли Contacts/Companies без предупреждения.

# 25\. Users / Roles / Permissions

| **Role example**       | **Access**                                             |
| ---------------------- | ------------------------------------------------------ |
| Admin                  | Полный доступ, users, roles, settings.                 |
| Manager                | Requests/Orders, own communications, assigned records. |
| Supervisor / Team Lead | Team visibility, reassignment, KPI.                    |
| Finance (future)       | Financial data and financial workflow.                 |

Изменение Responsible Manager обязательно логируется.

# 26\. Требования к структуре БД

- Request и Order - отдельные entities.
- Company и Contact - отдельные entities.
- Company roles - many-to-many либо эквивалентная гибкая модель.
- Request -> Order relation хранится явно.
- Email Message и Email Conversation - отдельные integration entities.
- Email &lt;-&gt; Request - many-to-many.
- Transport Leg - отдельная entity для Multimodal.
- Transport-specific data хранить структурированно, а не одним описательным текстом.
- History/Audit trail - отдельная надежная структура.
- Все datetime timezone-aware.
- Структура должна позволять добавить future Pricing/Finance без migration, меняющей фундамент Request/Order.

# 27\. Рекомендуемый порядок разработки

1. Companies / Contacts / Users / roles.
2. Request entity, IDs, source, statuses, timestamps.
3. New Request form и dynamic transport logic.
4. Request list, filters, search, Request card.
5. Manual sources (WhatsApp/Phone/Agent/Tender).
6. Outlook authentication and Create Request from Email.
7. Email thread sync, attachments, Link Email, Reply/Forward.
8. Quotation placeholder/entity and workflow status.
9. Convert Request to Order, including Direct Order.
10. Order lifecycle / Operations statuses.
11. Lost reasons, audit trail, KPI data.
12. Prepare connection points for detailed Finance module.

# 28\. Phase 1 Acceptance Criteria

- Новый Request вручную создается быстро и без лишних полей.
- Email Request создается из Outlook с автоматическим metadata.
- Client/Contact matching работает либо предлагает безопасное создание нового контакта/компании.
- Road/Sea/Rail/Air/Multimodal динамические поля открываются строго по логике ТЗ.
- Request может пройти Quotation path или Direct Order path.
- Direct Order разрешен без финальной цены.
- Order нельзя Closed без будущего обязательного финансового набора.
- Email thread продолжает синхронизироваться после создания REQ.
- Request -> Order переносит данные без повторного ввода.
- Search работает по REQ/ORD/Email Subject/Client/Route.
- Lost Reason обязателен.
- Все KPI timestamps и audit data сохраняются.

# Приложение A. Полная матрица Dynamic Transport Fields

| **Transport** | **Subtype**      | **Fields**                                                                                                            |
| ------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Road          | FTL              | Vehicle Type; Number of Trucks; Cargo fields; temperature if Reefer.                                                  |
| Road          | LTL              | Packages; Weight; CBM; Dimensions; Stackable.                                                                         |
| Sea           | FCL              | Container Type; Qty; POL; POD.                                                                                        |
| Sea           | LCL              | Packages; Weight; CBM; Dimensions; Stackable; POL; POD.                                                               |
| Sea           | Breakbulk        | Pieces; Weight; Dimensions; POL; POD; Oversized.                                                                      |
| Sea           | Ro-Ro            | Vehicle/Equipment; Qty; Weight/Dimensions as needed; POL; POD.                                                        |
| Rail          | Container        | Container Type; Qty; Origin Station; Destination Station.                                                             |
| Rail          | Wagon            | Wagon Type; Wagon Qty; Origin Station; Destination Station.                                                           |
| Rail          | LCL/Consolidated | Packages; Weight; Volume; Dimensions; Stations.                                                                       |
| Air           | \-               | Origin Airport; Destination Airport; Pieces; Gross Weight; Dimensions; Volume; Chargeable Weight; Routing Preference. |
| Multimodal    | Leg-based        | Unlimited Legs; each leg gets own Transport Type, route and matching dynamic fields.                                  |

# Приложение B. Пример Request - Quotation path

| **Field**            | **Example**                                          |
| -------------------- | ---------------------------------------------------- |
| REQ                  | REQ-2026-0145                                        |
| Title                | BOSCH \| Hamburg -> Baku \| Road FTL                 |
| Source               | Email                                                |
| Email Subject        | RFQ // 2 trucks Hamburg - Baku                       |
| Client / Contact     | BOSCH GmbH / John Smith                              |
| Origin / Destination | Germany, Hamburg -> Azerbaijan, Baku                 |
| Transport            | Road / FTL / Curtainsider / 2 trucks                 |
| Cargo                | Machinery / 18,500 kg                                |
| Ready Date           | 12.08.2026                                           |
| Status               | Quotation -> Quotation Sent -> Waiting Client -> Won |
| Result               | Create ORD-2026-0087                                 |

# Приложение C. Пример Request - Direct Order path

| **Field**       | **Example**                                                           |
| --------------- | --------------------------------------------------------------------- |
| Situation       | Client calls: urgent cargo in Germany, please collect tomorrow.       |
| REQ             | REQ-2026-0146                                                         |
| Source          | Phone                                                                 |
| Status          | New -> In Progress -> Won                                             |
| Quotation       | Skipped                                                               |
| Order           | ORD-2026-0088 created immediately                                     |
| Financial state | Financial data incomplete                                             |
| Later           | Carrier cost and client selling price entered during Operations       |
| Closure rule    | Order cannot become Closed until required financial data is completed |

# Приложение D. Терминология - использовать единообразно

| **Use**            | **Do not confuse with**                                  |
| ------------------ | -------------------------------------------------------- |
| Request            | Не Order.                                                |
| Quotation          | Единый этап; не показывать отдельно Pricing + Quotation. |
| Rates / Cost Rates | Внутренние ставки перевозчиков внутри Quotation/Finance. |
| Order              | Подтвержденная перевозка.                                |
| Operations         | Операционное исполнение; вместо общего Execution.        |
| Actual Financials  | Фактическая экономика Order.                             |
| Request Title      | Внутреннее название; не Email Subject.                   |
| Email Subject      | Оригинальная тема переписки клиента.                     |