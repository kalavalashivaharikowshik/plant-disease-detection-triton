import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PreferencesProvider } from "@/lib/preferences";
import { Layout } from "./Layout";
import { UploadPanel } from "./UploadPanel";
import { NoticeList } from "./result/NoticeList";
import { ConfidenceMeter } from "./result/ResultHeader";

const wrap = (ui: React.ReactNode) =>
  render(
    <PreferencesProvider>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>
    </PreferencesProvider>,
  );

describe("NoticeList", () => {
  it("orders danger before warnings and info", () => {
    render(
      <NoticeList
        notices={[
          { code: "a", message: "info note", severity: "info" },
          { code: "b", message: "danger note", severity: "danger" },
          { code: "c", message: "warning note", severity: "warning" },
        ]}
      />,
    );
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual(["danger note", "warning note", "info note"]);
  });
});

describe("ConfidenceMeter", () => {
  it("exposes the value to assistive technology", () => {
    render(<ConfidenceMeter value={0.485} />);
    const meter = screen.getByRole("meter", { name: "Confidence" });
    expect(meter).toHaveAttribute("aria-valuenow", "49");
    expect(screen.getByText("Guessing")).toBeInTheDocument();
  });
});

describe("UploadPanel", () => {
  it("explains why an oversized photo was rejected", async () => {
    const onFile = vi.fn();
    wrap(<UploadPanel previewUrl={null} busy={false} onFile={onFile} />);
    const big = new File([new Uint8Array(9 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
    await userEvent.upload(screen.getByLabelText("Leaf photo"), big);
    expect(await screen.findByRole("alert")).toHaveTextContent("larger than 8 MB");
    expect(onFile).not.toHaveBeenCalled();
  });

  it("passes a valid photo through", async () => {
    const onFile = vi.fn();
    wrap(<UploadPanel previewUrl={null} busy={false} onFile={onFile} />);
    const leaf = new File(["leaf"], "leaf.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("Leaf photo"), leaf);
    await vi.waitFor(() => expect(onFile).toHaveBeenCalledWith(leaf));
  });
});

describe("Layout", () => {
  it("renders navigation, a skip link and the tech mode switch", () => {
    wrap(<Layout>content</Layout>);
    expect(screen.getByText("Skip to content")).toHaveAttribute("href", "#main");
    expect(screen.getAllByRole("navigation", { name: "Main" })).toHaveLength(2);
    expect(screen.getByLabelText("Tech mode")).not.toBeChecked();
  });
});
