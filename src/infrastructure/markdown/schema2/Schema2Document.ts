export type Schema2DocumentErrorCode =
  | "missing-frontmatter"
  | "missing-property"
  | "future-schema"
  | "merge-conflict"
  | "invalid-heading"
  | "duplicate-region"
  | "malformed-region"
  | "missing-region";

export class Schema2DocumentError extends Error {
  constructor(
    public readonly code: Schema2DocumentErrorCode,
    message: string
  ) {
    super(message);
    this.name = "Schema2DocumentError";
  }
}

export interface Schema2Identity {
  type: string;
  schema: 2;
  id: string;
}

export interface WikiLink {
  target: string;
  alias?: string;
}

interface RegionRange {
  startMarkerEnd: number;
  endMarkerStart: number;
}

const CURRENT_MARKDOWN_SCHEMA = 2;
const MERGE_MARKER = /^(?:<{7}|={7}|>{7})(?:\s|$)/m;
const REGION_MARKER = /<!-- leif:([a-z0-9-]+):(start|end) -->/g;

/**
 * Lossless-ish schema-2 document boundary. It owns common protocol metadata,
 * the canonical H1 title, and managed regions; entity-specific codecs layer on
 * top without permission to rewrite unmanaged prose.
 */
export class Schema2Document {
  private constructor(
    private readonly source: string,
    public readonly identity: Schema2Identity,
    public readonly title: string,
    private readonly properties: ReadonlyMap<string, string>,
    private readonly regions: ReadonlyMap<string, RegionRange>,
    private readonly newline: "\n" | "\r\n"
  ) {}

  static parse(source: string): Schema2Document {
    if (MERGE_MARKER.test(source)) {
      throw new Schema2DocumentError(
        "merge-conflict",
        "Resolve conflict markers before Leif writes this document."
      );
    }

    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    const properties = parseFrontmatter(source);
    const type = requiredProperty(properties, "leif-type");
    const id = requiredProperty(properties, "leif-id");
    const schema = Number(requiredProperty(properties, "leif-schema"));
    if (!Number.isInteger(schema) || schema < 1) {
      throw new Schema2DocumentError("missing-property", "leif-schema must be a positive integer.");
    }
    if (schema > CURRENT_MARKDOWN_SCHEMA) {
      throw new Schema2DocumentError(
        "future-schema",
        `Document schema ${schema} was created by a newer Leif version.`
      );
    }
    if (schema !== CURRENT_MARKDOWN_SCHEMA) {
      throw new Schema2DocumentError(
        "future-schema",
        "Schema 2 documents must use leif-schema: 2."
      );
    }

    return new Schema2Document(
      source,
      { type, schema: 2, id },
      parseSingleH1(source),
      properties,
      parseRegions(source),
      newline
    );
  }

  property(name: string): string | undefined {
    return this.properties.get(name);
  }

  readRegion(name: string): string {
    const region = this.regions.get(name);
    if (!region) {
      throw new Schema2DocumentError("missing-region", `Managed region "${name}" is missing.`);
    }
    return this.source
      .slice(region.startMarkerEnd, region.endMarkerStart)
      .replace(/^\r?\n|\r?\n$/g, "");
  }

  replaceProperties(
    values: ReadonlyMap<string, string | undefined>,
    managedKeys: ReadonlySet<string>
  ): Schema2Document {
    const match = this.source.match(/^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
    if (!match) {
      throw new Schema2DocumentError("missing-frontmatter", "Document frontmatter is missing.");
    }

    const written = new Set<string>();
    const lines = match[2].split(/\r?\n/).flatMap((line) => {
      const separator = line.indexOf(":");
      const key = separator > 0 ? line.slice(0, separator).trim() : "";
      if (!managedKeys.has(key)) return [line];
      const value = values.get(key);
      if (value === undefined) return [];
      written.add(key);
      return [`${key}: ${renderPropertyValue(value)}`];
    });

    managedKeys.forEach((key) => {
      const value = values.get(key);
      if (value !== undefined && !written.has(key)) {
        lines.push(`${key}: ${renderPropertyValue(value)}`);
      }
    });

    return Schema2Document.parse(
      `${match[1]}${lines.join(this.newline)}${match[3]}${this.source.slice(match[0].length)}`
    );
  }

  replaceTitle(title: string): Schema2Document {
    return Schema2Document.parse(this.source.replace(/^#\s+.+$/m, `# ${title}`));
  }

  replaceRegion(name: string, content: string): Schema2Document {
    const region = this.regions.get(name);
    if (!region) {
      throw new Schema2DocumentError("missing-region", `Managed region "${name}" is missing.`);
    }
    const normalizedContent = content.replace(/\r?\n/g, this.newline).replace(/\r?\n$/, "");
    return Schema2Document.parse(
      `${this.source.slice(0, region.startMarkerEnd)}${this.newline}${normalizedContent}${this.newline}${this.source.slice(region.endMarkerStart)}`
    );
  }

  toString(): string {
    return this.source;
  }
}

export function parseWikiLinkList(source: string): WikiLink[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:[-*]|\d+\.)\s+\[\[([^\]|]+)(?:\|([^\]]+))?\]\]\s*$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({
      target: match[1],
      ...(match[2] ? { alias: match[2] } : {})
    }));
}

export function renderWikiLinkList(links: readonly WikiLink[], ordered = true): string {
  return links
    .map((link, index) => {
      const marker = ordered ? `${index + 1}.` : "-";
      const alias = link.alias ? `|${link.alias}` : "";
      return `${marker} [[${link.target}${alias}]]`;
    })
    .join("\n");
}

function parseFrontmatter(source: string): Map<string, string> {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new Schema2DocumentError(
      "missing-frontmatter",
      "Leif Markdown documents must begin with YAML frontmatter."
    );
  }

  const properties = new Map<string, string>();
  match[1].split(/\r?\n/).forEach((line) => {
    const separator = line.indexOf(":");
    if (separator < 1) return;
    properties.set(line.slice(0, separator).trim(), unquote(line.slice(separator + 1).trim()));
  });
  return properties;
}

function parseSingleH1(source: string): string {
  const titles = [...source.matchAll(/^#\s+(.+)$/gm)].map((match) => match[1].trim());
  if (titles.length !== 1) {
    throw new Schema2DocumentError(
      "invalid-heading",
      "Schema 2 documents must contain exactly one H1."
    );
  }
  return titles[0];
}

function requiredProperty(properties: ReadonlyMap<string, string>, name: string): string {
  const value = properties.get(name)?.trim();
  if (!value) {
    throw new Schema2DocumentError("missing-property", `Required property "${name}" is missing.`);
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
    markers.set(name, [
      ...(markers.get(name) ?? []),
      {
        kind: match[2] as "start" | "end",
        markerStart,
        markerEnd: markerStart + match[0].length
      }
    ]);
  }

  const regions = new Map<string, RegionRange>();
  markers.forEach((found, name) => {
    if (found.length > 2) {
      throw new Schema2DocumentError(
        "duplicate-region",
        `Managed region "${name}" appears more than once.`
      );
    }
    if (found.length !== 2 || found[0].kind !== "start" || found[1].kind !== "end") {
      throw new Schema2DocumentError(
        "malformed-region",
        `Managed region "${name}" must have one ordered start/end pair.`
      );
    }
    regions.set(name, {
      startMarkerEnd: found[0].markerEnd,
      endMarkerStart: found[1].markerStart
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
  if (/^[A-Za-z0-9_-]+$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return JSON.stringify(value);
}
