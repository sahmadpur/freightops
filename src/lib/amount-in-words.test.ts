import { describe, expect, it } from "vitest";
import { amountInWords } from "./amount-in-words";

describe("amountInWords — Azerbaijani (authoritative)", () => {
  it("matches the client template example (714.00 AZN)", () => {
    expect(amountInWords(71400, "AZN", "az")).toBe("Yeddi yüz on dörd manat 00 qəpik");
  });
  it("spells 100 as 'yüz' without a leading 'bir'", () => {
    expect(amountInWords(10000, "AZN", "az")).toBe("Yüz manat 00 qəpik");
  });
  it("spells 1000 as 'min' and 2000 as 'iki min'", () => {
    expect(amountInWords(100000, "AZN", "az")).toBe("Min manat 00 qəpik");
    expect(amountInWords(200000, "AZN", "az")).toBe("İki min manat 00 qəpik");
  });
  it("keeps 'bir milyon' for the million group", () => {
    expect(amountInWords(100000000, "AZN", "az")).toBe("Bir milyon manat 00 qəpik");
  });
  it("renders qəpik from the fractional part", () => {
    expect(amountInWords(71455, "AZN", "az")).toBe("Yeddi yüz on dörd manat 55 qəpik");
  });
});

describe("amountInWords — Russian plural/gender agreement", () => {
  it("agrees the manat noun with the amount", () => {
    expect(amountInWords(100, "AZN", "ru")).toBe("Один манат 00 гяпиков");
    expect(amountInWords(300, "AZN", "ru")).toBe("Три маната 00 гяпиков");
    expect(amountInWords(500, "AZN", "ru")).toBe("Пять манатов 00 гяпиков");
    expect(amountInWords(1100, "AZN", "ru")).toBe("Одиннадцать манатов 00 гяпиков");
  });
  it("uses feminine one/two for the thousands group", () => {
    expect(amountInWords(100000, "AZN", "ru")).toBe("Одна тысяча манатов 00 гяпиков");
    expect(amountInWords(200000, "AZN", "ru")).toBe("Две тысячи манатов 00 гяпиков");
  });
  it("agrees the minor (kopeck) noun", () => {
    // 714 → last two digits 14 fall in the 11–14 "many" class → "манатов".
    expect(amountInWords(71401, "AZN", "ru")).toBe("Семьсот четырнадцать манатов 01 гяпик");
    expect(amountInWords(71404, "AZN", "ru")).toBe("Семьсот четырнадцать манатов 04 гяпика");
  });
});

describe("amountInWords — English and USD", () => {
  it("spells USD with cents", () => {
    expect(amountInWords(71400, "USD", "en")).toBe("Seven hundred fourteen dollars and 00 cents");
    expect(amountInWords(100, "USD", "en")).toBe("One dollar and 00 cents");
  });
  it("hyphenates compound tens", () => {
    expect(amountInWords(4200, "USD", "en")).toBe("Forty-two dollars and 00 cents");
  });
});

describe("amountInWords — EUR and RUB", () => {
  it("spells EUR per language", () => {
    expect(amountInWords(10000, "EUR", "en")).toBe("One hundred euros and 00 cents");
    expect(amountInWords(10000, "EUR", "az")).toBe("Yüz avro 00 sent");
    // "евро" is indeclinable; only the cents agree.
    expect(amountInWords(10000, "EUR", "ru")).toBe("Сто евро 00 центов");
  });
  it("agrees the Russian ruble and kopeck nouns", () => {
    expect(amountInWords(100, "RUB", "ru")).toBe("Один рубль 00 копеек");
    expect(amountInWords(300, "RUB", "ru")).toBe("Три рубля 00 копеек");
    expect(amountInWords(50001, "RUB", "ru")).toBe("Пятьсот рублей 01 копейка");
  });
  it("spells RUB in English and Azerbaijani", () => {
    expect(amountInWords(100, "RUB", "en")).toBe("One ruble and 00 kopecks");
    expect(amountInWords(20050, "RUB", "az")).toBe("İki yüz rubl 50 qəpik");
  });
});
