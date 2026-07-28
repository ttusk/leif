import {
  Schema2Document,
  Schema2DocumentError,
  type Schema2DocumentErrorCode
} from "./Schema2Document";
import { Schema2DomainCodec, Schema2DomainCodecError } from "./Schema2DomainCodec";
import {
  Schema2WorkspaceIndex,
  Schema2WorkspaceIndexError,
  type Schema2MarkdownFile
} from "./Schema2WorkspaceIndex";

export type Schema2DiagnosticSeverity = "erro" | "aviso" | "info";

export interface Schema2Diagnostic {
  code: string;
  severity: Schema2DiagnosticSeverity;
  path?: string;
  message: string;
  guidance: string;
}

const DOCUMENT_ERROR_CODES: Record<Schema2DocumentErrorCode, string> = {
  "missing-frontmatter": "SCHEMA2_MISSING_FRONTMATTER",
  "missing-property": "SCHEMA2_MISSING_PROPERTY",
  "future-schema": "SCHEMA2_FUTURE_SCHEMA",
  "merge-conflict": "SCHEMA2_MERGE_CONFLICT",
  "invalid-heading": "SCHEMA2_INVALID_HEADING",
  "duplicate-region": "SCHEMA2_DUPLICATE_REGION",
  "malformed-region": "SCHEMA2_MALFORMED_REGION",
  "missing-region": "SCHEMA2_MISSING_REGION"
};

const WORKSPACE_ERROR_CODES: Record<Schema2WorkspaceIndexError["code"], string> = {
  "duplicate-id": "SCHEMA2_DUPLICATE_ID",
  "unknown-source": "SCHEMA2_UNKNOWN_SOURCE",
  "missing-link-target": "SCHEMA2_BROKEN_WIKILINK",
  "ambiguous-link": "SCHEMA2_AMBIGUOUS_WIKILINK"
};

const DOMAIN_ERROR_CODES: Record<Schema2DomainCodecError["code"], string> = {
  "missing-parent": "SCHEMA2_MISSING_PARENT",
  "invalid-property": "SCHEMA2_INVALID_PROPERTY",
  "invalid-link-target": "SCHEMA2_INVALID_LINK_TARGET",
  "cross-subject-link": "SCHEMA2_CROSS_SUBJECT_LINK"
};

export class Schema2WorkspaceValidator {
  static validate(files: readonly Schema2MarkdownFile[]): Schema2Diagnostic[] {
    const diagnostics = validateDocuments(files);
    diagnostics.push(...validateDuplicateIds(files));
    if (diagnostics.length > 0) return diagnostics;

    try {
      const index = Schema2WorkspaceIndex.build(files);
      Schema2DomainCodec.decode(index);
      return [];
    } catch (error) {
      return [diagnosticFromError(error)];
    }
  }
}

export function renderSchema2DiagnosticsMarkdown(
  diagnostics: readonly Schema2Diagnostic[],
  timestamp = new Date().toISOString()
): string {
  const result = diagnostics.length === 0 ? "sem problemas" : "com problemas";
  return [
    "# Diagnósticos Leif",
    "",
    `Validado em: ${timestamp}`,
    "",
    `Resultado: ${result}`,
    "",
    "| Código | Severidade | Caminho | Mensagem | Como corrigir |",
    "| --- | --- | --- | --- | --- |",
    ...(diagnostics.length === 0
      ? ["| SCHEMA2_OK | info | - | Nenhum problema encontrado. | Nenhuma ação necessária. |"]
      : diagnostics.map(
          (diagnostic) =>
            `| ${diagnostic.code} | ${diagnostic.severity} | ${diagnostic.path ?? "-"} | ${escapeTableCell(diagnostic.message)} | ${escapeTableCell(diagnostic.guidance)} |`
        )),
    ""
  ].join("\n");
}

function validateDocuments(files: readonly Schema2MarkdownFile[]): Schema2Diagnostic[] {
  return files.flatMap((file) => {
    try {
      Schema2Document.parse(file.content);
      return [];
    } catch (error) {
      return [diagnosticFromError(error, file.path)];
    }
  });
}

function validateDuplicateIds(files: readonly Schema2MarkdownFile[]): Schema2Diagnostic[] {
  const ids = new Map<string, string>();
  const diagnostics: Schema2Diagnostic[] = [];
  files.forEach((file) => {
    try {
      const document = Schema2Document.parse(file.content);
      const duplicatePath = ids.get(document.identity.id);
      if (duplicatePath) {
        diagnostics.push({
          code: "SCHEMA2_DUPLICATE_ID",
          severity: "erro",
          path: file.path,
          message: `O ID ${document.identity.id} aparece em mais de um documento.`,
          guidance: `Compare ${duplicatePath} e ${file.path}; mantenha o ID original apenas no documento correto.`
        });
      } else {
        ids.set(document.identity.id, file.path);
      }
    } catch {
      // Document-level diagnostics already explain why this file cannot join the index.
    }
  });
  return diagnostics;
}

function diagnosticFromError(error: unknown, path?: string): Schema2Diagnostic {
  if (error instanceof Schema2DocumentError) {
    return {
      code: DOCUMENT_ERROR_CODES[error.code],
      severity: "erro",
      path,
      message: documentMessage(error),
      guidance: documentGuidance(error)
    };
  }
  if (error instanceof Schema2WorkspaceIndexError) {
    return {
      code: WORKSPACE_ERROR_CODES[error.code],
      severity: "erro",
      path,
      message: workspaceMessage(error),
      guidance: workspaceGuidance(error)
    };
  }
  if (error instanceof Schema2DomainCodecError) {
    return {
      code: DOMAIN_ERROR_CODES[error.code],
      severity: "erro",
      path,
      message: domainMessage(error),
      guidance: domainGuidance(error)
    };
  }
  return {
    code: "SCHEMA2_UNKNOWN_ERROR",
    severity: "erro",
    path,
    message: error instanceof Error ? error.message : "Erro desconhecido.",
    guidance: "Revise o workspace Leif e execute a validação novamente."
  };
}

function documentMessage(error: Schema2DocumentError): string {
  switch (error.code) {
    case "future-schema":
      return "Este documento foi criado por uma versão mais nova do Leif.";
    case "merge-conflict":
      return "O documento contém marcadores de conflito.";
    case "missing-frontmatter":
      return "O documento não começa com frontmatter YAML.";
    case "missing-property":
      return "Uma propriedade obrigatória do protocolo Leif está ausente ou inválida.";
    case "invalid-heading":
      return "O documento precisa conter exatamente um título H1.";
    case "duplicate-region":
      return "Uma região gerenciada aparece mais de uma vez.";
    case "malformed-region":
      return "Uma região gerenciada está sem par start/end válido.";
    case "missing-region":
      return "Uma região gerenciada obrigatória não foi encontrada.";
  }
}

function documentGuidance(error: Schema2DocumentError): string {
  switch (error.code) {
    case "future-schema":
      return "Atualize o plugin antes de editar este documento.";
    case "merge-conflict":
      return "Resolva o conflito no Markdown antes de sincronizar.";
    case "missing-frontmatter":
      return "Adicione leif-type, leif-schema: 2 e leif-id no frontmatter.";
    case "missing-property":
      return "Confira leif-type, leif-schema e leif-id.";
    case "invalid-heading":
      return "Mantenha apenas um título começando com # no documento.";
    case "duplicate-region":
    case "malformed-region":
    case "missing-region":
      return "Recrie os marcadores <!-- leif:<regiao>:start --> e <!-- leif:<regiao>:end -->.";
  }
}

function workspaceMessage(error: Schema2WorkspaceIndexError): string {
  switch (error.code) {
    case "duplicate-id":
      return "Há documentos Leif com o mesmo ID interno.";
    case "missing-link-target":
      return "Um wikilink aponta para um documento que não existe.";
    case "ambiguous-link":
      return "Um wikilink pode apontar para mais de um documento.";
    case "unknown-source":
      return "Um wikilink foi resolvido a partir de um documento desconhecido.";
  }
}

function workspaceGuidance(error: Schema2WorkspaceIndexError): string {
  switch (error.code) {
    case "duplicate-id":
      return "Mantenha cada leif-id em apenas um documento ou deixe o Leif reparar uma cópia segura.";
    case "missing-link-target":
      return "Atualize o wikilink para um documento existente no concurso.";
    case "ambiguous-link":
      return "Troque o wikilink por um caminho mais específico.";
    case "unknown-source":
      return "Inclua o documento de origem no workspace antes de validar.";
  }
}

function domainMessage(error: Schema2DomainCodecError): string {
  switch (error.code) {
    case "missing-parent":
      return "Um documento está fora do caminho canônico esperado.";
    case "invalid-property":
      return "Uma propriedade de domínio está ausente ou inválida.";
    case "invalid-link-target":
      return "Um link aponta para um tipo de documento incompatível.";
    case "cross-subject-link":
      return "Um recurso ou registro aponta para assunto/recurso de outra matéria.";
  }
}

function domainGuidance(error: Schema2DomainCodecError): string {
  switch (error.code) {
    case "missing-parent":
      return "Mova o arquivo para a pasta canônica de concurso, matéria, recurso, assunto ou sessão.";
    case "invalid-property":
      return "Revise os campos obrigatórios e os grupos coerentes como meta/unidade.";
    case "invalid-link-target":
      return "Ajuste o link para apontar para o tipo de documento esperado.";
    case "cross-subject-link":
      return "Use apenas assuntos e recursos que pertencem à mesma matéria.";
  }
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
