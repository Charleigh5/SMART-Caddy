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

describe("ScorecardScanner Camera Lifecycle Tests", () => {
  let mockStream: any;
  let mockTrack: any;

  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== "undefined") {
      delete (window as any).__lastCameraStream;
    }

    // Setup HTMLVideoElement.prototype.srcObject mock mapping
    Object.defineProperty(HTMLVideoElement.prototype, "srcObject", {
      get() {
        return this._srcObject;
      },
      set(val) {
        this._srcObject = val;
      },
      configurable: true,
    });

    // Setup navigator mediaDevices mock
    mockTrack = {
      stop: vi.fn(),
    };
    mockStream = {
      getTracks: vi.fn(() => [mockTrack]),
    };

    Object.defineProperty(global.navigator, "mediaDevices", {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    // Mock HTMLMediaElement play
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls getUserMedia when camera button is clicked and stream gets attached", async () => {
    render(<ScorecardScanner />);

    const cameraBtn = document.querySelector("#scanner-start-camera-btn");
    expect(cameraBtn).toBeInTheDocument();

    fireEvent.click(cameraBtn!);

    // Should request camera permissions
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: "environment" },
    });

    // Should navigate into active scanning view
    await waitFor(() => {
      expect(document.querySelector("#scorecard-live-scanner")).toBeInTheDocument();
    });

    // Test stream trace
    const videoPreview = document.querySelector("#scanner-live-preview") as HTMLVideoElement;
    expect(videoPreview).toBeInTheDocument();
    
    await waitFor(() => {
      expect(videoPreview.srcObject).toBe(mockStream);
    });
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("handles camera permission denial gracefully and renders error fallback UI", async () => {
    // Force getUserMedia reject
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(new Error("Permission Denied"));

    render(<ScorecardScanner />);

    const cameraBtn = document.querySelector("#scanner-start-camera-btn");
    fireEvent.click(cameraBtn!);

    // Should fall back to try non-environment, then render CAMERA_ERROR state
    await waitFor(() => {
      expect(screen.getByText("Camera Connection Blocked")).toBeInTheDocument();
    });

    const retryBtn = document.querySelector("#camera-error-retry-btn");
    expect(retryBtn).toBeInTheDocument();
    const uploadBtn = document.querySelector("#camera-error-upload-btn");
    expect(uploadBtn).toBeInTheDocument();
    const dismissBtn = document.querySelector("#camera-error-dismiss-btn");
    expect(dismissBtn).toBeInTheDocument();
  });

  it("stops all tracks when cancel is clicked inside active viewfinder", async () => {
    render(<ScorecardScanner />);

    const cameraBtn = document.querySelector("#scanner-start-camera-btn");
    fireEvent.click(cameraBtn!);

    await waitFor(() => {
      expect(document.querySelector("#scorecard-live-scanner")).toBeInTheDocument();
    });

    const cancelBtn = document.querySelector("#camera-cancel-btn");
    expect(cancelBtn).toBeInTheDocument();
    fireEvent.click(cancelBtn!);

    // Should stop tracks
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it("stops tracks when component unmounts", async () => {
    const { unmount } = render(<ScorecardScanner />);

    const cameraBtn = document.querySelector("#scanner-start-camera-btn");
    fireEvent.click(cameraBtn!);

    await waitFor(() => {
      expect(document.querySelector("#scorecard-live-scanner")).toBeInTheDocument();
    });

    // Ensure the stream is fully bound and tracked
    await waitFor(() => {
      expect((window as any).__lastCameraStream).toBeDefined();
    });

    const activeStream = (window as any).__lastCameraStream;
    const activeTrack = activeStream.getTracks()[0];
    const trackStopSpy = vi.spyOn(activeTrack, "stop");

    // Settle all macro-tasks and rendering cycles before unmounting
    await new Promise((resolve) => setTimeout(resolve, 100));

    unmount();
    
    await waitFor(() => {
      expect(trackStopSpy).toHaveBeenCalled();
    });
  });
});
