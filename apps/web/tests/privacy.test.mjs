import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const directory = dirname(fileURLToPath(import.meta.url));
function moduleFrom(relative) {
  const source = ts.transpileModule(readFileSync(join(directory, relative), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const exports = {};
  runInNewContext(source, {exports});
  return exports;
}
const {toPublicPassport} = moduleFrom('../lib/privacy/public-passport.ts');
const {constitutionContent, privacyPolicy} = moduleFrom('../lib/privacy/legal-content.ts');

test('public passport DTO excludes personal fields even when the legacy RPC sends them', () => {
  const data = {
    passportNumber: 'UPP-TEST', publicSlug: 'test-pilot', issuedAt: '2026-01-01', callsign: 'TEST001',
    fullName: 'Private Test Name', email: 'private@example.invalid', pilot_id: 'private-user-id',
    totalHours: 12, totalFlights: 2,
    currentRank: {code: 'CADET', name: 'Cadet', email: 'private@example.invalid'},
    memberships: [{organizationId: 'test', organizationCode: 'TEST', organizationName: 'Test Airline', email: 'private@example.invalid'}],
    qualifications: [{code: 'A21N', name: 'A21N', fullName: 'Private Test Name'}],
    experience: {hours: 12, verifiedHours: 12, fullName: 'Private Test Name'},
  };
  const result = toPublicPassport(data);
  assert.equal(result.callsign, 'TEST001');
  assert.equal(result.totalHours, 12);
  const json = JSON.stringify(result);
  for (const secret of ['Private Test Name', 'private@example.invalid', 'private-user-id', 'fullName', 'email', 'pilot_id']) assert.ok(!json.includes(secret), secret);
  assert.equal(data.fullName, 'Private Test Name');
});

test('missing passports fail closed and malformed callsigns cannot publish emails or full names', () => {
  for (const value of [null, undefined, [], {}, 'bad']) assert.equal(toPublicPassport(value), null);
  for (const callsign of ['private@example.invalid', 'Private Test Name']) {
    assert.equal(toPublicPassport({passportNumber: 'UPP-TEST', publicSlug: 'test', callsign}).callsign, 'Pilot');
  }
});

test('the public regulations render all ten original constitution principles and bilingual privacy clauses', () => {
  const source = readFileSync(join(directory, '../../../docs/CONSTITUTION.md'), 'utf8');
  for (const locale of ['en', 'ar']) {
    const content = constitutionContent(source, locale);
    assert.equal(content.principles.length, 10);
    assert.equal(content.privacy.length, 8);
    assert.equal(content.privacy.some(text => /email|البريد/.test(text)), true);
  }
  assert.match(constitutionContent(source, 'en').principles[0], /^KVA is a virtual aviation platform/);
  assert.throws(() => constitutionContent('# empty', 'ar'));
});

test('privacy policy has matching Arabic/English sections and makes no invented contact or automated deletion promise', () => {
  assert.equal(privacyPolicy.ar.sections.length, privacyPolicy.en.sections.length);
  assert.ok(privacyPolicy.ar.sections.length >= 8);
  for (const locale of ['ar', 'en']) {
    assert.ok(privacyPolicy[locale].sections.every(section => section.title && section.body));
    assert.ok(JSON.stringify(privacyPolicy[locale]).includes('admin@kvafly.com'));
    assert.ok(!JSON.stringify(privacyPolicy[locale]).includes('private@example.invalid'));
  }
});
