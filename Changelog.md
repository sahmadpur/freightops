1. Apply changes to create order form:
Rename SIFARIŞIN ADI - Sifariş mövzusu 
Remove CLIENT ORDER ID
Change ROUTE - must be two searchable dropdonws with country names and flag  "from" and "to"
Rename Cargo delivery format - Transport type
Rename СУММА - стоймост транспортировки
2. Update create order form alignment:
Transport type
Client
Carrier
Route from to 
Sifariş mövzusu 
ОПИСАНИЕ ГРУЗА (must be searchable dropdown, multi select, add your variants for now)
Order documents (multi file upload) copy from order view
3. Add status waiting for cargo pickup
4. Change Order id format - must be ALL2607001 where 26 year, 07 month, 001 unique auto increment
5. Change - РАСХОДЫ ПЕРЕВОЗЧИКА to РАСХОДЫ agenta , plus icon which add new fied with dropdown selectable category(add your categories for now)
6. Add rollback number to create order and order info
7. Select currency, get rates for manat from cbar api (default is use) show manat conversation of total cost - https://www.cbar.az/currencies/05.08.2026.xml
8. Delete from order create - НОМЕР СЧЁТА, ДАТА СЧЁТА, № СЧЁТА ПЕРЕВОЗЧИКА, ДАТА СЧЁТА ПЕРЕВОЗЧИКА
9. Delete transport logic and all fields related
10. Add custom clearance section, with ability to select order or create without order.  Cost: Documentation fee, customs declaration main page, additional page, short declaration, broker fee, inspector fee, handling, terminal, delivery, nothing mandatory 
10.1. Price will be manually entered
11. Add double click opening of order
12. Documentation fee,  customs declaration main page, additional page, short declaration, delivery and handling should have buy and sell separately 
13.If status arrived should sent notification must create invoice!
14. Order - finance- need to log what I received and what I paid
15. After delivery order should be moved to archive
16. Add search filters to order table
17. Add to order hictory which user do what
18. create dashboard based on all information
19. Add logo to platform
20. Redesign platform
21. Add new invoices and acts to platform
22. Add financial statistics with charts and etc
23. add dark mode