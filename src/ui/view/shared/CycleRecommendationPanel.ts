import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import {
  type ActiveCycleSnapshot,
  GetActiveCycleSnapshotUseCase
} from "@/application/use-cases/GetActiveCycleSnapshotUseCase";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";

interface CycleRecommendationAction {
  label: string;
  onClick: (snapshot: ActiveCycleSnapshot) => void | Promise<void>;
}

export class CycleRecommendationPanel {
  private readonly snapshot: GetActiveCycleSnapshotUseCase;

  constructor(dataStore: PluginDataStore) {
    this.snapshot = new GetActiveCycleSnapshotUseCase(dataStore);
  }

  async render(action?: CycleRecommendationAction): Promise<HTMLElement> {
    const snapshot = await this.snapshot.execute();
    const panel = DomHelpers.createElement("section", "leif-cycle-recommendation");
    panel.setAttribute("aria-label", "Recomendação do ciclo");

    const summary = DomHelpers.createElement("div", "leif-cycle-recommendation-summary");
    summary.append(
      this.renderNow(snapshot),
      this.renderNext(snapshot),
      this.renderReason(snapshot)
    );
    panel.appendChild(summary);

    if (action && snapshot?.currentSubject) {
      panel.appendChild(
        DomHelpers.createButton(action.label, {
          className: "leif-cycle-recommendation-action",
          onClick: async () => {
            await action.onClick(snapshot);
          }
        })
      );
    }

    return panel;
  }

  private renderNow(snapshot: ActiveCycleSnapshot | null): HTMLElement {
    const now = DomHelpers.createElement("div", "leif-cycle-recommendation-now");
    const label = DomHelpers.createElement("span", "leif-cycle-recommendation-label");
    const subject = DomHelpers.createElement("strong", "leif-cycle-recommendation-subject");
    const resource = DomHelpers.createParagraph(
      snapshot?.currentResource?.title ?? "Sem recurso definido"
    );

    label.textContent = "Agora";
    subject.textContent = snapshot?.currentSubject?.name ?? "Sem matéria ativa";
    now.append(label, subject, resource);
    return now;
  }

  private renderNext(snapshot: ActiveCycleSnapshot | null): HTMLElement {
    const next = DomHelpers.createParagraph(
      `Próxima: ${snapshot?.nextSubject?.name ?? "Sem próxima matéria"}`
    );
    next.classList.add("leif-cycle-recommendation-next");
    return next;
  }

  private renderReason(snapshot: ActiveCycleSnapshot | null): HTMLElement {
    const hasNext = Boolean(snapshot?.nextSubject);
    const reason = DomHelpers.createParagraph(
      hasNext ? "Motivo: próxima matéria ativa no ciclo." : "Motivo: não há próxima matéria ativa."
    );
    reason.classList.add("leif-cycle-recommendation-reason");
    return reason;
  }
}
