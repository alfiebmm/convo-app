export const featurePages = {
  aiChatbot: {
    title: "A website chat assistant that knows your business.",
    description:
      "Branded AI chat that answers questions, captures intent, and turns repeated demand into leads, content, and page improvements.",
    positioning:
      "Not just deflection. Every chat becomes a growth signal.",
    sections: [
      {
        title: "Answer",
        points: [
          "Branded website assistant.",
          "Grounded in your pages and files.",
          "Useful replies before asking for details.",
        ],
      },
      {
        title: "Capture",
        points: [
          "Detects topic, intent, and timing.",
          "Triggers the right CTA in-chat.",
          "Saves lead context with the enquiry.",
        ],
      },
      {
        title: "Improve",
        points: [
          "Finds repeated questions.",
          "Feeds SEO and FAQ ideas.",
          "Connects chat to measurable content outcomes.",
        ],
      },
    ],
    differentiators: [
      "Most chatbots optimise for deflection or form fills. Convo connects the answer, the lead signal, and the future content opportunity in one workflow.",
      "Responses are grounded in the customer's own pages and documents, so the assistant can stay specific to the business instead of drifting into generic AI advice.",
      "Every conversation can become a reusable signal for sales, support, SEO, and website improvement.",
    ],
    outcomes: [
      "Visitors get a faster answer without hunting through the site.",
      "Sales teams receive leads with the actual conversation context attached.",
      "Marketing teams see the exact questions that deserve better content.",
    ],
    conversion: {
      title: "Useful answers first, lead capture second.",
      description:
        "The assistant earns trust by helping before asking. That makes the lead prompt feel like a natural next step rather than an interruption.",
      points: [
        "Answer the buying question in the chat.",
        "Detect intent from the visitor's own words.",
        "Trigger the right CTA only when it fits the conversation.",
      ],
    },
    competitorComparison: {
      title: "How Convo stacks up.",
      description:
        "A cleaner view of the core difference: support bots focus on resolving or routing chats. Convo uses chat as the start of the lead, content, and SEO loop.",
      rows: [
        {
          capability: "AI website chat",
          convo: true,
          intercom: true,
          zendesk: true,
          tidio: true,
          drift: true,
        },
        {
          capability: "Entry-level access",
          convo: "Included",
          intercom: "$0.99/resolution + seats",
          zendesk: "Suite/add-ons",
          tidio: "Free + quotas",
          drift: "Sales-led",
        },
        {
          capability: "Lead intent capture",
          convo: true,
          intercom: true,
          zendesk: true,
          tidio: true,
          drift: true,
        },
        {
          capability: "Branded widget examples",
          convo: true,
          intercom: true,
          zendesk: true,
          tidio: true,
          drift: true,
        },
        {
          capability: "Turns chats into SEO briefs",
          convo: true,
          intercom: false,
          zendesk: false,
          tidio: false,
          drift: false,
        },
        {
          capability: "FAQ/page update queue",
          convo: true,
          intercom: false,
          zendesk: false,
          tidio: false,
          drift: false,
        },
        {
          capability: "CMS publishing workflow",
          convo: true,
          intercom: false,
          zendesk: false,
          tidio: false,
          drift: false,
        },
        {
          capability: "SEO performance tracking",
          convo: true,
          intercom: false,
          zendesk: false,
          tidio: false,
          drift: false,
        },
      ],
    },
    brandedExamples: {
      title: "Make it look like your brand.",
      description:
        "A chat widget should feel native to the site. The important bit is what happens after the answer: intent, CTA, lead, and content signal.",
      examples: [
        {
          brand: "Doggo",
          theme: "Puppy marketplace",
          accentClass: "bg-orange-500",
          header: "Doggo puppy assistant",
          prompt:
            "I'm looking for a Cavoodle puppy near Brisbane. Are there breeders with litters available soon?",
          reply:
            "Yes. I can show nearby Cavoodle breeders, compare waitlists, and send you a checklist of questions to ask before you enquire.",
          cta: "Send breeder matches",
          signal:
            "Breed + location + availability intent captured for follow-up and content ideas.",
        },
        {
          brand: "AgPages",
          theme: "Agribusiness directory",
          accentClass: "bg-emerald-700",
          header: "AgPages supplier assistant",
          prompt:
            "I need contractors who can help with fencing and water infrastructure near Wagga. Who should I compare?",
          reply:
            "I can shortlist relevant rural contractors, show the service areas, and send a guide on what to check before requesting quotes.",
          cta: "Send supplier shortlist",
          signal:
            "Service + region + project need captured for lead routing and new directory content.",
        },
      ],
    },
  },
  leadCapture: {
    title: "Capture leads when the conversation is ready.",
    description:
      "Use subtle, configurable in-chat CTAs so businesses can collect lead details after visitors have received value.",
    positioning:
      "Convo captures leads at the moment of useful intent: after the visitor has asked enough for the business to understand what they need and how valuable the enquiry is.",
    sections: [
      {
        title: "Timing rules",
        points: [
          "Ask after a set number of messages.",
          "Ask after buying intent or qualifying questions.",
          "Limit lead capture to selected pages, topics, or use cases.",
        ],
      },
      {
        title: "Customisation",
        points: [
          "Control CTA wording, tone, fields, and confirmation copy.",
          "Match the prompt to the business brand instead of using a generic pop-up.",
          "Preserve conversation context so the lead is useful to sales or support.",
        ],
      },
      {
        title: "Routing",
        points: [
          "Store leads in Convo for review.",
          "Notify the business when a high-intent lead arrives.",
          "Connect to CRM, CMS, webhook, or lead workflows where supported.",
        ],
      },
    ],
    differentiators: [
      "The CTA can be based on message count, topic, page, qualifying answers, or intent rather than a blunt site-wide pop-up.",
      "Lead records include the conversation, so the follow-up starts with context instead of a cold form submission.",
      "The same signal that identifies a lead also helps Convo understand which content or FAQ gaps are creating demand.",
    ],
    outcomes: [
      "More useful enquiries with less pressure on first-page visitors.",
      "Cleaner handoff to sales, support, or marketplace operators.",
      "Better understanding of which questions convert into real opportunities.",
    ],
    conversion: {
      title: "Lead capture that feels like service.",
      description:
        "Instead of forcing a form before the visitor is ready, Convo asks when it can offer something specific: a quote, matched options, guide, callback, availability check, or saved recommendation.",
      points: [
        "Match CTA copy to the conversation.",
        "Ask only for fields the business can use.",
        "Keep the visitor's need attached to the lead.",
      ],
    },
    visualExample: {
      type: "lead-flow",
      title: "From chat to CRM without losing context.",
      description:
        "Show the path clearly: visitor question, identified lead, then routing into the tools the business already uses.",
    },
  },
  seoPipeline: {
    title: "Fully SEO-optimised content from real demand.",
    description:
      "Turn conversations into content recommendations that combine visitor language with keyword and performance data.",
    positioning:
      "Convo starts content strategy from first-party demand. It uses the words real visitors typed into the website, then checks SEO opportunity and existing coverage before recommending what to create or update.",
    sections: [
      {
        title: "Extraction",
        points: [
          "Identify topic, search intent, audience, confidence, and repeated phrasing.",
          "Enrich topics with Google Search Console query data where connected.",
          "Use Ahrefs-style keyword and competitor inputs where connected or imported.",
          "Group related conversations so one strong output can cover the pattern.",
          "Prioritise by frequency, commercial intent, keyword opportunity, and page performance.",
        ],
      },
      {
        title: "Decisioning",
        points: [
          "Check if the site already covers the answer.",
          "Recommend create, update, merge, or no action.",
          "Use impressions, clicks, CTR, ranking movement, and lead data to decide whether updates are working.",
          "Avoid creating thin duplicate content when an update is better.",
        ],
      },
      {
        title: "Review output",
        points: [
          "Generate title, slug, meta description, article body, FAQ answer, target keywords, and internal-link suggestions.",
          "Include a reviewable SEO score and optimisation checklist.",
          "Show the source conversations behind the recommendation.",
          "Keep human approval as the default before publishing.",
        ],
      },
    ],
    differentiators: [
      "The content queue is sourced from live visitor questions, not only keyword tools or a blank AI prompt.",
      "Convo can recommend create, update, merge, or skip, which helps avoid bloated content libraries and duplicate articles.",
      "Search Console, analytics, and keyword inputs can be used alongside chat data, giving the team both demand signal and performance signal.",
    ],
    outcomes: [
      "A clearer content backlog tied to real customer questions.",
      "More specific briefs because the source conversation is visible.",
      "Content decisions that connect SEO opportunity with commercial intent.",
    ],
    conversion: {
      title: "Content that answers the questions buyers already asked.",
      description:
        "The strongest pages often come from recurring buying questions: price, suitability, location, timing, trust, comparisons, and next steps.",
      points: [
        "Create new pages when demand is not covered.",
        "Update existing pages when the answer is weak.",
        "Track whether the published work increases conversations and leads.",
      ],
    },
    visualExample: {
      type: "content-pipeline",
      title: "A simple queue: new, edit, publish.",
      description:
        "Make the pipeline obvious: Convo decides whether to create something new, improve an existing page, or publish an approved draft.",
    },
  },
  analytics: {
    title: "Know what your content changed.",
    description:
      "Track the impact of new and updated content using search, analytics, keyword, conversation, and lead data.",
    positioning:
      "Convo treats measurement as part of the product loop. The question is not just whether content was published, but whether it changed search visibility, visitor behaviour, conversations, and leads.",
    sections: [
      {
        title: "SEO data inputs",
        points: [
          "Use Google Search Console queries, impressions, clicks, CTR, and average position where connected.",
          "Use GA4 traffic and conversion behaviour where connected.",
          "Use Ahrefs-style keyword, ranking, difficulty, and competitor data where connected or imported.",
        ],
      },
      {
        title: "Performance tracking",
        points: [
          "Track new and updated content URLs after publishing.",
          "Show before/after movement for impressions, clicks, positions, conversations, and leads.",
          "Identify pages with impressions but weak CTR or pages with traffic but repeated unanswered questions.",
        ],
      },
      {
        title: "Product value",
        points: [
          "Demonstrate tangible results from content work inside the product.",
          "Show what shipped, what moved, and what should be improved next.",
          "Feed performance learnings back into future content recommendations.",
        ],
      },
    ],
    differentiators: [
      "Performance is connected back to the content recommendation that created the page or update.",
      "Convo looks beyond rankings by also tracking conversations and lead signals tied to the same content area.",
      "The workflow can surface pages with traffic but repeated unanswered questions, which is where conversion and content work overlap.",
    ],
    outcomes: [
      "Teams can see which content changes actually moved.",
      "Underperforming pages become the next improvement queue.",
      "Stakeholders get a clearer link between SEO work and commercial outcomes.",
    ],
    conversion: {
      title: "Measure what matters after publishing.",
      description:
        "A page that gets impressions but creates confused chats still needs work. Convo helps connect search performance with the questions visitors ask once they arrive.",
      points: [
        "Track impressions, clicks, CTR, and position.",
        "Track chat starts and lead capture from related pages.",
        "Feed weak signals back into the next recommendation.",
      ],
    },
    visualExample: {
      type: "analytics-card",
      title: "Performance tied to the article, not buried in reports.",
      description:
        "Show a posted article and the SEO metrics that matter beside it: clicks, views, ranking movement, and leads.",
    },
  },
  contentMaintenance: {
    title: "Keep website answers consistent.",
    description:
      "Use conversation data to audit FAQs, service pages, and old templates that have drifted over time.",
    positioning:
      "Convo helps websites stay accurate after launch. When visitors keep asking questions a page should already answer, that becomes a maintenance signal rather than another lost chat.",
    sections: [
      {
        title: "Audit",
        points: [
          "Find content gaps from repeated visitor questions.",
          "Identify stale, duplicated, or incomplete FAQ answers.",
          "Spot pages that no longer match the desired structure.",
        ],
      },
      {
        title: "Template alignment",
        points: [
          "Map pages to the approved business template.",
          "Prepare bulk rewrite recommendations for inconsistent pages.",
          "Keep wording and structure consistent across product or service pages.",
        ],
      },
      {
        title: "Approval",
        points: [
          "Show current content, suggested change, and reason.",
          "Let humans approve, edit, reject, or archive each recommendation.",
          "Publish only after review unless auto-update is explicitly enabled.",
        ],
      },
    ],
    differentiators: [
      "Maintenance recommendations come from real confusion, not just a scheduled content audit.",
      "Convo can identify whether the better action is a small FAQ change, a page update, a template fix, or no change.",
      "The review workflow keeps humans in control while making stale content easier to find.",
    ],
    outcomes: [
      "Fewer repeated support and pre-sales questions.",
      "More consistent product, service, and FAQ pages.",
      "A website that improves as customer language changes.",
    ],
    conversion: {
      title: "Close the gap between what pages say and what visitors need.",
      description:
        "When the same objection or confusion keeps showing up in chat, Convo turns it into a practical page improvement.",
      points: [
        "Find answers that are missing or buried.",
        "Rewrite weak sections with clearer language.",
        "Review and publish updates through the same workflow.",
      ],
    },
  },
  cmsPublishing: {
    title: "Publish where your website already lives.",
    description:
      "Move approved content into the customer's real CMS workflow after review.",
    positioning:
      "Convo is designed to get reviewed content out of the dashboard and into the website. The publishing layer keeps the content workflow practical for teams already using WordPress, Shopify, Webflow, or a custom CMS.",
    sections: [
      {
        title: "Supported adapters",
        points: [
          "WordPress REST API.",
          "Shopify Blog API.",
          "Webflow CMS API.",
        ],
      },
      {
        title: "Workflow",
        points: [
          "Generate draft content from conversations.",
          "Review and approve the output.",
          "Publish and store the live URL.",
        ],
      },
      {
        title: "Controls",
        points: [
          "Manual review by default.",
          "Auto-publish only when explicitly configured.",
          "Clear publishing status helps teams keep content moving.",
        ],
      },
    ],
    differentiators: [
      "Publishing is attached to the recommendation, approval, and performance workflow instead of being a disconnected export step.",
      "Manual review is the default, which keeps teams in control of brand, accuracy, and compliance.",
      "The live URL can be stored and measured after publishing, closing the loop from conversation to result.",
    ],
    outcomes: [
      "Less copy-paste between AI tools, docs, and CMS admin screens.",
      "Clearer ownership of what is drafted, approved, published, and measured.",
      "A path from visitor question to live website improvement.",
    ],
    conversion: {
      title: "A cleaner path from approved draft to live page.",
      description:
        "The value of AI content is limited if it gets stuck in a document. Convo keeps the publishing step inside the same reviewed workflow.",
      points: [
        "Generate the draft from source conversations.",
        "Approve or edit before anything goes live.",
        "Publish and keep the live URL connected to reporting.",
      ],
    },
  },
  knowledgeBase: {
    title: "Answers grounded in your actual business.",
    description:
      "Give the chatbot reliable source material from website pages and uploaded documents.",
    positioning:
      "Convo's chat experience is only useful if it knows the business. The knowledge base gives the assistant source material, boundaries, and freshness checks so answers stay specific and trustworthy.",
    sections: [
      {
        title: "Sources",
        points: [
          "Crawl site pages and sitemaps.",
          "Ingest uploaded PDF, DOCX, and TXT files.",
          "Track sync state so admins understand freshness.",
        ],
      },
      {
        title: "Retrieval",
        points: [
          "Chunk and embed content for search.",
          "Retrieve relevant snippets during chat.",
          "Avoid confident answers when knowledge is missing.",
        ],
      },
      {
        title: "Admin controls",
        points: [
          "Resync the website.",
          "Upload or remove files.",
          "Review what knowledge the bot can use.",
        ],
      },
    ],
    differentiators: [
      "The same knowledge that powers chat can reveal gaps when visitors ask questions the source material cannot answer.",
      "Admins can use crawled pages and uploaded files together, which is useful for products, services, policies, guides, and sales collateral.",
      "Freshness and sync state make the system easier to trust and maintain over time.",
    ],
    outcomes: [
      "More accurate answers with less manual prompt tuning.",
      "Clearer guardrails around what the assistant should and should not answer.",
      "A stronger foundation for lead capture, content recommendations, and page updates.",
    ],
    conversion: {
      title: "Grounded answers create better next steps.",
      description:
        "When the assistant can answer from real business material, it can guide visitors toward useful actions with more confidence.",
      points: [
        "Use site pages and uploaded documents as source material.",
        "Retrieve relevant snippets during the conversation.",
        "Flag missing answers as content or knowledge gaps.",
      ],
    },
  },
} as const;
