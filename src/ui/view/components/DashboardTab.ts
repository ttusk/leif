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

    // Cycle info cards
    const cycleSection = DomHelpers.createElement("div", "corvo-grid corvo-grid-2");
    cycleSection.appendChild(
      this.renderCycleCard("Matéria atual", snapshot.currentSubject?.name ?? "Não definida", "Próxima", snapshot.nextSubject?.name ?? "—")
    );
    cycleSection.appendChild(
      this.renderCycleCard("Item atual", this.formatIdLabel(snapshot.currentItemId), "Próximo", this.formatIdLabel(snapshot.nextItemId))
    );
    container.appendChild(cycleSection);

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

  private renderCycleCard(
    label: string,
    value: string,
    nextLabel: string,
    nextValue: string
  ): HTMLElement {
    const card = DomHelpers.createElement("div", "corvo-card corvo-cycle-card");
    const main = DomHelpers.createElement("div", "corvo-cycle-main");
    const mainLabel = DomHelpers.createElement("span", "corvo-cycle-label");
    mainLabel.textContent = label;
    const mainValue = DomHelpers.createElement("span", "corvo-cycle-value");
    mainValue.textContent = value;
    main.append(mainLabel, mainValue);

    const next = DomHelpers.createElement("div", "corvo-cycle-next");
    const nextLabelEl = DomHelpers.createElement("span", "corvo-cycle-next-label");
    nextLabelEl.textContent = `${nextLabel}: `;
    const nextValueEl = DomHelpers.createElement("span", "corvo-cycle-next-value");
    nextValueEl.textContent = nextValue;
    next.append(nextLabelEl, nextValueEl);

    card.append(main, next);
    return card;
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
