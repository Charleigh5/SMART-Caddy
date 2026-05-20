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

describe("ScorecardScanner Bounding-Box Cropper Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock navigator.mediaDevices
    Object.defineProperty(global.navigator, "mediaDevices", {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
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
              target: { result: "data:image/jpeg;base64,mockOriginalData" }
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

  it("gates cropper and does not render cropper viewport until static image or active viewfinder exists", () => {
    render(<ScorecardScanner />);

    // In IDLE initial landing page, neither live scanner nor cropper is active
    expect(document.querySelector("#cropper-pipeline-screen")).not.toBeInTheDocument();
    expect(document.querySelector("#scorecard-live-scanner")).not.toBeInTheDocument();
  });

  it("activates cropper screen with original image previews and processes crop approval on confirm", async () => {
    render(<ScorecardScanner />);

    // Upload files flow (emulated)
    const uploadInput = document.querySelector("#scorecard-file-hidden-input") as HTMLInputElement;
    expect(uploadInput).toBeInTheDocument();

    const mockFile = new File(["dummyContent"], "testCard.png", { type: "image/png" });

    // Emulate file attachment
    fireEvent.change(uploadInput, { target: { files: [mockFile] } });

    // Wait for the FileReader to resolve and activate the Crop pipeline screen
    await waitFor(() => {
      expect(document.querySelector("#cropper-pipeline-screen")).toBeInTheDocument();
    });

    const cropSubmitBtn = document.querySelector("#crop-confirm-submit-btn");
    expect(cropSubmitBtn).toBeInTheDocument();
    
    // Confirm crop button triggers image calculation and moves back to IDLE
    fireEvent.click(cropSubmitBtn!);

    await waitFor(() => {
      expect(document.querySelector("#cropper-pipeline-screen")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(document.querySelector("#scanner-batch-preview-hub")).toBeInTheDocument();
    });

    // The cropped image thumbnail should present in the scan sides stack
    expect(screen.getAllByText(/Side 1/i)[0]).toBeInTheDocument();
  });

  it("permits bypassing the cropper box and adding the original uploaded image directly", async () => {
    render(<ScorecardScanner />);

    const uploadInput = document.querySelector("#scorecard-file-hidden-input") as HTMLInputElement;
    const mockFile = new File(["dummyContent"], "testCard.png", { type: "image/png" });
    fireEvent.change(uploadInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(document.querySelector("#cropper-pipeline-screen")).toBeInTheDocument();
    });

    const cropOriginalBypassBtn = document.querySelector("#crop-original-bypass-btn");
    expect(cropOriginalBypassBtn).toBeInTheDocument();

    // Bypass cropping directly
    fireEvent.click(cropOriginalBypassBtn!);

    await waitFor(() => {
      expect(document.querySelector("#cropper-pipeline-screen")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(document.querySelector("#scanner-batch-preview-hub")).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Side 1/i)[0]).toBeInTheDocument();
  });
});
