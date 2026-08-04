import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeCatalogCursor,
  encodeCatalogCursor,
  sanitizeTelemetryEvent,
} from "../worker/next-entry.js";

test("курсор каталога безопасно хранит смещение", () => {
  const cursor = encodeCatalogCursor(15);
  assert.equal(decodeCatalogCursor(cursor), 15);
  assert.equal(decodeCatalogCursor("повреждено"), 0);
  assert.equal(decodeCatalogCursor(""), 0);
});

test("телеметрия обрезает опасные и слишком длинные поля", () => {
  const event = sanitizeTelemetryEvent({
    name: "client_error".repeat(20),
    level: "critical",
    at: 123,
    path: "/catalog#test",
    data: {
      message: "x".repeat(1000),
      count: 4,
      ok: true,
      nested: { secret: "не сохранять как объект" },
    },
  });
  assert.equal(event.name.length, 80);
  assert.equal(event.level, "info");
  assert.equal(event.at, 123);
  assert.equal(event.data.message.length, 500);
  assert.equal(event.data.count, 4);
  assert.equal(event.data.ok, true);
  assert.equal(typeof event.data.nested, "string");
});
