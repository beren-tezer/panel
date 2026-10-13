import { test } from "node:test";
import assert from "node:assert/strict";
import { AGREEMENT_LIMITS, DEFAULT_AGREEMENT, normalizeAgreement, placeholdersIn, rowToAgreementText, splitBlanks, validateAgreement } from "../agreement.js";

test("Varsayılan taslak geçerli; yöneticinin dolduracağı boşluklar listelenir", () => {
  assert.deepEqual(validateAgreement(normalizeAgreement(DEFAULT_AGREEMENT)), {});
  const blanks = placeholdersIn(DEFAULT_AGREEMENT);
  for (const b of ["[Şirket Unvanı]", "[Şirket Adresi]", "[Cezai Şart Tutarı]"]) assert.ok(blanks.includes(b), b);
  assert.equal(new Set(blanks).size, blanks.length, "tekrarsız");
  assert.ok(DEFAULT_AGREEMENT.sections.length <= AGREEMENT_LIMITS.sections);
});

test("Boşluklar metinden ayrılır (vurgulama için)", () => {
  assert.deepEqual(splitBlanks("A [X] b [Y Z]"), [
    { text: "A ", blank: false }, { text: "[X]", blank: true }, { text: " b ", blank: false }, { text: "[Y Z]", blank: true },
  ]);
  assert.deepEqual(splitBlanks("boşluksuz"), [{ text: "boşluksuz", blank: false }]);
  assert.deepEqual(placeholdersIn({ title: "T", consent: "c", sections: [{ heading: "h", body: "dolu metin" }] }), []);
});

test("Doğrulama: boş alanlar ve sınırlar", () => {
  const e = validateAgreement(normalizeAgreement({ title: "  ", consent: "", sections: [{ heading: "1.", body: " " }, { heading: "", body: "x" }] }));
  assert.ok(e.title && e.consent && e["s0.body"] && e["s1.heading"]);
  assert.ok(validateAgreement(normalizeAgreement({ title: "T", consent: "c", sections: [] })).sections);
  assert.ok(validateAgreement({ title: "T", consent: "c", sections: [{ heading: "h", body: "x".repeat(AGREEMENT_LIMITS.body + 1) }] })["s0.body"]);
  assert.deepEqual(normalizeAgreement({ title: " T ", consent: "c", sections: [{ heading: " h ", body: "a\r\nb " }] }), { title: "T", consent: "c", sections: [{ heading: "h", body: "a\nb" }] });
});

test("Veritabanı satırı → metin; satır yoksa null (varsayılan taslak kullanılır)", () => {
  assert.equal(rowToAgreementText(null), null);
  const t = rowToAgreementText({ title: "T", consent: "c", version: "v1", sections: [{ heading: "h", body: "b", fazla: 1 }], updated_at: "2026-10-13T10:00:00Z", updated_by: "u" });
  assert.deepEqual(t, { version: "v1", title: "T", consent: "c", updatedAt: "2026-10-13T10:00:00Z", updatedBy: "u", sections: [{ heading: "h", body: "b" }] });
});
