/**
 * Fixed catalog of content-type demonstration bodies for `GET`/`POST /content/{type}`. Each body
 * is a small, deterministic, hand-built value — no XML/HTML templating library, since these are
 * fixed examples never parsed by this server itself (research.md Decision 9). No lifecycle, a
 * plain lookup table keyed by `ContentType`.
 */
export const CONTENT_TYPES = ["json", "text", "html", "xml"] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export interface ContentTypeDemo {
  mediaType: string;
  buildBody: () => string | object;
}

export const CONTENT_TYPE_DEMOS: Record<ContentType, ContentTypeDemo> = {
  json: {
    mediaType: "application/json",
    buildBody: () => ({ message: "This is a JSON response.", type: "json" }),
  },
  text: {
    mediaType: "text/plain",
    buildBody: () => "This is a plain text response.",
  },
  html: {
    mediaType: "text/html",
    buildBody: () =>
      "<!DOCTYPE html>\n<html>\n<head><title>HTML Demo</title></head>\n<body><p>This is an HTML response.</p></body>\n</html>",
  },
  xml: {
    mediaType: "application/xml",
    buildBody: () => '<?xml version="1.0" encoding="UTF-8"?>\n<response><message>This is an XML response.</message></response>',
  },
};
