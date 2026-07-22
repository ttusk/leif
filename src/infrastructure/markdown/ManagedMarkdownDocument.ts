export type MarkdownDocumentErrorCode =
  | "missing-frontmatter"
  | "missing-property"
  | "future-schema"
  | "merge-conflict"
  | "duplicate-region"
  | "malformed-region"
  | "missing-region";

export class MarkdownDocumentError extends Error {
  constructor(
    public readonly code: MarkdownDocumentErrorCode,
    message: string
  ) {
    super(message);
    this.name = "MarkdownDocumentError";
  }
}

export interface MarkdownIdentity {
  type: string;
  schema: number;
  id: string;
}

interface RegionRange {
  startMarkerStart: number;
  startMarkerEnd: number;
  endMarkerStart: number;
  endMarkerEnd: number;
}

const CURRENT_MARKDOWN_SCHEMA = 1;
const MERGE_MARKER = /^(?:<{7}|={7}|>{7})(?:\s|$)/m;
const REGION_MARKER = /<!-- leif:([a-z0-9-]+):(start|end) -->/g;

/**
 * A lossless boundary around a Leif Markdown document. It intentionally knows
 * only the common identity properties and managed markers; domain codecs build
 * on top of it without gaining permission to rewrite user-authored prose.
 */
export class ManagedMarkdownDocument {
  private constructor(
    private readonly source: string,
    public readonly identity: MarkdownIdentity,
    public readonly properties: ReadonlyMap<string, string>,
    private readonly regions: ReadonlyMap<string, RegionRange>,
    private readonly newline: "\n" | "\r\n"
  ) {}

  static parse(source: string): ManagedMarkdownDocument {
    if (MERGE_MARKER.test(source)) {
      throw new MarkdownDocumentError(
        "merge-conflict",
        "Resolve Git or sync conflict markers before Leif writes this document."
      );
    }

    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    const frontmatter = parseFrontmatter(source);
    const type = requiredProperty(frontmatter, "leif-type");
    const id = requiredProperty(frontmatter, "leif-id");
    const schemaText = requiredProperty(frontmatter, "leif-schema");
    const schema = Number(schemaText);

    if (!Number.isInteger(schema) || schema < 1) {
      throw new MarkdownDocumentError(
        "missing-property",
        "leif-schema must be a positive integer."
      );
    }
    if (schema > CURRENT_MARKDOWN_SCHEMA) {
      throw new MarkdownDocumentError(
        "future-schema",
        `Document schema ${schema} requires a newer Leif version.`
      );
    }

    return new ManagedMarkdownDocument(
      source,
      { type, schema, id },
      frontmatter,
      parseRegions(source),
      newline
    );
  }

  readRegion(name: string): string {
    const region = this.regions.get(name);
    if (!region) {
      throw new MarkdownDocumentError("missing-region", `Managed region "${name}" is missing.`);
    }

    return this.source
      .slice(region.startMarkerEnd, region.endMarkerStart)
      .replace(/^\r?\n|\r?\n$/g, "");
  }

  get regionNames(): readonly string[] {
    return [...this.regions.keys()];
  }

  replaceProperties(target: ReadonlyMap<string, string>, managedKeys: ReadonlySet<string>): string {
    const match = this.source.match(/^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
    if (!match) {
      throw new MarkdownDocumentError("missing-frontmatter", "Document frontmatter is missing.");
    }

    const written = new Set<string>();
    const lines = match[2].split(/\r?\n/).flatMap((line) => {
      const separator = line.indexOf(":");
      const key = separator > 0 ? line.slice(0, separator).trim() : "";
      if (!managedKeys.has(key)) return [line];
      const value = target.get(key);
      if (value === undefined) return [];
      written.add(key);
      return [`${key}: ${renderPropertyValue(value)}`];
    });
    managedKeys.forEach((key) => {
      const value = target.get(key);
      if (value !== undefined && !written.has(key)) {
        lines.push(`${key}: ${renderPropertyValue(value)}`);
      }
    });

    return `${match[1]}${lines.join(this.newline)}${match[3]}${this.source.slice(match[0].length)}`;
  }

  replaceRegion(name: string, content: string): string {
    const region = this.regions.get(name);
    if (!region) {
      throw new MarkdownDocumentError("missing-region", `Managed region "${name}" is missing.`);
    }

    const normalizedContent = content.replace(/\r?\n/g, this.newline).replace(/\r?\n$/, "");
    const replacement = `${this.newline}${normalizedContent}${this.newline}`;
    return (
      this.source.slice(0, region.startMarkerEnd) +
      replacement +
      this.source.slice(region.endMarkerStart)
    );
  }
}

function parseFrontmatter(source: string): Map<string, string> {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new MarkdownDocumentError(
      "missing-frontmatter",
      "Leif Markdown documents must begin with YAML frontmatter."
    );
  }

  const properties = new Map<string, string>();
  match[1].split(/\r?\n/).forEach((line) => {
    const separator = line.indexOf(":");
    if (separator < 1) return;
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    properties.set(key, unquote(rawValue));
  });
  return properties;
}

function requiredProperty(properties: ReadonlyMap<string, string>, name: string): string {
  const value = properties.get(name)?.trim();
  if (!value) {
    throw new MarkdownDocumentError("missing-property", `Required property "${name}" is missing.`);
  }
  return value;
}

function parseRegions(source: string): Map<string, RegionRange> {
  const markers = new Map<
    string,
    Array<{ kind: "start" | "end"; markerStart: number; markerEnd: number }>
  >();

  for (const match of source.matchAll(REGION_MARKER)) {
    const name = match[1];
    const markerStart = match.index;
    const found = markers.get(name) ?? [];
    found.push({
      kind: match[2] as "start" | "end",
      markerStart,
      markerEnd: markerStart + match[0].length
    });
    markers.set(name, found);
  }

  const regions = new Map<string, RegionRange>();
  markers.forEach((found, name) => {
    if (found.length > 2) {
      throw new MarkdownDocumentError(
        "duplicate-region",
        `Managed region "${name}" appears more than once.`
      );
    }
    if (found.length !== 2 || found[0].kind !== "start" || found[1].kind !== "end") {
      throw new MarkdownDocumentError(
        "malformed-region",
        `Managed region "${name}" must have one ordered start/end pair.`
      );
    }
    regions.set(name, {
      startMarkerStart: found[0].markerStart,
      startMarkerEnd: found[0].markerEnd,
      endMarkerStart: found[1].markerStart,
      endMarkerEnd: found[1].markerEnd
    });
  });
  return regions;
}

function unquote(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

function renderPropertyValue(value: string): string {
  if (/^(?:true|false|-?\d+(?:\.\d+)?)$/.test(value)) return value;
  return JSON.stringify(value);
}
