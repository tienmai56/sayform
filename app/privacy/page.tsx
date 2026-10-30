import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Sayform collects, uses, and protects your information.',
};

const sections = [
  {
    title: '1. Who this policy covers',
    paragraphs: ['This Privacy Policy explains how Sayform handles information from visitors, people requesting a coach match, learners, and coaches. It covers our website and coaching services, including features introduced during the beta.'],
  },
  {
    title: '2. Information we collect',
    paragraphs: ['When you request a coach match, we collect the information you submit, including your email, current role, company, coaching goals, speaking challenges, and session budget. Coaches may provide profile information, professional experience, pricing expectations, and availability.', 'When you use learning features, we process the answers, practice content, transcripts, coach notes, feedback, exercise responses, and progress information needed to support your learning. Audio or video processing depends on the feature you choose and the notice shown before capture begins.', 'We also process account details, essential session cookies, and technical information needed to sign you in, troubleshoot problems, and protect the service.'],
  },
  {
    title: '3. How we use your information',
    paragraphs: ['We use your application details to review your request, find a suitable coach, and contact you about next steps. We use account and scheduling information to provide the service.', 'Your lesson and practice content is used only to support your coaching: prepare lessons, generate personalized feedback and targeted exercises, track your progress, and help your coach guide your learning. We do not use this content for advertising, unrelated profiling, or other learners’ lessons.', 'Limited access may also be necessary to resolve a support issue you raise, investigate security incidents, or meet legal obligations.'],
  },
  {
    title: '4. Your information is not AI training data',
    paragraphs: ['Sayform does not use your personal information, calls, transcripts, coach notes, feedback, or exercise responses to train or fine-tune AI models. Generating feedback from your content is different from using it to train a model.', 'We require AI services processing coaching content on our behalf to operate under no-training protections. Processing by a provider is limited to delivering the requested learning features.'],
  },
  {
    title: '5. Calls, recordings, and consent',
    paragraphs: ['In-platform coach calls are not yet available in the current beta. Before enabling them, we will put encryption and appropriate provider privacy protections in place and explain how call content is processed.', 'Before recording or transcribing a coach call, we will explain what is captured, why it is needed, who can access it, and how long it is kept, and obtain participants’ consent. Joining a call is not, by itself, consent to recording.', 'Saved transcripts, feedback, and exercises are separate from temporary audio or video. We will not promise that all recordings are deleted immediately unless that feature’s deletion process has been verified.'],
  },
  {
    title: '6. Encryption and access',
    paragraphs: ['Information stored in our hosted Supabase database is encrypted at rest. Connections to the database and AI services use encrypted HTTPS/TLS connections. Use the secure HTTPS version of Sayform when it is deployed publicly.', 'Access controls restrict learning records to authorized users. Your assigned coach can access the information needed for your lessons, and authorized Sayform team members may access information when needed for matching, support, security, or legal obligations.', 'Encryption does not mean that only you can read the information. Authorized services must process relevant content to generate feedback and exercises; we do not describe this processing as end-to-end encrypted. No service can guarantee absolute security.'],
  },
  {
    title: '7. When information is shared',
    paragraphs: ['We share relevant goals, background, and learning information with your assigned coach to support your lessons. We use service providers for database hosting, authentication, and AI processing, including Supabase and OpenRouter with the model providers selected for the relevant feature.', 'We do not sell your personal information or share lesson content for targeted advertising. We may disclose information when legally required or necessary to protect users and the service. Providers may process information in countries other than your own.'],
  },
  {
    title: '8. How long we keep information',
    paragraphs: ['We retain application information while reviewing and following up on your request, and learning records while needed to provide your coaching and progress history. We do not yet publish a fixed retention period for every beta feature.', 'You may request deletion. Some information may need to be retained for legal obligations or security, and deletion from backups may take additional time. Feature-specific notices will explain any recording retention before capture begins.'],
  },
  {
    title: '9. Your choices and requests',
    paragraphs: ['You can request access to, correction of, or deletion of your personal information, and withdraw consent for optional processing. Available rights depend on your location. We may need to verify your identity before fulfilling a request.', 'To make a privacy request during the beta, reply to an email you have received from the Sayform team. Do not send passwords or sensitive identity documents in your initial request.'],
  },
  {
    title: '10. Updates to this policy',
    paragraphs: ['We will update this page as our services and data practices change and revise the date above. If a change requires a new notice or consent, we will provide it before the relevant processing begins.'],
  },
];

export default function PrivacyPage() {
  return <main className="min-h-screen bg-[#fbf9ff] px-6 py-10 text-[#211b29]">
    <div className="mx-auto max-w-3xl">
      <Link href="/home" className="font-display text-2xl font-semibold tracking-tight text-violet-700">sayform</Link>
      <header className="mb-10 mt-14">
        <p className="mb-3 text-sm font-semibold text-violet-700">Your information. Your learning.</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Privacy Policy</h1>
        <p className="mt-4 text-sm text-[#655b70]">Last updated: October 30, 2026</p>
        <p className="mt-6 text-base leading-7">Human coaching is personal. This policy explains what we collect, how we use it to support your learning, and the choices you have.</p>
        <div className="mt-6 border-l-4 border-violet-400 pl-5 text-base leading-7">
          <p className="font-semibold">Your learning is the purpose. Your data is not for training AI.</p>
          <p className="mt-2">We use lesson content to support your work with your coach, including personalized feedback and targeted exercises.</p>
        </div>
      </header>
      <nav aria-label="Policy contents" className="mb-12 border-y border-violet-100 py-5">
        <ol className="grid gap-2 text-sm sm:grid-cols-2">{sections.map((section, i) => <li key={section.title}><a href={`#privacy-${i + 1}`} className="text-violet-800 underline-offset-4 hover:underline">{section.title}</a></li>)}</ol>
      </nav>
      <div className="space-y-9">{sections.map((section, i) => <section id={`privacy-${i + 1}`} key={section.title} className="scroll-mt-8">
        <h2 className="mb-3 text-xl font-semibold">{section.title}</h2>
        {section.paragraphs.map(paragraph => <p key={paragraph} className="mt-3 text-base leading-7 text-[#51495b]">{paragraph}</p>)}
      </section>)}</div>
      <footer className="mt-14 border-t border-violet-100 py-7"><Link href="/home" className="text-sm font-semibold text-violet-700 hover:underline">Back to Sayform</Link></footer>
    </div>
  </main>;
}
