// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { getShownMenus, resetShownMenus } from "../mocks/obsidian";

describe("DomHelpers", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    resetShownMenus();
  });

  it("opens row actions through a native Obsidian menu", () => {
    const edit = vi.fn();
    const remove = vi.fn();
    const button = DomHelpers.createMenuButton(
      [
        { label: "Editar", icon: "edit", onClick: edit },
        { label: "Excluir", icon: "trash-2", disabled: true, onClick: remove }
      ],
      "Ações da matéria"
    );

    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const [menu] = getShownMenus();
    expect(button.tagName).toBe("BUTTON");
    expect(button.querySelector("summary")).toBeNull();
    expect(menu?.useNativeMenu).toBe(true);
    expect(menu?.shownAtMouseEvent).toBe(true);
    expect(menu?.items).toMatchObject([
      { title: "Editar", icon: "edit", disabled: false },
      { title: "Excluir", icon: "trash-2", disabled: true }
    ]);

    menu?.items[0]?.callback?.(new MouseEvent("click"));
    expect(edit).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });
});
