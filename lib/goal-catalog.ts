import type { Goal, GoalSkill } from '@/lib/types';

export type GoalDefinition = {
  key: string;
  title: string;
  description: string;
  skills: GoalSkill[];
  defaultCategory: string;
  questions: { prompt: string; skillId: string }[];
};

export const goalCatalog: GoalDefinition[] = [
  {
    key: 'clarity',
    title: 'Communicate with clarity',
    description: 'Make complex ideas easy to understand, concise, and direct.',
    defaultCategory: 'professional',
    skills: [
      { id: 'main-point', title: 'Lead with the main point', description: 'Give listeners the frame before the detail.' },
      { id: 'complex-ideas', title: 'Explain complex ideas clearly', description: 'Translate complexity without losing the meaning.' },
      { id: 'concise', title: 'Be concise and direct', description: 'Remove repetition, hedging, and detours.' },
      { id: 'logical-flow', title: 'Build a logical flow', description: 'Connect ideas with an order listeners can follow.' },
      { id: 'precise-language', title: 'Use precise language', description: 'Replace broad wording with concrete meaning.' },
    ],
    questions: [
      {
        skillId: 'complex-ideas',
        prompt: 'Explain a technical or complex idea from your work to a colleague who has no background in it.',
      },
      {
        skillId: 'concise',
        prompt: 'Give a one-minute update on a project that is behind schedule. What matters most right now?',
      },
      {
        skillId: 'main-point',
        prompt: 'Your team can invest in speed or reliability this quarter, but not both. Which would you choose, and why?',
      },
      {
        skillId: 'logical-flow',
        prompt: 'Describe a difficult decision you made and walk your listener through the reasoning in a clear order.',
      },
      {
        skillId: 'precise-language',
        prompt: 'Describe one process at work that should improve, including the specific consequence of leaving it unchanged.',
      },
    ],
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
      { id: 'context', title: 'Establish context efficiently', description: 'Give just enough background to orient the listener.' },
      { id: 'details', title: 'Choose relevant details', description: 'Use concrete details that move the story forward.' },
      { id: 'stakes', title: 'Create stakes or tension', description: 'Make clear why the moment mattered.' },
      { id: 'turning-point', title: 'Land the turning point', description: 'Show the decision, realization, or change.' },
      { id: 'takeaway', title: 'End with a meaningful takeaway', description: 'Connect the story to what the listener should retain.' },
    ],
    questions: [
      {
        skillId: 'context',
        prompt: 'Tell a story about a project that started with an unclear problem. Set the scene without overexplaining it.',
      },
      {
        skillId: 'details',
        prompt: 'Describe a moment when one small detail changed how you understood a situation.',
      },
      {
        skillId: 'stakes',
        prompt: 'Tell a story about a decision where the consequences mattered to other people, not only to you.',
      },
      {
        skillId: 'turning-point',
        prompt: 'Describe a decision you changed after receiving new information. What changed your mind?',
      },
      {
        skillId: 'takeaway',
        prompt: 'Tell a story about a mistake that changed how you work today, and finish with the lesson you carried forward.',
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

export function getPracticeQuestions(templateKey?: string | null, skillFocus?: string) {
  const definition = getGoalDefinition(templateKey);
  if (!definition) return fallbackQuestions;
  if (skillFocus && skillFocus !== 'coach-choice') {
    const focused = definition.questions.filter((question) => question.skillId === skillFocus);
    if (focused.length) return focused.map((question) => question.prompt);
  }
  return definition.questions.map((question) => question.prompt);
}

export function createDemoGoals(): Goal[] {
  return goalCatalog.map((goal) => ({
    id: `demo-goal-${goal.key}`,
    templateKey: goal.key,
    isCustom: false,
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
