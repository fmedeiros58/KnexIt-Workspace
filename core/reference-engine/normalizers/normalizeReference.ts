import type { BibliographicSource } from "../core/BibliographicSource";
import { normalizeAuthors } from "./normalizeAuthors";
import { normalizeContainerTitle } from "./normalizeContainerTitle";
import { normalizeDate } from "./normalizeDate";
import { normalizeDoi } from "./normalizeDoi";
import { normalizeEdition } from "./normalizeEdition";
import { normalizeOrganizationAuthor } from "./normalizeOrganizationAuthor";
import { normalizePages } from "./normalizePages";
import { normalizePlace } from "./normalizePlace";
import { normalizePublisher } from "./normalizePublisher";
import { normalizeSubtitle, normalizeTitle } from "./normalizeTitle";
import { normalizeUrl } from "./normalizeUrl";

export function normalizeReference(reference: BibliographicSource): BibliographicSource {
  return {
    ...reference,
    title: normalizeTitle(reference.title),
    subtitle: normalizeSubtitle(reference.subtitle),
    authors: normalizeAuthors(reference.authors),
    organizationAuthor: normalizeOrganizationAuthor(reference.organizationAuthor),
    containerTitle: normalizeContainerTitle(reference.containerTitle),
    publicationDate: normalizeDate(reference.publicationDate),
    depositDate: normalizeDate(reference.depositDate),
    accessDate: normalizeDate(reference.accessDate),
    edition: normalizeEdition(reference.edition),
    pages: normalizePages(reference.pages),
    place: normalizePlace(reference.place),
    publisher: normalizePublisher(reference.publisher),
    doi: normalizeDoi(reference.doi),
    url: normalizeUrl(reference.url),
  };
}

