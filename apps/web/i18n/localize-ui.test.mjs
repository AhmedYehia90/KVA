import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as React from 'react';

const testDirectory = dirname(fileURLToPath(import.meta.url));

// Exercise the actual shared TypeScript implementation without adding a test dependency.
const source = ts.transpileModule(readFileSync(join(testDirectory, 'localize-ui.ts'), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true},
}).outputText;
const exportsObject = {};
runInNewContext(source, {exports: exportsObject, require: name => name === 'react' ? React : JSON.parse(readFileSync(join(testDirectory, name), 'utf8'))});
const {localizeUi, localizeText} = exportsObject;

test('Arabic localizes headings, dynamic statuses, attributes and navigation arrows', () => {
  assert.equal(localizeText('Pilot Login', 'ar'), 'دخول الطيار');
  assert.equal(localizeText('UNDER_REVIEW', 'ar'), 'قيد المراجعة');
  assert.equal(localizeText('Open Passport →', 'ar'), 'فتح الجواز ←');
  assert.equal(localizeText('← Fleet overview', 'ar'), '→ نظرة عامة على الأسطول');
  assert.equal(localizeText('Fleet Overview | Kalabsha Airlines', 'ar'), 'نظرة عامة على الأسطول | طيران كلابشة');
  assert.equal(localizeText('12 flights', 'ar'), '12 الرحلات');
});

test('other supported locales and already translated Arabic stay unchanged', () => {
  for (const locale of ['en', 'fr', 'de', 'es']) assert.equal(localizeText('Pilot Login', locale), 'Pilot Login');
  assert.equal(localizeText('دخول الطيار', 'ar'), 'دخول الطيار');
  const node = React.createElement('h1', {}, 'Pilot Login');
  assert.equal(localizeUi(node, 'en'), node);
});

test('rendered form text is translated while stored values, links, styles and handlers stay untouched', () => {
  const onClick = () => {};
  const style = {textAlign: 'left'};
  const original = React.createElement('a', {href: '/pilot/passport?status=ready', className: 'active', style, onClick, title: 'Open Passport'}, 'Open Passport');
  const result = localizeUi(original, 'ar');
  assert.equal(result.props.children, 'فتح الجواز');
  assert.equal(result.props.title, 'فتح الجواز');
  assert.equal(result.props.href, original.props.href);
  assert.equal(result.props.className, 'active');
  assert.equal(result.props.style, style);
  assert.equal(result.props.onClick, onClick);
  assert.equal(original.props.children, 'Open Passport');
  const input = localizeUi(React.createElement('input', {name: 'status', value: 'ready', placeholder: 'Search'}), 'ar');
  assert.equal(input.props.value, 'ready');
  assert.equal(input.props.name, 'status');
  assert.equal(input.props.placeholder, 'بحث');
});

test('option labels translate without changing submitted implicit or explicit enum values', () => {
  const implicit = localizeUi(React.createElement('option', {}, 'ready'), 'ar');
  assert.equal(implicit.props.value, 'ready');
  assert.equal(implicit.props.children, 'جاهز');
  const explicit = localizeUi(React.createElement('option', {value: 'maintenance'}, 'Maintenance'), 'ar');
  assert.equal(explicit.props.value, 'maintenance');
  assert.equal(explicit.props.children, 'الصيانة');
});

test('code, JSON evidence, technical identifiers and opt-out content remain verbatim', () => {
  for (const type of ['pre', 'code', 'script', 'style']) {
    const original = React.createElement(type, {}, 'Ready');
    assert.equal(localizeUi(original, 'ar'), original);
  }
  const original = React.createElement('span', {translate: 'no'}, 'Ready');
  assert.equal(localizeUi(original, 'ar'), original);
  for (const code of ['HECA', 'KVA123', 'B777-300ER', 'flight.completed', 'REBUILD']) assert.equal(localizeText(code, 'ar'), code);
});

test('nested output, accessible labels, whitespace and keyed list identity survive localization', () => {
  const original = React.createElement('section', {'aria-label': 'Flight Planning'}, [React.createElement('span', {key: 'ready'}, ' Ready '), null, 0]);
  const result = localizeUi(original, 'ar');
  assert.equal(result.props['aria-label'], 'تخطيط الرحلة');
  assert.equal(result.props.children[0].props.children, ' جاهز ');
  assert.equal(result.props.children[0].key, 'ready');
  assert.equal(result.props.children[1], null);
  assert.equal(result.props.children[2], 0);
});


test('templated system messages translate without changing flight identifiers or recorded quantities', () => {
  assert.equal(localizeText('KVA105 flight is complete. The dispatcher session is closed from recorded KVA OS evidence.', 'ar'), 'اكتملت الرحلة KVA105. أُغلقت جلسة التجهيز بناءً على أدلة KVA OS المسجّلة.');
  assert.equal(localizeText('100% confidence', 'ar'), 'الثقة 100٪');
  assert.equal(localizeText('Assigned aircraft: SU-KAAA.', 'ar'), 'الطائرة المعيّنة: SU-KAAA.');
  assert.equal(localizeText('40 ft/min', 'ar'), '40 قدم/دقيقة');
  assert.equal(localizeText('· 60 min', 'ar'), '· 60 دقيقة');
  assert.equal(localizeText('١٢ NM', 'ar'), '١٢ ميل بحري');
});

test('React client references are neither inspected nor invoked during server localization', () => {
  const clientReference = new Proxy(() => {}, {get: (_, property) => {
    if (property === 'toString' || property === Symbol.toPrimitive) throw new Error('Cannot inspect client module');
    return undefined;
  }});
  const original = React.createElement(clientReference, {title: 'Flight Planning'});
  const result = localizeUi(original, 'ar');
  assert.equal(result.type, original.type);
  assert.equal(result.props.title, 'تخطيط الرحلة');
});

test('all message templates preserve exactly the same recorded-value placeholders', () => {
  const templates = JSON.parse(readFileSync(join(testDirectory, 'ui-patterns-ar.json'), 'utf8'));
  for (const [source, translation] of Object.entries(templates)) {
    const placeholders = text => [...text.matchAll(/\{([a-z]+)\}/gi)].map(match => match[1]).sort();
    assert.deepEqual(placeholders(source), placeholders(translation), source);
  }
});
