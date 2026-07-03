import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";

export interface SelectedSubject {
  id: string;
  name: string;
}

/**
 * Shared subject-picker helpers used by tabs that operate per-subject
 * (Items, Topics) and by LeifView for its selection state.
 */
export class SubjectPicker {
  static getSelectedSubject(
    data: LeifPluginData,
    selectedSubjectId: string | null
  ): SelectedSubject | null {
    const subjects = data.subjects
      .filter((subject) => subject.contestId === data.activeContestId)
      .sort((left, right) => left.order - right.order);

    if (subjects.length === 0) return null;
    return (
      subjects.find((subject) => subject.id === selectedSubjectId) ?? subjects[0]
    );
  }

  static create(
    data: LeifPluginData,
    selectedSubjectId: string | null,
    onChange: (subjectId: string) => void | Promise<void>
  ): HTMLElement {
    const subjects = data.subjects
      .filter((subject) => subject.contestId === data.activeContestId)
      .sort((left, right) => left.order - right.order);

    const select = DomHelpers.createSelect(
      subjects.map((subject) => [subject.id, subject.name]),
      selectedSubjectId ?? undefined
    );
    select.addEventListener("change", () => {
      void onChange(select.value);
    });

    const wrapper = DomHelpers.createElement("div", "leif-toolbar");
    wrapper.appendChild(DomHelpers.createLabel("Matéria", select));
    return wrapper;
  }
}
