import { describe, expect, it } from "vitest";
import type { Document, TrainingModule } from "@/generated/prisma/client";
import { isoToDate } from "@/lib/dates";
import { inductionBlockers, inductionStatus, inductionToDo, mojRenewsISO, mojStatus, trainingLock } from "@/lib/induction";
import { moduleStatuses } from "@/lib/training";
import { documentEmbedUrl, documentSiteLabel } from "@satisfy/core/documents";

const TODAY = "2026-11-05";
const CHECK_ROLES = ["WAREHOUSE", "DRIVERS_ASSISTANT", "VOLUNTEER_DRIVER"] as const;

function doc(over: Partial<Document> & Pick<Document, "id" | "title">): Document {
  return { kind: "AGREEMENT", summary: "", url: null, body: null, roles: ["WAREHOUSE", "DRIVERS_ASSISTANT", "VOLUNTEER_DRIVER", "HARVEST"], version: 1, versionNote: null, versionAt: new Date(), order: 0, archived: false, createdAt: new Date(), updatedAt: new Date(), ...over };
}
const checked = (iso: string) => ({ checkedOn: isoToDate(iso) });
const signed = (documentId: string, version: number) => ({ documentId, version, createdAt: new Date("2026-01-01T00:00:00Z") });

describe("the Ministry of Justice check", () => {
  it("renews three years from the date on the check", () => {
    expect(mojRenewsISO("2024-02-29")).toBe("2027-02-28");
    expect(mojRenewsISO("2025-11-05")).toBe("2028-11-05");
  });

  it("is needed for the roles set, and not for the harvest pool alone", () => {
    expect(mojStatus(["WAREHOUSE"], CHECK_ROLES, [], TODAY)).toMatchObject({ status: "NEEDED", required: true, roles: ["WAREHOUSE"] });
    expect(mojStatus(["HARVEST"], CHECK_ROLES, [], TODAY)).toMatchObject({ status: "NOT_REQUIRED", required: false });
    expect(mojStatus(["WAREHOUSE"], [], [], TODAY).status).toBe("NOT_REQUIRED");
  });

  it("uses the latest check and comes due 60 days ahead", () => {
    expect(mojStatus(["WAREHOUSE"], CHECK_ROLES, [checked("2023-01-10"), checked("2025-06-01")], TODAY)).toMatchObject({ status: "CURRENT", checkedISO: "2025-06-01", renewsISO: "2028-06-01" });
    expect(mojStatus(["WAREHOUSE"], CHECK_ROLES, [checked("2023-12-20")], TODAY)).toMatchObject({ status: "RENEWAL_DUE", daysLeft: 45 });
    expect(mojStatus(["WAREHOUSE"], CHECK_ROLES, [checked("2023-11-01")], TODAY)).toMatchObject({ status: "EXPIRED", daysLeft: -4 });
  });
});

describe("induction", () => {
  const agreement = doc({ id: "a", title: "Volunteer Agreement" });
  const confidentiality = doc({ id: "c", title: "Confidentiality Agreement", version: 2 });
  const harvestOnly = doc({ id: "h", title: "Harvest Agreement", roles: ["HARVEST"] });
  const input = { mojCheckRoles: CHECK_ROLES, agreements: [agreement, confidentiality, harvestOnly] };

  it("counts what a new warehouse volunteer still needs", () => {
    const i = inductionStatus({ roles: ["WAREHOUSE"] }, { ...input, checks: [], acknowledgements: [] }, TODAY);
    expect(i).toMatchObject({ complete: false, outstanding: 3 });
    expect(i.agreements.map((a) => [a.document.id, a.status])).toEqual([["a", "UNSIGNED"], ["c", "UNSIGNED"], ["h", "NOT_REQUIRED"]]);
    expect(inductionToDo(i)).toBe("your Ministry of Justice check and your signature on the Volunteer Agreement and Confidentiality Agreement");
  });

  it("asks again for an agreement with a new version", () => {
    const i = inductionStatus({ roles: ["WAREHOUSE"] }, { ...input, checks: [checked("2025-06-01")], acknowledgements: [signed("a", 1), signed("c", 1)] }, TODAY);
    expect(i.agreements.find((a) => a.document.id === "c")).toMatchObject({ status: "UPDATED", signedVersion: 1 });
    expect(inductionToDo(i)).toBe("your signature on the Confidentiality Agreement");
    const done = inductionStatus({ roles: ["WAREHOUSE"] }, { ...input, checks: [checked("2025-06-01")], acknowledgements: [signed("a", 1), signed("c", 2)] }, TODAY);
    expect(done).toMatchObject({ complete: true, outstanding: 0 });
    expect(inductionToDo(done)).toBe("");
  });

  it("still counts as complete while a check is only due for renewal", () => {
    const i = inductionStatus({ roles: ["WAREHOUSE"] }, { ...input, checks: [checked("2023-12-20")], acknowledgements: [signed("a", 1), signed("c", 2)] }, TODAY);
    expect(i).toMatchObject({ complete: true, moj: { status: "RENEWAL_DUE" } });
  });

  it("blocks only what needs the missing step", () => {
    const i = inductionStatus({ roles: ["WAREHOUSE", "HARVEST"] }, { ...input, checks: [], acknowledgements: [signed("a", 1), signed("c", 2)] }, TODAY);
    expect(inductionBlockers(i, ["WAREHOUSE"])).toEqual(["We need to see your Ministry of Justice check first"]);
    expect(inductionBlockers(i, ["HARVEST"])).toEqual(["Sign the Harvest Agreement first"]);
  });
});

describe("what holds a training module back", () => {
  const mod = (over: Partial<TrainingModule> & Pick<TrainingModule, "id" | "code">): TrainingModule => ({ name: over.code, description: "", validityMonths: null, requiredRoles: ["WAREHOUSE"], mandatoryBeforeFirstShift: false, delivery: "IN_PERSON", content: null, order: 0, prerequisiteId: null, inDevelopment: false, ...over });
  const t1 = mod({ id: "t1", code: "T1", name: "Sorting T1" });
  const t2 = mod({ id: "t2", code: "T2", name: "Sorting T2", prerequisiteId: "t1" });
  const soon = mod({ id: "s", code: "S", name: "Ladders", inDevelopment: true });
  const me = { roles: ["WAREHOUSE" as const] };
  const statuses = moduleStatuses(me, [t1, t2, soon], [], TODAY);
  const done = inductionStatus(me, { mojCheckRoles: [], agreements: [], checks: [], acknowledgements: [] }, TODAY);
  const notDone = inductionStatus(me, { mojCheckRoles: CHECK_ROLES, agreements: [], checks: [], acknowledgements: [] }, TODAY);

  it("asks for the induction first, then the earlier stage", () => {
    expect(trainingLock(me, statuses[0]!, notDone)).toBe("Finish your induction before training: we need to see your Ministry of Justice check first.");
    expect(trainingLock(me, statuses[0]!, done)).toBeNull();
    expect(trainingLock(me, statuses[1]!, done)).toBe("Complete Sorting T1 first.");
  });

  it("keeps a module in development closed", () => {
    expect(trainingLock(me, statuses[2]!, done)).toMatch(/^Ladders is still being put together/);
  });
});

describe("documents in Google Drive", () => {
  it("embeds Drive files and Google Docs with Google's viewer", () => {
    expect(documentEmbedUrl("https://drive.google.com/file/d/1AbC-d_E/view?usp=sharing")).toBe("https://drive.google.com/file/d/1AbC-d_E/preview");
    expect(documentEmbedUrl("https://drive.google.com/open?id=1AbC")).toBe("https://drive.google.com/file/d/1AbC/preview");
    expect(documentEmbedUrl("https://docs.google.com/document/d/1XyZ/edit#heading=h.1")).toBe("https://docs.google.com/document/d/1XyZ/preview");
    expect(documentEmbedUrl("https://drive.google.com/drive/folders/1Fold")).toBe("https://drive.google.com/embeddedfolderview?id=1Fold#list");
  });

  it("opens anything else as a plain link", () => {
    expect(documentEmbedUrl("https://www.satisfyfoodrescue.org.nz/policy.pdf")).toBeNull();
    expect(documentEmbedUrl("http://drive.google.com/file/d/1AbC/view")).toBeNull();
    expect(documentEmbedUrl("https://drive.google.com.evil.example/file/d/1AbC/view")).toBeNull();
    expect(documentEmbedUrl("not a url")).toBeNull();
    expect(documentSiteLabel("https://docs.google.com/document/d/1")).toBe("Google Docs");
    expect(documentSiteLabel("https://www.worksafe.govt.nz/x")).toBe("worksafe.govt.nz");
  });
});
