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

describe("ScorecardScanner Upload & Fallback Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("launches the file system dialog when clicking upload photos option", () => {
    render(<ScorecardScanner />);

    const uploadOptionBtn = document.querySelector("#scanner-upload-photos-btn") as HTMLButtonElement;
    const fileInput = document.querySelector("#scorecard-file-hidden-input") as HTMLInputElement;

    expect(uploadOptionBtn).toBeInTheDocument();
    expect(fileInput).toBeInTheDocument();

    const fileInputClickSpy = vi.spyOn(fileInput, "click");
    fireEvent.click(uploadOptionBtn);

    expect(fileInputClickSpy).toHaveBeenCalled();
  });

  it("triggers manual entry bypass immediately on clicking start empty manual scorecard button", () => {
    render(<ScorecardScanner />);

    const manualBypassBtn = document.querySelector("#scanner-manual-bypass-btn") as HTMLButtonElement;
    expect(manualBypassBtn).toBeInTheDocument();

    fireEvent.click(manualBypassBtn);

    // Should transition directly to confirmation preview form
    expect(document.querySelector("#ocr-results-reviewer")).toBeInTheDocument();
    expect(document.querySelector("#reviewer-course-name")).toHaveValue("Commemorative Course");
  });
});
