/**
 * Demo data seeder — fills the workspace with realistic freight-forwarding
 * records so the UI has something to show. Idempotent-ish: it refuses to run
 * if orders already exist, unless SEED_DEMO_RESET=1 (which wipes all domain
 * data first — but never touches users/auth).
 *
 *   npm run db:seed:demo
 *   SEED_DEMO_RESET=1 npm run db:seed:demo
 */
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import {
  accounts,
  carriers,
  contacts,
  transportModes,
  orders,
  payments,
  comments,
  auditLog,
  orderCounters,
  documents,
  notifications,
} from "../src/db/schema/domain";

const YEAR = 2026;
const reset = ["1", "true", "yes"].includes((process.env.SEED_DEMO_RESET ?? "").toLowerCase());

// Spread createdAt across the year so the list, "last modified" and YTD
// finance figures look lived-in.
const day = (m: number, d: number) => new Date(Date.UTC(YEAR, m - 1, d, 9, 30));
const iso = (m: number, d: number) => `${YEAR}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const money = (n: number) => n.toFixed(2);
const num = (n: number) => formatNum(n);
function formatNum(n: number) {
  return n.toFixed(2);
}

async function main() {
  const admin =
    (await db.query.user.findFirst({ where: (u, { eq }) => eq(u.role, "admin") })) ??
    (await db.query.user.findFirst());
  const by = admin?.id ?? null;

  const existing = await db.select({ c: sql<number>`count(*)`.mapWith(Number) }).from(orders);
  if (existing[0].c > 0 && !reset) {
    console.log(
      `Found ${existing[0].c} existing orders — refusing to seed. Re-run with SEED_DEMO_RESET=1 to wipe and reseed.`,
    );
    process.exit(0);
  }

  if (reset) {
    console.log("Resetting domain data…");
    // Children first; payments/comments cascade from orders but be explicit.
    await db.delete(payments);
    await db.delete(comments);
    await db.delete(documents);
    await db.delete(notifications);
    await db.delete(orders);
    await db.delete(contacts);
    await db.delete(transportModes);
    await db.delete(accounts);
    await db.delete(carriers);
    await db.delete(auditLog);
    await db.delete(orderCounters);
  }

  // ---- Accounts (clients) -------------------------------------------------
  console.log("Seeding accounts…");
  const accountRows = await db
    .insert(accounts)
    .values([
      { title: "Caspian Traders LLC", taxId: "AZ-1004557", address: "12 Neftchilar Ave, Baku, AZ", notes: "Key account — electronics & machinery imports.", createdBy: by },
      { title: "Silk Road Imports", taxId: "GE-405511230", address: "8 Rustaveli Ave, Tbilisi, GE", notes: "Textiles and consumer goods.", createdBy: by },
      { title: "Anatolia Logistics A.Ş.", taxId: "TR-9928174", address: "Atatürk Cd. 145, Istanbul, TR", notes: null, createdBy: by },
      { title: "Volga Freight OOO", taxId: "RU-7714029384", address: "Lenina St. 56, Astrakhan, RU", notes: "Seasonal agricultural shipments.", createdBy: by },
      { title: "Hanseatic GmbH", taxId: "DE-811125567", address: "Speicherstadt 4, Hamburg, DE", notes: "Automotive parts.", createdBy: by },
    ])
    .returning({ id: accounts.id, title: accounts.title });
  const acc = Object.fromEntries(accountRows.map((a) => [a.title, a.id]));

  // ---- Carriers -----------------------------------------------------------
  console.log("Seeding carriers…");
  const carrierRows = await db
    .insert(carriers)
    .values([
      { title: "BTK Rail Cargo", address: "Baku–Tbilisi–Kars Terminal, Alyat, AZ", notes: "Rail block trains, weekly slots.", createdBy: by },
      { title: "Caspian Shipping Co.", address: "Port of Baku, Alyat, AZ", notes: "Ro-Ro and container, Caspian crossings.", createdBy: by },
      { title: "TransAnatolia Trucking", address: "Halkalı Lojistik Merkezi, Istanbul, TR", notes: "FTL/LTL road, TIR carnet.", createdBy: by },
      { title: "Lufthansa Cargo", address: "Frankfurt Airport, DE", notes: "Air freight, temperature-controlled available.", createdBy: by },
      { title: "Black Sea Lines", address: "Port of Poti, GE", notes: null, createdBy: by },
    ])
    .returning({ id: carriers.id, title: carriers.title });
  const car = Object.fromEntries(carrierRows.map((c) => [c.title, c.id]));

  // ---- Contacts (a couple per client/carrier) ----------------------------
  console.log("Seeding contacts…");
  await db.insert(contacts).values([
    { parentType: "account", parentId: acc["Caspian Traders LLC"], name: "Rashad Aliyev", phones: ["+994 50 123 45 67"], emails: ["rashad@caspiantraders.az"] },
    { parentType: "account", parentId: acc["Silk Road Imports"], name: "Nino Beridze", phones: ["+995 599 11 22 33"], emails: ["nino@silkroad.ge"] },
    { parentType: "account", parentId: acc["Anatolia Logistics A.Ş."], name: "Mehmet Yılmaz", phones: ["+90 532 444 55 66"], emails: ["mehmet@anatolialog.com.tr"] },
    { parentType: "account", parentId: acc["Hanseatic GmbH"], name: "Klaus Brandt", phones: ["+49 40 998877"], emails: ["k.brandt@hanseatic.de"] },
    { parentType: "carrier", parentId: car["TransAnatolia Trucking"], name: "Ahmet Demir", phones: ["+90 533 222 11 00"], emails: ["dispatch@transanatolia.com.tr"] },
    { parentType: "carrier", parentId: car["Caspian Shipping Co."], name: "Elnur Mammadov", phones: ["+994 12 404 50 50"], emails: ["ops@caspianshipping.az"] },
  ]);

  // ---- Transport modes ----------------------------------------------------
  console.log("Seeding transport modes…");
  const tmRows = await db
    .insert(transportModes)
    .values([
      { modeType: "rail", number: "BTK-7741", fromCountry: "AZ", toCountry: "GE", route: "Alyat → Tbilisi", loadingDate: iso(5, 12), plannedArrivalDate: iso(5, 16), totalWeightKg: num(42000), totalVolumeM3: num(76), createdBy: by },
      { modeType: "sea", number: "MSC-AZ-2031", fromCountry: "CN", toCountry: "AZ", route: "Shanghai → Baku (via Aktau)", loadingDate: iso(3, 2), plannedArrivalDate: iso(4, 1), totalWeightKg: num(180000), totalVolumeM3: num(320), createdBy: by },
      { modeType: "vehicle", number: "TRK-3390", fromCountry: "AZ", toCountry: "TR", route: "Baku → Istanbul", loadingDate: iso(6, 4), plannedArrivalDate: iso(6, 9), totalWeightKg: num(21000), totalVolumeM3: num(58), createdBy: by },
      { modeType: "air", number: "LH-8800", fromCountry: "DE", toCountry: "AZ", route: "Frankfurt → Baku", loadingDate: iso(6, 11), plannedArrivalDate: iso(6, 12), totalWeightKg: num(3400), totalVolumeM3: num(14), createdBy: by },
      { modeType: "vehicle", number: "TRK-3412", fromCountry: "GE", toCountry: "AZ", route: "Poti → Baku", loadingDate: iso(2, 18), plannedArrivalDate: iso(2, 22), totalWeightKg: num(18500), totalVolumeM3: num(44), createdBy: by },
    ])
    .returning({ id: transportModes.id, number: transportModes.number });
  const tm = Object.fromEntries(tmRows.map((t) => [t.number, t.id]));

  // ---- Orders -------------------------------------------------------------
  // Each row: financials, status, and (optionally) a payment plan.
  // pay: [receivedFraction, paidFraction] of [amountReceivable, amountPayable].
  console.log("Seeding orders…");
  type Seed = {
    title: string;
    account: string;
    carrier?: string;
    transport?: string;
    route: string;
    cargo: string;
    packages: number;
    weight: number;
    volume: number;
    incoterms: string;
    deliveryFormat: string;
    status: string;
    client: number;
    carrierCost: number;
    additional: number;
    addNote?: string;
    invoiced: boolean;
    pay?: [number, number];
    month: number;
    date: number;
  };

  const seeds: Seed[] = [
    { title: "Industrial CNC machines", account: "Caspian Traders LLC", carrier: "Caspian Shipping Co.", transport: "MSC-AZ-2031", route: "Shanghai → Baku", cargo: "3× CNC milling machines, crated", packages: 3, weight: 12400, volume: 48, incoterms: "CIF", deliveryFormat: "FCL", status: "delivered", client: 24800, carrierCost: 17200, additional: 640, addNote: "Port handling + crane", invoiced: true, pay: [1, 1], month: 3, date: 4 },
    { title: "Cotton textiles consignment", account: "Silk Road Imports", carrier: "BTK Rail Cargo", transport: "BTK-7741", route: "Alyat → Tbilisi", cargo: "Baled cotton textiles", packages: 120, weight: 21000, volume: 64, incoterms: "DAP", deliveryFormat: "LCL", status: "delivered", client: 9600, carrierCost: 6300, additional: 220, invoiced: true, pay: [1, 1], month: 5, date: 18 },
    { title: "Automotive spare parts", account: "Hanseatic GmbH", carrier: "Lufthansa Cargo", transport: "LH-8800", route: "Frankfurt → Baku", cargo: "Engine components, palletized", packages: 8, weight: 3400, volume: 14, incoterms: "CPT", deliveryFormat: "LTL", status: "at_customs", client: 14200, carrierCost: 10100, additional: 380, addNote: "Customs brokerage", invoiced: true, pay: [0.5, 0], month: 6, date: 11 },
    { title: "Consumer electronics", account: "Caspian Traders LLC", carrier: "TransAnatolia Trucking", transport: "TRK-3390", route: "Baku → Istanbul", cargo: "Mixed electronics, 2 pallets", packages: 2, weight: 1800, volume: 9, incoterms: "DAP", deliveryFormat: "LTL", status: "transit", client: 7400, carrierCost: 4900, additional: 150, invoiced: true, pay: [0.3, 0], month: 6, date: 4 },
    { title: "Agricultural machinery", account: "Volga Freight OOO", carrier: "Caspian Shipping Co.", route: "Astrakhan → Baku", cargo: "Tractor + implements", packages: 1, weight: 6800, volume: 32, incoterms: "FOB", deliveryFormat: "FCL", status: "loaded", client: 11200, carrierCost: 7600, additional: 300, invoiced: true, pay: [0, 0], month: 6, date: 9 },
    { title: "Pharmaceutical cold chain", account: "Hanseatic GmbH", carrier: "Lufthansa Cargo", transport: "LH-8800", route: "Frankfurt → Baku", cargo: "Temperature-controlled pharma", packages: 14, weight: 920, volume: 6, incoterms: "CIP", deliveryFormat: "LTL", status: "arrived", client: 18600, carrierCost: 13400, additional: 720, addNote: "Reefer surcharge", invoiced: true, pay: [0.5, 0.5], month: 6, date: 12 },
    { title: "Furniture container", account: "Silk Road Imports", carrier: "Black Sea Lines", route: "Poti → Batumi", cargo: "Flat-pack furniture", packages: 240, weight: 9400, volume: 70, incoterms: "EXW", deliveryFormat: "FCL", status: "at_border", client: 8200, carrierCost: 5400, additional: 180, invoiced: true, pay: [0, 0], month: 6, date: 7 },
    { title: "Steel coils", account: "Volga Freight OOO", carrier: "BTK Rail Cargo", transport: "BTK-7741", route: "Alyat → Tbilisi", cargo: "Hot-rolled steel coils", packages: 18, weight: 41000, volume: 22, incoterms: "FCA", deliveryFormat: "FTL", status: "internal_transit", client: 13800, carrierCost: 9700, additional: 410, invoiced: true, pay: [0, 0], month: 6, date: 13 },
    { title: "Retail apparel restock", account: "Anatolia Logistics A.Ş.", carrier: "TransAnatolia Trucking", transport: "TRK-3390", route: "Baku → Istanbul", cargo: "Apparel, hanging garments", packages: 60, weight: 2200, volume: 26, incoterms: "DAP", deliveryFormat: "LTL", status: "received", client: 6100, carrierCost: 3950, additional: 120, invoiced: false, month: 6, date: 14 },
    { title: "Solar panel shipment", account: "Caspian Traders LLC", route: "Shenzhen → Baku", cargo: "Photovoltaic panels", packages: 320, weight: 15600, volume: 88, incoterms: "CIF", deliveryFormat: "FCL", status: "created", client: 21300, carrierCost: 0, additional: 0, invoiced: false, month: 6, date: 15 },
    { title: "Wine export pallets", account: "Silk Road Imports", carrier: "TransAnatolia Trucking", transport: "TRK-3412", route: "Poti → Baku", cargo: "Bottled wine, palletized", packages: 44, weight: 8800, volume: 30, incoterms: "DAP", deliveryFormat: "LTL", status: "closed", client: 7900, carrierCost: 5100, additional: 260, addNote: "Excise documentation", invoiced: true, pay: [1, 1], month: 2, date: 18 },
    { title: "Construction equipment", account: "Anatolia Logistics A.Ş.", carrier: "Caspian Shipping Co.", transport: "MSC-AZ-2031", route: "Mersin → Baku", cargo: "Excavator + attachments", packages: 1, weight: 19500, volume: 54, incoterms: "DPU", deliveryFormat: "FCL", status: "transit", client: 16700, carrierCost: 11900, additional: 540, invoiced: true, pay: [0.4, 0.25], month: 5, date: 28 },
    { title: "Packaged food goods", account: "Volga Freight OOO", carrier: "BTK Rail Cargo", route: "Astrakhan → Tbilisi", cargo: "Canned goods, dry", packages: 800, weight: 24000, volume: 60, incoterms: "DAP", deliveryFormat: "FTL", status: "delivered", client: 10400, carrierCost: 6900, additional: 280, invoiced: true, pay: [1, 0.6], month: 4, date: 9 },
    { title: "Medical devices", account: "Hanseatic GmbH", carrier: "Lufthansa Cargo", transport: "LH-8800", route: "Frankfurt → Baku", cargo: "Diagnostic equipment", packages: 22, weight: 1600, volume: 11, incoterms: "CIP", deliveryFormat: "LTL", status: "delivered", client: 22900, carrierCost: 16300, additional: 690, invoiced: true, pay: [1, 1], month: 5, date: 6 },
  ];

  let seq = 0;
  const created: { id: string; number: string; status: string; title: string }[] = [];
  for (const s of seeds) {
    seq += 1;
    const number = `ORD-${YEAR}-${String(seq).padStart(3, "0")}`;
    const expectedProfit = s.client - s.carrierCost - s.additional;
    const when = day(s.month, s.date);
    const [row] = await db
      .insert(orders)
      .values({
        number,
        title: s.title,
        accountId: acc[s.account],
        carrierId: s.carrier ? car[s.carrier] : null,
        transportModeId: s.transport ? tm[s.transport] : null,
        route: s.route,
        cargoDescription: s.cargo,
        packages: s.packages,
        weightKg: num(s.weight),
        volumeM3: num(s.volume),
        incoterms: s.incoterms as never,
        deliveryFormat: s.deliveryFormat as never,
        status: s.status as never,
        clientCharge: s.client ? money(s.client) : null,
        carrierCost: s.carrierCost ? money(s.carrierCost) : null,
        additionalCosts: s.additional ? money(s.additional) : null,
        additionalCostsNote: s.addNote ?? null,
        expectedProfit: s.client ? money(expectedProfit) : null,
        invoiceNumber: s.invoiced ? `INV-${YEAR}-${String(seq).padStart(3, "0")}` : null,
        invoiceDate: s.invoiced ? iso(s.month, Math.min(28, s.date + 1)) : null,
        amountReceivable: s.invoiced ? money(s.client) : null,
        amountPayable: s.invoiced && s.carrierCost ? money(s.carrierCost) : null,
        createdAt: when,
        updatedAt: when,
        createdBy: by,
      })
      .returning({ id: orders.id, number: orders.number });

    // Payments
    if (s.pay && s.invoiced) {
      const [recvFrac, payFrac] = s.pay;
      const payRows = [];
      if (recvFrac > 0) {
        payRows.push({
          orderId: row.id,
          direction: "incoming" as const,
          amount: money(s.client * recvFrac),
          paidAt: day(s.month, Math.min(28, s.date + 3)),
          note: recvFrac >= 1 ? "Paid in full" : "Partial advance",
          createdBy: by,
        });
      }
      if (payFrac > 0 && s.carrierCost) {
        payRows.push({
          orderId: row.id,
          direction: "outgoing" as const,
          amount: money(s.carrierCost * payFrac),
          paidAt: day(s.month, Math.min(28, s.date + 5)),
          note: payFrac >= 1 ? "Carrier settled" : "Partial to carrier",
          createdBy: by,
        });
      }
      if (payRows.length) await db.insert(payments).values(payRows);
    }

    created.push({ id: row.id, number: row.number, status: s.status, title: s.title });
  }

  // Order counter so the next real order continues the sequence.
  await db
    .insert(orderCounters)
    .values({ year: YEAR, lastNumber: seq })
    .onConflictDoUpdate({ target: orderCounters.year, set: { lastNumber: seq } });

  // ---- Comments (on a couple of active orders) ---------------------------
  if (by) {
    console.log("Seeding comments…");
    const atCustoms = created.find((o) => o.status === "at_customs");
    const transit = created.find((o) => o.status === "transit");
    const commentRows = [];
    if (atCustoms)
      commentRows.push(
        { orderId: atCustoms.id, authorId: by, body: "Customs flagged for inspection — awaiting brokerage clearance.", createdAt: day(6, 12) },
        { orderId: atCustoms.id, authorId: by, body: "Duties paid, expecting release tomorrow.", createdAt: day(6, 13) },
      );
    if (transit)
      commentRows.push({ orderId: transit.id, authorId: by, body: "Driver checked in at the border crossing, on schedule.", createdAt: day(6, 6) });
    if (commentRows.length) await db.insert(comments).values(commentRows);
  }

  // ---- A few audit entries ------------------------------------------------
  console.log("Seeding audit log…");
  const auditRows = created.slice(0, 6).map((o, i) => ({
    userId: by,
    entityType: "order",
    entityId: o.id,
    action: i % 2 === 0 ? "create" : "status_change",
    field: i % 2 === 0 ? null : "status",
    oldValue: i % 2 === 0 ? null : "created",
    newValue: i % 2 === 0 ? null : o.status,
    createdAt: day(6, 10 + i),
  }));
  if (auditRows.length) await db.insert(auditLog).values(auditRows);

  console.log(
    `\nDone. Seeded ${accountRows.length} accounts, ${carrierRows.length} carriers, ${tmRows.length} transport modes, ${created.length} orders.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
