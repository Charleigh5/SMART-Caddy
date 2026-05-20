/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ScorecardScanner } from "./ScorecardScanner";

// Mock React Router
vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(),
}));

describe("ScorecardScanner OCR Integration & Verification Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === "/api/gemini/scorecard-parse") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              courseName: "Twin Lakes Golf",
              teeSet: "Yellow",
              holes: [
                { number: 1, par: 4, yardage: 390, handicap: 1 },
                { number: 2, par: 3, yardage: 155, handicap: 17 },
              ],
              uncertainFields: ["Hole 2 Handicap"],
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    // Mock HTMLMediaElement play
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);

    // Clean prototype overrides for canvas elements
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
    }) as any;
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,mockCropData");

    // Stub global FileReader to automatically trigger load
    class MockFileReader {
      onload: any;
      readAsDataURL(file: File) {
        setTimeout(() => {
          if (this.onload) {
            this.onload({
              target: { result: "data:image/jpeg;base64,Ynl0ZXM=" }
            });
          }
        }, 0);
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    // Stub global Image class to simulate loading and bypass JSDOM limitations
    class MockImage {
      _src: string = "";
      onload: any = null;
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
      get src() {
        return this._src;
      }
      get width() {
        return 500;
      }
      get height() {
        return 500;
      }
    }
    vi.stubGlobal("Image", MockImage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("submits the batched previews to the scorecard-parse API and renders editable reviewer layout with confidence warning", async () => {
    render(<ScorecardScanner />);

    const uploadInput = document.querySelector("#scorecard-file-hidden-input") as HTMLInputElement;
    const mockFile = new File(["bytes"], "test.jpg", { type: "image/jpeg" });
    fireEvent.change(uploadInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(document.querySelector("#cropper-pipeline-screen")).toBeInTheDocument();
    });

    // ClickConfirm to back to IDLE with preview
    fireEvent.click(document.querySelector("#crop-confirm-submit-btn")!);

    await waitFor(() => {
      expect(document.querySelector("#cropper-pipeline-screen")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(document.querySelector("#scanner-batch-preview-hub")).toBeInTheDocument();
    });

    const processOcrBtn = document.querySelector("#batch-process-ocr-btn");
    expect(processOcrBtn).toBeInTheDocument();

    // Trigger OCR Submission parse
    fireEvent.click(processOcrBtn!);

    // Check loading state transition
    await waitFor(() => {
      expect(screen.getByText("Extracting Scorecard Data")).toBeInTheDocument();
    });

    // Check successful reviewer display transition
    await waitFor(() => {
      expect(document.querySelector("#ocr-results-reviewer")).toBeInTheDocument();
    });

    // Verify course name loaded
    const courseInput = document.querySelector("#reviewer-course-name") as HTMLInputElement;
    expect(courseInput.value).toBe("Twin Lakes Golf");

    // Verify editable input rows
    const parHole1Input = document.querySelector("#input-par-1") as HTMLInputElement;
    expect(parHole1Input.value).toBe("4");

    // Verify low-confidence fields alert
    expect(screen.getByText("Hole 2 Handicap")).toBeInTheDocument();

    // Verify commemorative disclaimer label
    expect(screen.getByText(/Commemorative Keepsake Notice/)).toBeInTheDocument();
  });

  it("displays custom user-friendly error layout with retry and manual bypass options when the scorecard-parse API fails", async () => {
    // Override global fetch to fail for scorecard-parse
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === "/api/gemini/scorecard-parse") {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve("API key quota exceeded or image too blurry."),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<ScorecardScanner />);

    const uploadInput = document.querySelector("#scorecard-file-hidden-input") as HTMLInputElement;
    const mockFile = new File(["bytes"], "test.jpg", { type: "image/jpeg" });
    fireEvent.change(uploadInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(document.querySelector("#cropper-pipeline-screen")).toBeInTheDocument();
    });

    // Confirm crop to add picture count
    fireEvent.click(document.querySelector("#crop-confirm-submit-btn")!);

    await waitFor(() => {
      expect(document.querySelector("#scanner-batch-preview-hub")).toBeInTheDocument();
    });

    const processOcrBtn = document.querySelector("#batch-process-ocr-btn");
    expect(processOcrBtn).toBeInTheDocument();

    // Trigger OCR parse
    fireEvent.click(processOcrBtn!);

    // Expect the user friendly error banner with retry and manual entry options
    await waitFor(() => {
      expect(document.querySelector("#scanner-error-banner")).toBeInTheDocument();
    });

    expect(screen.getByText("Scorecard Analysis Failed")).toBeInTheDocument();
    expect(screen.getByText("API key quota exceeded or image too blurry.")).toBeInTheDocument();

    const retryBtn = document.querySelector("#error-retry-ocr-btn");
    const manualBtn = document.querySelector("#error-manual-bypass-btn");

    expect(retryBtn).toBeInTheDocument();
    expect(manualBtn).toBeInTheDocument();

    // Verify clicking "Enter Manually" resolves to Review screen
    fireEvent.click(manualBtn!);
    await waitFor(() => {
      expect(document.querySelector("#ocr-results-reviewer")).toBeInTheDocument();
    });
  });
});
