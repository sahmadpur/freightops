import { describe, expect, it } from "vitest";
import { aznPerUnit, aznRateFor, cbarUrl, isOrderCurrency, parseCbarRates } from "./fx";

/** Trimmed from the real 05.08.2026 bulletin, whitespace and all. */
const BULLETIN = `<?xml version="1.0" encoding="UTF-8"?>
<ValCurs Date="05.08.2026" Name="AZN məzənnələri">
    <ValType Type="Bank metalları">
        <Valute Code="XAU">
            <Nominal>1 t.u.</Nominal>
            <Name>Qızıl</Name>
            <Value>7030.3585</Value>
        </Valute>
    </ValType>
    <ValType Type="Xarici valyutalar">
                            <Valute Code="USD">
                        <Nominal>1</Nominal>
                        <Name>1 ABŞ dolları</Name>
                        <Value>1.7</Value>
            </Valute>
            <Valute Code="EUR">
                <Nominal>1</Nominal>
                <Name>1 Avro</Name>
                <Value>1.961</Value>
            </Valute>
            <Valute Code="RUB">
                <Nominal>100</Nominal>
                <Name>100 Rusiya rublu</Name>
                <Value>2.1443</Value>
            </Valute>
    </ValType>
</ValCurs>`;

describe("cbarUrl", () => {
  it("builds the DD.MM.YYYY bulletin URL from an ISO date", () => {
    expect(cbarUrl("2026-08-05")).toBe("https://www.cbar.az/currencies/05.08.2026.xml");
    expect(cbarUrl("2026-12-31")).toBe("https://www.cbar.az/currencies/31.12.2026.xml");
  });
});

describe("parseCbarRates", () => {
  const rates = parseCbarRates(BULLETIN);

  it("extracts currencies with their nominal", () => {
    expect(rates.USD).toEqual({ nominal: 1, value: 1.7 });
    expect(rates.EUR).toEqual({ nominal: 1, value: 1.961 });
    expect(rates.RUB).toEqual({ nominal: 100, value: 2.1443 });
  });

  it("skips bank metals, whose nominal is not a number", () => {
    expect(rates.XAU).toBeUndefined();
  });

  it("returns nothing for junk instead of throwing", () => {
    expect(parseCbarRates("")).toEqual({});
    expect(parseCbarRates("<html>404 not found</html>")).toEqual({});
  });
});

describe("aznPerUnit", () => {
  it("divides the quoted value by its nominal", () => {
    expect(aznPerUnit({ nominal: 1, value: 1.7 })).toBeCloseTo(1.7, 6);
    expect(aznPerUnit({ nominal: 100, value: 2.1443 })).toBeCloseTo(0.021443, 8);
  });
});

describe("aznRateFor", () => {
  const rates = parseCbarRates(BULLETIN);

  it("formats to 4 decimals", () => {
    expect(aznRateFor("USD", rates)).toBe("1.7000");
    expect(aznRateFor("EUR", rates)).toBe("1.9610");
    expect(aznRateFor("RUB", rates)).toBe("0.0214");
  });

  it("treats AZN as the identity without consulting the bulletin", () => {
    expect(aznRateFor("AZN", {})).toBe("1.0000");
  });

  it("returns null for a currency the bulletin doesn't quote", () => {
    expect(aznRateFor("GBP", rates)).toBeNull();
  });
});

describe("isOrderCurrency", () => {
  it("accepts only the five supported currencies", () => {
    expect(isOrderCurrency("USD")).toBe(true);
    expect(isOrderCurrency("TRY")).toBe(true);
    expect(isOrderCurrency("GBP")).toBe(false);
    expect(isOrderCurrency("usd")).toBe(false);
  });
});
