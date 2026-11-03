// @vitest-environment node
// The extension tool: find_cheapest_in_stock. Stock is faked so each case
// controls exactly what's on the shelf.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InventoryRow } from "@/lib/copper/inventory";

let stock: InventoryRow[] | null = null;

vi.mock("@/lib/copper/inventory", () => ({
  readInventory: async () => (stock ? structuredClone(stock) : null),
}));

const row = (
  product: string,
  color: string,
  units_in_stock: number,
): InventoryRow => ({
  sku: `${product}-${color}`,
  product,
  color,
  units_in_stock,
  next_shipment: "2026-12-01",
});

const everythingIn = (units: number) => [
  row("Copper Home", "Polished Copper", units),
  row("Copper Home", "Patina Teal", units),
  row("Copper Home", "Night Sky", units),
  row("Copper Notes", "Brushed Copper", units),
  row("Copper Notes", "Desert Sand", units),
  row("Copper Notes", "Night Sky", units),
];

async function loadTools() {
  return import("@/lib/copper/assistant/tools");
}

describe("find_cheapest_in_stock", () => {
  beforeEach(() => {
    stock = everythingIn(50);
  });

  it("returns the cheapest product with its price and in-stock colors", async () => {
    const { findCheapestInStock } = await loadTools();
    const result = await findCheapestInStock();
    expect(result).toEqual({
      status: "ok",
      product: "Copper Notes",
      priceUsd: 129,
      colors: [
        { color: "Brushed Copper", stock: "in_stock" },
        { color: "Desert Sand", stock: "in_stock" },
        { color: "Night Sky", stock: "in_stock" },
      ],
    });
  });

  it("skips back-ordered colors and keeps low-stock ones", async () => {
    stock = [
      ...everythingIn(50).filter((r) => r.product === "Copper Home"),
      row("Copper Notes", "Brushed Copper", 0),
      row("Copper Notes", "Desert Sand", 3),
      row("Copper Notes", "Night Sky", 0),
    ];
    const { findCheapestInStock } = await loadTools();
    expect(await findCheapestInStock()).toMatchObject({
      status: "ok",
      product: "Copper Notes",
      colors: [{ color: "Desert Sand", stock: "low_stock" }],
    });
  });

  it("moves on to the next product when the cheapest has nothing in stock", async () => {
    stock = [
      ...everythingIn(50).filter((r) => r.product === "Copper Home"),
      ...everythingIn(0).filter((r) => r.product === "Copper Notes"),
    ];
    const { findCheapestInStock } = await loadTools();
    expect(await findCheapestInStock()).toMatchObject({
      status: "ok",
      product: "Copper Home",
      priceUsd: 149,
    });
  });

  it("says so when nothing is in stock", async () => {
    stock = everythingIn(0);
    const { findCheapestInStock } = await loadTools();
    expect(await findCheapestInStock()).toEqual({ status: "none_in_stock" });
  });

  it("says stock can't be checked, instead of guessing, when stock can't be read", async () => {
    stock = null;
    const { findCheapestInStock } = await loadTools();
    const result = await findCheapestInStock();
    expect(result.status).toBe("unavailable");
    expect(JSON.stringify(result)).not.toMatch(/in_stock|low_stock/);
  });

  it("is one of Copper's tools, with a description", async () => {
    const { copperTools } = await loadTools();
    expect(Object.keys(copperTools)).toContain("find_cheapest_in_stock");
    expect(copperTools.find_cheapest_in_stock.description).toMatch(/cheapest/i);
  });
});
