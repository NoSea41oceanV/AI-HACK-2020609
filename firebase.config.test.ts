import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Firebase Spark deployment configuration", () => {
  it("deploys only Firestore rules and the static SPA", () => {
    const config = JSON.parse(read("./firebase.json")) as Record<string, unknown>;
    expect(config).toHaveProperty("firestore.rules", "firestore.rules");
    expect(config).toHaveProperty("hosting.public", "dist");
    expect(config).toHaveProperty("emulators.firestore.host", "127.0.0.1");
    expect(config).not.toHaveProperty("functions");
    expect(config).not.toHaveProperty("storage");
  });

  it("uses immutable caching only for generated assets", () => {
    const config = JSON.parse(read("./firebase.json")) as {
      hosting: { headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> };
    };
    const headerValue = (source: string, key: string) =>
      config.hosting.headers.find((entry) => entry.source === source)?.headers.find((header) => header.key === key)?.value;

    expect(headerValue("/index.html", "Cache-Control")).toContain("no-store");
    expect(headerValue("/assets/**", "Cache-Control")).toContain("immutable");
  });

  it("keeps owner intake unreadable and denies every unspecified Firestore path", () => {
    const rules = read("./firestore.rules");
    const intakeMatch = rules.match(/match \/demoIntakes\/\{intakeId\} \{([\s\S]*?)\n    \}/)?.[1] ?? "";

    expect(intakeMatch).toContain("allow create:");
    expect(intakeMatch).toContain("allow read, update, delete: if false;");
    expect(rules).toContain("match /{document=**}");
    expect(rules).toContain("allow read, write: if false;");
  });

  it("stores media metadata only and matches the client and Worker byte limits", () => {
    const rules = read("./firestore.rules");

    expect(rules).toContain("item.keys().hasOnly(['kind', 'fileName', 'contentType', 'sizeBytes', 'status'])");
    expect(rules).not.toContain("mediaId");
    expect(rules).not.toContain("dataUrl");
    expect(rules).toContain("validIntakeMedia(media.photo, 'image', 5 * 1024 * 1024)");
    expect(rules).toContain("validIntakeMedia(media.video, 'video', 20 * 1024 * 1024)");
  });

  it("does not expose a server-side AI key in browser environment examples", () => {
    const example = read("./.env.example");
    expect(example).not.toMatch(/^VITE_.*ORCA.*KEY=/m);
    expect(example).not.toMatch(/\bsk-[A-Za-z0-9_-]{16,}\b/);
  });
});
