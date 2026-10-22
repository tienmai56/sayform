import type { ExerciseSkillId, ExerciseTemplateId } from '@/lib/types';

export type ExerciseTemplate = {
  id: ExerciseTemplateId;
  skillId: ExerciseSkillId;
  title: string;
  targetSkill: string;
  behaviorCode: string;
  objective: string;
  instructions: string[];
  estimatedMinutes: number;
  successCriteria: string[];
  guidedPrompts: string[];
  transferPrompt: string;
  levelGuidance: [string, string, string];
};

export const exerciseTemplates: ExerciseTemplate[] = [
  {
    id: 'E1',
    skillId: 'S1',
    title: 'Answer First',
    targetSkill: 'Structuring thoughts',
    behaviorCode: 'state_main_point_first',
    objective: 'Open with a direct answer or recommendation, then support it with relevant reasoning.',
    instructions: ['Take a brief moment to organize your thoughts.', 'State the direct answer or recommendation first.', 'Add no more than two connected supporting points.'],
    estimatedMinutes: 4,
    successCriteria: ['The opening directly answers the question.', 'Supporting points connect logically to the conclusion.', 'The answer remains coherent and complete.'],
    guidedPrompts: [
      'Your team discovered a critical issue two days before launch. Would you delay the release?',
      'A project is over budget but close to completion. What should the team do next?',
      'Two priorities are equally urgent and resources are limited. Which should come first?',
    ],
    transferPrompt: 'A senior leader asks whether to pause a promising but uncertain initiative. What do you recommend?',
    levelGuidance: ['Use: answer first, then reason one and reason two.', 'Lead with the answer; use only one brief planning cue.', 'Answer directly without a visible framework.'],
  },
  {
    id: 'E2',
    skillId: 'S2',
    title: 'Defend Your Reasoning',
    targetSkill: 'Reasoning',
    behaviorCode: 'support_claims_with_reasoning',
    objective: 'Make a recommendation and explain the reasons, evidence, assumptions, and trade-offs behind it.',
    instructions: ['Take a position or make a recommendation.', 'Support it with relevant reasons or evidence.', 'Name an assumption, trade-off, or condition that could change your view.'],
    estimatedMinutes: 5,
    successCriteria: ['Claims have relevant support.', 'The reasoning is logically coherent.', 'Assumptions and uncertainty are acknowledged.', 'The response addresses a challenge meaningfully.'],
    guidedPrompts: [
      'Should your team invest in reliability before adding new features? Defend your recommendation.',
      'A colleague challenges the evidence behind your proposal. Explain why your recommendation still holds.',
      'What assumption in your plan is most important, and what would change your mind?',
    ],
    transferPrompt: 'Your manager proposes a faster approach with more risk. Take a position and defend it.',
    levelGuidance: ['Use: claim, two reasons, one assumption.', 'Make the logic explicit and answer one challenge.', 'Defend the position and address a counterargument without a framework.'],
  },
  {
    id: 'E3',
    skillId: 'S3',
    title: 'Explain It Simply',
    targetSkill: 'Articulation',
    behaviorCode: 'explain_without_unnecessary_jargon',
    objective: 'Explain a complex idea clearly while preserving its important meaning.',
    instructions: ['Name the central idea in plain language.', 'Explain or remove jargon.', 'Use one concrete example or comparison when it helps understanding.'],
    estimatedMinutes: 4,
    successCriteria: ['The central concept remains accurate.', 'Unnecessary jargon is removed or explained.', 'The explanation fits the intended audience.', 'Clarification uses different wording.'],
    guidedPrompts: [
      'Explain a technical concept from your work to a new teammate with no background in it.',
      'Explain the same concept to a business stakeholder who only needs the practical impact.',
      'The listener misunderstood your explanation. Clarify it using a different example.',
    ],
    transferPrompt: 'Explain a complicated process you know well to an intelligent listener outside your field.',
    levelGuidance: ['Use: plain-language definition, example, why it matters.', 'Adapt the detail to the named audience with one brief cue.', 'Explain clearly without a framework or sample wording.'],
  },
  {
    id: 'E4',
    skillId: 'S4',
    title: 'Compression Ladder',
    targetSkill: 'Concision',
    behaviorCode: 'retain_core_message_with_fewer_words',
    objective: 'Keep the conclusion and essential reasoning while removing repetition and irrelevant detail.',
    instructions: ['State the core message.', 'Keep only essential reasoning or qualification.', 'Remove repeated setup and details that do not change the decision.'],
    estimatedMinutes: 4,
    successCriteria: ['The main conclusion is retained.', 'Essential reasoning remains.', 'Unnecessary information is removed.', 'The result is not misleading or incomplete.'],
    guidedPrompts: [
      'Explain a recent work decision in 60 seconds while preserving the key reason.',
      'Give the same decision and reasoning in about 30 seconds.',
      'Deliver the essential decision, reason, and consequence in about 15 seconds.',
    ],
    transferPrompt: 'Summarize a complex recommendation for a busy executive who has less than 20 seconds.',
    levelGuidance: ['Use: decision, key reason, consequence. Aim for 60 seconds.', 'Keep the same meaning in about 30 seconds.', 'Use no framework hint; keep only what the listener needs.'],
  },
  {
    id: 'E5',
    skillId: 'S5',
    title: 'Surprise Question',
    targetSkill: 'Thinking on your feet',
    behaviorCode: 'organize_unprepared_response',
    objective: 'Organize a coherent response to an unfamiliar question without relying on a script.',
    instructions: ['Pause briefly to identify the question.', 'Choose a clear organizing point.', 'Answer, then recover explicitly if you need to qualify or redirect.'],
    estimatedMinutes: 4,
    successCriteria: ['The response addresses the question.', 'The response follows a coherent structure.', 'Logic remains connected under challenge.', 'The speaker recovers from uncertainty.'],
    guidedPrompts: [
      'What workplace practice would you eliminate, and why?',
      'You are asked to own a problem outside your expertise. How do you respond?',
      'A leader interrupts and challenges your premise. How do you continue?',
    ],
    transferPrompt: 'What is one professional belief you changed recently, and what caused the change?',
    levelGuidance: ['Pause, then use: position, reason, example.', 'Use one short organizing cue only.', 'Respond without a visible framework.'],
  },
  {
    id: 'E6',
    skillId: 'S6',
    title: 'Read the Room',
    targetSkill: 'Audience adaptation',
    behaviorCode: 'adapt_to_listener_priorities',
    objective: 'Adjust a recommendation to the listener’s knowledge, priorities, and objections.',
    instructions: ['Identify what this listener cares about.', 'Choose the appropriate level of detail.', 'Address the listener’s concern while keeping the recommendation consistent.'],
    estimatedMinutes: 5,
    successCriteria: ['Relevant stakeholder concerns are recognized.', 'The response addresses rather than repeats.', 'Detail matches the audience.', 'The recommendation remains understandable and consistent.'],
    guidedPrompts: [
      'Explain a process change to a teammate who is worried about extra workload.',
      'Recommend a technical investment to a finance leader focused on cost and risk.',
      'Two stakeholders want different outcomes. Explain a recommendation that addresses both priorities.',
    ],
    transferPrompt: 'Present a change to a skeptical executive who cares about business impact but not implementation detail.',
    levelGuidance: ['Use: audience concern, recommendation, relevant benefit.', 'Adapt detail and answer one stakeholder objection.', 'Respond to the audience without a framework hint.'],
  },
];

export function getExerciseTemplate(id: string | null | undefined) {
  return exerciseTemplates.find((template) => template.id === id) ?? exerciseTemplates[0];
}

export function fallbackExercisePrompt(templateId: ExerciseTemplateId, attemptNumber: number, transfer = false) {
  const template = getExerciseTemplate(templateId);
  if (transfer) return template.transferPrompt;
  return template.guidedPrompts[Math.min(Math.max(attemptNumber - 1, 0), template.guidedPrompts.length - 1)];
}
