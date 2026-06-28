export type ResourceAudience =
  | "Public website visitors"
  | "Business owners and marketers"
  | "Customer dashboard users"
  | "Troubleshooting"
  | "Comparison and alternatives";

export type ResourceArticle = {
  slug: string;
  title: string;
  description: string;
  category: ResourceAudience;
  intent: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  funnelStage: "Awareness" | "Consideration" | "Activation" | "Support";
  cta: string;
  public: boolean;
  dashboard: boolean;
  schema: "Article" | "FAQPage" | "HowTo";
  quickAnswer: string;
  whoThisIsFor: string;
  sections: Array<{
    heading: string;
    body: string;
    bullets: string[];
  }>;
  mistakes: string[];
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  related: string[];
};

function article(input: ResourceArticle): ResourceArticle {
  return input;
}

const publicEducation: ResourceArticle[] = [
  article({
    slug: "what-is-convo",
    title: "What is Convo?",
    description:
      "A plain-English guide to Convo, the website chat platform that turns visitor questions into leads, content ideas, and better answers.",
    category: "Business owners and marketers",
    intent: "Understand what Convo does and whether it fits the business.",
    primaryKeyword: "what is Convo",
    secondaryKeywords: ["AI chatbot for websites", "website chat platform", "chat to content"],
    funnelStage: "Awareness",
    cta: "Start free",
    public: true,
    dashboard: false,
    schema: "FAQPage",
    quickAnswer:
      "Convo is a website chat and content platform. It answers visitor questions, captures qualified enquiries, and helps teams turn repeated questions into useful website content.",
    whoThisIsFor:
      "Time-poor business owners, solopreneurs, small businesses, agencies, and marketing teams that need better leads and useful content without adding more manual work.",
    sections: [
      {
        heading: "The simple version",
        body:
          "Convo adds a branded chat assistant to a website. Visitors can ask questions in their own words and get a useful answer without hunting through pages or forms.",
        bullets: [
          "Answers questions using the business's own website and documents.",
          "Captures enquiry details when the conversation shows real intent.",
          "Highlights repeated questions that deserve better content.",
        ],
      },
      {
        heading: "What Convo helps teams do",
        body:
          "The value is not just the chat window. Convo helps teams turn everyday website questions into clearer answers, better-qualified enquiries, and content ideas grounded in real customer language.",
        bullets: [
          "Give visitors faster answers.",
          "Send better-qualified follow-up opportunities to the business.",
          "Create or improve content without relying only on expensive agencies, overloaded in-house teams, or guesswork.",
        ],
      },
      {
        heading: "What Convo is not",
        body:
          "Convo is not a generic form builder or a replacement for every support tool. It is best when visitor questions can become better answers, better follow-up, and better website content.",
        bullets: [
          "It does not replace the judgement of a sales or support team.",
          "It does not publish content without review unless the business chooses that workflow.",
          "It is not just a booking form with a chat bubble attached.",
        ],
      },
    ],
    mistakes: [
      "Treating chat as a dead-end support channel.",
      "Asking for contact details before giving the visitor a useful answer.",
      "Creating content from guesses instead of actual visitor questions.",
    ],
    faqs: [
      {
        question: "Is Convo just another chatbot?",
        answer:
          "No. Convo includes website chat, but the broader product is about turning conversations into qualified enquiries and content opportunities.",
      },
      {
        question: "Who should use Convo?",
        answer:
          "Convo suits websites where visitors ask questions before they enquire, book, compare options, or choose a supplier.",
      },
      {
        question: "Does Convo replace my website content?",
        answer:
          "No. Convo helps visitors find answers now and helps the business see which content should be improved next.",
      },
    ],
    related: ["how-convo-turns-website-chats-into-seo-content", "how-is-convo-different-from-a-normal-website-chatbot"],
  }),
  article({
    slug: "how-convo-turns-website-chats-into-seo-content",
    title: "How Convo turns website chats into SEO content",
    description:
      "See how visitor questions become content recommendations, reviewed articles, FAQs, and website updates.",
    category: "Business owners and marketers",
    intent: "Understand the Convo growth loop from chat to content.",
    primaryKeyword: "website chat to SEO content",
    secondaryKeywords: ["conversation to content", "AI content workflow", "chatbot SEO content"],
    funnelStage: "Awareness",
    cta: "See how it works",
    public: true,
    dashboard: false,
    schema: "Article",
    quickAnswer:
      "Convo looks for useful patterns in website conversations, then helps the team decide whether to create a new article, improve an existing page, answer a common FAQ, or leave the site unchanged.",
    whoThisIsFor:
      "Businesses that do not have enough time to create content, teams spending too much on content production, and marketers who want ideas from real customer language.",
    sections: [
      {
        heading: "Start with real questions",
        body:
          "Visitors ask about price, timing, suitability, trust, setup, and next steps. Those questions are often a clearer content brief than a blank page, a generic keyword list, or another agency brainstorm.",
        bullets: [
          "Use the words visitors actually type.",
          "Spot repeat questions across different conversations.",
          "Separate useful content opportunities from one-off support noise.",
        ],
      },
      {
        heading: "Choose the right content action",
        body:
          "Not every question deserves a new blog post. Sometimes the better action is to update a service page, add an FAQ, improve product copy, or do nothing because the answer already exists.",
        bullets: [
          "Create when the topic deserves its own page.",
          "Update when an existing page should answer the question better.",
          "Skip when more content would create clutter.",
        ],
      },
      {
        heading: "Review before publishing",
        body:
          "Convo is designed around review. Teams can inspect the recommendation, edit the draft, approve it, publish it as a draft, or publish it live through a connected CMS.",
        bullets: [
          "Keep a human in the loop.",
          "Use clear metadata and related links.",
          "Measure whether the content helps search and visitor outcomes.",
        ],
      },
    ],
    mistakes: [
      "Publishing every chat topic as a standalone article.",
      "Ignoring existing pages that should be improved instead.",
      "Writing content that does not answer the visitor's original question.",
    ],
    faqs: [
      {
        question: "Does every chat become an article?",
        answer:
          "No. Convo is strongest when it recommends the right action, including create, update, merge, or skip.",
      },
      {
        question: "Can the team edit content first?",
        answer:
          "Yes. Review is the normal workflow before publishing.",
      },
      {
        question: "Why use chat data for SEO?",
        answer:
          "Chat data reveals the questions people ask while they are already on the website, which can be a strong sign of practical search and conversion demand.",
      },
    ],
    related: ["how-to-use-website-chat-data-for-seo-strategy", "how-to-turn-customer-questions-into-blog-posts-without-thin-content"],
  }),
  article({
    slug: "ai-chatbot-for-websites-what-convo-does-differently",
    title: "AI chatbot for websites: what Convo does differently",
    description:
      "Convo combines website chat, lead capture, content recommendations, publishing workflow, and performance measurement.",
    category: "Business owners and marketers",
    intent: "Compare Convo with ordinary website chatbots.",
    primaryKeyword: "AI chatbot for websites",
    secondaryKeywords: ["website chatbot", "AI lead capture chatbot", "chatbot for business website"],
    funnelStage: "Consideration",
    cta: "Explore AI Chatbot",
    public: true,
    dashboard: false,
    schema: "Article",
    quickAnswer:
      "Most website chatbots focus on answering or routing questions. Convo is built to help the business learn from those questions, capture qualified enquiries, and improve the website over time.",
    whoThisIsFor:
      "Lean teams comparing website chatbot options and trying to understand whether Convo can reduce content workload, improve enquiries, and support growth without extra headcount.",
    sections: [
      {
        heading: "Helpful answers first",
        body:
          "Convo should feel like part of the website, not a pop-up that gets in the way. The assistant can answer questions with the business's own knowledge before asking for contact details.",
        bullets: [
          "Branded widget experience.",
          "Answers grounded in business knowledge.",
          "Visitor-first flow before lead capture.",
        ],
      },
      {
        heading: "Lead capture when it makes sense",
        body:
          "A visitor is more likely to share details after the chat has helped them. Convo supports prompts that match the context of the conversation.",
        bullets: [
          "Ask after intent is clearer.",
          "Collect details needed for follow-up.",
          "Keep the chat context attached to the enquiry.",
        ],
      },
      {
        heading: "Content improvement loop",
        body:
          "The biggest difference is what happens after the chat. Convo helps the team see which questions deserve better pages, FAQs, articles, or product content.",
        bullets: [
          "Find repeated questions.",
          "Suggest content actions.",
          "Track the result after publishing.",
        ],
      },
    ],
    mistakes: [
      "Judging chat tools only by how fast they answer.",
      "Separating lead capture from the conversation context.",
      "Letting useful questions disappear after the chat ends.",
    ],
    faqs: [
      {
        question: "Can Convo work as a normal chatbot?",
        answer:
          "Yes. It can answer website questions, but the bigger value is the connected lead and content workflow around those conversations.",
      },
      {
        question: "Does Convo need lots of setup?",
        answer:
          "The basics are simple: create a business account, add the widget, connect knowledge, and tune the chat settings over time.",
      },
      {
        question: "Is Convo for sales or support?",
        answer:
          "It can support both, but it is especially useful when visitor questions can become better enquiries and better website content.",
      },
    ],
    related: ["how-is-convo-different-from-live-chat-and-support-inbox-tools", "how-convo-captures-leads-inside-chat"],
  }),
  article({
    slug: "how-convo-captures-leads-inside-chat",
    title: "How Convo captures leads inside a chat conversation",
    description:
      "Learn how Convo helps businesses collect useful enquiries after visitors have asked meaningful questions.",
    category: "Business owners and marketers",
    intent: "Understand how conversational lead capture works.",
    primaryKeyword: "lead capture chatbot",
    secondaryKeywords: ["AI lead capture", "chat lead capture", "website lead capture"],
    funnelStage: "Consideration",
    cta: "Explore Lead Capture",
    public: true,
    dashboard: false,
    schema: "Article",
    quickAnswer:
      "Convo captures leads by asking for contact details when the conversation suggests a useful next step, such as a quote, shortlist, booking, callback, or product recommendation.",
    whoThisIsFor:
      "Small businesses, service teams, and marketplaces that want more qualified enquiries without forcing every visitor through a form too early.",
    sections: [
      {
        heading: "Answer before asking",
        body:
          "The best lead capture feels like service. Convo can help the visitor first, then ask for details when there is a clear reason to follow up.",
        bullets: [
          "Avoid interrupting early visitors.",
          "Use the conversation to understand need.",
          "Make the ask feel connected to the answer.",
        ],
      },
      {
        heading: "Capture the useful context",
        body:
          "A form submission often gives the business a name and email but no context. A conversation can show what the visitor wanted, where they are, what they compared, and why they are asking.",
        bullets: [
          "Keep the conversation attached.",
          "Collect only useful fields.",
          "Give sales or support a warmer starting point.",
        ],
      },
      {
        heading: "Route the opportunity",
        body:
          "Captured enquiries can be reviewed in Convo and routed into the business's existing workflow where supported. If the best next step is a booking, Convo can guide the visitor toward the existing booking page or a supported appointment flow.",
        bullets: [
          "Review follow-up opportunities.",
          "Use contact details and conversation history together.",
          "Connect to the right next step, such as a quote, callback, booking page, or supported calendar flow.",
        ],
      },
    ],
    mistakes: [
      "Treating every visitor as ready to book.",
      "Asking for more fields than the business will actually use.",
      "Sending leads without the context that made them valuable.",
    ],
    faqs: [
      {
        question: "Can Convo replace my contact form?",
        answer:
          "Sometimes, but it often works best beside existing forms by helping visitors who need answers before they are ready to submit details.",
      },
      {
        question: "Can Convo work with booking forms too?",
        answer:
          "Yes. Convo can keep the existing booking path in place, send ready visitors to it, or use supported appointment tools inside the chat when that creates a better experience.",
      },
      {
        question: "Can Convo ask different questions for different visitors?",
        answer:
          "Convo can support tailored prompts and follow-up logic so the ask feels relevant to the conversation.",
      },
      {
        question: "Where do captured leads go?",
        answer:
          "They can be reviewed inside Convo and routed into connected tools where the account has configured that workflow.",
      },
    ],
    related: ["how-is-convo-different-from-booking-forms-and-lead-forms", "when-should-you-use-convo-live-chat-booking-form-or-all-three"],
  }),
  article({
    slug: "how-the-convo-knowledge-base-works",
    title: "How the Convo knowledge base works",
    description:
      "How Convo uses business knowledge from website pages and uploaded documents to answer visitor questions more accurately.",
    category: "Business owners and marketers",
    intent: "Understand why business knowledge improves chat quality.",
    primaryKeyword: "chatbot knowledge base",
    secondaryKeywords: ["AI chatbot knowledge base", "website chatbot documents", "business knowledge chatbot"],
    funnelStage: "Consideration",
    cta: "Explore Knowledge Base",
    public: true,
    dashboard: true,
    schema: "Article",
    quickAnswer:
      "Convo can use the business's website pages and uploaded documents as source knowledge, helping the chat assistant give answers that are specific to the business.",
    whoThisIsFor:
      "Website owners and operators who want the assistant to answer with the same information the business already trusts.",
    sections: [
      {
        heading: "Use what the business already knows",
        body:
          "Most businesses already have useful knowledge across web pages, FAQs, PDFs, product documents, service pages, and team guides. Convo helps make that information available in chat.",
        bullets: [
          "Connect a website domain.",
          "Upload helpful documents.",
          "Keep answers aligned with approved business information.",
        ],
      },
      {
        heading: "Better knowledge means better answers",
        body:
          "The assistant is only as useful as the information available to it. Clear source content helps Convo answer specific questions and avoid vague replies.",
        bullets: [
          "Add pricing, service areas, policies, and eligibility details where appropriate.",
          "Keep outdated documents out of the knowledge base.",
          "Refresh website content when the business changes.",
        ],
      },
      {
        heading: "Knowledge also shows content gaps",
        body:
          "If visitors keep asking questions that are not answered well by the website, that is a sign the site may need a clearer FAQ, guide, service page, or article.",
        bullets: [
          "Find missing answers.",
          "Improve existing pages.",
          "Support content planning with real visitor demand.",
        ],
      },
    ],
    mistakes: [
      "Uploading old documents that no longer reflect the business.",
      "Expecting good answers when the website itself is thin or unclear.",
      "Forgetting to refresh knowledge after major business changes.",
    ],
    faqs: [
      {
        question: "What files can I upload?",
        answer:
          "The current dashboard supports common document formats such as PDF, DOCX, and TXT files.",
      },
      {
        question: "Does Convo expose private documents publicly?",
        answer:
          "The documents are used to improve the chat experience for that business account. Public pages should only include content the business chooses to publish.",
      },
      {
        question: "What if the answer is not in my website or documents?",
        answer:
          "The best fix is usually to add or improve the source information, then refresh the knowledge available to Convo.",
      },
    ],
    related: ["convo-security-and-data-protection-faqs", "how-to-add-website-content-and-documents-to-convos-knowledge-base", "why-is-the-chatbot-not-using-my-website-content"],
  }),
  article({
    slug: "convo-security-and-data-protection-faqs",
    title: "Convo security and data protection FAQs",
    description:
      "Answers to common questions about how Convo protects business knowledge, visitor conversations, and content workflows.",
    category: "Business owners and marketers",
    intent: "Build buyer confidence around security and data protection.",
    primaryKeyword: "Convo security",
    secondaryKeywords: ["AI chatbot security", "prompt injection protection", "data protection chatbot"],
    funnelStage: "Consideration",
    cta: "Start free",
    public: true,
    dashboard: true,
    schema: "FAQPage",
    quickAnswer:
      "Convo is designed with layered safeguards for business knowledge, visitor conversations, and content workflows. It uses account controls, approved source knowledge, review steps, and protections against unsafe or off-topic requests.",
    whoThisIsFor:
      "Business owners, marketers, agencies, and teams that want the benefits of AI chat and content workflows without being casual about customer data or website safety.",
    sections: [
      {
        heading: "Protect business knowledge",
        body:
          "Convo uses the business knowledge connected to a specific account so the assistant can answer questions about that business. Teams should only connect sources they are comfortable using for visitor answers.",
        bullets: [
          "Use approved website pages and documents.",
          "Keep sensitive material out of visitor-facing answers unless it is meant to be shared.",
          "Review and refresh source knowledge when the business changes.",
        ],
      },
      {
        heading: "Reduce unsafe or misleading answers",
        body:
          "Public AI systems can be asked to ignore instructions, reveal information, or answer outside their purpose. Convo is designed to keep the assistant focused on the business, its approved knowledge, and the visitor's useful next step.",
        bullets: [
          "Keep answers grounded in the business's own information.",
          "Guide visitors back to supported topics when a question is not relevant.",
          "Avoid giving visitors access to private setup details or hidden instructions.",
        ],
      },
      {
        heading: "Keep humans in the loop",
        body:
          "Convo is built around review for higher-impact workflows. Leads, conversations, and content recommendations can be checked before teams act on them or publish content.",
        bullets: [
          "Review conversations and captured enquiries.",
          "Approve, edit, or reject content recommendations.",
          "Use publishing controls before content goes live.",
        ],
      },
    ],
    mistakes: [
      "Uploading documents that should never inform visitor answers.",
      "Treating AI output as final without review.",
      "Expecting a chatbot to replace normal privacy, access, and publishing controls.",
    ],
    faqs: [
      {
        question: "Does Convo protect against prompt injection?",
        answer:
          "Convo includes safeguards designed to reduce prompt-injection style attacks, such as attempts to make the assistant ignore its purpose, reveal hidden instructions, or move away from approved business topics. We do not publish the exact rules because that would make them easier to work around.",
      },
      {
        question: "Can visitors see private setup instructions?",
        answer:
          "No. Public visitors should only see helpful answers, prompts, and content the business intends to expose. Private setup details are not meant to be shown in visitor conversations.",
      },
      {
        question: "How should a business handle sensitive documents?",
        answer:
          "Only connect documents that are appropriate for Convo to use when helping visitors. If a document contains private commercial, staff, legal, or customer information that should not shape public answers, keep it out of the visitor knowledge sources.",
      },
      {
        question: "Does Convo publish content automatically?",
        answer:
          "Convo supports review-focused workflows. Teams can inspect, edit, approve, reject, or publish content according to the workflow they choose.",
      },
      {
        question: "What makes Convo safer than a generic AI chat widget?",
        answer:
          "Convo is built around business-specific knowledge, topic focus, reviewable recommendations, and account-level workflows rather than an open-ended assistant that tries to answer everything.",
      },
    ],
    related: ["how-the-convo-knowledge-base-works", "is-ai-generated-website-content-safe-to-publish", "how-convo-decides-create-update-merge-or-skip-content"],
  }),
  article({
    slug: "how-convo-decides-create-update-merge-or-skip-content",
    title: "How Convo decides whether to create, update, merge, or skip content",
    description:
      "Why good content automation should recommend the right action, not publish a new article for every question.",
    category: "Business owners and marketers",
    intent: "Understand how Convo helps teams keep content useful and reviewable.",
    primaryKeyword: "AI content recommendations",
    secondaryKeywords: ["create update merge content", "AI blog workflow", "content decision workflow"],
    funnelStage: "Consideration",
    cta: "Explore SEO Content Pipeline",
    public: true,
    dashboard: false,
    schema: "Article",
    quickAnswer:
      "Convo is designed to help teams choose the right content action: create a new article, improve an existing page, merge related ideas, answer with an FAQ, or skip the topic.",
    whoThisIsFor:
      "Teams that need more content output but do not want to pay for low-value volume, overload in-house staff, or publish thin AI pages.",
    sections: [
      {
        heading: "Create only when the topic deserves it",
        body:
          "A new article should have a clear reason to exist. Convo content should answer a real question, help the visitor make progress, and fit the site's wider content strategy.",
        bullets: [
          "Use a clear primary question.",
          "Avoid duplicate pages.",
          "Give each article a useful next step.",
        ],
      },
      {
        heading: "Update when an existing page should do the job",
        body:
          "Sometimes the best SEO move is not a new post. If the business already has a relevant page, the better action may be to improve that page with clearer answers.",
        bullets: [
          "Strengthen existing service pages.",
          "Add missing FAQs.",
          "Improve product or category copy.",
        ],
      },
      {
        heading: "Skip when content would not help",
        body:
          "Some questions are too narrow, too temporary, already answered, or not commercially useful. Skipping those topics protects the website from clutter.",
        bullets: [
          "Avoid thin articles.",
          "Keep the content library focused.",
          "Prioritise topics that help visitors and the business.",
        ],
      },
    ],
    mistakes: [
      "Creating a blog post for every single question.",
      "Publishing content that competes with an existing page.",
      "Ignoring the visitor's practical next step.",
    ],
    faqs: [
      {
        question: "Can Convo create FAQs instead of articles?",
        answer:
          "Yes. Some questions are better suited to FAQs or page updates rather than full articles.",
      },
      {
        question: "How do I keep content quality high?",
        answer:
          "Use review, clear article templates, related page links, and a decision rule that favours helpful content over volume.",
      },
      {
        question: "Can I reject a recommendation?",
        answer:
          "Yes. The dashboard supports review decisions so teams can reject, archive, or refine content before publishing.",
      },
    ],
    related: ["how-to-review-and-publish-content-from-the-content-queue", "how-to-turn-customer-questions-into-blog-posts-without-thin-content"],
  }),
  article({
    slug: "how-convo-publishes-content-to-cms",
    title: "How Convo publishes content to WordPress, Shopify, Webflow, or a custom API",
    description:
      "A practical overview of Convo's review and publishing workflow for approved content.",
    category: "Business owners and marketers",
    intent: "Understand CMS publishing options.",
    primaryKeyword: "AI content CMS publishing",
    secondaryKeywords: ["WordPress AI publishing", "Shopify blog publishing", "Webflow CMS publishing"],
    funnelStage: "Consideration",
    cta: "Explore CMS Publishing",
    public: true,
    dashboard: true,
    schema: "HowTo",
    quickAnswer:
      "Convo can help teams review generated content and publish approved items through connected CMS workflows, including WordPress, Shopify, Webflow, or a custom API setup.",
    whoThisIsFor:
      "Teams that want content workflow support without copying and pasting every approved article manually.",
    sections: [
      {
        heading: "Connect the CMS",
        body:
          "A business can connect the publishing destination it uses for articles or site content. The exact fields depend on the CMS.",
        bullets: [
          "WordPress needs site and application access details.",
          "Shopify needs shop and blog destination details.",
          "Webflow needs site and collection details.",
        ],
      },
      {
        heading: "Review the content",
        body:
          "Generated content should be reviewed before publishing. Teams can check the title, summary, body, metadata, and whether the recommendation still makes sense.",
        bullets: [
          "Approve strong items.",
          "Reject items that should not go live.",
          "Archive items that are not needed right now.",
        ],
      },
      {
        heading: "Publish or save as draft",
        body:
          "Approved content can be published directly where supported, or sent as a draft so the team can make final edits inside the CMS.",
        bullets: [
          "Publish live when ready.",
          "Publish as draft for final CMS review.",
          "Check the published URL after completion.",
        ],
      },
    ],
    mistakes: [
      "Turning on publishing before checking CMS credentials.",
      "Publishing without reading the final draft.",
      "Forgetting to check the live URL after publishing.",
    ],
    faqs: [
      {
        question: "Can Convo auto-publish?",
        answer:
          "Convo supports publishing controls, but review should stay on unless the business is comfortable with the configured workflow.",
      },
      {
        question: "Can content be saved as a draft?",
        answer:
          "Yes. The dashboard supports publishing approved content as a draft where the publishing destination supports that flow.",
      },
      {
        question: "What if publishing fails?",
        answer:
          "Check the connected CMS settings, credentials, destination IDs, permissions, and the error shown in the dashboard.",
      },
    ],
    related: ["how-to-connect-your-cms-and-publishing-settings", "why-did-publishing-fail"],
  }),
  article({
    slug: "convo-vs-normal-live-chat-tools",
    title: "Convo vs normal live chat tools",
    description:
      "How Convo compares with live chat and support tools that focus mainly on conversations and inbox management.",
    category: "Comparison and alternatives",
    intent: "Compare product categories.",
    primaryKeyword: "Convo vs live chat",
    secondaryKeywords: ["AI chatbot vs live chat", "live chat alternatives", "Intercom alternative for content"],
    funnelStage: "Consideration",
    cta: "Compare the workflow",
    public: true,
    dashboard: false,
    schema: "Article",
    quickAnswer:
      "Live chat tools help teams respond to conversations. Convo also helps the business turn those conversations into qualified enquiries and website content improvements.",
    whoThisIsFor:
      "Buyers comparing Convo with chat widgets, support inboxes, and customer messaging tools.",
    sections: [
      {
        heading: "Where live chat is strong",
        body:
          "Traditional live chat is useful when a human team needs to answer messages quickly, route support requests, and manage an inbox.",
        bullets: [
          "Human support workflows.",
          "Conversation routing.",
          "Support team inboxes.",
        ],
      },
      {
        heading: "Where Convo is different",
        body:
          "Convo is designed around what the business can learn from visitor questions. The chat is part of a bigger loop that includes leads, content recommendations, publishing, and measurement.",
        bullets: [
          "Captures visitor intent with context.",
          "Turns repeated questions into content opportunities.",
          "Connects chat activity to website improvement.",
        ],
      },
      {
        heading: "What this is not",
        body:
          "Convo is not trying to be a full support desk for every enterprise support workflow. It is strongest when website questions can become better follow-up and better content.",
        bullets: [
          "Use live chat for high-volume human support teams.",
          "Use Convo for visitor questions that reveal buying and content demand.",
          "Use both if the business needs support coverage and growth insight.",
        ],
      },
    ],
    mistakes: [
      "Assuming every chat widget solves the same problem.",
      "Buying an inbox when the business actually needs better lead context.",
      "Ignoring the content value of repeated visitor questions.",
    ],
    faqs: [
      {
        question: "Does Convo replace Intercom or Zendesk?",
        answer:
          "Not always. Those tools are strong support and messaging platforms. Convo is more focused on chat-driven lead capture and content improvement.",
      },
      {
        question: "Can a business use Convo with live chat?",
        answer:
          "Yes. A business can use Convo for the website assistant and still keep a separate support tool where needed.",
      },
      {
        question: "What is the main difference?",
        answer:
          "Convo is built around the business value of visitor questions, not only the act of replying to a chat.",
      },
    ],
    related: ["how-is-convo-different-from-live-chat-and-support-inbox-tools", "when-should-you-use-convo-live-chat-booking-form-or-all-three"],
  }),
  article({
    slug: "convo-vs-seo-content-tools",
    title: "Convo vs SEO content tools",
    description:
      "Why Convo starts content planning from first-party website conversations rather than keyword tools alone.",
    category: "Comparison and alternatives",
    intent: "Compare Convo with SEO content platforms.",
    primaryKeyword: "Convo vs SEO content tools",
    secondaryKeywords: ["SEO content automation", "AI SEO tool alternative", "chat data for SEO"],
    funnelStage: "Consideration",
    cta: "Explore SEO Content Pipeline",
    public: true,
    dashboard: false,
    schema: "Article",
    quickAnswer:
      "SEO content tools often start from keyword data. Convo starts from questions visitors already ask on the website, then helps turn useful patterns into reviewed content actions.",
    whoThisIsFor:
      "Marketers comparing keyword-led content tools with a first-party conversation-led workflow.",
    sections: [
      {
        heading: "Keyword tools are useful, but incomplete",
        body:
          "Keyword tools can show search demand, competition, and opportunity. They do not always show what people ask once they reach the site.",
        bullets: [
          "Great for market-level demand.",
          "Less direct for on-site objections.",
          "Needs human judgement to become useful content.",
        ],
      },
      {
        heading: "Conversation data adds practical intent",
        body:
          "Website conversations reveal the questions that block action: price, suitability, location, availability, trust, setup, and next steps.",
        bullets: [
          "Use visitor language.",
          "Find objections already happening on the site.",
          "Improve content that supports conversion as well as search.",
        ],
      },
      {
        heading: "What this is not",
        body:
          "Convo is not a broad rank tracker or technical SEO suite. It works best as a content and website-improvement layer powered by real visitor questions.",
        bullets: [
          "Use SEO suites for technical audits and rank tracking.",
          "Use Convo to turn conversations into content actions.",
          "Use both when the business needs search data and first-party demand.",
        ],
      },
    ],
    mistakes: [
      "Writing only for keyword volume.",
      "Ignoring the questions visitors ask after arriving.",
      "Creating pages that rank but do not help people act.",
    ],
    faqs: [
      {
        question: "Does Convo replace keyword research?",
        answer:
          "No. It complements keyword research by adding first-party visitor questions and on-site demand.",
      },
      {
        question: "Can Convo help update existing pages?",
        answer:
          "Yes. Updating an existing page is often a better recommendation than creating a new article.",
      },
      {
        question: "Why does first-party chat data matter?",
        answer:
          "It shows what people ask when they are already evaluating the business, which is often highly actionable.",
      },
    ],
    related: ["how-to-use-website-chat-data-for-seo-strategy", "convo-vs-normal-live-chat-tools"],
  }),
  article({
    slug: "is-ai-generated-website-content-safe-to-publish",
    title: "Is AI-generated website content safe to publish?",
    description:
      "How to use AI content safely with review, source knowledge, clear editing, and publishing controls.",
    category: "Business owners and marketers",
    intent: "Address trust and risk concerns about AI content.",
    primaryKeyword: "is AI generated content safe to publish",
    secondaryKeywords: ["AI content review", "AI website content safety", "publish AI blog posts"],
    funnelStage: "Consideration",
    cta: "Review content workflow",
    public: true,
    dashboard: false,
    schema: "FAQPage",
    quickAnswer:
      "AI-generated website content is safest when it is grounded in business knowledge, reviewed by a human, checked for accuracy, and published through a controlled workflow.",
    whoThisIsFor:
      "Business owners, lean marketing teams, and agencies that want faster content production without publishing risky, thin, or inaccurate pages.",
    sections: [
      {
        heading: "Review is the safety layer",
        body:
          "Convo is designed around review. A team can inspect, edit, approve, reject, archive, or publish as a draft before content goes live.",
        bullets: [
          "Check facts and claims.",
          "Make sure the page matches the brand.",
          "Confirm the article answers the real question.",
        ],
      },
      {
        heading: "Use business knowledge",
        body:
          "Content is safer when it is based on information the business already trusts. That includes website pages, policies, service details, and uploaded documents.",
        bullets: [
          "Avoid unsupported claims.",
          "Keep source content current.",
          "Use specific examples where the business can stand behind them.",
        ],
      },
      {
        heading: "Keep publishing controlled",
        body:
          "Auto-publishing should be used carefully. Many teams should start with draft or review workflows until they understand the output quality.",
        bullets: [
          "Review before live publishing.",
          "Use CMS drafts when needed.",
          "Monitor published pages after release.",
        ],
      },
    ],
    mistakes: [
      "Publishing without reading.",
      "Adding claims the business cannot support.",
      "Letting AI create duplicate or thin pages.",
    ],
    faqs: [
      {
        question: "Will Google penalise AI content?",
        answer:
          "Search engines care about helpfulness, quality, originality, and user value. AI-assisted content still needs review and a real reason to exist.",
      },
      {
        question: "Should I use auto-publishing?",
        answer:
          "Start with review or draft workflows unless the business has a mature process and is comfortable with the publishing rules.",
      },
      {
        question: "What should I check before publishing?",
        answer:
          "Check accuracy, usefulness, structure, related links, metadata, tone, and whether the article truly answers the target question.",
      },
    ],
    related: ["how-convo-decides-create-update-merge-or-skip-content", "how-to-review-and-publish-content-from-the-content-queue"],
  }),
];

const dashboardHelp: ResourceArticle[] = [
  article({
    slug: "getting-started-with-convo",
    title: "Getting started with Convo",
    description:
      "Set up a business account, configure the chat assistant, install the widget, and review the first conversations.",
    category: "Customer dashboard users",
    intent: "Help a new customer complete setup.",
    primaryKeyword: "Convo setup guide",
    secondaryKeywords: ["Convo onboarding", "set up Convo", "install Convo chatbot"],
    funnelStage: "Activation",
    cta: "Open the dashboard",
    public: false,
    dashboard: true,
    schema: "HowTo",
    quickAnswer:
      "To get started, create your site, add the domain, configure the assistant, install the widget, add business knowledge, and review conversations once visitors start chatting.",
    whoThisIsFor:
      "New Convo customers setting up their first business account or workspace.",
    sections: [
      {
        heading: "Create the business account",
        body:
          "Start by adding the site name and domain. The domain helps Convo connect the chat experience to the right website and knowledge source.",
        bullets: ["Add the site name.", "Add the website domain.", "Confirm you are in the right workspace."],
      },
      {
        heading: "Configure the assistant",
        body:
          "Set the assistant name, welcome message, colour, and basic behaviour so the chat experience feels native to the website.",
        bullets: ["Use customer-friendly welcome copy.", "Match the brand colour.", "Keep the assistant purpose clear."],
      },
      {
        heading: "Install and test",
        body:
          "Copy the widget snippet from the dashboard and add it before the closing body tag on the website. Then open the website as a visitor and send a test message.",
        bullets: ["Paste the snippet.", "Check the widget appears.", "Send a test question.", "Review the conversation in the dashboard."],
      },
    ],
    mistakes: [
      "Installing the widget before checking the business account details.",
      "Testing while logged into the wrong workspace.",
      "Forgetting to add business knowledge before judging answer quality.",
    ],
    faqs: [
      {
        question: "Where should I start?",
        answer:
          "Start with the dashboard setup flow, then move through Widget, Knowledge, Settings, and Conversations.",
      },
      {
        question: "Can I change the setup later?",
        answer:
          "Yes. Most settings can be updated from the dashboard after the initial setup.",
      },
      {
        question: "How do I know it is working?",
        answer:
          "Open the website as a visitor, send a chat message, then check whether the conversation appears in the dashboard.",
      },
    ],
    related: ["how-to-install-the-convo-widget", "how-to-add-website-content-and-documents-to-convos-knowledge-base"],
  }),
  article({
    slug: "how-to-install-the-convo-widget",
    title: "How to install the Convo widget",
    description:
      "Copy the widget snippet from the dashboard, add it to the website, and check that the chat assistant appears correctly.",
    category: "Customer dashboard users",
    intent: "Install the public website widget.",
    primaryKeyword: "install Convo widget",
    secondaryKeywords: ["install website chatbot", "Convo script", "add chat widget"],
    funnelStage: "Activation",
    cta: "Open Widget settings",
    public: false,
    dashboard: true,
    schema: "HowTo",
    quickAnswer:
      "Open Dashboard > Widget, copy the script snippet, paste it before the closing body tag on your website, publish the website change, then test the widget in a fresh browser window.",
    whoThisIsFor:
      "Site owners, developers, and marketers responsible for installing Convo on a website.",
    sections: [
      {
        heading: "Find the snippet",
        body:
          "The dashboard shows a script snippet that includes the Convo widget source and the account identifier needed to load the right chat settings.",
        bullets: ["Open Dashboard > Widget.", "Copy the full snippet.", "Do not remove the account identifier."],
      },
      {
        heading: "Add it to the website",
        body:
          "Paste the snippet before the closing body tag or into the site's tag manager or code injection area, depending on how the website is managed.",
        bullets: ["Add it once per site.", "Publish the website change.", "Clear caches if needed."],
      },
      {
        heading: "Test as a visitor",
        body:
          "Open the website in a fresh browser or private window. The chat bubble should appear in the configured position.",
        bullets: ["Check desktop and mobile.", "Send a real test question.", "Confirm the conversation appears in Convo."],
      },
    ],
    mistakes: [
      "Pasting only part of the snippet.",
      "Using the wrong business account's snippet.",
      "Testing before the website publish or cache refresh completes.",
    ],
    faqs: [
      {
        question: "Where do I paste the snippet?",
        answer:
          "Most sites support adding scripts before the closing body tag, through a tag manager, or in a custom code area.",
      },
      {
        question: "Can I install Convo on multiple pages?",
        answer:
          "Yes. The widget should usually be installed site-wide unless the business only wants it on selected pages.",
      },
      {
        question: "What if the widget does not appear?",
        answer:
          "Check the snippet, website cache, browser console, script blockers, and whether the website publish completed.",
      },
    ],
    related: ["why-is-the-convo-widget-not-appearing-on-my-website", "how-to-configure-chatbot-name-welcome-message-colour-position-and-size"],
  }),
  article({
    slug: "how-to-configure-chatbot-name-welcome-message-colour-position-and-size",
    title: "How to configure your chatbot name, welcome message, colour, position, and size",
    description:
      "Make the Convo widget feel native to the business website with simple appearance and greeting settings.",
    category: "Customer dashboard users",
    intent: "Configure visible widget settings.",
    primaryKeyword: "configure Convo widget",
    secondaryKeywords: ["chatbot welcome message", "chat widget colour", "chatbot appearance"],
    funnelStage: "Activation",
    cta: "Open Widget settings",
    public: false,
    dashboard: true,
    schema: "HowTo",
    quickAnswer:
      "Open Dashboard > Widget to edit the chatbot name, welcome message, primary colour, position, and size. These settings control the visitor-facing widget experience.",
    whoThisIsFor:
      "Dashboard users setting up the public chat experience before or after installation.",
    sections: [
      {
        heading: "Set the assistant name",
        body:
          "Use a name that matches the website and makes the assistant feel like part of the business.",
        bullets: ["Keep it short.", "Avoid unclear company shorthand.", "Use the same naming style as the website."],
      },
      {
        heading: "Write the welcome message",
        body:
          "The welcome message should tell visitors what they can ask and make the first step feel easy.",
        bullets: ["Mention the type of help available.", "Avoid long introductions.", "Use the brand's normal tone."],
      },
      {
        heading: "Match the visual style",
        body:
          "Set the primary colour, position, and size so the widget is visible without feeling out of place.",
        bullets: ["Use a brand colour with good contrast.", "Choose bottom left or bottom right.", "Check mobile spacing."],
      },
    ],
    mistakes: [
      "Using a welcome message that says too much.",
      "Choosing a colour that blends into the page.",
      "Forgetting to check the widget on mobile.",
    ],
    faqs: [
      {
        question: "How quickly do changes appear?",
        answer:
          "Widget settings are designed to update shortly after saving, though browser or site caching can delay what you see.",
      },
      {
        question: "Should the welcome message ask for contact details?",
        answer:
          "Usually no. It should invite a useful question first, then capture details later when there is a clear reason.",
      },
      {
        question: "Can I change the position later?",
        answer:
          "Yes. Update the position in the dashboard and test it on key pages.",
      },
    ],
    related: ["why-is-the-welcome-message-or-qualifying-question-not-showing", "how-to-install-the-convo-widget"],
  }),
  article({
    slug: "how-to-add-website-content-and-documents-to-convos-knowledge-base",
    title: "How to add website content and documents to Convo's knowledge base",
    description:
      "Use website pages and uploaded documents to improve the answers visitors receive from Convo.",
    category: "Customer dashboard users",
    intent: "Help users add source knowledge.",
    primaryKeyword: "add Convo knowledge base",
    secondaryKeywords: ["upload documents to chatbot", "website knowledge chatbot", "Convo documents"],
    funnelStage: "Activation",
    cta: "Open Knowledge",
    public: false,
    dashboard: true,
    schema: "HowTo",
    quickAnswer:
      "Open Dashboard > Knowledge to sync website content and upload documents such as PDF, DOCX, or TXT files. Better source knowledge usually means better answers.",
    whoThisIsFor:
      "Dashboard users who want the assistant to answer more accurately using approved business information.",
    sections: [
      {
        heading: "Start with the website",
        body:
          "Add the website domain in settings, then use the Knowledge area to sync site content. Clear public pages are usually the best first source.",
        bullets: ["Add the domain.", "Run a sync.", "Check how many pages are indexed."],
      },
      {
        heading: "Upload useful documents",
        body:
          "Documents can help cover policies, service details, pricing guides, product information, and FAQs that may not be easy to find on the public site.",
        bullets: ["Use PDF, DOCX, or TXT.", "Remove outdated files.", "Keep file names understandable."],
      },
      {
        heading: "Improve the source if answers are weak",
        body:
          "If the assistant cannot answer a question well, the source material may be missing, unclear, or outdated.",
        bullets: ["Add the missing answer.", "Resync website content.", "Upload a better document."],
      },
    ],
    mistakes: [
      "Uploading private or outdated files.",
      "Expecting the assistant to know details not present in the source material.",
      "Not resyncing after a major website update.",
    ],
    faqs: [
      {
        question: "What document formats are supported?",
        answer:
          "The dashboard supports common formats such as PDF, DOCX, and TXT.",
      },
      {
        question: "How do I refresh website knowledge?",
        answer:
          "Use the resync action in the Knowledge area after changing important website content.",
      },
      {
        question: "What should I upload first?",
        answer:
          "Start with current FAQs, service details, policies, pricing explanations, product guides, or onboarding documents.",
      },
    ],
    related: ["why-is-the-chatbot-not-using-my-website-content", "how-the-convo-knowledge-base-works"],
  }),
  article({
    slug: "how-to-configure-chatbot-behaviour",
    title: "How to configure chatbot behaviour",
    description:
      "Adjust how the Convo assistant speaks, what it should answer, what it should avoid, and how it guides visitors.",
    category: "Customer dashboard users",
    intent: "Help customers tune chat behaviour.",
    primaryKeyword: "configure chatbot behaviour",
    secondaryKeywords: ["chatbot settings", "AI chatbot safety settings", "Convo chat settings"],
    funnelStage: "Activation",
    cta: "Open Chatbot behaviour",
    public: false,
    dashboard: true,
    schema: "HowTo",
    quickAnswer:
      "Use the dashboard chat settings to control the assistant's voice, welcome flow, answer boundaries, qualifying questions, and follow-up prompts.",
    whoThisIsFor:
      "Customers tuning the assistant after installation or preparing for launch.",
    sections: [
      {
        heading: "Set the voice and role",
        body:
          "The assistant should sound like the business and make it clear what kind of help it can provide.",
        bullets: ["Use a concise voice description.", "Match the website tone.", "Keep the role practical."],
      },
      {
        heading: "Define what the assistant should cover",
        body:
          "Clear topic boundaries help visitors get useful answers while keeping the assistant focused on the business.",
        bullets: ["List the topics the business wants to support.", "Add topics the assistant should avoid.", "Use plain customer-facing language."],
      },
      {
        heading: "Guide the visitor toward the next step",
        body:
          "Qualifying questions and follow-up prompts should help the visitor progress, not feel like a form disguised as a chat.",
        bullets: ["Ask only useful questions.", "Keep options clear.", "Make follow-up feel natural."],
      },
    ],
    mistakes: [
      "Writing settings in company shorthand visitors would not understand.",
      "Making the assistant too broad.",
      "Asking too many qualifying questions before helping.",
    ],
    faqs: [
      {
        question: "Should I make the assistant very detailed?",
        answer:
          "No. Give enough direction for good answers, but keep settings practical and easy to maintain.",
      },
      {
        question: "Can I stop the assistant answering certain topics?",
        answer:
          "Yes. Use chat settings to define boundaries and topics that should be avoided.",
      },
      {
        question: "How should I write qualifying questions?",
        answer:
          "Write questions that help the visitor get a better outcome, such as location, need, budget, timing, or category.",
      },
    ],
    related: ["why-did-the-chatbot-refuse-deflect-or-give-a-short-answer", "why-is-the-welcome-message-or-qualifying-question-not-showing"],
  }),
  article({
    slug: "how-follow-up-rules-work-in-convo",
    title: "How follow-up rules work in Convo",
    description:
      "Use follow-up rules to decide when Convo should ask for details and where opportunities should go.",
    category: "Customer dashboard users",
    intent: "Explain follow-up configuration.",
    primaryKeyword: "Convo follow-up rules",
    secondaryKeywords: ["chat follow-up rules", "lead capture rules", "chatbot contact capture"],
    funnelStage: "Activation",
    cta: "Open Follow-up",
    public: false,
    dashboard: true,
    schema: "HowTo",
    quickAnswer:
      "Follow-up rules help Convo decide when a conversation is worth capturing, what contact details to ask for, and where the opportunity should be reviewed or routed.",
    whoThisIsFor:
      "Customers configuring lead capture and follow-up workflows for their website.",
    sections: [
      {
        heading: "Contact methods",
        body:
          "Contact methods define what details the business can ask for, such as email, phone, or another preferred method.",
        bullets: ["Ask only for details the business will use.", "Keep labels clear.", "Respect the visitor's context."],
      },
      {
        heading: "Capture policies",
        body:
          "Capture policies shape when the assistant should ask for details. The goal is to ask when follow-up genuinely helps.",
        bullets: ["Use buyer intent.", "Use practical next steps.", "Avoid asking on casual messages."],
      },
      {
        heading: "Destinations",
        body:
          "Destinations describe where the follow-up opportunity should go after it is captured, such as a dashboard review flow or connected business process.",
        bullets: ["Keep routing simple at first.", "Check captured details.", "Review performance before adding complexity."],
      },
    ],
    mistakes: [
      "Asking every visitor for contact details.",
      "Collecting contact details without a clear follow-up promise.",
      "Routing opportunities before the team knows how they will handle them.",
    ],
    faqs: [
      {
        question: "Can I use different follow-up rules for different needs?",
        answer:
          "Yes. Follow-up rules can support different types of opportunities, depending on the account setup.",
      },
      {
        question: "Should follow-up be aggressive?",
        answer:
          "No. Convo works best when follow-up feels like the next helpful step.",
      },
      {
        question: "Where do I review follow-up opportunities?",
        answer:
          "Use the Conversations and Contacts areas in the dashboard.",
      },
    ],
    related: ["how-to-manage-conversations-and-follow-up-opportunities", "why-is-lead-capture-not-triggering"],
  }),
  article({
    slug: "how-to-manage-conversations-and-follow-up-opportunities",
    title: "How to manage conversations and follow-up opportunities",
    description:
      "Review chats that need attention, filter by status, inspect transcripts, and resolve follow-up work.",
    category: "Customer dashboard users",
    intent: "Help users operate the conversations dashboard.",
    primaryKeyword: "manage Convo conversations",
    secondaryKeywords: ["chat follow-up dashboard", "conversation filters", "chat transcript"],
    funnelStage: "Support",
    cta: "Open Conversations",
    public: false,
    dashboard: true,
    schema: "HowTo",
    quickAnswer:
      "Open Dashboard > Conversations to review follow-up opportunities raised from chats, inspect the conversation history, apply filters, assign work, and resolve items.",
    whoThisIsFor:
      "Sales, support, marketplace, and operations teams reviewing website chat follow-up.",
    sections: [
      {
        heading: "Use filters to find the right work",
        body:
          "Filters help teams focus on the conversations that matter, such as unresolved items, high-priority opportunities, or assigned follow-up.",
        bullets: ["Filter by status.", "Filter by priority or assignment.", "Use topic and date filters when volume grows."],
      },
      {
        heading: "Read the transcript",
        body:
          "The transcript shows what the visitor asked and how the assistant responded. Use it to understand the real need before following up.",
        bullets: ["Look for the visitor's exact wording.", "Check the page context where available.", "Use the conversation to personalise the response."],
      },
      {
        heading: "Close the loop",
        body:
          "Once the team has handled the opportunity, update the status so the dashboard stays useful.",
        bullets: ["Resolve completed work.", "Dismiss irrelevant items.", "Keep assignments current."],
      },
    ],
    mistakes: [
      "Following up without reading the conversation.",
      "Leaving resolved items open.",
      "Using too many filters and missing new opportunities.",
    ],
    faqs: [
      {
        question: "What should I review first?",
        answer:
          "Start with unresolved high-priority follow-up opportunities, then work through recent conversations.",
      },
      {
        question: "Why does a conversation appear here?",
        answer:
          "It appears when Convo has captured or identified something that may need attention.",
      },
      {
        question: "Can I assign follow-up to another person?",
        answer:
          "The dashboard supports team-oriented review flows where assignment is available for the account.",
      },
    ],
    related: ["how-contacts-are-created-and-merged-in-convo", "why-are-conversations-not-appearing-in-the-dashboard"],
  }),
  article({
    slug: "how-contacts-are-created-and-merged-in-convo",
    title: "How contacts are created and merged in Convo",
    description:
      "Understand how visitor details, conversation history, and follow-up activity appear in the Contacts area.",
    category: "Customer dashboard users",
    intent: "Explain contacts dashboard behaviour.",
    primaryKeyword: "Convo contacts",
    secondaryKeywords: ["chat contacts", "lead contact details", "conversation history"],
    funnelStage: "Support",
    cta: "Open Contacts",
    public: false,
    dashboard: true,
    schema: "Article",
    quickAnswer:
      "Contacts are created when visitors share useful identifying details during chat. The contact record brings together identifiers, conversation history, follow-up activity, and captured attributes.",
    whoThisIsFor:
      "Teams reviewing people or companies captured from website conversations.",
    sections: [
      {
        heading: "What creates a contact",
        body:
          "A contact appears when the conversation includes details the business can use for follow-up, such as an email, phone number, name, company, or other configured detail.",
        bullets: ["Visitor shares details.", "Convo stores the useful context.", "The contact appears for review."],
      },
      {
        heading: "What the contact page shows",
        body:
          "The contact page helps teams see who the person is, what they asked, and what follow-up activity exists.",
        bullets: ["Identifiers.", "Merged attributes.", "Conversation history.", "Follow-up history."],
      },
      {
        heading: "How to use contacts well",
        body:
          "Contacts are most useful when the team treats them as context-rich enquiries rather than plain form submissions.",
        bullets: ["Read the linked conversation.", "Check captured attributes.", "Use the latest activity before replying."],
      },
    ],
    mistakes: [
      "Expecting a contact when the visitor did not share contact details.",
      "Using only the email or phone number without reading the conversation.",
      "Letting duplicate details accumulate without review.",
    ],
    faqs: [
      {
        question: "Why is there no contact for a conversation?",
        answer:
          "A visitor may have chatted without sharing identifying details or the conversation may not have met the capture settings.",
      },
      {
        question: "What should I check before replying?",
        answer:
          "Check the latest conversation, captured details, and follow-up history.",
      },
      {
        question: "Can contacts include companies?",
        answer:
          "Yes, where company information is captured or added through the configured workflow.",
      },
    ],
    related: ["why-are-contacts-not-appearing-after-chats", "how-to-manage-conversations-and-follow-up-opportunities"],
  }),
  article({
    slug: "how-to-review-and-publish-content-from-the-content-queue",
    title: "How to review and publish content from the content queue",
    description:
      "Review generated articles, FAQs, and page sections before approving, rejecting, publishing, drafting, or archiving.",
    category: "Customer dashboard users",
    intent: "Operate content review workflow.",
    primaryKeyword: "Convo content queue",
    secondaryKeywords: ["review AI content", "publish AI articles", "content approval workflow"],
    funnelStage: "Support",
    cta: "Open Content",
    public: false,
    dashboard: true,
    schema: "HowTo",
    quickAnswer:
      "Open Dashboard > Content to review generated content. Expand an item, read the draft, then approve, reject, publish, publish as draft, or archive it.",
    whoThisIsFor:
      "Marketing and content teams reviewing Convo-generated recommendations.",
    sections: [
      {
        heading: "Understand the status",
        body:
          "Content moves through practical review states so the team can see what needs attention.",
        bullets: ["Review means it needs a human decision.", "Approved means it is ready to publish.", "Published means it has been sent live or to the destination."],
      },
      {
        heading: "Review the draft",
        body:
          "Check the title, summary, body, usefulness, accuracy, and whether the content should be a new article or a different update.",
        bullets: ["Read the full body.", "Check the target question.", "Look for unsupported claims."],
      },
      {
        heading: "Choose the action",
        body:
          "The content list supports approving, rejecting, publishing, publishing as a draft, archiving, and bulk actions where appropriate.",
        bullets: ["Approve strong items.", "Reject poor fits.", "Publish as draft when more CMS editing is needed."],
      },
    ],
    mistakes: [
      "Approving without reading.",
      "Publishing content that should have updated an existing page.",
      "Leaving stale items in review forever.",
    ],
    faqs: [
      {
        question: "What is the safest publishing option?",
        answer:
          "Publishing as a draft is safest when the team wants one more check inside the CMS.",
      },
      {
        question: "Can I approve everything at once?",
        answer:
          "Bulk approve is available for review items, but it should only be used when the team has already checked the content.",
      },
      {
        question: "What should I archive?",
        answer:
          "Archive content that is not useful now but should not be treated as rejected forever.",
      },
    ],
    related: ["how-convo-publishes-content-to-cms", "why-did-convo-create-or-skip-a-content-idea"],
  }),
  article({
    slug: "how-to-connect-your-cms-and-publishing-settings",
    title: "How to connect your CMS and publishing settings",
    description:
      "Set up WordPress, Shopify, Webflow, or a custom publishing destination for Convo content.",
    category: "Customer dashboard users",
    intent: "Configure CMS integration.",
    primaryKeyword: "connect CMS to Convo",
    secondaryKeywords: ["WordPress Convo", "Shopify Convo", "Webflow Convo"],
    funnelStage: "Activation",
    cta: "Open Settings",
    public: false,
    dashboard: true,
    schema: "HowTo",
    quickAnswer:
      "Open Dashboard > Settings to connect a CMS, test the connection, choose publishing controls, and decide whether content should stay in review or publish automatically under configured rules.",
    whoThisIsFor:
      "Customers preparing to publish reviewed content from Convo into their existing website system.",
    sections: [
      {
        heading: "Choose the destination",
        body:
          "Pick the CMS or publishing workflow the business already uses. Keep the first setup simple and test before publishing real content.",
        bullets: ["WordPress.", "Shopify.", "Webflow.", "Custom API."],
      },
      {
        heading: "Add credentials carefully",
        body:
          "Each destination needs the correct access details. Mistyped credentials or missing permissions are the most common publishing problems.",
        bullets: ["Use the correct site or shop.", "Check access permissions.", "Save and test the connection."],
      },
      {
        heading: "Decide on publishing controls",
        body:
          "Most teams should start with review. Auto-publishing should only be enabled when the team trusts the configured workflow.",
        bullets: ["Keep review on by default.", "Use drafts for final CMS checks.", "Turn on automation gradually."],
      },
    ],
    mistakes: [
      "Using personal credentials that may later be removed.",
      "Skipping the connection test.",
      "Turning on auto-publish before reviewing enough drafts.",
    ],
    faqs: [
      {
        question: "Which CMS platforms are supported?",
        answer:
          "The dashboard includes workflows for WordPress, Shopify, Webflow, and custom API publishing.",
      },
      {
        question: "Can I publish as a draft?",
        answer:
          "Yes, where supported by the destination and workflow.",
      },
      {
        question: "What if the connection test fails?",
        answer:
          "Check the URL, access token or password, destination IDs, permissions, and whether the CMS allows connected publishing.",
      },
    ],
    related: ["why-did-publishing-fail", "how-convo-publishes-content-to-cms"],
  }),
  article({
    slug: "how-the-public-knowledge-hub-works",
    title: "How the public Knowledge Hub works",
    description:
      "Understand the public hub where approved content can be browsed, searched, filtered, indexed, and shared.",
    category: "Customer dashboard users",
    intent: "Explain how the Knowledge Hub helps customers manage Convo's source content.",
    primaryKeyword: "Convo Knowledge Hub",
    secondaryKeywords: ["public content hub", "AI generated FAQ hub", "website knowledge hub"],
    funnelStage: "Activation",
    cta: "Open Widget settings",
    public: false,
    dashboard: true,
    schema: "Article",
    quickAnswer:
      "The Knowledge Hub is the public page where a business's approved articles, FAQs, and guides can be browsed by visitors and discovered by search engines.",
    whoThisIsFor:
      "Customers reviewing how approved content appears outside the dashboard.",
    sections: [
      {
        heading: "What appears in the hub",
        body:
          "Only approved and published content should appear in the public hub. Drafts, rejected items, and archived content should not be treated as public content.",
        bullets: ["Articles.", "FAQs.", "Guides or page sections where supported."],
      },
      {
        heading: "How visitors use it",
        body:
          "Visitors can browse content, search for answers, and use topic filters to narrow the list.",
        bullets: ["Search by keyword.", "Filter by topic.", "Open individual article pages."],
      },
      {
        heading: "How search engines use it",
        body:
          "The hub includes metadata, article pages, a sitemap, and an RSS feed so public content can be discovered and maintained more easily.",
        bullets: ["Article metadata.", "Related content links.", "Sitemap and feed support."],
      },
    ],
    mistakes: [
      "Expecting unpublished content to appear.",
      "Publishing content without checking the final public article page.",
      "Forgetting to link useful content from other parts of the website.",
    ],
    faqs: [
      {
        question: "Where is the Knowledge Hub?",
        answer:
          "The hub URL is shown in the Widget area of the dashboard.",
      },
      {
        question: "Can visitors search the hub?",
        answer:
          "Yes. The hub includes search and topic filters.",
      },
      {
        question: "Why is an article missing?",
        answer:
          "Check that the content is published, has a valid slug, and belongs to the correct business account.",
      },
    ],
    related: ["why-is-published-content-not-showing-in-the-knowledge-hub-or-sitemap", "how-to-review-and-publish-content-from-the-content-queue"],
  }),
];

const troubleshooting: ResourceArticle[] = [
  article({
    slug: "why-is-the-convo-widget-not-appearing-on-my-website",
    title: "Why is the Convo widget not appearing on my website?",
    description:
      "Troubleshoot missing chat bubbles, script issues, caching, wrong snippets, and browser blockers.",
    category: "Troubleshooting",
    intent: "Fix a widget that does not appear.",
    primaryKeyword: "Convo widget not appearing",
    secondaryKeywords: ["chat widget not showing", "website chatbot not loading", "Convo troubleshooting"],
    funnelStage: "Support",
    cta: "Check Widget settings",
    public: false,
    dashboard: true,
    schema: "FAQPage",
    quickAnswer:
      "If the widget is not appearing, first check that the full snippet is installed, the website change has been published, the account identifier is correct, and the page is not blocking the script.",
    whoThisIsFor:
      "Site owners or developers testing Convo on a public website.",
    sections: [
      {
        heading: "Check the snippet",
        body:
          "A missing or incomplete snippet is the most common reason the widget does not appear.",
        bullets: ["Copy the snippet again from the dashboard.", "Confirm it is on the page.", "Check the account identifier was not edited."],
      },
      {
        heading: "Check website publishing and cache",
        body:
          "Some website builders and CDNs delay script changes. The page you are viewing may not be the latest published version.",
        bullets: ["Publish the website change.", "Clear the site cache.", "Test in a private browser window."],
      },
      {
        heading: "Check browser or page blockers",
        body:
          "Script blockers, strict security settings, or website rules can prevent the widget from loading.",
        bullets: ["Check the browser console.", "Disable ad blockers for the test.", "Ask the website developer to inspect script loading."],
      },
    ],
    mistakes: [
      "Testing before publishing the site change.",
      "Copying the snippet from a different business account.",
      "Assuming the widget is broken when the page cache is stale.",
    ],
    faqs: [
      {
        question: "Should I install the snippet once or on every page?",
        answer:
          "Most businesses install it site-wide, but the right setup depends on where the chat should appear.",
      },
      {
        question: "Can caching delay the widget?",
        answer:
          "Yes. Browser, CDN, and website builder caches can delay visible changes.",
      },
      {
        question: "What should I send support?",
        answer:
          "Send the website URL, a screenshot, the browser used, and whether the widget script appears in the page source.",
      },
    ],
    related: ["how-to-install-the-convo-widget", "why-are-conversations-not-appearing-in-the-dashboard"],
  }),
  article({
    slug: "why-is-the-chatbot-not-using-my-website-content",
    title: "Why is the chatbot not using my website content?",
    description:
      "Fix weak or generic answers by checking domain settings, website sync, uploaded documents, and source content quality.",
    category: "Troubleshooting",
    intent: "Help customers improve answer quality from website content.",
    primaryKeyword: "chatbot not using website content",
    secondaryKeywords: ["AI chatbot wrong answers", "chatbot knowledge base issue", "Convo answers not accurate"],
    funnelStage: "Support",
    cta: "Open Knowledge",
    public: false,
    dashboard: true,
    schema: "FAQPage",
    quickAnswer:
      "If answers feel generic, check that the website domain is saved, the site has been synced, useful documents have been uploaded, and the source content actually answers the question.",
    whoThisIsFor:
      "Customers testing answer quality after installing Convo.",
    sections: [
      {
        heading: "Confirm the source knowledge exists",
        body:
          "The assistant needs useful source information. If the answer is not on the website or in uploaded documents, Convo may not have enough context.",
        bullets: ["Check the domain.", "Review indexed pages.", "Upload missing documents."],
      },
      {
        heading: "Refresh after changes",
        body:
          "If the website has recently changed, refresh the knowledge source so Convo can use the latest information.",
        bullets: ["Run a site resync.", "Replace outdated documents.", "Wait for processing to finish."],
      },
      {
        heading: "Improve the underlying answer",
        body:
          "Sometimes the best fix is clearer website content. If a human cannot find the answer easily, the assistant may struggle too.",
        bullets: ["Add clearer FAQs.", "Include service areas and policies.", "Remove conflicting information."],
      },
    ],
    mistakes: [
      "Expecting Convo to know information not present in the business content.",
      "Leaving outdated files active.",
      "Testing with very broad questions before adding source knowledge.",
    ],
    faqs: [
      {
        question: "Why does Convo give a broad answer?",
        answer:
          "The available source information may be too thin, outdated, or not specific enough to the question.",
      },
      {
        question: "Should I upload private company documents?",
        answer:
          "Only upload documents that are safe and useful for answering visitor questions.",
      },
      {
        question: "What is the fastest fix?",
        answer:
          "Add or improve the source answer, then refresh the knowledge source and test again.",
      },
    ],
    related: ["how-to-add-website-content-and-documents-to-convos-knowledge-base", "how-the-convo-knowledge-base-works"],
  }),
  article({
    slug: "why-is-the-welcome-message-or-qualifying-question-not-showing",
    title: "Why is the welcome message or qualifying question not showing?",
    description:
      "Check welcome settings, qualifying questions, widget cache, and saved chat settings.",
    category: "Troubleshooting",
    intent: "Fix missing widget welcome or question prompts.",
    primaryKeyword: "Convo welcome message not showing",
    secondaryKeywords: ["chatbot welcome not showing", "qualifying question not showing", "chat widget question issue"],
    funnelStage: "Support",
    cta: "Open Widget settings",
    public: false,
    dashboard: true,
    schema: "FAQPage",
    quickAnswer:
      "If the welcome message or qualifying questions do not appear, check the saved widget settings, chat settings, whether questions are configured, and whether the visitor is seeing a cached version.",
    whoThisIsFor:
      "Customers testing the first interaction visitors see in the widget.",
    sections: [
      {
        heading: "Check the visible widget settings",
        body:
          "The assistant name, welcome message, colour, position, and size are managed from the Widget area.",
        bullets: ["Save the latest welcome copy.", "Check the configured position.", "Refresh the website after saving."],
      },
      {
        heading: "Check qualifying questions",
        body:
          "If qualifying questions are configured, the welcome flow may behave differently depending on the setup.",
        bullets: ["Confirm the questions are active.", "Check the visitor flow in a private window.", "Keep questions short and practical."],
      },
      {
        heading: "Check cache and repeat sessions",
        body:
          "A returning browser session may not behave like a new visitor. Test in a fresh private window when checking the first-open experience.",
        bullets: ["Use a private window.", "Clear local browser data if needed.", "Wait for saved settings to propagate."],
      },
    ],
    mistakes: [
      "Testing only as a returning visitor.",
      "Saving copy in the wrong area.",
      "Writing questions that are too long for the widget.",
    ],
    faqs: [
      {
        question: "Can welcome copy and questions appear together?",
        answer:
          "That depends on the account's chat settings. Test the exact visitor flow after saving.",
      },
      {
        question: "Why does it look different on mobile?",
        answer:
          "The widget adjusts to the device. Always check mobile separately.",
      },
      {
        question: "How do I test the first visitor experience?",
        answer:
          "Use a private browser window or clear previous widget session data.",
      },
    ],
    related: ["how-to-configure-chatbot-name-welcome-message-colour-position-and-size", "how-to-configure-chatbot-behaviour"],
  }),
  article({
    slug: "why-is-lead-capture-not-triggering",
    title: "Why is lead capture not triggering?",
    description:
      "Troubleshoot why Convo is not asking for contact details or creating follow-up opportunities.",
    category: "Troubleshooting",
    intent: "Fix lead capture expectations and setup.",
    primaryKeyword: "Convo lead capture not triggering",
    secondaryKeywords: ["chatbot not capturing leads", "lead capture issue", "chat follow-up not working"],
    funnelStage: "Support",
    cta: "Open Follow-up",
    public: false,
    dashboard: true,
    schema: "FAQPage",
    quickAnswer:
      "Lead capture may not trigger if the conversation has not shown enough intent, follow-up settings are incomplete, the visitor has not reached the right moment, or the assistant has no useful next step to offer.",
    whoThisIsFor:
      "Customers testing whether Convo is capturing useful enquiries.",
    sections: [
      {
        heading: "Check the conversation context",
        body:
          "Convo should not ask every casual visitor for details. A lead prompt works best after the visitor has shown a meaningful need.",
        bullets: ["Test with a realistic buying question.", "Include the need and location if relevant.", "Avoid testing with greetings only."],
      },
      {
        heading: "Check follow-up settings",
        body:
          "Follow-up settings control what details can be asked for and when the assistant should ask.",
        bullets: ["Check contact methods.", "Review capture policies.", "Confirm destinations or review flows are set."],
      },
      {
        heading: "Check the promise",
        body:
          "Lead capture works better when there is a clear reason to ask, such as sending matches, checking availability, giving a quote, or arranging a callback.",
        bullets: ["Use a specific CTA.", "Ask for only useful details.", "Make the next step clear."],
      },
    ],
    mistakes: [
      "Testing with low-intent messages.",
      "Expecting contact capture before the assistant has helped.",
      "Configuring contact fields without a clear follow-up action.",
    ],
    faqs: [
      {
        question: "Should Convo ask every visitor for details?",
        answer:
          "No. It should ask when the conversation shows a useful reason for follow-up.",
      },
      {
        question: "Can I make lead capture more active?",
        answer:
          "Yes, but keep the visitor experience in mind. Aggressive prompts can reduce trust.",
      },
      {
        question: "Why did the visitor share details but no contact appears?",
        answer:
          "Check the captured details, follow-up settings, and whether the conversation appears in the dashboard.",
      },
    ],
    related: ["how-follow-up-rules-work-in-convo", "why-are-contacts-not-appearing-after-chats"],
  }),
  article({
    slug: "why-are-conversations-not-appearing-in-the-dashboard",
    title: "Why are conversations not appearing in the dashboard?",
    description:
      "Check widget installation, business account selection, test messages, and whether the visitor actually sent a message.",
    category: "Troubleshooting",
    intent: "Troubleshoot missing conversations.",
    primaryKeyword: "Convo conversations not appearing",
    secondaryKeywords: ["chat conversations missing", "dashboard not showing chats", "website chat not recording"],
    funnelStage: "Support",
    cta: "Open Conversations",
    public: false,
    dashboard: true,
    schema: "FAQPage",
    quickAnswer:
      "If conversations are missing, check that the widget is installed with the right business account, the visitor sent a real message, and you are viewing the correct workspace in the dashboard.",
    whoThisIsFor:
      "Customers validating that website chats are being recorded in Convo.",
    sections: [
      {
        heading: "Check the widget account",
        body:
          "A widget installed from the wrong account will send conversations somewhere else or fail to connect as expected.",
        bullets: ["Copy the snippet from the correct account.", "Check the website is using the current snippet.", "Use the correct dashboard workspace."],
      },
      {
        heading: "Send a real test message",
        body:
          "Opening the widget may not create the kind of conversation you expect. Send a real question as a visitor.",
        bullets: ["Use a private window.", "Send a full question.", "Wait a moment and refresh the dashboard."],
      },
      {
        heading: "Check loading errors",
        body:
          "If the widget or chat request fails, conversations may not be recorded properly.",
        bullets: ["Check whether the widget appears.", "Check browser console errors.", "Ask a developer to inspect network requests if needed."],
      },
    ],
    mistakes: [
      "Testing only by opening the widget without sending a message.",
      "Viewing the wrong workspace.",
      "Using a stale website snippet.",
    ],
    faqs: [
      {
        question: "How fast should conversations appear?",
        answer:
          "They should appear shortly after a real visitor message is sent, though refreshing the dashboard may be needed.",
      },
      {
        question: "Can test conversations be hidden by filters?",
        answer:
          "Yes. Clear filters in the Conversations area if you cannot find a test.",
      },
      {
        question: "What if the widget appears but messages fail?",
        answer:
          "Check browser errors and confirm the business account is active and correctly configured.",
      },
    ],
    related: ["why-is-the-convo-widget-not-appearing-on-my-website", "how-to-manage-conversations-and-follow-up-opportunities"],
  }),
  article({
    slug: "why-are-contacts-not-appearing-after-chats",
    title: "Why are contacts not appearing after chats?",
    description:
      "Understand why some conversations do not create contacts and how to improve contact capture.",
    category: "Troubleshooting",
    intent: "Explain missing contacts.",
    primaryKeyword: "Convo contacts not appearing",
    secondaryKeywords: ["chat contacts missing", "lead details not captured", "contact capture issue"],
    funnelStage: "Support",
    cta: "Open Contacts",
    public: false,
    dashboard: true,
    schema: "FAQPage",
    quickAnswer:
      "Contacts usually appear when a visitor shares identifying details. If no contact appears, the visitor may not have provided details or the follow-up settings may not be asking at the right moment.",
    whoThisIsFor:
      "Teams reviewing whether Convo is capturing useful visitor details.",
    sections: [
      {
        heading: "Check whether details were shared",
        body:
          "A conversation can exist without a contact if the visitor did not share an email, phone, name, company, or other identifying information.",
        bullets: ["Read the transcript.", "Look for contact details.", "Check whether follow-up was offered."],
      },
      {
        heading: "Check capture settings",
        body:
          "If the assistant never asks for details, review the follow-up settings and the kind of test questions being used.",
        bullets: ["Use realistic intent.", "Check contact methods.", "Check follow-up prompts."],
      },
      {
        heading: "Check filters",
        body:
          "Contacts may exist but be hidden by search, date, persona, or status filters.",
        bullets: ["Clear filters.", "Search by known detail.", "Sort by last seen."],
      },
    ],
    mistakes: [
      "Expecting a contact from every chat.",
      "Testing with no contact details.",
      "Using filters that hide recent contacts.",
    ],
    faqs: [
      {
        question: "Does every conversation create a contact?",
        answer:
          "No. Contacts are created when useful identifying details are captured.",
      },
      {
        question: "Can contacts include partial details?",
        answer:
          "Yes, depending on what the visitor shared and the configured capture flow.",
      },
      {
        question: "Where should I look first?",
        answer:
          "Start with the conversation transcript, then the Contacts filters and follow-up settings.",
      },
    ],
    related: ["how-contacts-are-created-and-merged-in-convo", "why-is-lead-capture-not-triggering"],
  }),
  article({
    slug: "why-did-convo-create-or-skip-a-content-idea",
    title: "Why did Convo create or skip a content idea?",
    description:
      "Understand why some conversations become content recommendations and others do not.",
    category: "Troubleshooting",
    intent: "Explain content queue outcomes.",
    primaryKeyword: "Convo content idea skipped",
    secondaryKeywords: ["AI content recommendation", "content queue issue", "chat to content"],
    funnelStage: "Support",
    cta: "Open Content",
    public: false,
    dashboard: true,
    schema: "FAQPage",
    quickAnswer:
      "Convo should recommend content when a conversation reveals a useful repeated question or content gap. It may skip topics that are too narrow, already covered, unclear, or not useful enough.",
    whoThisIsFor:
      "Marketing teams reviewing why the content queue looks the way it does.",
    sections: [
      {
        heading: "Useful questions become recommendations",
        body:
          "A strong content idea usually answers a question that matters to more than one visitor or improves a page that already matters to the business.",
        bullets: ["Clear visitor question.", "Useful business outcome.", "Potential to help future visitors."],
      },
      {
        heading: "Some questions should be skipped",
        body:
          "Not every chat should become content. Skipping weak ideas keeps the site from filling with low-value pages.",
        bullets: ["Too narrow.", "Already answered.", "Temporary or off-topic."],
      },
      {
        heading: "Review before deciding",
        body:
          "Use the content queue as a recommendation surface, not an autopilot obligation.",
        bullets: ["Read the draft.", "Check existing pages.", "Approve, reject, or archive."],
      },
    ],
    mistakes: [
      "Expecting every conversation to create content.",
      "Approving content without checking if a page already exists.",
      "Treating skipped topics as a product failure instead of quality control.",
    ],
    faqs: [
      {
        question: "Can I force a topic into content?",
        answer:
          "If a topic matters, create or update content manually and use Convo's insights to shape it.",
      },
      {
        question: "Why did a low-value question become a draft?",
        answer:
          "Review it carefully. The dashboard lets you reject or archive content that should not go live.",
      },
      {
        question: "What should I look for in a good recommendation?",
        answer:
          "A clear audience, clear question, useful answer, and a practical next step.",
      },
    ],
    related: ["how-convo-decides-create-update-merge-or-skip-content", "how-to-review-and-publish-content-from-the-content-queue"],
  }),
  article({
    slug: "why-did-publishing-fail",
    title: "Why did publishing fail?",
    description:
      "Troubleshoot failed publishing to WordPress, Shopify, Webflow, or a custom publishing destination.",
    category: "Troubleshooting",
    intent: "Fix CMS publishing failures.",
    primaryKeyword: "Convo publishing failed",
    secondaryKeywords: ["WordPress publishing failed", "Shopify blog publish failed", "Webflow CMS publishing issue"],
    funnelStage: "Support",
    cta: "Open Settings",
    public: false,
    dashboard: true,
    schema: "FAQPage",
    quickAnswer:
      "Publishing usually fails because of credentials, permissions, destination settings, missing fields, or a CMS-side issue. Start by testing the connection and checking the publishing destination.",
    whoThisIsFor:
      "Customers trying to send approved content from Convo into a CMS.",
    sections: [
      {
        heading: "Check credentials and permissions",
        body:
          "The CMS must allow Convo to create or update content in the chosen destination.",
        bullets: ["Check access tokens or passwords.", "Confirm the account has publishing permission.", "Regenerate credentials if needed."],
      },
      {
        heading: "Check destination details",
        body:
          "Some CMS platforms require a specific blog, collection, site, or endpoint. A wrong destination can block publishing.",
        bullets: ["Check blog ID or collection ID.", "Check site URL.", "Check custom endpoint fields."],
      },
      {
        heading: "Try draft publishing",
        body:
          "If live publishing fails or feels risky, publish as a draft where supported and finish the final check inside the CMS.",
        bullets: ["Use draft mode.", "Review CMS validation messages.", "Check required fields."],
      },
    ],
    mistakes: [
      "Using credentials without publish permissions.",
      "Changing CMS settings without updating Convo.",
      "Trying to publish content that is not approved.",
    ],
    faqs: [
      {
        question: "Should I test the connection first?",
        answer:
          "Yes. Always test the CMS connection before relying on publishing.",
      },
      {
        question: "Can a CMS block connected publishing?",
        answer:
          "Yes. Permissions, security settings, plugins, or API limits can block publishing.",
      },
      {
        question: "What should I send support?",
        answer:
          "Send the content title, destination CMS, error shown, and whether connection testing succeeds.",
      },
    ],
    related: ["how-to-connect-your-cms-and-publishing-settings", "how-convo-publishes-content-to-cms"],
  }),
  article({
    slug: "why-is-published-content-not-showing-in-the-knowledge-hub-or-sitemap",
    title: "Why is published content not showing in the Knowledge Hub or sitemap?",
    description:
      "Check content status, slug, filters, cache, sitemap timing, and whether the article belongs to the right business account.",
    category: "Troubleshooting",
    intent: "Fix missing public content.",
    primaryKeyword: "Convo content not showing in Knowledge Hub",
    secondaryKeywords: ["published article missing", "sitemap article not showing", "public content hub issue"],
    funnelStage: "Support",
    cta: "Open Content",
    public: false,
    dashboard: true,
    schema: "FAQPage",
    quickAnswer:
      "Published content may not appear if it is not actually published, has no usable slug, belongs to a different business account, is hidden by search or topic filters, or the public page is still cached.",
    whoThisIsFor:
      "Customers checking their public content hub after publishing.",
    sections: [
      {
        heading: "Check the content status",
        body:
          "Only content that has reached the right published state should be visible in the public hub.",
        bullets: ["Open the content item.", "Check the status.", "Check the published URL if available."],
      },
      {
        heading: "Check the hub view",
        body:
          "Search and topic filters can hide content. Clear filters before assuming the article is missing.",
        bullets: ["Clear search.", "Clear topic filter.", "Open the direct article URL if available."],
      },
      {
        heading: "Check timing and cache",
        body:
          "Sitemaps, feeds, and public pages can take time to refresh depending on caching and the hosting setup.",
        bullets: ["Refresh the page.", "Try a private window.", "Wait for cache expiry."],
      },
    ],
    mistakes: [
      "Looking in the wrong business account's hub.",
      "Using search filters that hide the item.",
      "Expecting sitemap updates to be instant everywhere.",
    ],
    faqs: [
      {
        question: "Where is the public hub URL?",
        answer:
          "The Widget area shows the business account's public hub link.",
      },
      {
        question: "Can an article be published but hard to find?",
        answer:
          "Yes. Search filters, topic filters, or missing related links can make it harder to discover.",
      },
      {
        question: "Should every article be indexed by search engines?",
        answer:
          "Only useful public content should be indexable. Thin or unfinished content should not be pushed live.",
      },
    ],
    related: ["how-the-public-knowledge-hub-works", "how-to-review-and-publish-content-from-the-content-queue"],
  }),
  article({
    slug: "why-did-the-chatbot-refuse-deflect-or-give-a-short-answer",
    title: "Why did the chatbot refuse, deflect, or give a short answer?",
    description:
      "Understand why Convo may avoid certain topics, keep answers short, or guide visitors back to supported subjects.",
    category: "Troubleshooting",
    intent: "Explain chat boundaries in customer-facing language.",
    primaryKeyword: "chatbot refused to answer",
    secondaryKeywords: ["AI chatbot deflected", "chatbot short answer", "Convo chatbot boundaries"],
    funnelStage: "Support",
    cta: "Open Chatbot behaviour",
    public: false,
    dashboard: true,
    schema: "FAQPage",
    quickAnswer:
      "Convo may refuse, deflect, or shorten an answer when the question is outside the business's supported topics, asks for something unsafe, lacks enough context, or should be handled by a person.",
    whoThisIsFor:
      "Customers tuning the assistant and investigating unusual chat responses.",
    sections: [
      {
        heading: "Some topics are outside scope",
        body:
          "The assistant should stay focused on what the business can actually help with. Off-topic or unsupported questions may be redirected.",
        bullets: ["Check supported topics.", "Add clear source content.", "Use human follow-up for sensitive questions."],
      },
      {
        heading: "Short answers can be intentional",
        body:
          "For greetings, acknowledgements, or unclear questions, a short response can be better than a long generic answer.",
        bullets: ["Test with a complete question.", "Check the visitor's wording.", "Tune welcome and prompt copy if needed."],
      },
      {
        heading: "Review chat settings",
        body:
          "If the assistant deflects too often or answers too broadly, review the chat settings and business knowledge.",
        bullets: ["Clarify supported topics.", "Improve source content.", "Review tone and answer length settings."],
      },
    ],
    mistakes: [
      "Trying to make the assistant answer every possible question.",
      "Treating every short answer as a failure.",
      "Using company policy wording in visitor-facing settings.",
    ],
    faqs: [
      {
        question: "Should Convo answer off-topic questions?",
        answer:
          "Usually no. It should guide visitors back to the business's supported topics or a useful next step.",
      },
      {
        question: "How do I reduce unnecessary deflection?",
        answer:
          "Make supported topics clearer and improve the source content for common questions.",
      },
      {
        question: "When should a person handle the chat?",
        answer:
          "A person should handle sensitive, complex, account-specific, or high-risk requests.",
      },
    ],
    related: ["how-to-configure-chatbot-behaviour", "why-is-the-chatbot-not-using-my-website-content"],
  }),
];

const comparisonAndSeo: ResourceArticle[] = [
  article({
    slug: "how-to-use-website-chat-data-for-seo-strategy",
    title: "How to use website chat data for SEO strategy",
    description:
      "Use real visitor questions to find content gaps, improve pages, and prioritise topics that help search and conversion.",
    category: "Business owners and marketers",
    intent: "Teach the strategic use of chat data for SEO.",
    primaryKeyword: "website chat data SEO strategy",
    secondaryKeywords: ["customer questions SEO", "chatbot SEO strategy", "first-party content ideas"],
    funnelStage: "Awareness",
    cta: "Explore SEO Content Pipeline",
    public: true,
    dashboard: false,
    schema: "Article",
    quickAnswer:
      "Website chat data can improve SEO by showing the questions visitors ask while they are already evaluating the business. Those questions can guide new articles, FAQs, service page updates, and content maintenance.",
    whoThisIsFor:
      "Marketing teams, small businesses, and agencies that want a practical content backlog based on real visitor demand, not just assumptions.",
    sections: [
      {
        heading: "Find questions that block action",
        body:
          "Visitors often ask the questions that stop them from enquiring, booking, buying, or comparing options.",
        bullets: ["Price.", "Fit.", "Availability.", "Location.", "Trust."],
      },
      {
        heading: "Match questions to content actions",
        body:
          "Some questions need new content. Others need a clearer answer on an existing page.",
        bullets: ["Create new articles for broad recurring questions.", "Update service pages for conversion blockers.", "Add FAQs for quick answers."],
      },
      {
        heading: "Measure the outcome",
        body:
          "Useful SEO content should help people and move measurable outcomes such as impressions, clicks, conversations, and enquiries.",
        bullets: ["Track search performance.", "Watch chat volume on related topics.", "Compare leads before and after updates."],
      },
    ],
    mistakes: [
      "Only writing for keyword tools.",
      "Ignoring questions that happen after visitors arrive.",
      "Creating content without a next step.",
    ],
    faqs: [
      {
        question: "Is chat data enough for SEO?",
        answer:
          "No. It should be used alongside search data, analytics, and editorial judgement.",
      },
      {
        question: "What questions are most valuable?",
        answer:
          "Questions that repeat, show buying intent, or reveal missing information on important pages.",
      },
      {
        question: "Should every chat question become content?",
        answer:
          "No. Prioritise useful, repeated, and commercially relevant questions.",
      },
    ],
    related: ["how-convo-turns-website-chats-into-seo-content", "convo-vs-seo-content-tools"],
  }),
  article({
    slug: "how-to-turn-customer-questions-into-blog-posts-without-thin-content",
    title: "How to turn customer questions into blog posts without creating thin content",
    description:
      "Use customer questions as a starting point for helpful content without filling the site with repetitive AI articles.",
    category: "Business owners and marketers",
    intent: "Address quality concerns around AI-assisted content.",
    primaryKeyword: "turn customer questions into blog posts",
    secondaryKeywords: ["avoid thin AI content", "customer questions content strategy", "AI blog quality"],
    funnelStage: "Awareness",
    cta: "Review content workflow",
    public: true,
    dashboard: false,
    schema: "Article",
    quickAnswer:
      "Use customer questions as content inputs, not automatic publishing instructions. Group related questions, check existing pages, answer the intent fully, and review every draft before publishing.",
    whoThisIsFor:
      "Time-poor operators and content teams that want speed without sacrificing quality or filling the site with generic posts.",
    sections: [
      {
        heading: "Start with the intent",
        body:
          "A good article should answer the reason behind the question, not just repeat the words the visitor used.",
        bullets: ["Identify the real decision.", "Answer directly.", "Give practical next steps."],
      },
      {
        heading: "Group related questions",
        body:
          "Many small questions belong together in one stronger article or FAQ cluster.",
        bullets: ["Avoid duplicate posts.", "Use one article for one clear intent.", "Link related answers together."],
      },
      {
        heading: "Review for usefulness",
        body:
          "Before publishing, check whether the article has enough substance, context, examples, and business relevance.",
        bullets: ["Check originality.", "Check accuracy.", "Check whether the reader can act."],
      },
    ],
    mistakes: [
      "Publishing one short post per question.",
      "Ignoring existing content that should be updated.",
      "Leaving out proof, examples, or practical detail.",
    ],
    faqs: [
      {
        question: "What makes AI content thin?",
        answer:
          "Thin content usually lacks specific value, repeats other pages, or fails to answer the reader's real question.",
      },
      {
        question: "How long should an article be?",
        answer:
          "Long enough to answer the question well. The structure matters more than a fixed word count.",
      },
      {
        question: "Should I publish AI content unchanged?",
        answer:
          "No. Review, edit, and make sure it reflects the business accurately.",
      },
    ],
    related: ["is-ai-generated-website-content-safe-to-publish", "how-convo-decides-create-update-merge-or-skip-content"],
  }),
  article({
    slug: "best-ai-chatbot-for-lead-capture-and-seo-content",
    title: "Best AI chatbot for lead capture and SEO content",
    description:
      "What to look for if you want a website chatbot that captures enquiries and improves content strategy.",
    category: "Comparison and alternatives",
    intent: "Commercial investigation for buyers comparing chatbot options.",
    primaryKeyword: "best AI chatbot for lead capture",
    secondaryKeywords: ["AI chatbot for SEO content", "website chatbot for leads", "chatbot content automation"],
    funnelStage: "Consideration",
    cta: "Start free",
    public: true,
    dashboard: false,
    schema: "Article",
    quickAnswer:
      "The best AI chatbot for lead capture and SEO content should answer visitor questions, capture context-rich enquiries, reveal repeated questions, support reviewable content workflows, and avoid publishing low-quality content automatically.",
    whoThisIsFor:
      "Buyers comparing chat platforms, content tools, agency retainers, and in-house content workflows before choosing a better website growth process.",
    sections: [
      {
        heading: "Look beyond the chat bubble",
        body:
          "A chat bubble is only the visible layer. The better question is what the business gets from the conversation afterward.",
        bullets: ["Visitor answers.", "Qualified follow-up.", "Content insights.", "Performance measurement."],
      },
      {
        heading: "Check the lead capture flow",
        body:
          "Good lead capture should happen when it helps the visitor, not as an immediate interruption.",
        bullets: ["Context-aware prompts.", "Useful fields.", "Conversation history attached."],
      },
      {
        heading: "Check the content workflow",
        body:
          "A strong tool should support review, editing, publishing controls, and decisions about whether to create or update content.",
        bullets: ["Human review.", "CMS publishing.", "Update-vs-create thinking."],
      },
    ],
    mistakes: [
      "Choosing only by chatbot response style.",
      "Ignoring whether leads include useful context.",
      "Using a content generator that creates too much low-value content.",
    ],
    faqs: [
      {
        question: "Is Convo a good fit for every website?",
        answer:
          "No. It is best for websites where visitor questions reveal useful buying, support, or content demand.",
      },
      {
        question: "What is the most important feature?",
        answer:
          "The connected workflow: answer, capture, recommend content, review, publish, and measure.",
      },
      {
        question: "Should I still use analytics and keyword tools?",
        answer:
          "Yes. Convo adds first-party conversation data to the broader SEO and conversion picture.",
      },
    ],
    related: ["convo-vs-normal-live-chat-tools", "convo-vs-seo-content-tools"],
  }),
  article({
    slug: "website-chatbot-pricing-what-should-businesses-expect-to-pay",
    title: "Website chatbot pricing: what should businesses expect to pay?",
    description:
      "A practical guide to live chat, AI chat, seat-based pricing, usage pricing, and flat monthly chatbot plans.",
    category: "Comparison and alternatives",
    intent: "Educate buyers on pricing models.",
    primaryKeyword: "website chatbot pricing",
    secondaryKeywords: ["AI chatbot pricing", "live chat pricing", "chat feature pricing"],
    funnelStage: "Consideration",
    cta: "View pricing",
    public: true,
    dashboard: false,
    schema: "Article",
    quickAnswer:
      "Website chat pricing commonly ranges from free basic tools to per-seat support platforms, usage-priced AI agents, and flat monthly plans. The right model depends on whether the business needs support inboxes, lead capture, AI answers, content workflows, or all of them.",
    whoThisIsFor:
      "Business owners comparing chat tools, agency costs, in-house team costs, and the value of reducing manual content work.",
    sections: [
      {
        heading: "The common pricing models",
        body:
          "Most chat products charge by seat, by workspace, by conversation, by AI outcome, or by plan tier.",
        bullets: ["Seat-based support tools.", "Flat monthly small-business tools.", "AI usage pricing.", "Enterprise contracts."],
      },
      {
        heading: "What changes the price",
        body:
          "Pricing usually rises with team size, AI usage, automation, integrations, reporting, security, and support needs.",
        bullets: ["Number of users.", "Conversation volume.", "AI automation.", "Publishing or CRM integrations."],
      },
      {
        heading: "How to compare value",
        body:
          "Do not compare only the chat window. Compare what happens after the conversation: leads, content ideas, publishing workflow, and measurable outcomes.",
        bullets: ["Cost per useful enquiry.", "Time saved on content planning.", "Better answers for visitors.", "Reduced missed opportunities."],
      },
    ],
    mistakes: [
      "Comparing seat pricing to flat pricing without normalising usage.",
      "Ignoring AI usage charges.",
      "Buying a support inbox when the main need is lead and content insight.",
    ],
    faqs: [
      {
        question: "Is free live chat enough?",
        answer:
          "Free chat can be enough for basic messaging, but it may not include AI answers, lead context, content recommendations, or publishing workflows.",
      },
      {
        question: "Should pricing be per seat or flat monthly?",
        answer:
          "Per-seat pricing suits support teams. Flat monthly pricing is often easier for productised chat and content workflows.",
      },
      {
        question: "What should I compare before buying?",
        answer:
          "Compare answer quality, lead capture, content workflow, integrations, usage limits, and review controls.",
      },
    ],
    related: ["convo-vs-normal-live-chat-tools", "best-ai-chatbot-for-lead-capture-and-seo-content"],
  }),
  article({
    slug: "how-is-convo-different-from-a-normal-website-chatbot",
    title: "How is Convo different from a normal website chatbot?",
    description:
      "A clear category comparison for buyers wondering why Convo is more than a chat widget.",
    category: "Comparison and alternatives",
    intent: "Explain Convo's differentiation through customer outcomes.",
    primaryKeyword: "how is Convo different from a chatbot",
    secondaryKeywords: ["Convo vs chatbot", "website chatbot alternative", "chatbot for content"],
    funnelStage: "Consideration",
    cta: "Explore Product",
    public: true,
    dashboard: false,
    schema: "Article",
    quickAnswer:
      "A normal website chatbot answers or routes questions. Convo is built to help the business answer visitors, capture useful enquiries, and improve the website based on repeated questions.",
    whoThisIsFor:
      "Buyers who understand chatbots but want to know why Convo exists as a separate product category.",
    sections: [
      {
        heading: "Normal chatbots focus on the moment",
        body:
          "A standard chatbot helps the visitor in the current session. That is useful, but it often leaves the business with little long-term learning.",
        bullets: ["Answer questions.", "Route visitors.", "Reduce repeated manual replies."],
      },
      {
        heading: "Convo focuses on the loop",
        body:
          "Convo treats each useful conversation as a possible lead, content idea, or website improvement opportunity.",
        bullets: ["Answer now.", "Capture intent.", "Improve content later."],
      },
      {
        heading: "What this is not",
        body:
          "Convo is not magic content autopilot and it is not a replacement for human judgement. It gives teams better inputs and a clearer workflow.",
        bullets: ["Review still matters.", "Source knowledge still matters.", "The business controls what gets published."],
      },
    ],
    mistakes: [
      "Judging Convo only by the chat bubble.",
      "Comparing tools without looking at the post-chat workflow.",
      "Assuming automation means losing review control.",
    ],
    faqs: [
      {
        question: "Is Convo more like chat or content software?",
        answer:
          "It combines both. Chat is the source of visitor demand; the dashboard turns that demand into follow-up and content actions.",
      },
      {
        question: "Why does that matter?",
        answer:
          "Because the same questions that visitors ask in chat often reveal what the website should explain better.",
      },
      {
        question: "Can a normal chatbot do this?",
        answer:
          "Some tools have pieces of the workflow, but Convo is built around the connected chat-to-growth loop.",
      },
    ],
    related: ["convo-vs-normal-live-chat-tools", "what-is-convo"],
  }),
  article({
    slug: "how-is-convo-different-from-live-chat-and-support-inbox-tools",
    title: "How is Convo different from live chat and support inbox tools?",
    description:
      "When to use Convo instead of, or alongside, tools built mainly for support teams.",
    category: "Comparison and alternatives",
    intent: "Explain Convo versus support messaging platforms.",
    primaryKeyword: "Convo vs live chat",
    secondaryKeywords: ["Convo vs Intercom", "Convo vs Zendesk", "support inbox alternative"],
    funnelStage: "Consideration",
    cta: "Compare Product",
    public: true,
    dashboard: false,
    schema: "Article",
    quickAnswer:
      "Live chat and support inbox tools help teams manage conversations. Convo is designed to turn website questions into useful answers, qualified follow-up, and content improvements.",
    whoThisIsFor:
      "Businesses comparing Convo with customer support and messaging software.",
    sections: [
      {
        heading: "Support tools are built for teams",
        body:
          "Support inboxes are strong when multiple people need to manage tickets, replies, SLAs, and customer service operations.",
        bullets: ["Team inbox.", "Support routing.", "Ticket-style workflows."],
      },
      {
        heading: "Convo is built for website demand",
        body:
          "Convo helps with the questions people ask before they decide to enquire, buy, book, or compare options.",
        bullets: ["Visitor questions.", "Context-rich enquiries.", "Content opportunities."],
      },
      {
        heading: "Use both when it makes sense",
        body:
          "A business may still use a support inbox for existing customers while using Convo to improve the public website journey.",
        bullets: ["Support inbox for service teams.", "Convo for website visitors.", "Both for larger businesses."],
      },
    ],
    mistakes: [
      "Buying a support inbox to solve a content strategy problem.",
      "Using chat transcripts only for support reporting.",
      "Ignoring pre-sales and pre-booking visitor questions.",
    ],
    faqs: [
      {
        question: "Does Convo have a dashboard?",
        answer:
          "Yes. The dashboard helps teams review conversations, contacts, content, knowledge, widget settings, and publishing.",
      },
      {
        question: "Can Convo replace a support inbox?",
        answer:
          "Not always. If the business needs heavy support operations, a support inbox may still be useful.",
      },
      {
        question: "What is the main reason to choose Convo?",
        answer:
          "Choose Convo when website visitor questions should become leads, content, and website improvements.",
      },
    ],
    related: ["convo-vs-normal-live-chat-tools", "when-should-you-use-convo-live-chat-booking-form-or-all-three"],
  }),
  article({
    slug: "how-is-convo-different-from-booking-forms-and-lead-forms",
    title: "How is Convo different from booking forms and lead forms?",
    description:
      "Why Convo helps before a visitor is ready to book, submit a form, or request a quote.",
    category: "Comparison and alternatives",
    intent: "Compare Convo with forms and booking systems.",
    primaryKeyword: "Convo vs booking form",
    secondaryKeywords: ["chatbot vs lead form", "chat before booking", "AI booking assistant"],
    funnelStage: "Consideration",
    cta: "Explore Lead Capture",
    public: true,
    dashboard: false,
    schema: "Article",
    quickAnswer:
      "Booking forms and lead forms capture visitors who are ready to act. Convo helps visitors who still have questions, then captures details when the next step makes sense.",
    whoThisIsFor:
      "Service businesses, marketplaces, and local operators deciding whether chat belongs before a booking or enquiry form.",
    sections: [
      {
        heading: "Forms work when the visitor is ready",
        body:
          "A form is efficient when someone knows what they want and is prepared to submit details.",
        bullets: ["Book a time.", "Request a quote.", "Submit a direct enquiry."],
      },
      {
        heading: "Convo helps before that point",
        body:
          "Many visitors need help comparing options, understanding fit, checking availability, or deciding what to ask for.",
        bullets: ["Answer questions first.", "Clarify the need.", "Suggest the right next step."],
      },
      {
        heading: "What this is not",
        body:
          "Convo does not need to replace a booking system. It can sit before one, helping more visitors reach the point where booking makes sense.",
        bullets: ["Use forms for direct action.", "Use Convo for questions and qualification.", "Use both for a smoother journey."],
      },
      {
        heading: "How Convo can work with booking tools",
        body:
          "A website can keep its existing booking call to action while using Convo to help visitors who are not ready to book yet. Where supported, Convo can also guide visitors to a booking page or show an approved booking experience inside the chat.",
        bullets: [
          "Keep a separate Book now button or tab for ready visitors.",
          "Route qualified visitors to the right booking or enquiry page.",
          "Use supported calendar or appointment embeds when the booking provider allows it.",
        ],
      },
    ],
    mistakes: [
      "Assuming every visitor is ready to book.",
      "Forcing questions into a static form.",
      "Losing context before the business follows up.",
    ],
    faqs: [
      {
        question: "Should I remove my booking form?",
        answer:
          "Usually no. Convo can help visitors before they reach the booking form.",
      },
      {
        question: "When is chat better than a form?",
        answer:
          "Chat is better when the visitor has questions, needs guidance, or is not sure what option fits.",
      },
      {
        question: "Can Convo send people to a booking page?",
        answer:
          "Yes. The assistant can guide visitors toward the appropriate next step where configured.",
      },
      {
        question: "Can Convo work with my existing booking system?",
        answer:
          "Yes. Convo can work alongside an existing booking form or booking page. For supported booking providers, a calendar or appointment experience can also be embedded into the chat flow.",
      },
    ],
    related: ["convo-vs-booking-systems-when-do-you-need-chat-before-a-booking", "how-convo-captures-leads-inside-chat"],
  }),
  article({
    slug: "convo-vs-booking-systems-when-do-you-need-chat-before-a-booking",
    title: "Convo vs booking systems: when do you need chat before a booking?",
    description:
      "Use chat before booking when visitors need answers about fit, price, timing, trust, or available options.",
    category: "Comparison and alternatives",
    intent: "Help buyers decide where Convo fits around booking systems.",
    primaryKeyword: "chat before booking system",
    secondaryKeywords: ["booking system vs chatbot", "pre booking chat", "AI booking assistant"],
    funnelStage: "Consideration",
    cta: "Explore Lead Capture",
    public: true,
    dashboard: false,
    schema: "Article",
    quickAnswer:
      "You need chat before a booking when visitors are not ready to pick a time or submit a form because they still need help understanding fit, cost, availability, location, or trust.",
    whoThisIsFor:
      "Businesses with bookings, quotes, appointments, listings, or marketplaces where visitors need guidance first.",
    sections: [
      {
        heading: "Booking works for high-intent visitors",
        body:
          "If someone already knows what they need, a booking form is the fastest path.",
        bullets: ["Known service.", "Known location.", "Clear availability.", "Ready to act."],
      },
      {
        heading: "Chat works for uncertain visitors",
        body:
          "If the visitor needs advice, comparison, or explanation, chat can reduce friction before the booking step.",
        bullets: ["Which option fits me?", "How much should I expect?", "Do you serve my area?", "What happens next?"],
      },
      {
        heading: "Together they cover more intent",
        body:
          "Convo can help earlier-stage visitors while the booking system handles people who are already ready.",
        bullets: [
          "Answer first.",
          "Qualify the need.",
          "Send the visitor to the right booking, embedded calendar, or follow-up path.",
        ],
      },
      {
        heading: "Keep the booking action visible",
        body:
          "Convo does not need to hide or replace the website's booking call to action. Ready visitors can still use a Book now button, while unsure visitors can use chat to get to the right next step.",
        bullets: [
          "Keep direct booking visible for high-intent visitors.",
          "Use chat for suitability, pricing, availability, and trust questions.",
          "Embed approved booking tools in chat where the provider supports it.",
        ],
      },
    ],
    mistakes: [
      "Making uncertain visitors choose from a rigid booking menu.",
      "Hiding important price or fit information behind a form.",
      "Sending unqualified enquiries straight to a booking calendar.",
    ],
    faqs: [
      {
        question: "What types of businesses need chat before booking?",
        answer:
          "Services, marketplaces, clinics, agencies, local operators, and complex products often benefit from chat before booking.",
      },
      {
        question: "Will chat reduce bookings?",
        answer:
          "It should help visitors who would otherwise leave or submit poor-fit enquiries. The right flow can still send ready visitors to book.",
      },
      {
        question: "Can Convo qualify visitors before booking?",
        answer:
          "Yes. It can ask practical questions and guide visitors toward the next suitable action.",
      },
      {
        question: "Can a calendar be embedded in the chat?",
        answer:
          "Where a supported booking provider allows it, Convo can show a calendar or appointment experience in the chat so the visitor can move from questions to booking without losing context.",
      },
    ],
    related: ["how-is-convo-different-from-booking-forms-and-lead-forms", "when-should-you-use-convo-live-chat-booking-form-or-all-three"],
  }),
  article({
    slug: "when-should-you-use-convo-live-chat-booking-form-or-all-three",
    title: "When should you use Convo, live chat, a booking form, or all three?",
    description:
      "A decision guide for choosing the right mix of chat, human support, and booking or lead forms.",
    category: "Comparison and alternatives",
    intent: "Help buyers choose tools without overclaiming.",
    primaryKeyword: "Convo live chat booking form",
    secondaryKeywords: ["chatbot vs live chat vs booking form", "website conversion tools", "lead capture options"],
    funnelStage: "Consideration",
    cta: "Start free",
    public: true,
    dashboard: false,
    schema: "Article",
    quickAnswer:
      "Use Convo when visitors need answers before action, live chat when a human support team must respond directly, booking forms when visitors are ready to schedule, and all three when the website serves multiple levels of intent.",
    whoThisIsFor:
      "Business owners choosing the right conversion and support stack for their website.",
    sections: [
      {
        heading: "Use Convo for question-led demand",
        body:
          "Convo is strongest when visitors ask questions that reveal intent, confusion, objections, or missing content.",
        bullets: ["Pre-sales questions.", "Marketplace matching.", "Service fit.", "Content gaps."],
      },
      {
        heading: "Use live chat for human response operations",
        body:
          "Live chat is strongest when people need a real support team to answer, route, and resolve conversations in an inbox.",
        bullets: ["Existing customer support.", "Team handoff.", "Service requests."],
      },
      {
        heading: "Use booking and lead forms for direct action",
        body:
          "Forms work best when the visitor already understands the offer and is ready to give details or pick a time.",
        bullets: ["Book now.", "Request quote.", "Contact sales.", "Join waitlist."],
      },
      {
        heading: "Use them together when the journey has two speeds",
        body:
          "Some visitors are ready to book immediately. Others need answers first. In that case, keep the booking call to action visible and use Convo to help visitors who need guidance before they act.",
        bullets: [
          "Send ready visitors straight to booking.",
          "Use Convo for questions, qualification, and context.",
          "Embed supported booking providers in chat where it improves the flow.",
        ],
      },
    ],
    mistakes: [
      "Using a booking form for visitors who still need guidance.",
      "Using live chat when the team cannot reply quickly.",
      "Using chat without a clear next step.",
    ],
    faqs: [
      {
        question: "Can Convo sit before a booking form?",
        answer:
          "Yes. It can answer questions and route ready visitors toward booking, while the website still keeps its normal booking button or form.",
      },
      {
        question: "Can Convo and a booking form both be on the same website?",
        answer:
          "Yes. Many websites should use both: a direct booking action for ready visitors and Convo for people who still need help choosing, qualifying, or understanding the next step.",
      },
      {
        question: "Can Convo replace live chat?",
        answer:
          "Sometimes, for basic website questions. Larger support teams may still need a live chat inbox.",
      },
      {
        question: "What is the best starting point?",
        answer:
          "Start with Convo on high-question pages, keep existing forms, and review the conversations to see where visitors need help.",
      },
    ],
    related: ["how-is-convo-different-from-booking-forms-and-lead-forms", "how-is-convo-different-from-live-chat-and-support-inbox-tools"],
  }),
];

export const resourceArticles: ResourceArticle[] = [
  ...publicEducation,
  ...dashboardHelp,
  ...troubleshooting,
  ...comparisonAndSeo,
];

export const publicResourceArticles = resourceArticles.filter((article) => article.public);
export const dashboardHelpArticles = resourceArticles.filter((article) => article.dashboard);

export function getResourceArticle(slug: string): ResourceArticle | undefined {
  return resourceArticles.find((article) => article.slug === slug);
}

export function getPublicResourceArticle(slug: string): ResourceArticle | undefined {
  return publicResourceArticles.find((article) => article.slug === slug);
}

export function getDashboardHelpArticle(slug: string): ResourceArticle | undefined {
  return dashboardHelpArticles.find((article) => article.slug === slug);
}

export function getArticlesByCategory(articles: ResourceArticle[]) {
  return articles.reduce<Record<ResourceAudience, ResourceArticle[]>>(
    (groups, article) => {
      groups[article.category] = [...(groups[article.category] ?? []), article];
      return groups;
    },
    {
      "Public website visitors": [],
      "Business owners and marketers": [],
      "Customer dashboard users": [],
      Troubleshooting: [],
      "Comparison and alternatives": [],
    }
  );
}
