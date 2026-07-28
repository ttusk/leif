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
          await this.onNavigate("sessions", {
            subjectId: snapshot.currentSubject.id,
            resourceId: snapshot.currentResource?.id
          });
        }
      })
    );

    const summary = await this.summary.execute();
    const card = DomHelpers.createCard("Resumo por matéria");
    summary.subjectSummaries.forEach((subject) => {
      const row = DomHelpers.createElement("div", "leif-summary-row");
      row.append(
        DomHelpers.createStrong(subject.subjectName),
        DomHelpers.createMetric("Sessões", String(subject.totalSessions)),
        DomHelpers.createMetric("Páginas", String(subject.pagesRead)),
        DomHelpers.createMetric("Questões", String(subject.questionsSolved))
      );
      card.appendChild(row);
    });
    container.appendChild(card);
  }
}
