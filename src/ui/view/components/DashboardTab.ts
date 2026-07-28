import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { GetActiveContestSummaryUseCase } from "@/application/use-cases/GetActiveContestSummaryUseCase";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import type { LeifTabId } from "@/ui/constants";
import { CycleRecommendationPanel } from "@/ui/view/shared/CycleRecommendationPanel";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";

export interface RecommendedStudyRegistration {
  subjectId: string;
  resourceId?: string;
}

export class DashboardTab {
  private readonly recommendation: CycleRecommendationPanel;
  private readonly summary: GetActiveContestSummaryUseCase;

  constructor(
    dataStore: PluginDataStore,
    private readonly onNavigate: (
      tabId: LeifTabId,
      registration?: RecommendedStudyRegistration
    ) => Promise<void>
  ) {
    this.recommendation = new CycleRecommendationPanel(dataStore);
    this.summary = new GetActiveContestSummaryUseCase(dataStore);
  }

  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    container.appendChild(DomHelpers.createSectionTitle("Hoje"));
    const contest = data.contests.find((entry) => entry.id === data.activeContestId);
    if (!contest) {
      container.appendChild(
        DomHelpers.createEmptyState("Sem concurso ativo", "Crie ou escolha um concurso.")
      );
      return;
    }

    container.appendChild(
      await this.recommendation.render({
        label: "Registrar",
        onClick: async (snapshot) => {
          if (!snapshot.currentSubject) return;
          await this.onNavigate("records", {
            subjectId: snapshot.currentSubject.id,
            resourceId: snapshot.currentResource?.id
          });
        }
      })
    );

    const summary = await this.summary.execute();
    const card = DomHelpers.createCard("Resumo por matéria");
    const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
      "Matéria",
      "Registros",
      "Páginas",
      "Questões"
    ]);
    tableContainer.querySelector("table")?.classList.add("leif-summary-table");
    summary.subjectSummaries.forEach((subject) => {
      const row = DomHelpers.createElement("tr");
      row.dataset.subjectId = subject.subjectId;
      row.append(
        DomHelpers.createNameCell(subject.subjectName),
        DomHelpers.createNumericCell(String(subject.totalRecords)),
        DomHelpers.createNumericCell(String(subject.pagesRead)),
        DomHelpers.createNumericCell(String(subject.questionsSolved))
      );
      tbody.appendChild(row);
    });
    card.appendChild(tableContainer);
    container.appendChild(card);
  }
}
