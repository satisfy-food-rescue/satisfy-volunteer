import { describe, expect, it } from "vitest";
import { completionGate, isVideo, linkKindLabel, moduleParagraphs } from "@satisfy/core/training";

const video = { id: "v1", label: "Lifting", url: "https://www.youtube.com/watch?v=Dcf9bT9DK94" };
const short = { id: "v2", label: "Short", url: "https://youtu.be/abc" };
const page = { id: "p1", label: "MPI course", url: "https://www.mpi.govt.nz/food-safety" };

describe("completionGate", () => {
  it("locks until the content is read and every link is opened", () => {
    const gate = completionGate({ hasContent: true, readToEnd: false, links: [video], opened: new Set() });
    expect(gate.ready).toBe(false);
    expect(gate.steps).toEqual([
      { key: "read", label: "Read to the end", done: false },
      { key: "watch", label: "Open the video", done: false },
    ]);
  });

  it("stays locked when only some links are opened, and counts them", () => {
    const gate = completionGate({ hasContent: true, readToEnd: true, links: [video, short], opened: new Set(["v1"]) });
    expect(gate.ready).toBe(false);
    expect(gate.steps[1]).toEqual({ key: "watch", label: "Open the videos (1 of 2)", done: false });
  });

  it("unlocks when both are done", () => {
    expect(completionGate({ hasContent: true, readToEnd: true, links: [video, page], opened: new Set(["v1", "p1"]) }).ready).toBe(true);
  });

  it("calls a mix of videos and pages links", () => {
    expect(completionGate({ hasContent: false, readToEnd: false, links: [video, page], opened: new Set() }).steps[0].label).toBe("Open every link (0 of 2)");
  });

  it("has nothing to do for a module with no content or links", () => {
    expect(completionGate({ hasContent: false, readToEnd: false, links: [], opened: new Set() })).toEqual({ ready: true, steps: [] });
  });
});

describe("links", () => {
  it("recognises YouTube and Vimeo as videos", () => {
    expect(isVideo(video.url)).toBe(true);
    expect(isVideo(short.url)).toBe(true);
    expect(isVideo("https://m.youtube.com/watch?v=x")).toBe(true);
    expect(isVideo("https://vimeo.com/123")).toBe(true);
    expect(isVideo(page.url)).toBe(false);
    expect(isVideo("not a url")).toBe(false);
  });

  it("labels a link by its kind or site", () => {
    expect(linkKindLabel(video.url)).toBe("YouTube video");
    expect(linkKindLabel(short.url)).toBe("YouTube video");
    expect(linkKindLabel(page.url)).toBe("mpi.govt.nz");
  });
});

describe("moduleParagraphs", () => {
  it("splits on blank lines, including Windows line endings and stray spaces", () => {
    expect(moduleParagraphs("One.\n\nTwo.\r\n  \r\nThree.\n\n\n")).toEqual(["One.", "Two.", "Three."]);
    expect(moduleParagraphs(null)).toEqual([]);
  });
});
