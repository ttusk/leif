import { describe, expect, it } from "vitest";

import { CsvExportService } from "@/domain/services/CsvExportService";

describe("CsvExportService", () => {
  it("returns only the BOM for an empty record set", () => {
    expect(CsvExportService.export([])).toBe("\uFEFF");
  });

  it("emits a header row followed by one row per record", () => {
    const csv = CsvExportService.export([
      { A: 1, B: "two" },
      { A: 3, B: "four" }
    ]);

    expect(csv).toBe("\uFEFFA,B\n1,two\n3,four");
  });

  it("escapes values containing commas, quotes or newlines", () => {
    const csv = CsvExportService.export([
      { Name: 'a,b', Quote: 'say "hi"', Multi: "line1\nline2" }
    ]);

    expect(csv).toBe('\uFEFFName,Quote,Multi\n"a,b","say ""hi""","line1\nline2"');
  });

  it("renders undefined and null values as empty cells", () => {
    const csv = CsvExportService.export([{ A: undefined, B: null, C: "x" }]);
    expect(csv).toBe("\uFEFFA,B,C\n,,x");
  });
});
