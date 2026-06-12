import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { GetActiveContestSummaryUseCase } from "@/application/use-cases/GetActiveContestSummaryUseCase";
import { GetActiveCycleSnapshotUseCase } from "@/application/use-cases/GetActiveCycleSnapshotUseCase";
import type { CorvoPluginData } from "@/domain/types/CorvoPluginData";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";

/**
 * Dashboard tab component - shows contest overview and summary.
 */
export class DashboardTab {
  private readonly getActiveCycleSnapshotUseCase: GetActiveCycleSnapshotUseCase;
  private readonly getActiveContestSummaryUseCase: GetActiveContestSummaryUseCase;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    this.getActiveCycleSnapshotUseCase = new GetActiveCycleSnapshotUseCase(dataStore);
    this.getActiveContestSummaryUseCase = new GetActiveContestSummaryUseCase(dataStore);
  }

  /**
   * Renders the dashboard tab content.
   */
  async render(container: HTMLElement, data: CorvoPluginData): Promise<void> {
    const activeContest = data.contests.find((contest) => contest.id === data.activeContestId) ?? null;

    if (!activeContest) {
      container.append(
        DomHelpers.createSectionTitle("Dashboard"),
        DomHelpers.createEmptyState(
          "Nenhum concurso ativo",
          "Crie um concurso na aba Concursos para começar."
        )
      );
      return;
    }

    const snapshot = await this.getActiveCycleSnapshotUseCase.execute();
    const summary = await this.getActiveContestSummaryUseCase.execute();

    container.appendChild(DomHelpers.createSectionTitle("Dashboard"));
    container.appendChild(
      DomHelpers.createParagraph("Visão geral do concurso ativo.")
    );

    // Cycle control overview
    const overview = DomHelpers.createCard("Controle do ciclo");
    overview.appendChild(
      DomHelpers.createTable(
        ["Campo", "Valor"],
        [
          ["Concurso ativo", activeContest.name],
          ["Matéria atual", snapshot.currentSubject?.name ?? "Não definida"],
          ["Próxima matéria", snapshot.nextSubject?.name ?? "Não definida"],
          ["Item atual", this.formatIdLabel(snapshot.currentItemId)],
          ["Próximo item", this.formatIdLabel(snapshot.nextItemId)]
        ]
      )
    );
    container.appendChild(overview);

    // Subject summary card
    const subjectSummaryCard = DomHelpers.createCard("Resumo por matéria");
    subjectSummaryCard.appendChild(
      DomHelpers.createTable(
        ["Matéria", "Sessões", "PDF", "Questões", "Acerto"],
        summary.subjectSummaries.map((subjectSummary) => [
          subjectSummary.subjectName,
          String(subjectSummary.totalSessions),
          String(subjectSummary.pdfProgressCount),
          String(subjectSummary.questionProgressCount),
          subjectSummary.questionAccuracy === null
            ? "-"
            : `${Math.round(subjectSummary.questionAccuracy * 100)}%`
        ])
      )
    );
    container.appendChild(subjectSummaryCard);
  }

  /**
   * Formats an ID label for display.
   */
  private formatIdLabel(id: string | null): string {
    if (!id) return "Não definido";
    const parts = id.split("-");
    return parts.length > 0 ? parts[parts.length - 1] : id;
  }
}
