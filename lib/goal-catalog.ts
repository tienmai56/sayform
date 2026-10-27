import type { Goal, GoalSkill } from '@/lib/types';

export type GoalDefinition = {
  key: string;
  title: string;
  description: string;
  skills: GoalSkill[];
  defaultCategory: string;
  questions: { prompt: string; skillId: string }[];
  requiresPersonalPrompt?: boolean;
  coachInstructions?: string;
  evaluationFramework?: {
    name: string;
    description: string;
    criteria: Array<{
      id: string;
      title: string;
      description: string;
      feedbackDimension: 'Vocabulary' | 'Sentence structure' | 'Communication effectiveness' | 'Critical thinking';
    }>;
  };
};

export const goalCatalog: GoalDefinition[] = [
  {
    key: 'clarity',
    title: 'Interview',
    description: '',
    defaultCategory: 'professional',
    requiresPersonalPrompt: true,
    coachInstructions: 'You are an experienced hiring manager and interview coach helping the candidate improve their interviewing skills and land their next job. Always make three interview checks explicit: Did the candidate answer the actual question? Was the reasoning easy to follow? Did the candidate provide a clear conclusion? Also evaluate specific evidence, personal actions and impact, judgment, self-awareness, vocabulary, sentence quality, concision, and conversational fluency. Be candid, supportive, and practical. Do not invent job requirements or facts that the candidate did not provide.',
    skills: [
      { id: 'direct-answer', title: 'Answer the question directly', description: 'Lead with a clear answer before adding context.' },
      { id: 'structured-example', title: 'Structure a compelling example', description: 'Organize the situation, actions, and result so the story is easy to follow.' },
      { id: 'specific-impact', title: 'Show impact with evidence', description: 'Use concrete outcomes, scope, and examples instead of broad claims.' },
      { id: 'judgment', title: 'Demonstrate judgment and self-awareness', description: 'Explain decisions, tradeoffs, learning, and personal ownership.' },
      { id: 'concise-delivery', title: 'Be concise and conversational', description: 'Remove repetition and filler while sounding natural and credible.' },
    ],
    questions: [],
  },
  {
    key: 'negotiation',
    title: 'Negotiate effectively',
    description: 'Make clear proposals, navigate tradeoffs, and move toward agreement.',
    defaultCategory: 'persuasion',
    skills: [
      { id: 'position', title: 'State your position and outcome', description: 'Make the request and desired result explicit.' },
      { id: 'interests', title: 'Surface interests and constraints', description: 'Separate underlying needs from stated positions.' },
      { id: 'tradeoffs', title: 'Frame tradeoffs and concessions', description: 'Show what can move and what must remain protected.' },
      { id: 'objections', title: 'Respond to objections', description: 'Address the strongest concern without becoming defensive.' },
      { id: 'next-step', title: 'Close with a clear next step', description: 'Turn discussion into a concrete path forward.' },
    ],
    questions: [
      {
        skillId: 'position',
        prompt: 'You need two additional weeks for an important project. How would you make the request to a skeptical stakeholder?',
      },
      {
        skillId: 'interests',
        prompt: 'Two teams want the same limited engineering support. How would you uncover what each team actually needs?',
      },
      {
        skillId: 'tradeoffs',
        prompt: 'A client asks for a lower price without reducing scope. Propose a tradeoff that protects the relationship and the work.',
      },
      {
        skillId: 'objections',
        prompt: 'Your manager says your proposal is too risky. Respond to the objection and make a stronger case.',
      },
      {
        skillId: 'next-step',
        prompt: 'A negotiation has stalled because both sides want more information. Close the conversation with a practical next step.',
      },
    ],
  },
  {
    key: 'storytelling',
    title: 'Tell compelling stories',
    description: 'Turn experiences into structured stories with a meaningful takeaway.',
    defaultCategory: 'storytelling',
    skills: [
      { id: 'five-second-moment', title: 'Build toward a five-second moment', description: 'Land on a specific realization or change in perspective.' },
      { id: 'start-close-to-action', title: 'Start close to the action', description: 'Begin near the consequential moment instead of overexplaining background.' },
      { id: 'stakes', title: 'Establish meaningful stakes', description: 'Make clear what could be gained, lost, or changed and why it mattered.' },
      { id: 'beginning-ending-contrast', title: 'Create beginning-to-ending contrast', description: 'Show how the storyteller’s understanding or situation changed.' },
    ],
    evaluationFramework: {
      name: "Matthew Dicks’ Storyworthy framework",
      description: 'A compelling story builds toward a five-second moment—a realization or change in perspective—while beginning close to the action, establishing meaningful stakes, and showing a clear contrast between the beginning and ending.',
      criteria: [
        { id: 'five-second-moment', title: 'Five-second moment', description: 'Does the story build toward a specific realization or change in perspective?', feedbackDimension: 'Communication effectiveness' },
        { id: 'start-close-to-action', title: 'Start close to the action', description: 'Does the opening begin near the consequential moment with only necessary context?', feedbackDimension: 'Sentence structure' },
        { id: 'stakes', title: 'Meaningful stakes', description: 'Does the listener understand what could be gained, lost, or changed and why it matters?', feedbackDimension: 'Critical thinking' },
        { id: 'beginning-ending-contrast', title: 'Beginning-to-ending contrast', description: 'Does the language make the difference between the storyteller at the beginning and ending concrete?', feedbackDimension: 'Vocabulary' },
      ],
    },
    questions: [
      {
        skillId: 'start-close-to-action',
        prompt: 'Tell a story about a project that started with an unclear problem. Set the scene without overexplaining it.',
      },
      {
        skillId: 'five-second-moment',
        prompt: 'Describe a moment when one small detail changed how you understood a situation.',
      },
      {
        skillId: 'stakes',
        prompt: 'Tell a story about a decision where the consequences mattered to other people, not only to you.',
      },
      {
        skillId: 'five-second-moment',
        prompt: 'Describe a decision you changed after receiving new information. What changed your mind?',
      },
      {
        skillId: 'beginning-ending-contrast',
        prompt: 'Tell a story about a mistake that changed how you work today, and finish with the takeaway you carried forward.',
      },
    ],
  },
];

const fallbackQuestions = [
  'What is one communication habit you want to change, and what would improvement look like?',
  'Describe a recent conversation that did not go as planned. What would you say differently now?',
  'Explain an opinion you hold that a thoughtful colleague might disagree with.',
];

export function getGoalDefinition(templateKey?: string | null) {
  return goalCatalog.find((goal) => goal.key === templateKey);
}

export function getPracticeQuestions(templateKey?: string | null) {
  const definition = getGoalDefinition(templateKey);
  if (!definition) return fallbackQuestions;
  return definition.questions.map((question) => question.prompt);
}

export function createDemoGoals(): Goal[] {
  return goalCatalog.map((goal) => ({
    id: `demo-goal-${goal.key}`,
    templateKey: goal.key,
    isCustom: false,
    isActive: goal.key === 'clarity',
    title: goal.title,
    description: goal.description,
    skills: goal.skills,
    defaultCategory: goal.defaultCategory,
    status: 'active',
    lastPractised: null,
    sessions: 0,
    recommended: true,
  }));
}
