export const featureCards = [
  {
    title: "AI Chatbot",
    href: "/features/ai-chatbot",
    eyebrow: "Visitor experience",
    description:
      "Answer website questions with responses grounded in your business knowledge.",
  },
  {
    title: "Lead Capture",
    href: "/features/lead-capture",
    eyebrow: "Conversion",
    description:
      "Ask for details at the right moment with subtle, configurable in-chat CTAs.",
  },
  {
    title: "SEO Content Pipeline",
    href: "/features/seo-content-pipeline",
    eyebrow: "Growth",
    description:
      "Turn repeated conversations into fully SEO-optimised articles, briefs, and content ideas.",
  },
  {
    title: "SEO Performance Analytics",
    href: "/features/analytics",
    eyebrow: "Measurement",
    description:
      "Use Search Console, GA4, and keyword inputs to track what new or updated content changed.",
  },
  {
    title: "Content Maintenance",
    href: "/features/content-maintenance",
    eyebrow: "Site quality",
    description:
      "Keep FAQs, service pages, and content hubs accurate as customer questions change.",
  },
  {
    title: "Knowledge Base",
    href: "/features/knowledge-base",
    eyebrow: "Grounding",
    description:
      "Use site pages and uploaded files so the chatbot understands the business.",
  },
  {
    title: "CMS Publishing",
    href: "/features/cms-publishing",
    eyebrow: "Workflow",
    description:
      "Review approved content and publish to WordPress, Shopify, Webflow, or custom REST.",
  },
] as const;

/**
 * Six features picked for the home page grid (3x2). Drops Content
 * Maintenance because the SEO Content Pipeline covers the same buyer
 * job at the home-page summary level. The full set still lives on
 * /features.
 */
export const homeFeatureCards = [
  featureCards[0],
  featureCards[1],
  featureCards[2],
  featureCards[3],
  featureCards[5],
  featureCards[6],
] as const;

export const workflowSteps = [
  {
    title: "Chat",
    description:
      "Visitors ask real questions and get useful answers from a branded website assistant.",
  },
  {
    title: "Capture",
    description:
      "Convo detects intent and can ask for contact details using your timing, fields, and copy.",
  },
  {
    title: "Decide",
    description:
      "Convo checks existing site content and SEO data before recommending a new article, FAQ update, page edit, or no action.",
  },
  {
    title: "Measure",
    description:
      "Humans review the output, then track impressions, clicks, rankings, conversations, and leads.",
  },
] as const;

/**
 * Three-step variant used on the home page. The five-step workflow
 * still lives on /how-it-works.
 */
export const homeWorkflowSteps = [
  {
    number: "01",
    title: "Chat",
    description:
      "Convo answers your visitors 24/7 using your real business knowledge. It captures leads when the question is ready, not before.",
  },
  {
    number: "02",
    title: "Decide",
    description:
      "Convo groups recurring questions, checks what your site already covers, and writes the page that's missing. Or updates the one that's drifted.",
  },
  {
    number: "03",
    title: "Publish",
    description:
      "Reviewed, SEO-optimised content flows into WordPress, Shopify, or Webflow. Performance is tracked against the conversations that started it.",
  },
] as const;

export const faqGroups = [
  {
    title: "Product basics",
    items: [
      {
        question: "What is Convo?",
        answer:
          "Convo is an AI chatbot, lead capture, and content platform for websites. It chats with visitors, captures qualified leads, and turns recurring questions into reviewed articles, FAQs, and page updates.",
      },
      {
        question: "What makes it different from a normal chatbot?",
        answer:
          "A normal chatbot answers questions or captures leads. Convo also analyses conversations for content gaps, lead signals, and repeated customer language.",
      },
      {
        question: "Does every conversation become content?",
        answer:
          "No. Convo recommends the right action: create new content, update existing content, merge content, or leave the site unchanged when the answer already exists.",
      },
    ],
  },
  {
    title: "Lead capture",
    items: [
      {
        question: "Can Convo collect leads?",
        answer:
          "Yes. Convo can ask for contact details inside the chat flow using configurable prompts and subtle CTAs.",
      },
      {
        question: "When does it ask for lead details?",
        answer:
          "The business can control this by message count, buying intent, qualifying questions, selected pages, or other configured rules.",
      },
      {
        question: "Where do leads go?",
        answer:
          "Leads are captured with conversation context and can be routed to the business's CRM, CMS, webhook, or lead workflow where supported.",
      },
    ],
  },
  {
    title: "Content and publishing",
    items: [
      {
        question: "What content can Convo create or update?",
        answer:
          "Convo supports fully SEO-optimised blog drafts, FAQ entries, service page sections, product/category copy, comparison pages, and update briefs for existing pages.",
      },
      {
        question: "Does Convo use SEO tools and performance data?",
        answer:
          "Convo can use connected or imported data from sources such as Google Search Console, GA4, and Ahrefs-style keyword research to optimise content and measure results after publishing.",
      },
      {
        question: "Can Convo show whether content is working?",
        answer:
          "Yes. Convo tracks new and updated content URLs against impressions, clicks, keyword movement, conversations, and leads where analytics and search data are connected.",
      },
      {
        question: "Can I review before publishing?",
        answer:
          "Yes. Human review is the default. Auto-publishing is only used when a customer explicitly configures it.",
      },
      {
        question: "Which CMS platforms are supported?",
        answer:
          "Convo supports publishing workflows for WordPress, Shopify, Webflow, and generic REST APIs.",
      },
    ],
  },
] as const;

/**
 * Five FAQ items picked for the home page. Each one handles a real
 * buyer objection. Same set is emitted as FAQPage JSON-LD for SEO.
 */
export const homeFaqs = [
  {
    question: "What is Convo?",
    answer:
      "Convo is an AI chatbot, lead capture, and content engine for service-business websites. It chats with your visitors, captures qualified leads, and turns recurring questions into SEO-optimised articles, FAQs, and page updates that you review before publishing.",
  },
  {
    question: "How is this different from a normal chatbot?",
    answer:
      "A normal chatbot answers a question and the data disappears. Convo turns every conversation into a signal: the lead now, and the page that ranks for that question later. Both compound.",
  },
  {
    question: "Will it sound like my business?",
    answer:
      "Yes. Convo is grounded in your own pages, files, and brand voice. You set the topic guardrails. Articles come back with the same tone as the rest of your site.",
  },
  {
    question: "Do I have to publish whatever it writes?",
    answer:
      "No. Human review is the default. You see the source conversations, the SEO score, and the draft. You approve, edit, or skip. Auto-publishing is opt-in only.",
  },
  {
    question: "Which CMS does it work with?",
    answer:
      "WordPress, Shopify, Webflow, and a generic REST API for custom stacks. Install is a script tag. Most customers are live within 15 minutes.",
  },
] as const;

export const useCases = [
  "Local services",
  "Ecommerce",
  "Marketplaces",
  "Agencies",
] as const;

/**
 * Verticals on the home page expansion grid. The badge on dental
 * signals the first wedge without narrowing positioning. Each tile
 * carries an example question so the buyer recognises their own
 * customer in the line.
 */
export type VerticalUseCase = {
  name: string;
  question: string;
  badge?: string;
};

export const verticalUseCases: ReadonlyArray<VerticalUseCase> = [
  {
    name: "Dental",
    question: "Do you do same-day crowns?",
    badge: "Pilot ready",
  },
  {
    name: "Vet",
    question: "Is my puppy due for a vaccine?",
  },
  {
    name: "Cosmetic",
    question: "How much downtime after a chin filler?",
  },
  {
    name: "Legal",
    question: "Do I have a case for unfair dismissal?",
  },
  {
    name: "Allied health",
    question: "Will my health fund cover this?",
  },
  {
    name: "Real estate",
    question: "What's the rental yield in this suburb?",
  },
  {
    name: "Financial advice",
    question: "Should I salary sacrifice?",
  },
  {
    name: "Agencies",
    question: "White-label Convo for your clients.",
  },
];

/**
 * Three home-page pricing tiles. Numbers locked in the GTM strategy
 * v1 (gtm/convo-gtm-strategy-v1.html, slide 21). Annual price shown
 * primary, monthly secondary. Same set used by /pricing as a starting
 * point.
 */
export type HomePricingTier = {
  name: string;
  annualMonthly: number;
  monthly: number;
  summary: string;
  points: ReadonlyArray<string>;
  href: string;
  cta: string;
  featured?: boolean;
};

export const homePricingTiers: ReadonlyArray<HomePricingTier> = [
  {
    name: "Starter",
    annualMonthly: 249,
    monthly: 299,
    summary: "For a single practice or site finding its content rhythm.",
    points: [
      "Chat assistant + lead capture",
      "4 published articles per month",
      "One site, one user",
      "Email support",
    ],
    href: "/pricing",
    cta: "Start free",
  },
  {
    name: "Growth",
    annualMonthly: 499,
    monthly: 599,
    summary: "For growing service businesses ready to compound.",
    points: [
      "Everything in Starter",
      "12 published articles per month",
      "Google Search Console connected",
      "Suburb and service page suggestions",
      "Three users, chat support",
    ],
    href: "/pricing",
    cta: "Start free",
    featured: true,
  },
  {
    name: "Scale",
    annualMonthly: 899,
    monthly: 1099,
    summary: "For multi-location and premium service brands.",
    points: [
      "Everything in Growth",
      "30 published articles per month",
      "Human review on every draft",
      "Up to five sites, dedicated success contact",
      "Quarterly strategy call",
    ],
    href: "/pricing",
    cta: "Start free",
  },
];

export type LaunchBonusItem = {
  label: string;
  value: string;
};

export type LaunchBonus = {
  totalValue: string;
  items: ReadonlyArray<LaunchBonusItem>;
};

export const homePricingBonuses: Readonly<Record<string, LaunchBonus>> = {
  Starter: {
    totalValue: "$2,000",
    items: [
      { label: "Free site SEO audit", value: "Valued up to $2,000" },
    ],
  },
  Growth: {
    totalValue: "$4,500",
    items: [
      { label: "Free site SEO audit", value: "Valued up to $2,000" },
      { label: "5 free keyword-optimised blog posts", value: "Usually $2,500" },
    ],
  },
  Scale: {
    totalValue: "$7,000",
    items: [
      { label: "Free site SEO audit", value: "Valued up to $2,000" },
      { label: "10 free keyword-optimised blog posts", value: "Usually $5,000" },
    ],
  },
};

export const integrations = [
  { name: "WordPress", mark: "W", tone: "bg-blue-50 text-blue-700 border-blue-100" },
  { name: "Shopify", mark: "S", tone: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  { name: "Webflow", mark: "Wf", tone: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  { name: "Google Search Console", mark: "G", tone: "bg-amber-50 text-amber-700 border-amber-100" },
  { name: "Google Analytics", mark: "GA", tone: "bg-orange-50 text-orange-700 border-orange-100" },
  { name: "Ahrefs", mark: "A", tone: "bg-sky-50 text-sky-700 border-sky-100" },
  { name: "Custom API", mark: "API", tone: "bg-zinc-100 text-zinc-700 border-zinc-200" },
] as const;

export const comparisonRows = [
  ["Website chat widget", true, false],
  ["Lead capture inside chat", true, false],
  ["Conversation-sourced content ideas", true, false],
  ["Fully SEO-optimised article drafts", true, true],
  ["FAQ and existing page updates", true, false],
  ["CMS publishing workflow", true, true],
  ["GSC/GA4/Ahrefs-style performance inputs", true, true],
  ["Broad technical SEO automation", false, true],
  ["Rank tracking as a core SEO suite", false, true],
  ["Built around first-party visitor questions", true, false],
] as const;
