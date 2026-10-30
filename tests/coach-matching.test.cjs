const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: name => imports[name] || require(name) });
  return exports;
}
const choices = load('lib/coach-matching.ts');
const { accessRequestSchema } = load('lib/validation.ts', { '@/lib/coach-matching': choices });
const valid = { email: ' Person@Example.com ', currentRole: 'Engineer', company: 'Example', goals: [choices.coachingGoals[0]], challenges: [choices.speakingChallenges[0]], sessionBudget: 'Not sure yet' };
test('coach matching normalizes email and accepts multiple goals and challenges', () => {
  const result = accessRequestSchema.parse({ ...valid, goals: choices.coachingGoals.slice(0, 2), challenges: choices.speakingChallenges.slice(0, 3), status: 'approved' });
  assert.equal(result.email, 'person@example.com');
  assert.equal(result.goals.length, 2);
  assert.equal(result.status, undefined);
});
test('company and current role are required; the old target-role field cannot substitute', () => {
  for (const field of ['company', 'currentRole']) assert.equal(accessRequestSchema.safeParse({ ...valid, [field]: undefined, targetRoles: 'Manager' }).success, false);
});
test('goals, challenges and budget must be supported choices', () => {
  for (const patch of [{ goals: [] }, { challenges: [] }, { sessionBudget: '' }, { goals: ['invented'] }, { sessionBudget: 'free forever' }]) {
    assert.equal(accessRequestSchema.safeParse({ ...valid, ...patch }).success, false);
  }
});
