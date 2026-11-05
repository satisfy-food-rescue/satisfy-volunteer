// Policies, agreements and induction for the native app, matching
// src/app/app/induction and src/app/app/policies.
import type { DocumentItem } from "@satisfy/core/api";
import { documentEmbedUrl } from "@satisfy/core/documents";
import { moduleParagraphs } from "@satisfy/core/training";
import { todayISO } from "../dates";
import type { VolunteerDocument } from "../documents";

export function documentItem({ document: d, readVersion, readAt, needsAction }: VolunteerDocument): DocumentItem {
  return {
    id: d.id,
    kind: d.kind,
    title: d.title,
    summary: d.summary,
    version: d.version,
    versionISO: todayISO(d.versionAt),
    versionNote: d.versionNote,
    url: d.url,
    viewUrl: d.url ? (documentEmbedUrl(d.url) ?? d.url) : null,
    paragraphs: moduleParagraphs(d.body),
    readVersion,
    readISO: readAt ? todayISO(readAt) : null,
    needsAction,
  };
}
