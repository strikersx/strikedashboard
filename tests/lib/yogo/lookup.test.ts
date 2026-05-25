import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCustomerCache, findCustomerByPhone } from "../../../src/lib/yogo/lookup";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("../../../src/lib/yogo/fetch", () => ({
  yogoFetch: fetchMock,
}));

afterEach(() => {
  clearCustomerCache();
  fetchMock.mockReset();
});

function okWith(rows: unknown[]) {
  return { ok: true, status: 200, data: { customers: rows, headers: [] }, rawText: "" };
}

describe("findCustomerByPhone", () => {
  it("returns null for unparseable input", async () => {
    fetchMock.mockResolvedValue(okWith([]));
    expect(await findCustomerByPhone("not-a-phone")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hits when a stored phone matches via any variant (PT national 9-digit)", async () => {
    fetchMock.mockResolvedValue(
      okWith([{ id: 42, first_name: "Ana", phone: "+351912345678" }]),
    );
    const hit = await findCustomerByPhone("+351912345678");
    expect(hit?.id).toBe(42);
  });

  it("matches when caller sends bare national and Yogo stores international", async () => {
    fetchMock.mockResolvedValue(okWith([{ id: 7, phone: "351912345678" }]));
    // Caller probes with E.164; the index built from Yogo "351912345678" indexed
    // all 3 variants (+351..., 351..., 912...) and the +351 lookup hits.
    const hit = await findCustomerByPhone("+351912345678");
    expect(hit?.id).toBe(7);
  });

  it("returns null when no customer matches any variant", async () => {
    fetchMock.mockResolvedValue(okWith([{ id: 1, phone: "+351999000111" }]));
    expect(await findCustomerByPhone("+351912345678")).toBeNull();
  });

  it("reuses the cache across calls (single fetch round)", async () => {
    fetchMock.mockResolvedValue(okWith([{ id: 42, phone: "+351912345678" }]));
    await findCustomerByPhone("+351912345678");
    await findCustomerByPhone("+351912345678");
    await findCustomerByPhone("+351933444555"); // miss
    // Two queries (cold-leads union + members union) per cache build.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rebuilds the cache after clearCustomerCache()", async () => {
    fetchMock.mockResolvedValue(okWith([{ id: 42, phone: "+351912345678" }]));
    await findCustomerByPhone("+351912345678");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    clearCustomerCache();
    await findCustomerByPhone("+351912345678");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("skips records with empty phone field", async () => {
    fetchMock.mockResolvedValue(
      okWith([
        { id: 1, phone: "" },
        { id: 2, phone: null },
        { id: 3, phone: "+351912345678" },
      ]),
    );
    expect((await findCustomerByPhone("+351912345678"))?.id).toBe(3);
  });
});
