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

export const useCases = [
  "Local services",
  "Ecommerce",
  "Marketplaces",
  "Agencies",
] as const;

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
